//! Paddle Billing checkout, customer portal, and webhook handlers.

use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Utc};
use hmac::{Hmac, KeyInit, Mac};
use serde::Deserialize;
use serde_json::Value;
use sha2::Sha256;
use std::time::Duration;
use subtle::ConstantTimeEq;
use tracing::{debug, error, warn};
use uuid::Uuid;

use crate::audit::{record_event, AuditEvent};
use crate::config::BillingConfig;
use crate::db::{BillingCheckoutResponse, BillingPortalResponse};
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::state::AppState;
use crate::subscription::SubscriptionStatus;

type HmacSha256 = Hmac<Sha256>;

/// Maximum allowed clock skew for webhook timestamps (5 minutes).
const WEBHOOK_MAX_SKEW_SECS: i64 = 300;

/// Default hosted plan when a single Paddle price is configured.
const HOSTED_PLAN: &str = "pro";

/// Plan assigned when no active Paddle subscription remains.
const FREE_PLAN: &str = "free";

/// HTTP timeout for Paddle Billing API calls.
const PADDLE_HTTP_TIMEOUT_SECS: u64 = 10;

/// Return Paddle.js checkout overlay settings for the authenticated user.
#[utoipa::path(
    post,
    path = "/api/billing/checkout",
    tag = "Billing",
    responses(
        (status = 200, description = "Checkout overlay settings", body = BillingCheckoutResponse),
        (status = 400, description = "Account has no email for checkout", body = ApiError),
        (status = 401, description = "Not authenticated", body = ApiError),
        (
            status = 404,
            description = "Billing not configured. The route is not mounted, so the server's generic JSON 404 is returned; the handler's own 404 (`Billing is not enabled on this server`) is a defensive path that is not reachable in production.",
            body = ApiError
        ),
    ),
    security(("cookieAuth" = []))
)]
pub async fn checkout(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
) -> Result<Json<BillingCheckoutResponse>, ApiError> {
    let billing = billing_config(&state)?;
    let email = user
        .email
        .ok_or_else(|| ApiError::new("Account email is required before starting checkout"))?;

    Ok(Json(BillingCheckoutResponse {
        client_token: billing.client_token.clone(),
        price_id: billing.price_id.clone(),
        email,
        custom_data: signed_custom_data(&billing.webhook_secret, user.id),
        environment: if billing.sandbox {
            "sandbox".to_string()
        } else {
            "production".to_string()
        },
    }))
}

/// Return an authenticated Paddle customer portal URL for the signed-in user.
#[utoipa::path(
    get,
    path = "/api/billing/portal",
    tag = "Billing",
    responses(
        (status = 200, description = "Customer portal URL", body = BillingPortalResponse),
        (status = 401, description = "Not authenticated", body = ApiError),
        (
            status = 404,
            description = "Billing not configured. The route is not mounted, so the server's generic JSON 404 is returned; the handler's own 404 is a defensive path that is not reachable in production.",
            body = ApiError
        ),
        (status = 409, description = "No Paddle customer linked yet", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn customer_portal(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
) -> Result<Json<BillingPortalResponse>, ApiError> {
    let billing = billing_config(&state)?;
    let customer_id = user.paddle_customer_id.ok_or_else(|| {
        ApiError::conflict("No billing account linked yet — complete checkout first")
    })?;

    let url = create_portal_session(billing, &customer_id).await?;
    Ok(Json(BillingPortalResponse { url }))
}

/// Handle signed Paddle Billing webhook events.
///
/// Registered only when billing is configured. Every delivery must carry a
/// valid `Paddle-Signature` header; replayed event ids are acknowledged with
/// 200 and skipped.
#[utoipa::path(
    post,
    path = "/webhooks/paddle",
    tag = "Billing",
    request_body(
        content = serde_json::Value,
        description = "Paddle notification payload (event_id, event_type, occurred_at, data)"
    ),
    params(
        ("Paddle-Signature" = String, Header, description = "`ts=<unix>;h1=<hmac-sha256 hex>` over `ts:body`")
    ),
    responses(
        (status = 200, description = "Event processed or already processed"),
        (status = 400, description = "Malformed payload, missing event_id, or event could not be applied", body = ApiError),
        (status = 401, description = "Missing or invalid signature, or stale timestamp", body = ApiError),
        (
            status = 404,
            description = "Billing not configured. The route is not mounted, so the server's generic JSON 404 is returned (`/webhooks/*` is a reserved path and is never served by the SPA fallback).",
            body = ApiError
        ),
        (status = 409, description = "Paddle customer already linked to a different account", body = ApiError),
        (status = 500, description = "Event applied but could not be marked processed; Paddle should retry", body = ApiError),
    )
)]
pub async fn paddle_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, ApiError> {
    let billing = billing_config(&state)?;
    let cloud = state.cloud()?;

    let signature = headers
        .get("Paddle-Signature")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| ApiError::unauthorized("Missing Paddle-Signature header"))?;

    verify_webhook_signature(signature, &body, &billing.webhook_secret)?;

    let payload: PaddleWebhook = serde_json::from_slice(&body).map_err(|err| {
        warn!("paddle webhook JSON parse failed: {err}");
        ApiError::new("Invalid webhook payload")
    })?;

    // Every Paddle notification carries an event_id; without one there is no
    // replay protection, so a signed but id-less payload is rejected rather
    // than applied unguarded.
    let event_id = payload
        .event_id
        .as_deref()
        .ok_or_else(|| ApiError::new("Missing Paddle event_id"))?;

    // Replay protection: an event is skipped only once it has been fully
    // applied (processed_at set). A retry of a delivery that failed midway
    // finds an unprocessed row and is handled again; the handlers are
    // idempotent and ordering-guarded, so a concurrent duplicate is harmless.
    if claim_webhook_event(&cloud.db, event_id).await? == WebhookClaim::AlreadyProcessed {
        debug!(event_id, "skipping already-processed Paddle webhook event");
        return Ok(StatusCode::OK);
    }

    dispatch_webhook_event(&cloud.db, billing, &payload).await?;

    // If this fails the event stays unprocessed and the 500 makes Paddle
    // retry; re-applying is safe.
    mark_webhook_event_processed(&cloud.db, event_id).await?;

    record_event(
        &cloud.db,
        AuditEvent {
            event_type: "billing.webhook.received",
            actor_user_id: verified_custom_user_id(&billing.webhook_secret, &payload.data),
            resource_type: Some("billing"),
            resource_id: None,
            metadata: serde_json::json!({
                "event_type": payload.event_type,
                "event_id": payload.event_id,
            }),
            ip_address: None,
        },
    )
    .await;

    Ok(StatusCode::OK)
}

async fn dispatch_webhook_event(
    pool: &sqlx::PgPool,
    billing: &BillingConfig,
    payload: &PaddleWebhook,
) -> Result<(), ApiError> {
    let occurred_at = payload.occurred_at.as_deref().and_then(parse_rfc3339);
    let secret = billing.webhook_secret.as_str();

    match payload.event_type.as_str() {
        // Paddle emits a dedicated event per lifecycle transition. Whether or
        // not a `subscription.updated` accompanies it, every one of these
        // carries the full subscription entity, so they all go through the
        // same status-driven upsert.
        "subscription.created"
        | "subscription.updated"
        | "subscription.activated"
        | "subscription.trialing"
        | "subscription.past_due"
        | "subscription.paused"
        | "subscription.resumed" => {
            let status = payload.data.get("status").and_then(Value::as_str);
            if status == Some(SubscriptionStatus::Canceled.as_str()) {
                handle_subscription_canceled(pool, secret, &payload.data, occurred_at).await?;
            } else {
                handle_subscription_upsert(pool, secret, &payload.data, occurred_at).await?;
            }
        }
        "subscription.canceled" => {
            handle_subscription_canceled(pool, secret, &payload.data, occurred_at).await?;
        }
        "customer.created" => {
            handle_customer_created(pool, secret, &payload.data).await?;
        }
        other => {
            debug!(
                event_type = other,
                "ignoring unhandled Paddle webhook event"
            );
        }
    }

    Ok(())
}

