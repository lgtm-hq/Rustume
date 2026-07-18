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
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 404, description = "Billing not enabled", body = ApiError),
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
        custom_data: serde_json::json!({ "user_id": user.id.to_string() }),
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
        (status = 404, description = "Billing not enabled", body = ApiError),
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

    match payload.event_type.as_str() {
        "subscription.created" | "subscription.updated" => {
            let status = payload.data.get("status").and_then(Value::as_str);
            if status == Some(SubscriptionStatus::Canceled.as_str()) {
                handle_subscription_canceled(&cloud.db, &payload.data).await?;
            } else {
                handle_subscription_upsert(&cloud.db, &payload.data).await?;
            }
        }
        "subscription.canceled" => {
            handle_subscription_canceled(&cloud.db, &payload.data).await?;
        }
        "customer.created" => {
            handle_customer_created(&cloud.db, &payload.data).await?;
        }
        other => {
            debug!(
                event_type = other,
                "ignoring unhandled Paddle webhook event"
            );
        }
    }

    record_event(
        &cloud.db,
        AuditEvent {
            event_type: "billing.webhook.received",
            actor_user_id: extract_user_id(&payload.data),
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
        error!(status = %status, body = %body, "paddle portal session rejected");
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

#[derive(Debug, Deserialize)]
struct PaddleWebhook {
    event_id: Option<String>,
    event_type: String,
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

async fn handle_subscription_upsert(pool: &sqlx::PgPool, data: &Value) -> Result<(), ApiError> {
    let subscription_id = required_str(data, "id")?;
    let status = required_str(data, "status")?;
    let customer_id = required_str(data, "customer_id")?;
    let price_id = extract_price_id(data).unwrap_or_else(|| "unknown".to_string());
    let period_end = extract_period_end(data);
    let user_id = resolve_user_id(pool, data, Some(&customer_id)).await?;

    if SubscriptionStatus::parse(&status).is_none() {
        warn!(status = %status, "unknown paddle subscription status");
    }

    sqlx::query(
        r#"
        INSERT INTO subscriptions (
            user_id,
            paddle_subscription_id,
            paddle_price_id,
            plan,
            status,
            current_period_end
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (paddle_subscription_id) DO UPDATE SET
            status = EXCLUDED.status,
            current_period_end = EXCLUDED.current_period_end,
            paddle_price_id = EXCLUDED.paddle_price_id,
            updated_at = now()
        "#,
    )
    .bind(user_id)
    .bind(subscription_id)
    .bind(&price_id)
    .bind(HOSTED_PLAN)
    .bind(&status)
    .bind(period_end)
    .execute(pool)
    .await
    .map_err(internal_db_error)?;

    if matches!(status.as_str(), "active" | "trialing") {
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

        link_paddle_customer(pool, user_id, &customer_id).await?;
    }

    Ok(())
}

async fn handle_subscription_canceled(pool: &sqlx::PgPool, data: &Value) -> Result<(), ApiError> {
    let subscription_id = required_str(data, "id")?;
    let period_end = extract_period_end(data);
    let status = SubscriptionStatus::Canceled.as_str();

    let user_id = sqlx::query_scalar(
        r#"
        UPDATE subscriptions
        SET status = $2,
            current_period_end = COALESCE($3, current_period_end),
            updated_at = now()
        WHERE paddle_subscription_id = $1
        RETURNING user_id
        "#,
    )
    .bind(subscription_id)
    .bind(status)
    .bind(period_end)
    .fetch_optional(pool)
    .await
    .map_err(internal_db_error)?;

    let user_id = if let Some(user_id) = user_id {
        user_id
    } else {
        handle_subscription_upsert(pool, data).await?;
        resolve_user_id(pool, data, data.get("customer_id").and_then(Value::as_str)).await?
    };

    downgrade_user_plan_if_no_active_subscription(pool, user_id).await?;

    Ok(())
}

async fn handle_customer_created(pool: &sqlx::PgPool, data: &Value) -> Result<(), ApiError> {
    let customer_id = required_str(data, "id")?;
    let user_id = resolve_user_id(pool, data, None).await?;

    link_paddle_customer(pool, user_id, &customer_id).await?;

    Ok(())
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
        let existing: Option<String> =
            sqlx::query_scalar("SELECT paddle_customer_id FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_optional(pool)
                .await
                .map_err(internal_db_error)?;

        if existing.as_deref() != Some(customer_id) {
            warn!(
                user_id = %user_id,
                customer_id = %customer_id,
                "unable to link Paddle customer id; already assigned to another user"
            );
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

async fn resolve_user_id(
    pool: &sqlx::PgPool,
    data: &Value,
    customer_id: Option<&str>,
) -> Result<Uuid, ApiError> {
    if let Some(user_id) = extract_custom_user_id(data) {
        return Ok(user_id);
    }

    if let Some(email) = extract_email(data) {
        if let Some(user_id) = lookup_user_id_by_email(pool, email).await? {
            return Ok(user_id);
        }
    }

    if let Some(customer_id) = customer_id {
        if let Some(user_id) = lookup_user_id_by_customer(pool, customer_id).await? {
            return Ok(user_id);
        }
    }

    Err(ApiError::new(
        "Unable to match Paddle event to a Rustume user",
    ))
}

async fn lookup_user_id_by_email(
    pool: &sqlx::PgPool,
    email: &str,
) -> Result<Option<Uuid>, ApiError> {
    sqlx::query_scalar("SELECT id FROM users WHERE lower(email) = lower($1)")
        .bind(email)
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

fn extract_email(data: &Value) -> Option<&str> {
    data.get("email").and_then(Value::as_str).or_else(|| {
        data.get("customer")
            .and_then(|customer| customer.get("email"))
            .and_then(Value::as_str)
    })
}

fn extract_custom_user_id(data: &Value) -> Option<Uuid> {
    data.get("custom_data")
        .and_then(|custom| custom.get("user_id"))
        .and_then(Value::as_str)
        .and_then(|value| Uuid::parse_str(value).ok())
}

fn extract_user_id(data: &Value) -> Option<Uuid> {
    extract_custom_user_id(data)
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

fn internal_db_error(err: sqlx::Error) -> ApiError {
    error!("billing database error: {err}");
    ApiError::internal("internal server error")
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Datelike, TimeZone};

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
    fn extract_email_reads_top_level_and_nested_customer_email() {
        let top_level = serde_json::json!({ "email": "dev@example.com" });
        assert_eq!(extract_email(&top_level), Some("dev@example.com"));

        let nested = serde_json::json!({
            "customer": { "email": "nested@example.com" }
        });
        assert_eq!(extract_email(&nested), Some("nested@example.com"));
    }

    #[test]
    fn extract_custom_user_id_reads_custom_data() {
        let data = serde_json::json!({
            "custom_data": { "user_id": "550e8400-e29b-41d4-a716-446655440000" }
        });
        let user_id = extract_custom_user_id(&data).expect("user id");
        assert_eq!(user_id.to_string(), "550e8400-e29b-41d4-a716-446655440000");
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
        let url = std::env::var("TEST_DATABASE_URL")
            .ok()
            .map(|url| url.trim().to_owned())
            .filter(|url| !url.is_empty())
            .or_else(|| {
                std::env::var("DATABASE_URL")
                    .ok()
                    .map(|url| url.trim().to_owned())
                    .filter(|url| !url.is_empty())
            })?;

        if looks_like_test_database_url(&url) {
            Some(url)
        } else {
            eprintln!(
                "SKIP billing integration tests: set TEST_DATABASE_URL (or DATABASE_URL) to a database whose name contains _test"
            );
            None
        }
    }

    #[tokio::test]
    async fn subscription_upsert_is_idempotent_when_database_available() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };

        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(2)
            .connect(&database_url)
            .await
            .expect("connect to test database");
        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .expect("run migrations");

        let user_id = uuid::Uuid::new_v4();
        let workos_id = format!("workos_billing_{user_id}");
        sqlx::query("INSERT INTO users (id, workos_id, email) VALUES ($1, $2, $3)")
            .bind(user_id)
            .bind(&workos_id)
            .bind("billing@example.com")
            .execute(&pool)
            .await
            .expect("insert user");

        let data = serde_json::json!({
            "id": format!("sub_test_{user_id}"),
            "status": "active",
            "customer_id": format!("ctm_test_{user_id}"),
            "items": [{ "price": { "id": "pri_test" } }],
            "current_billing_period": { "ends_at": "2099-01-01T00:00:00Z" },
            "custom_data": { "user_id": user_id.to_string() }
        });

        handle_subscription_upsert(&pool, &data)
            .await
            .expect("first upsert");
        handle_subscription_upsert(&pool, &data)
            .await
            .expect("second upsert");

        let count =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM subscriptions WHERE user_id = $1")
                .bind(user_id)
                .fetch_one(&pool)
                .await
                .expect("count subscriptions");

        assert_eq!(count, 1);

        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(user_id)
            .execute(&pool)
            .await
            .expect("cleanup user");
    }
}
