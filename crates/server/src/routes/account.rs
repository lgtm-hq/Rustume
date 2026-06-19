//! Account lifecycle routes for Rustume Cloud.

use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use axum_extra::extract::cookie::CookieJar;
use tracing::{error, info, warn};

use crate::audit::{record_event, AuditEvent};
use crate::auth::session::SESSION_COOKIE;
use crate::db::{DeleteAccountRequest, DeleteAccountResponse};
use crate::email::log_send_failure;
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::net::{self, trusted_client_ip};
use crate::state::AppState;

const DELETE_CONFIRMATION: &str = "DELETE";

/// Permanently delete the authenticated user's account and all associated data.
#[utoipa::path(
    delete,
    path = "/api/account",
    tag = "Account",
    request_body = DeleteAccountRequest,
    responses(
        (status = 200, description = "Account deleted", body = DeleteAccountResponse),
        (status = 400, description = "Invalid confirmation", body = ApiError),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 500, description = "Deletion failed", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn delete_account(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(body): Json<DeleteAccountRequest>,
) -> Result<Response, ApiError> {
    if !is_valid_delete_confirmation(&body.confirmation) {
        return Err(ApiError::new("Type DELETE to confirm account deletion"));
    }

    let cloud = state.cloud()?;
    let ip_address = trusted_client_ip(&headers, net::trusted_proxy_enabled());
    let ip = ip_address.as_deref();

    let resume_count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM resumes
        WHERE user_id = $1
        "#,
    )
    .bind(user.id)
    .fetch_one(&cloud.db)
    .await
    .map_err(internal_db_error)?;

    let email = user.email.clone();
    let workos_id = user.workos_id.clone();

    record_event(
        &cloud.db,
        AuditEvent {
            event_type: "account.delete",
            actor_user_id: Some(user.id),
            resource_type: Some("account"),
            resource_id: Some(user.id),
            metadata: serde_json::json!({
                "resume_count": resume_count,
                "had_paddle_customer": user.paddle_customer_id.is_some(),
            }),
            ip_address: ip,
        },
    )
    .await;

    if user.paddle_customer_id.is_some() {
        info!(
            user_id = %user.id,
            "paddle subscription cancellation deferred until billing API is integrated"
        );
    }

    if let Err(err) = cloud.workos.delete_user(&workos_id).await {
        warn!(
            user_id = %user.id,
            workos_id = %workos_id,
            error = %err,
            "WorkOS user deletion failed; continuing with local data erasure"
        );
    }

    if let Some(cookie) = jar.get(SESSION_COOKIE) {
        cloud.sessions.delete(cookie.value()).await.map_err(|err| {
            error!("session deletion failed during account delete: {err}");
            ApiError::internal("internal server error")
        })?;
    }

    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user.id)
        .execute(&cloud.db)
        .await
        .map_err(|err| {
            error!("user deletion failed: {err}");
            ApiError::internal("failed to delete account")
        })?;

    if let (Some(service), Some(recipient)) = (cloud.email.as_ref(), email.as_deref()) {
        if let Err(err) = service.send_deletion_confirmation(recipient).await {
            log_send_failure("deletion_confirmation", recipient, &err);
        }
    }

    let clear = cloud.sessions.clear_cookie();
    let payload = DeleteAccountResponse {
        deleted: true,
        message: "Account and all data permanently deleted.".to_string(),
    };
    let mut response = (StatusCode::OK, Json(payload)).into_response();
    append_set_cookie(&mut response, clear)?;
    Ok(response)
}

fn is_valid_delete_confirmation(confirmation: &str) -> bool {
    confirmation == DELETE_CONFIRMATION
}

fn internal_db_error(err: sqlx::Error) -> ApiError {
    error!("database error: {err}");
    ApiError::internal("internal server error")
}

fn append_set_cookie(
    response: &mut Response,
    cookie: axum_extra::extract::cookie::Cookie<'static>,
) -> Result<(), ApiError> {
    let header_value = cookie
        .to_string()
        .parse::<header::HeaderValue>()
        .map_err(|err| ApiError::internal(format!("invalid cookie header: {err}")))?;
    response
        .headers_mut()
        .append(header::SET_COOKIE, header_value);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delete_confirmation_requires_exact_match() {
        assert!(is_valid_delete_confirmation("DELETE"));
        assert!(!is_valid_delete_confirmation("delete"));
        assert!(!is_valid_delete_confirmation("DELETE "));
        assert!(!is_valid_delete_confirmation(""));
    }
}