/// Result of registering a webhook delivery for processing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WebhookClaim {
    /// First delivery, or a retry of one that never finished: handle it.
    Claimed,
    /// This event was already applied in full.
    AlreadyProcessed,
}

/// Register a delivery of `event_id`. Rows without `processed_at` (a failed
/// or in-flight attempt) are re-claimed so Paddle's retry is not mistaken
/// for a replay.
async fn claim_webhook_event(
    pool: &sqlx::PgPool,
    event_id: &str,
) -> Result<WebhookClaim, ApiError> {
    let claimed: Option<String> = sqlx::query_scalar(
        r#"
        INSERT INTO billing_webhook_events (event_id)
        VALUES ($1)
        ON CONFLICT (event_id) DO UPDATE SET received_at = now()
        WHERE billing_webhook_events.processed_at IS NULL
        RETURNING event_id
        "#,
    )
    .bind(event_id)
    .fetch_optional(pool)
    .await
    .map_err(internal_db_error)?;

    Ok(if claimed.is_some() {
        WebhookClaim::Claimed
    } else {
        WebhookClaim::AlreadyProcessed
    })
}

/// Record that `event_id` was applied in full. Only then do later deliveries
/// of the same event get skipped.
async fn mark_webhook_event_processed(pool: &sqlx::PgPool, event_id: &str) -> Result<(), ApiError> {
    sqlx::query("UPDATE billing_webhook_events SET processed_at = now() WHERE event_id = $1")
        .bind(event_id)
        .execute(pool)
        .await
        .map_err(|err| {
            error!(event_id, "failed to mark webhook event processed: {err}");
            ApiError::internal("failed to record webhook processing")
        })?;
    Ok(())
}

/// Key derivation for the checkout `custom_data` signature: the webhook
/// secret already binds us to Paddle; a domain prefix keeps the two uses of
/// that secret from ever producing interchangeable MACs.
const CHECKOUT_SIGNATURE_DOMAIN: &str = "rustume-checkout-v1:";

/// Sign a user id for inclusion in checkout `custom_data`.
///
/// The overlay is opened by the browser, so anything in `custom_data` can be
/// tampered with before Paddle sees it. Carrying an HMAC over the user id
/// (keyed by a server-only secret) means a webhook's `custom_data.user_id`
/// is trusted only if it was minted by our own `/api/billing/checkout` for
/// that very user.
fn sign_checkout_user_id(secret: &str, user_id: Uuid) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key");
    mac.update(CHECKOUT_SIGNATURE_DOMAIN.as_bytes());
    mac.update(user_id.as_bytes());
    bytes_to_hex(&mac.finalize().into_bytes())
}

fn signed_custom_data(secret: &str, user_id: Uuid) -> Value {
    serde_json::json!({
        "user_id": user_id.to_string(),
        "sig": sign_checkout_user_id(secret, user_id),
    })
}

/// Return `custom_data.user_id` only when its signature verifies.
fn verified_custom_user_id(secret: &str, data: &Value) -> Option<Uuid> {
    let custom = data.get("custom_data")?;
    let user_id = custom
        .get("user_id")
        .and_then(Value::as_str)
        .and_then(|value| Uuid::parse_str(value).ok())?;
    let sig = custom.get("sig").and_then(Value::as_str)?;
    let expected = sign_checkout_user_id(secret, user_id);
    if constant_time_eq(&sig.to_ascii_lowercase(), &expected) {
        Some(user_id)
    } else {
        warn!(%user_id, "rejecting Paddle custom_data.user_id with invalid signature");
        None
    }
}

fn billing_config(state: &AppState) -> Result<&BillingConfig, ApiError> {
    state
        .billing
        .as_ref()
        .ok_or_else(|| ApiError::not_found("Billing is not enabled on this server"))
}

async fn create_portal_session(
    billing: &BillingConfig,
    customer_id: &str,
) -> Result<String, ApiError> {
    let url = format!(
        "{}/customers/{customer_id}/portal-sessions",
        billing.api_base.trim_end_matches('/')
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(PADDLE_HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|err| {
            error!("paddle HTTP client build failed: {err}");
            ApiError::internal("failed to create customer portal session")
        })?;
    let response = client
        .post(&url)
        .bearer_auth(&billing.api_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({}))
        .send()
        .await
        .map_err(|err| {
            error!("paddle portal session request failed: {err}");
            ApiError::internal("failed to create customer portal session")
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        // Paddle error bodies can echo customer details; log only the
        // machine-readable error code, never the raw body.
        let error_code = paddle_error_code(&body);
        error!(
            status = %status,
            error_code = error_code.as_deref().unwrap_or("unknown"),
            body_bytes = body.len(),
            "paddle portal session rejected"
        );
        return Err(ApiError::internal(
            "failed to create customer portal session",
        ));
    }

    let payload: PortalSessionResponse = response.json().await.map_err(|err| {
        error!("paddle portal session parse failed: {err}");
        ApiError::internal("failed to create customer portal session")
    })?;

    payload
        .data
        .urls
        .general
        .overview
        .ok_or_else(|| ApiError::internal("paddle portal session missing overview URL"))
}

/// Extract Paddle's `error.code` from an API error body without logging the body.
fn paddle_error_code(body: &str) -> Option<String> {
    serde_json::from_str::<Value>(body)
        .ok()?
        .get("error")?
        .get("code")?
        .as_str()
        .map(str::to_string)
}

#[derive(Debug, Deserialize)]
struct PaddleWebhook {
    event_id: Option<String>,
    event_type: String,
    occurred_at: Option<String>,
    data: Value,
}

#[derive(Debug, Deserialize)]
struct PortalSessionResponse {
    data: PortalSessionData,
}

#[derive(Debug, Deserialize)]
struct PortalSessionData {
    urls: PortalSessionUrls,
}

#[derive(Debug, Deserialize)]
struct PortalSessionUrls {
    general: PortalGeneralUrls,
}

#[derive(Debug, Deserialize)]
struct PortalGeneralUrls {
    overview: Option<String>,
}

/// Verify the Paddle-Signature header against the raw request body.
pub fn verify_webhook_signature(
    signature_header: &str,
    body: &[u8],
    secret: &str,
) -> Result<(), ApiError> {
    let (timestamp, signatures) = parse_signature_header(signature_header)
        .ok_or_else(|| ApiError::unauthorized("Invalid Paddle-Signature header"))?;

    reject_stale_timestamp(timestamp)?;

    let body_str = std::str::from_utf8(body).map_err(|_| {
        ApiError::unauthorized("Webhook body must be valid UTF-8 for signature verification")
    })?;
    let signed_payload = format!("{timestamp}:{body_str}");

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|_| ApiError::internal("invalid webhook secret"))?;
    mac.update(signed_payload.as_bytes());
    let expected = bytes_to_hex(&mac.finalize().into_bytes());

    if signatures
        .iter()
        .any(|signature| constant_time_eq(signature, &expected))
    {
        Ok(())
    } else {
        Err(ApiError::unauthorized("Invalid webhook signature"))
    }
}

fn parse_signature_header(header: &str) -> Option<(i64, Vec<String>)> {
    let mut timestamp = None;
    let mut signatures = Vec::new();

    for segment in header.split(';') {
        let (key, value) = segment.split_once('=')?;
        match key.trim() {
            "ts" => timestamp = value.trim().parse().ok(),
            "h1" => signatures.push(value.trim().to_lowercase()),
            _ => {}
        }
    }

    let timestamp = timestamp?;
    if signatures.is_empty() {
        return None;
    }

    Some((timestamp, signatures))
}

fn reject_stale_timestamp(timestamp: i64) -> Result<(), ApiError> {
    let now = Utc::now().timestamp();
    if (now - timestamp).abs() > WEBHOOK_MAX_SKEW_SECS {
        return Err(ApiError::unauthorized("Webhook timestamp is too old"));
    }
    Ok(())
}

fn constant_time_eq(left: &str, right: &str) -> bool {
    left.as_bytes().ct_eq(right.as_bytes()).into()
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

async fn handle_subscription_upsert(
    pool: &sqlx::PgPool,
    secret: &str,
    data: &Value,
    occurred_at: Option<DateTime<Utc>>,
) -> Result<(), ApiError> {
    let subscription_id = required_str(data, "id")?;
    let raw_status = required_str(data, "status")?;
    let customer_id = required_str(data, "customer_id")?;
    let price_id = extract_price_id(data).unwrap_or_else(|| "unknown".to_string());
    let period_end = extract_period_end(data);
    let user_id = require_user_id(pool, secret, data, Some(&customer_id)).await?;

    // `subscriptions.status` has a CHECK constraint over the known values, so
    // a status this build does not understand is persisted as `past_due`:
    // read-only until the period ends, never paid access. The raw value is
    // kept in the log for the operator.
    let status = match SubscriptionStatus::parse(&raw_status) {
        Some(known) => known,
        None => {
            warn!(
                status = %raw_status,
                subscription_id = %subscription_id,
                "unknown paddle subscription status; storing as past_due"
            );
            SubscriptionStatus::PastDue
        }
    };
    let status = status.as_str();

    // The WHERE clause guards against out-of-order deliveries: an event older
    // than the last one applied to the row must not overwrite newer state. An
    // event with no usable `occurred_at` can only seed a row that has never
    // been timestamped; it never overrides timestamped state.
    let result = sqlx::query(
        r#"
        INSERT INTO subscriptions (
            user_id,
            paddle_subscription_id,
            paddle_price_id,
            plan,
            status,
            current_period_end,
            last_event_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (paddle_subscription_id) DO UPDATE SET
            status = EXCLUDED.status,
            current_period_end = EXCLUDED.current_period_end,
            paddle_price_id = EXCLUDED.paddle_price_id,
            last_event_at = COALESCE(EXCLUDED.last_event_at, subscriptions.last_event_at),
            updated_at = now()
        WHERE subscriptions.last_event_at IS NULL
           OR (
             EXCLUDED.last_event_at IS NOT NULL
             AND EXCLUDED.last_event_at >= subscriptions.last_event_at
           )
        "#,
    )
    .bind(user_id)
    .bind(&subscription_id)
    .bind(&price_id)
    .bind(HOSTED_PLAN)
    .bind(status)
    .bind(period_end)
    .bind(occurred_at)
    .execute(pool)
    .await
    .map_err(internal_db_error)?;

    if result.rows_affected() == 0 {
        debug!(
            subscription_id = %subscription_id,
            "skipping out-of-order Paddle subscription event"
        );
        return Ok(());
    }

    // `user_id` was resolved through the trust model in `resolve_user_id`, so
    // the customer id is safe to persist regardless of subscription status.
    // Linking on every applied event means a canceled-first delivery still
    // leaves the account able to reach the customer portal.
    link_paddle_customer(pool, user_id, &customer_id).await?;

    if matches!(status, "active" | "trialing") {
        sqlx::query(
            r#"
            UPDATE users
            SET plan = $2, updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(user_id)
        .bind(HOSTED_PLAN)
        .execute(pool)
        .await
        .map_err(internal_db_error)?;
    }

    Ok(())
}

async fn handle_subscription_canceled(
    pool: &sqlx::PgPool,
    secret: &str,
    data: &Value,
    occurred_at: Option<DateTime<Utc>>,
) -> Result<(), ApiError> {
    let subscription_id = required_str(data, "id")?;
    let period_end = extract_period_end(data);
    let status = SubscriptionStatus::Canceled.as_str();

    // Out-of-order guard: never apply a cancellation older than the last
    // event already applied to the subscription row, and never let a
    // cancellation without a usable `occurred_at` override timestamped state.
    let user_id = sqlx::query_scalar(
        r#"
        UPDATE subscriptions
        SET status = $2,
            current_period_end = COALESCE($3, current_period_end),
            last_event_at = COALESCE($4, last_event_at),
            updated_at = now()
        WHERE paddle_subscription_id = $1
          AND (
            last_event_at IS NULL
            OR ($4 IS NOT NULL AND $4 >= last_event_at)
          )
        RETURNING user_id
        "#,
    )
    .bind(&subscription_id)
    .bind(status)
    .bind(period_end)
    .bind(occurred_at)
    .fetch_optional(pool)
    .await
    .map_err(internal_db_error)?;

    let user_id = if let Some(user_id) = user_id {
        user_id
    } else if lookup_subscription_user(pool, &subscription_id)
        .await?
        .is_some()
    {
        // The row exists but the guard rejected this event as stale; the
        // stored state is newer, so leave it untouched.
        debug!(
            subscription_id = %subscription_id,
            "skipping out-of-order Paddle cancellation event"
        );
        return Ok(());
    } else {
        handle_subscription_upsert(pool, secret, data, occurred_at).await?;
        require_user_id(
            pool,
            secret,
            data,
            data.get("customer_id").and_then(Value::as_str),
        )
        .await?
    };

    downgrade_user_plan_if_no_active_subscription(pool, user_id).await?;

    Ok(())
}

async fn handle_customer_created(
    pool: &sqlx::PgPool,
    secret: &str,
    data: &Value,
) -> Result<(), ApiError> {
    let customer_id = required_str(data, "id")?;

    match resolve_user_id(pool, secret, data, Some(&customer_id)).await? {
        Some(user_id) => link_paddle_customer(pool, user_id, &customer_id).await,
        None => {
            // Not an error: customer.created often carries no usable linkage
            // data. The customer is linked when a subscription event with a
            // verifiable custom_data.user_id arrives.
            debug!(
                customer_id = %customer_id,
                "customer.created did not match a user; deferring linkage to subscription events"
            );
            Ok(())
        }
    }
}

async fn link_paddle_customer(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    customer_id: &str,
) -> Result<(), ApiError> {
    let result = sqlx::query(
        r#"
        UPDATE users
        SET paddle_customer_id = $2, updated_at = now()
        WHERE id = $1
          AND (
            paddle_customer_id IS NULL
            OR paddle_customer_id = $2
          )
          AND NOT EXISTS (
            SELECT 1 FROM users
            WHERE paddle_customer_id = $2 AND id != $1
          )
        "#,
    )
    .bind(user_id)
    .bind(customer_id)
    .execute(pool)
    .await
    .map_err(internal_db_error)?;

    if result.rows_affected() == 0 {
        // Outer Option: row exists; inner Option: column is nullable.
        let existing: Option<String> = sqlx::query_scalar::<_, Option<String>>(
            "SELECT paddle_customer_id FROM users WHERE id = $1",
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(internal_db_error)?
        .flatten();

        if existing.as_deref() != Some(customer_id) {
            // Fail loudly: a 409 makes Paddle retry and surfaces the delivery
            // as failed in the Paddle dashboard, and the audit row gives the
            // operator a durable record of the conflict to remediate.
            error!(
                user_id = %user_id,
                customer_id = %customer_id,
                "unable to link Paddle customer id; already assigned to another user"
            );
            record_event(
                pool,
                AuditEvent {
                    event_type: "billing.customer_link_conflict",
                    actor_user_id: Some(user_id),
                    resource_type: Some("billing"),
                    resource_id: None,
                    metadata: serde_json::json!({
                        "paddle_customer_id": customer_id,
                        "existing_paddle_customer_id": existing,
                    }),
                    ip_address: None,
                },
            )
            .await;
            return Err(ApiError::conflict(
                "Paddle customer is already linked to a different account",
            ));
        }
    }

    Ok(())
}

async fn downgrade_user_plan_if_no_active_subscription(
    pool: &sqlx::PgPool,
    user_id: Uuid,
) -> Result<(), ApiError> {
    let active_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM subscriptions
        WHERE user_id = $1
          AND status IN ('active', 'trialing')
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(internal_db_error)?;

    if active_count == 0 {
        sqlx::query(
            r#"
            UPDATE users
            SET plan = $2, updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(user_id)
        .bind(FREE_PLAN)
        .execute(pool)
        .await
        .map_err(internal_db_error)?;
    }

    Ok(())
}

/// Resolve which Rustume user a Paddle event belongs to, or `None` when no
/// trustworthy match exists.
///
/// Trust model: the webhook signature proves the event came from Paddle, but
/// it does NOT make the event contents trustworthy for account linkage —
/// `custom_data` is supplied by whichever browser opened the checkout
/// overlay, so an attacker can start a real checkout carrying an arbitrary
/// `custom_data.user_id`. Therefore:
///
/// 1. An existing `users.paddle_customer_id` link for the event's customer id
///    always wins over `custom_data` — a customer already linked to an
///    account cannot be re-pointed at another one by forged custom data.
/// 2. `custom_data.user_id` is accepted only when it carries a valid
///    signature minted by our own checkout endpoint for that user (so the
///    overlay caller cannot substitute another account's id), and it names
///    an existing user whose linked Paddle customer id is absent or matches
///    this event's customer id.
/// 3. Checkout emails are never used: they are unverified, and matching on
///    them would let an attacker attach their subscription to any victim
///    account simply by typing the victim's email at checkout.
async fn resolve_user_id(
    pool: &sqlx::PgPool,
    secret: &str,
    data: &Value,
    customer_id: Option<&str>,
) -> Result<Option<Uuid>, ApiError> {
    if let Some(customer_id) = customer_id {
        if let Some(user_id) = lookup_user_id_by_customer(pool, customer_id).await? {
            return Ok(Some(user_id));
        }
    }

    if let Some(user_id) = verified_custom_user_id(secret, data) {
        let linked_customer: Option<Option<String>> =
            sqlx::query_scalar("SELECT paddle_customer_id FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_optional(pool)
                .await
                .map_err(internal_db_error)?;

        if let Some(linked_customer) = linked_customer {
            let conflicts = match (linked_customer.as_deref(), customer_id) {
                (None, _) => false,
                (Some(linked), Some(event_customer)) => linked != event_customer,
                // User already linked to a customer, but this event carries
                // none to verify against: refuse the ambiguous match.
                (Some(_), None) => true,
            };

            if !conflicts {
                return Ok(Some(user_id));
            }

            warn!(
                user_id = %user_id,
                "rejecting Paddle custom_data.user_id: conflicting paddle_customer_id link"
            );
        }
    }

    Ok(None)
}

/// Like [`resolve_user_id`], but treat an unresolvable event as an error.
async fn require_user_id(
    pool: &sqlx::PgPool,
    secret: &str,
    data: &Value,
    customer_id: Option<&str>,
) -> Result<Uuid, ApiError> {
    resolve_user_id(pool, secret, data, customer_id)
        .await?
        .ok_or_else(|| ApiError::new("Unable to match Paddle event to a Rustume user"))
}

async fn lookup_subscription_user(
    pool: &sqlx::PgPool,
    subscription_id: &str,
) -> Result<Option<Uuid>, ApiError> {
    sqlx::query_scalar("SELECT user_id FROM subscriptions WHERE paddle_subscription_id = $1")
        .bind(subscription_id)
        .fetch_optional(pool)
        .await
        .map_err(internal_db_error)
}

async fn lookup_user_id_by_customer(
    pool: &sqlx::PgPool,
    customer_id: &str,
) -> Result<Option<Uuid>, ApiError> {
    sqlx::query_scalar("SELECT id FROM users WHERE paddle_customer_id = $1")
        .bind(customer_id)
        .fetch_optional(pool)
        .await
        .map_err(internal_db_error)
}

fn extract_price_id(data: &Value) -> Option<String> {
    data.get("items")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(|item| item.get("price"))
        .and_then(|price| price.get("id"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn extract_period_end(data: &Value) -> Option<DateTime<Utc>> {
    data.get("current_billing_period")
        .and_then(|period| period.get("ends_at"))
        .and_then(Value::as_str)
        .and_then(parse_rfc3339)
        .or_else(|| {
            data.get("scheduled_change")
                .and_then(|change| change.get("effective_at"))
                .and_then(Value::as_str)
                .and_then(parse_rfc3339)
        })
}

fn parse_rfc3339(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|parsed| parsed.with_timezone(&Utc))
}

fn required_str(data: &Value, field: &str) -> Result<String, ApiError> {
    data.get(field)
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| ApiError::new(format!("Missing Paddle field: {field}")))
}

fn internal_db_error(err: impl std::fmt::Display) -> ApiError {
    error!("billing database error: {err}");
    ApiError::internal("internal server error")
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Datelike, TimeZone};

    const TEST_SECRET: &str = "test_webhook_secret";

    fn sign_payload(secret: &str, timestamp: i64, body: &str) -> String {
        let signed_payload = format!("{timestamp}:{body}");
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(signed_payload.as_bytes());
        bytes_to_hex(&mac.finalize().into_bytes())
    }

    #[test]
    fn verify_webhook_signature_accepts_valid_header() {
        let secret = "test_webhook_secret";
        let body = r#"{"event_type":"subscription.created","data":{"id":"sub_test"}}"#;
        let timestamp = Utc::now().timestamp();
        let signature = sign_payload(secret, timestamp, body);
        let header = format!("ts={timestamp};h1={signature}");

        verify_webhook_signature(&header, body.as_bytes(), secret).expect("valid signature");
    }

    #[test]
    fn verify_webhook_signature_rejects_invalid_signature() {
        let secret = "test_webhook_secret";
        let body = r#"{"event_type":"subscription.created"}"#;
        let timestamp = Utc::now().timestamp();
        let header = format!("ts={timestamp};h1=deadbeef");

        let err = verify_webhook_signature(&header, body.as_bytes(), secret)
            .expect_err("invalid signature");
        assert!(matches!(err.kind, crate::error::ApiErrorKind::Unauthorized));
    }

    #[test]
    fn verify_webhook_signature_rejects_stale_timestamp() {
        let secret = "test_webhook_secret";
        let body = r#"{"event_type":"subscription.created"}"#;
        let timestamp = Utc
            .with_ymd_and_hms(2020, 1, 1, 0, 0, 0)
            .unwrap()
            .timestamp();
        let signature = sign_payload(secret, timestamp, body);
        let header = format!("ts={timestamp};h1={signature}");

        let err = verify_webhook_signature(&header, body.as_bytes(), secret)
            .expect_err("stale timestamp");
        assert!(err.error.contains("too old"));
    }

    #[test]
    fn signed_custom_data_round_trips_only_with_matching_secret() {
        let user_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let data = serde_json::json!({ "custom_data": signed_custom_data(TEST_SECRET, user_id) });

        assert_eq!(verified_custom_user_id(TEST_SECRET, &data), Some(user_id));
        assert_eq!(verified_custom_user_id("other_secret", &data), None);

        // Unsigned custom_data — what an attacker can put in the overlay — is
        // never trusted, nor is a signature for a different user id.
        let unsigned = serde_json::json!({ "custom_data": { "user_id": user_id.to_string() } });
        assert_eq!(verified_custom_user_id(TEST_SECRET, &unsigned), None);
        let other = Uuid::new_v4();
        let mut forged = signed_custom_data(TEST_SECRET, other);
        forged["user_id"] = Value::String(user_id.to_string());
        let forged = serde_json::json!({ "custom_data": forged });
        assert_eq!(verified_custom_user_id(TEST_SECRET, &forged), None);
    }

    #[test]
    fn extract_period_end_reads_current_billing_period() {
        let data = serde_json::json!({
            "current_billing_period": {
                "ends_at": "2099-01-01T00:00:00Z"
            }
        });
        let ends_at = extract_period_end(&data).expect("period end");
        assert_eq!(ends_at.year(), 2099);
    }

    fn looks_like_test_database_url(url: &str) -> bool {
        let db_name = url
            .split(['?', '#'])
            .next()
            .unwrap_or(url)
            .rsplit('/')
            .next()
            .unwrap_or("");
        db_name.contains("_test")
    }

    fn database_url_for_tests() -> Option<String> {
        let Some(url) = std::env::var("TEST_DATABASE_URL")
            .ok()
            .map(|url| url.trim().to_owned())
            .filter(|url| !url.is_empty())
            .or_else(|| {
                std::env::var("DATABASE_URL")
                    .ok()
                    .map(|url| url.trim().to_owned())
                    .filter(|url| !url.is_empty())
            })
        else {
            skip_or_fail_without_test_db();
            return None;
        };

        if looks_like_test_database_url(&url) {
            Some(url)
        } else {
            skip_or_fail_without_test_db();
            None
        }
    }

    /// Locally the DB-backed tests are optional; in CI (which always provisions
    /// Postgres) a missing or misnamed database must fail instead of quietly
    /// passing with zero assertions.
    fn skip_or_fail_without_test_db() {
        let message = "billing integration tests need TEST_DATABASE_URL (or DATABASE_URL) naming a *_test database";
        if std::env::var("CI").is_ok() {
            panic!("{message}");
        }
        eprintln!("SKIP {message}");
    }

    async fn test_pool() -> Option<sqlx::PgPool> {
        let database_url = database_url_for_tests()?;

        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(2)
            .connect(&database_url)
            .await
            .expect("connect to test database");
        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .expect("run migrations");

        Some(pool)
    }

    async fn insert_test_user(pool: &sqlx::PgPool, user_id: Uuid, email: &str) {
        let workos_id = format!("workos_billing_{user_id}");
        // Emails are unique in the schema; suffix the id so an aborted run
        // cannot collide with the next one.
        let (local, domain) = email.split_once('@').expect("test email");
        let email = format!("{local}+{user_id}@{domain}");
        sqlx::query("INSERT INTO users (id, workos_id, email) VALUES ($1, $2, $3)")
            .bind(user_id)
            .bind(&workos_id)
            .bind(&email)
            .execute(pool)
            .await
            .expect("insert user");
    }

    async fn delete_test_user(pool: &sqlx::PgPool, user_id: Uuid) {
        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(user_id)
            .execute(pool)
            .await
            .expect("cleanup user");
    }

    fn subscription_event(user_id: Uuid, status: &str) -> Value {
        serde_json::json!({
            "id": format!("sub_test_{user_id}"),
            "status": status,
            "customer_id": format!("ctm_test_{user_id}"),
            "items": [{ "price": { "id": "pri_test" } }],
            "current_billing_period": { "ends_at": "2099-01-01T00:00:00Z" },
            "custom_data": signed_custom_data(TEST_SECRET, user_id)
        })
    }

    fn occurred(rfc3339: &str) -> Option<DateTime<Utc>> {
        Some(parse_rfc3339(rfc3339).expect("valid timestamp"))
    }

    #[tokio::test]
    async fn subscription_upsert_is_idempotent_when_database_available() {
        let Some(pool) = test_pool().await else {
            return;
        };

        let user_id = uuid::Uuid::new_v4();
        insert_test_user(&pool, user_id, "billing@example.com").await;

        let data = subscription_event(user_id, "active");

        handle_subscription_upsert(&pool, TEST_SECRET, &data, None)
            .await
            .expect("first upsert");
        handle_subscription_upsert(&pool, TEST_SECRET, &data, None)
            .await
            .expect("second upsert");

        let count =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM subscriptions WHERE user_id = $1")
                .bind(user_id)
                .fetch_one(&pool)
                .await
                .expect("count subscriptions");

        assert_eq!(count, 1);

        delete_test_user(&pool, user_id).await;
    }

    #[tokio::test]
    async fn webhook_event_claim_skips_only_processed_events_when_database_available() {
        let Some(pool) = test_pool().await else {
            return;
        };

        let event_id = format!("evt_test_{}", uuid::Uuid::new_v4());

        // First delivery.
        assert_eq!(
            claim_webhook_event(&pool, &event_id)
                .await
                .expect("first claim"),
            WebhookClaim::Claimed
        );
        // A retry before the handler finished (or after it failed) must be
        // handled again, not mistaken for a replay.
        assert_eq!(
            claim_webhook_event(&pool, &event_id)
                .await
                .expect("retry claim"),
            WebhookClaim::Claimed
        );

        mark_webhook_event_processed(&pool, &event_id)
            .await
            .expect("mark processed");
        assert_eq!(
            claim_webhook_event(&pool, &event_id)
                .await
                .expect("claim after processing"),
            WebhookClaim::AlreadyProcessed
        );

        sqlx::query("DELETE FROM billing_webhook_events WHERE event_id = $1")
            .bind(&event_id)
            .execute(&pool)
            .await
            .expect("cleanup event");
    }

    #[tokio::test]
    async fn stale_update_does_not_resurrect_canceled_subscription_when_database_available() {
        let Some(pool) = test_pool().await else {
            return;
        };

        let user_id = uuid::Uuid::new_v4();
        insert_test_user(&pool, user_id, "ordering@example.com").await;

        let active = subscription_event(user_id, "active");

        // Activation at T1, cancellation at T2.
        handle_subscription_upsert(
            &pool,
            TEST_SECRET,
            &active,
            occurred("2099-01-01T00:00:00Z"),
        )
        .await
        .expect("activate");
        handle_subscription_canceled(
            &pool,
            TEST_SECRET,
            &active,
            occurred("2099-01-02T00:00:00Z"),
        )
        .await
        .expect("cancel");

        // A delayed replay of the T1 update must not resurrect the
        // subscription or restore the paid plan.
        handle_subscription_upsert(
            &pool,
            TEST_SECRET,
            &active,
            occurred("2099-01-01T00:00:00Z"),
        )
        .await
        .expect("stale update");

        let status: String = sqlx::query_scalar(
            "SELECT status FROM subscriptions WHERE paddle_subscription_id = $1",
        )
        .bind(format!("sub_test_{user_id}"))
        .fetch_one(&pool)
        .await
        .expect("subscription status");
        assert_eq!(status, "canceled");

        let plan: String = sqlx::query_scalar("SELECT plan FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(&pool)
            .await
            .expect("user plan");
        assert_eq!(plan, "free");

        // A stale cancellation replay must also be a no-op.
        handle_subscription_canceled(
            &pool,
            TEST_SECRET,
            &active,
            occurred("2099-01-01T00:00:00Z"),
        )
        .await
        .expect("stale cancel");

        delete_test_user(&pool, user_id).await;
    }

    #[tokio::test]
    async fn resolve_user_id_rejects_conflicting_custom_data_when_database_available() {
        let Some(pool) = test_pool().await else {
            return;
        };

        let victim_id = uuid::Uuid::new_v4();
        let attacker_id = uuid::Uuid::new_v4();
        insert_test_user(&pool, victim_id, "victim@example.com").await;
        insert_test_user(&pool, attacker_id, "attacker@example.com").await;

        let victim_customer = format!("ctm_victim_{victim_id}");
        sqlx::query("UPDATE users SET paddle_customer_id = $2 WHERE id = $1")
            .bind(victim_id)
            .bind(&victim_customer)
            .execute(&pool)
            .await
            .expect("link victim customer");

        // Forged custom_data naming the victim, but the event's customer id
        // belongs to no one: the victim's existing link must block the match.
        // Even a correctly signed custom_data (the victim's own checkout token
        // replayed by an attacker) is blocked by the victim's existing link.
        let forged = serde_json::json!({
            "custom_data": signed_custom_data(TEST_SECRET, victim_id)
        });
        let attacker_customer = format!("ctm_attacker_{attacker_id}");
        let resolved = resolve_user_id(&pool, TEST_SECRET, &forged, Some(&attacker_customer))
            .await
            .expect("resolve");
        assert_eq!(resolved, None);

        // An unverified checkout email must never be used for linkage.
        let email_only = serde_json::json!({ "email": "victim@example.com" });
        let resolved = resolve_user_id(&pool, TEST_SECRET, &email_only, Some(&attacker_customer))
            .await
            .expect("resolve email");
        assert_eq!(resolved, None);

        // Unsigned custom_data naming an unlinked user (what the overlay caller
        // controls) is refused too: first-link requires our checkout token.
        let unsigned = serde_json::json!({
            "custom_data": { "user_id": attacker_id.to_string() }
        });
        let resolved = resolve_user_id(&pool, TEST_SECRET, &unsigned, Some(&attacker_customer))
            .await
            .expect("resolve unsigned");
        assert_eq!(resolved, None);

        // The event's customer id mapping wins over custom_data.
        let mismatched = serde_json::json!({
            "custom_data": signed_custom_data(TEST_SECRET, attacker_id)
        });
        let resolved = resolve_user_id(&pool, TEST_SECRET, &mismatched, Some(&victim_customer))
            .await
            .expect("resolve linked");
        assert_eq!(resolved, Some(victim_id));

        delete_test_user(&pool, victim_id).await;
        delete_test_user(&pool, attacker_id).await;
    }

    fn test_user(id: Uuid, email: Option<&str>, customer: Option<&str>) -> crate::db::User {
        crate::db::User {
            id,
            workos_id: format!("workos_billing_{id}"),
            plan: "free".to_string(),
            paddle_customer_id: customer.map(str::to_string),
            email: email.map(str::to_string),
            first_name: None,
            last_name: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    fn test_billing_config() -> BillingConfig {
        BillingConfig {
            api_key: "api_test".to_string(),
            webhook_secret: "test_webhook_secret".to_string(),
            price_id: "pri_test".to_string(),
            client_token: "client_test".to_string(),
            api_base: "https://sandbox-api.paddle.com".to_string(),
            sandbox: true,
        }
    }

    fn billing_state(pool: Option<sqlx::PgPool>) -> AppState {
        use crate::auth::{session::SessionService, workos::WorkOsClient};
        use crate::cloud::CloudState;
        use std::sync::Arc;

        let cloud = pool.map(|pool| {
            Arc::new(CloudState {
                db: pool.clone(),
                workos: WorkOsClient::new("client_test".into(), "api_key_test".into()),
                sessions: SessionService::new(
                    pool,
                    "test-session-secret-at-least-32-chars".into(),
                    false,
                ),
                workos_redirect_uri: "http://localhost/auth/callback".into(),
                email: None,
            })
        });
        AppState::with_options_and_billing(
            Arc::new(crate::routes::static_dir()),
            cloud,
            true,
            crate::config::RateLimitConfig::default(),
            Some(test_billing_config()),
        )
    }

    fn signed_headers(body: &str) -> HeaderMap {
        let timestamp = Utc::now().timestamp();
        let signature = sign_payload("test_webhook_secret", timestamp, body);
        let mut headers = HeaderMap::new();
        headers.insert(
            "Paddle-Signature",
            format!("ts={timestamp};h1={signature}").parse().unwrap(),
        );
        headers
    }

    async fn subscription_status(pool: &sqlx::PgPool, user_id: Uuid) -> String {
        sqlx::query_scalar("SELECT status FROM subscriptions WHERE paddle_subscription_id = $1")
            .bind(format!("sub_test_{user_id}"))
            .fetch_one(pool)
            .await
            .expect("subscription status")
    }

    async fn user_plan(pool: &sqlx::PgPool, user_id: Uuid) -> String {
        sqlx::query_scalar("SELECT plan FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await
            .expect("user plan")
    }

    async fn user_customer(pool: &sqlx::PgPool, user_id: Uuid) -> Option<String> {
        sqlx::query_scalar("SELECT paddle_customer_id FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await
            .expect("user customer")
    }

    #[tokio::test]
    async fn timestampless_events_never_override_timestamped_state_when_database_available() {
        let Some(pool) = test_pool().await else {
            return;
        };

        let user_id = uuid::Uuid::new_v4();
        insert_test_user(&pool, user_id, "timestampless@example.com").await;
        let active = subscription_event(user_id, "active");

        handle_subscription_upsert(
            &pool,
            TEST_SECRET,
            &active,
            occurred("2099-01-02T00:00:00Z"),
        )
        .await
        .expect("activate");
        assert_eq!(user_plan(&pool, user_id).await, "pro");

        // A cancel with no usable occurred_at (missing or unparsable) must not
        // downgrade a timestamped active row.
        handle_subscription_canceled(&pool, TEST_SECRET, &active, None)
            .await
            .expect("timestampless cancel");
        assert_eq!(subscription_status(&pool, user_id).await, "active");
        assert_eq!(user_plan(&pool, user_id).await, "pro");

        // Nor may a timestampless upsert with a different status.
        let paused = subscription_event(user_id, "paused");
        handle_subscription_upsert(&pool, TEST_SECRET, &paused, None)
            .await
            .expect("timestampless upsert");
        assert_eq!(subscription_status(&pool, user_id).await, "active");

        // A row that has never been timestamped may still be seeded/updated
        // by a timestampless event (legacy or simulator payloads).
        let other_user = uuid::Uuid::new_v4();
        insert_test_user(&pool, other_user, "legacy@example.com").await;
        let legacy = subscription_event(other_user, "active");
        handle_subscription_upsert(&pool, TEST_SECRET, &legacy, None)
            .await
            .expect("legacy activate");
        handle_subscription_canceled(&pool, TEST_SECRET, &legacy, None)
            .await
            .expect("legacy cancel");
        assert_eq!(subscription_status(&pool, other_user).await, "canceled");

        delete_test_user(&pool, user_id).await;
        delete_test_user(&pool, other_user).await;
    }

    #[tokio::test]
    async fn canceled_first_delivery_links_customer_when_database_available() {
        let Some(pool) = test_pool().await else {
            return;
        };

        let user_id = uuid::Uuid::new_v4();
        insert_test_user(&pool, user_id, "canceled-first@example.com").await;

        // Paddle can deliver the cancellation before any active event has been
        // seen (or the active event may have failed). The customer must still
        // be linked so the account can reach the portal.
        let canceled = subscription_event(user_id, "canceled");
        handle_subscription_canceled(
            &pool,
            TEST_SECRET,
            &canceled,
            occurred("2099-01-01T00:00:00Z"),
        )
        .await
        .expect("canceled-first");

        assert_eq!(subscription_status(&pool, user_id).await, "canceled");
        assert_eq!(user_plan(&pool, user_id).await, "free");
        assert_eq!(
            user_customer(&pool, user_id).await.as_deref(),
            Some(format!("ctm_test_{user_id}").as_str())
        );

        delete_test_user(&pool, user_id).await;
    }

    #[tokio::test]
    async fn link_conflict_fails_loudly_when_database_available() {
        let Some(pool) = test_pool().await else {
            return;
        };

        let owner = uuid::Uuid::new_v4();
        let other = uuid::Uuid::new_v4();
        insert_test_user(&pool, owner, "owner@example.com").await;
        insert_test_user(&pool, other, "other@example.com").await;
        let customer = format!("ctm_shared_{owner}");

        link_paddle_customer(&pool, owner, &customer)
            .await
            .expect("first link");
        // Re-linking the same pair is idempotent.
        link_paddle_customer(&pool, owner, &customer)
            .await
            .expect("idempotent link");

        let err = link_paddle_customer(&pool, other, &customer)
            .await
            .expect_err("conflicting link must fail");
        assert!(
            matches!(err.kind, crate::error::ApiErrorKind::Conflict),
            "unexpected error: {err:?}"
        );
        assert_eq!(user_customer(&pool, other).await, None);

        let audited: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM audit_events
            WHERE actor_user_id = $1 AND event_type = 'billing.customer_link_conflict'
            "#,
        )
        .bind(other)
        .fetch_one(&pool)
        .await
        .expect("audit count");
        assert_eq!(audited, 1);

        delete_test_user(&pool, owner).await;
        delete_test_user(&pool, other).await;
    }

    #[tokio::test]
    async fn signed_canceled_webhook_is_applied_once_when_database_available() {
        let Some(pool) = test_pool().await else {
            return;
        };

        let user_id = uuid::Uuid::new_v4();
        insert_test_user(&pool, user_id, "webhook@example.com").await;
        let state = billing_state(Some(pool.clone()));

        let active = serde_json::json!({
            "event_id": format!("evt_active_{user_id}"),
            "event_type": "subscription.activated",
            "occurred_at": "2099-01-01T00:00:00Z",
            "data": subscription_event(user_id, "active"),
        })
        .to_string();
        let status = paddle_webhook(State(state.clone()), signed_headers(&active), active.into())
            .await
            .expect("activated webhook");
        assert_eq!(status, StatusCode::OK);
        assert_eq!(user_plan(&pool, user_id).await, "pro");

        let canceled = serde_json::json!({
            "event_id": format!("evt_canceled_{user_id}"),
            "event_type": "subscription.canceled",
            "occurred_at": "2099-01-02T00:00:00Z",
            "data": subscription_event(user_id, "canceled"),
        })
        .to_string();
        let status = paddle_webhook(
            State(state.clone()),
            signed_headers(&canceled),
            canceled.clone().into(),
        )
        .await
        .expect("canceled webhook");
        assert_eq!(status, StatusCode::OK);
        assert_eq!(subscription_status(&pool, user_id).await, "canceled");
        assert_eq!(user_plan(&pool, user_id).await, "free");

        // Replayed delivery of the same event id is acknowledged and skipped:
        // re-activate directly, then replay the cancel and expect no change.
        handle_subscription_upsert(
            &pool,
            TEST_SECRET,
            &subscription_event(user_id, "active"),
            occurred("2099-01-03T00:00:00Z"),
        )
        .await
        .expect("reactivate");
        let status = paddle_webhook(
            State(state.clone()),
            signed_headers(&canceled),
            canceled.into(),
        )
        .await
        .expect("replayed webhook");
        assert_eq!(status, StatusCode::OK);
        assert_eq!(subscription_status(&pool, user_id).await, "active");

        // customer.created without any verifiable linkage is acknowledged.
        let created = serde_json::json!({
            "event_id": format!("evt_customer_{user_id}"),
            "event_type": "customer.created",
            "occurred_at": "2099-01-04T00:00:00Z",
            "data": { "id": "ctm_unlinked", "email": "webhook@example.com" },
        })
        .to_string();
        let status = paddle_webhook(State(state), signed_headers(&created), created.into())
            .await
            .expect("customer.created webhook");
        assert_eq!(status, StatusCode::OK);
        assert_eq!(
            user_customer(&pool, user_id).await.as_deref(),
            Some(format!("ctm_test_{user_id}").as_str()),
            "unverified email must not relink the customer"
        );

        delete_test_user(&pool, user_id).await;
    }

    #[tokio::test]
    async fn portal_returns_conflict_without_linked_customer() {
        // Lazy pool: the handler never reaches the database on this path.
        let state = billing_state(Some(crate::cloud::test_cloud_state().db.clone()));
        let user = test_user(Uuid::new_v4(), Some("dev@example.com"), None);

        let err = customer_portal(AuthUser(user), State(state))
            .await
            .expect_err("portal must refuse unlinked accounts");
        assert!(matches!(err.kind, crate::error::ApiErrorKind::Conflict));
    }

    #[tokio::test]
    async fn checkout_requires_account_email() {
        let state = billing_state(Some(crate::cloud::test_cloud_state().db.clone()));
        let user = test_user(Uuid::new_v4(), None, None);

        let err = checkout(AuthUser(user), State(state.clone()))
            .await
            .expect_err("checkout must require an email");
        assert!(matches!(err.kind, crate::error::ApiErrorKind::BadRequest));

        let user = test_user(Uuid::new_v4(), Some("dev@example.com"), None);
        let Json(settings) = checkout(AuthUser(user.clone()), State(state))
            .await
            .expect("checkout settings");
        assert_eq!(settings.environment, "sandbox");
        assert_eq!(settings.price_id, "pri_test");
        assert_eq!(settings.custom_data["user_id"], user.id.to_string());
    }

    #[tokio::test]
    async fn failed_delivery_is_reprocessed_and_idless_events_are_rejected_when_database_available()
    {
        let Some(pool) = test_pool().await else {
            return;
        };

        let user_id = uuid::Uuid::new_v4();
        insert_test_user(&pool, user_id, "retry@example.com").await;
        let state = billing_state(Some(pool.clone()));
        let event_id = format!("evt_retry_{user_id}");

        // First attempt fails: the event names a subscription whose custom_data
        // is missing, so no user can be resolved -> 400. The claim row stays
        // unprocessed.
        let mut data = subscription_event(user_id, "active");
        data.as_object_mut().unwrap().remove("custom_data");
        let failing = serde_json::json!({
            "event_id": event_id,
            "event_type": "subscription.activated",
            "occurred_at": "2099-01-01T00:00:00Z",
            "data": data,
        })
        .to_string();
        let err = paddle_webhook(
            State(state.clone()),
            signed_headers(&failing),
            failing.into(),
        )
        .await
        .expect_err("unresolvable event must fail");
        assert!(matches!(err.kind, crate::error::ApiErrorKind::BadRequest));
        assert_eq!(user_plan(&pool, user_id).await, "free");

        // Paddle retries the same event id, now resolvable: it must be applied,
        // not skipped as a replay.
        let retry = serde_json::json!({
            "event_id": event_id,
            "event_type": "subscription.activated",
            "occurred_at": "2099-01-01T00:00:00Z",
            "data": subscription_event(user_id, "active"),
        })
        .to_string();
        let status = paddle_webhook(State(state.clone()), signed_headers(&retry), retry.into())
            .await
            .expect("retry applies");
        assert_eq!(status, StatusCode::OK);
        assert_eq!(user_plan(&pool, user_id).await, "pro");

        // A signed payload without event_id has no replay protection: reject.
        let idless = serde_json::json!({
            "event_type": "subscription.canceled",
            "occurred_at": "2099-01-02T00:00:00Z",
            "data": subscription_event(user_id, "canceled"),
        })
        .to_string();
        let err = paddle_webhook(State(state), signed_headers(&idless), idless.into())
            .await
            .expect_err("event without id must be rejected");
        assert!(matches!(err.kind, crate::error::ApiErrorKind::BadRequest));
        assert_eq!(err.error, "Missing Paddle event_id");
        assert_eq!(user_plan(&pool, user_id).await, "pro");

        sqlx::query("DELETE FROM billing_webhook_events WHERE event_id = $1")
            .bind(&event_id)
            .execute(&pool)
            .await
            .expect("cleanup event");
        delete_test_user(&pool, user_id).await;
    }

    #[tokio::test]
    async fn unknown_status_is_stored_as_past_due_when_database_available() {
        let Some(pool) = test_pool().await else {
            return;
        };

        let user_id = uuid::Uuid::new_v4();
        insert_test_user(&pool, user_id, "unknown-status@example.com").await;

        let odd = subscription_event(user_id, "hibernating");
        handle_subscription_upsert(&pool, TEST_SECRET, &odd, occurred("2099-01-01T00:00:00Z"))
            .await
            .expect("unknown status must not 500 on the CHECK constraint");

        assert_eq!(subscription_status(&pool, user_id).await, "past_due");
        assert_eq!(user_plan(&pool, user_id).await, "free");
        let access = crate::subscription::load_access(&pool, user_id)
            .await
            .expect("load access");
        assert!(
            access.ensure_write().is_err(),
            "unknown status is never paid access"
        );

        delete_test_user(&pool, user_id).await;
    }

    #[tokio::test]
    async fn access_follows_live_subscription_over_newer_canceled_row_when_database_available() {
        let Some(pool) = test_pool().await else {
            return;
        };

        let user_id = uuid::Uuid::new_v4();
        insert_test_user(&pool, user_id, "resubscribed@example.com").await;

        // Old subscription, canceled and expired.
        let mut old = subscription_event(user_id, "active");
        old["id"] = Value::String(format!("sub_old_{user_id}"));
        old["current_billing_period"]["ends_at"] = Value::String("2020-01-01T00:00:00Z".into());
        handle_subscription_upsert(&pool, TEST_SECRET, &old, occurred("2019-01-01T00:00:00Z"))
            .await
            .expect("old active");
        // New subscription under a fresh Paddle id.
        let new = subscription_event(user_id, "active");
        handle_subscription_upsert(&pool, TEST_SECRET, &new, occurred("2099-01-01T00:00:00Z"))
            .await
            .expect("new active");
        // A late webhook cancels the *old* one, touching its updated_at last.
        handle_subscription_canceled(&pool, TEST_SECRET, &old, occurred("2020-01-01T00:00:00Z"))
            .await
            .expect("cancel old");

        assert_eq!(user_plan(&pool, user_id).await, "pro");
        let access = crate::subscription::load_access(&pool, user_id)
            .await
            .expect("load access");
        assert_eq!(access, crate::subscription::SubscriptionAccess::Active);

        delete_test_user(&pool, user_id).await;
    }

    /// Minimal stand-in for the Paddle API: answers portal-session requests
    /// with a canned response. Returns the base URL to point `api_base` at.
    async fn mock_paddle_api(
        status: StatusCode,
        body: serde_json::Value,
    ) -> (String, tokio::task::JoinHandle<()>) {
        use axum::routing::post;
        let router = axum::Router::new().route(
            "/customers/{customer_id}/portal-sessions",
            post(move || {
                let body = body.clone();
                async move { (status, Json(body)) }
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind mock paddle api");
        let addr = listener.local_addr().expect("local addr");
        let server = tokio::spawn(async move {
            axum::serve(listener, router)
                .await
                .expect("serve mock paddle api");
        });
        (format!("http://{addr}"), server)
    }

    #[tokio::test]
    async fn portal_returns_overview_url_from_paddle() {
        let (api_base, server) = mock_paddle_api(
            StatusCode::CREATED,
            serde_json::json!({
                "data": { "urls": { "general": { "overview": "https://customer-portal.paddle.com/cpl_test" } } }
            }),
        )
        .await;
        let mut config = test_billing_config();
        config.api_base = api_base;
        let state = AppState::with_options_and_billing(
            std::sync::Arc::new(crate::routes::static_dir()),
            Some(crate::cloud::test_cloud_state()),
            true,
            crate::config::RateLimitConfig::default(),
            Some(config),
        );
        let user = test_user(Uuid::new_v4(), Some("dev@example.com"), Some("ctm_linked"));

        let Json(response) = customer_portal(AuthUser(user), State(state))
            .await
            .expect("portal session");
        assert_eq!(response.url, "https://customer-portal.paddle.com/cpl_test");
        server.abort();
    }

    #[tokio::test]
    async fn portal_failure_never_echoes_paddle_error_body() {
        let (api_base, server) = mock_paddle_api(
            StatusCode::FORBIDDEN,
            serde_json::json!({
                "error": {
                    "code": "forbidden",
                    "detail": "customer secret-email@example.com is not accessible"
                }
            }),
        )
        .await;
        let mut config = test_billing_config();
        config.api_base = api_base;
        let state = AppState::with_options_and_billing(
            std::sync::Arc::new(crate::routes::static_dir()),
            Some(crate::cloud::test_cloud_state()),
            true,
            crate::config::RateLimitConfig::default(),
            Some(config),
        );
        let user = test_user(Uuid::new_v4(), Some("dev@example.com"), Some("ctm_linked"));

        let err = customer_portal(AuthUser(user), State(state))
            .await
            .expect_err("paddle rejection surfaces as an error");
        assert!(matches!(
            err.kind,
            crate::error::ApiErrorKind::InternalError
        ));
        assert_eq!(err.error, "failed to create customer portal session");
        assert!(!err.error.contains("secret-email"));
        assert_eq!(
            paddle_error_code(r#"{"error":{"code":"forbidden"}}"#).as_deref(),
            Some("forbidden")
        );
        server.abort();
    }
}
