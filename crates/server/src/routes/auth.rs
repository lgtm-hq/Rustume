//! WorkOS AuthKit login, callback, logout, and session probe routes.

use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Redirect, Response},
    Json,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use serde::Deserialize;
use tracing::error;
use uuid::Uuid;

use crate::audit::{record_event, AuditEvent};
use crate::auth::session::SESSION_COOKIE;
use crate::auth::workos::upsert_user;
use crate::db::{AuthMeUnauthorizedResponse, AuthUserResponse};
use crate::error::ApiError;
use crate::net::{self, trusted_client_ip};
use crate::policy::record_signup_policy_acceptances;
use crate::state::AppState;
use crate::subscription;

const OAUTH_STATE_COOKIE: &str = "rustume_oauth_state";
const OAUTH_STATE_TTL_MINUTES: i64 = 10;

/// OAuth query parameters returned by WorkOS on `/auth/callback`.
#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

/// Redirect the browser to WorkOS AuthKit for sign-in.
pub async fn login(State(state): State<AppState>) -> Result<Response, ApiError> {
    let cloud = state.cloud()?;
    let oauth_state = Uuid::new_v4().to_string();
    let url = cloud
        .workos
        .authorize_url(&cloud.workos_redirect_uri, &oauth_state);

    let state_cookie = build_oauth_state_cookie(&oauth_state, &cloud.workos_redirect_uri);
    let mut response = Redirect::temporary(&url).into_response();
    append_set_cookie(&mut response, state_cookie)?;
    Ok(response)
}

/// Handle the WorkOS OAuth callback, upsert the user, and set the session cookie.
pub async fn callback(
    State(state): State<AppState>,
    jar: CookieJar,
    query: Result<Query<CallbackQuery>, axum::extract::rejection::QueryRejection>,
    headers: HeaderMap,
) -> Response {
    let ip = trusted_client_ip(&headers, net::trusted_proxy_enabled());

    let query = match query {
        Ok(Query(query)) => query,
        Err(rejection) => {
            error!("OAuth callback query rejected: {rejection}");
            audit_callback_failure(&state, "invalid_query", ip.as_deref()).await;
            return oauth_error_redirect("authentication_failed");
        }
    };

    if let Some(code) = oauth_callback_error_code(&query) {
        if query.error.is_some() {
            error!("WorkOS OAuth callback returned error");
            audit_callback_failure(&state, "provider_error", ip.as_deref()).await;
        } else {
            error!("OAuth callback missing authorization code");
            audit_callback_failure(&state, "missing_code", ip.as_deref()).await;
        }
        return oauth_error_redirect(code);
    }

    let Some(code) = query.code.as_deref() else {
        audit_callback_failure(&state, "missing_code", ip.as_deref()).await;
        return oauth_error_redirect("authentication_failed");
    };

    match callback_inner(state, jar, code, query.state.as_deref(), headers).await {
        Ok(response) => response,
        Err(code) => oauth_error_redirect(code),
    }
}

fn oauth_callback_error_code(query: &CallbackQuery) -> Option<&'static str> {
    if query.error.is_some() {
        return Some("authentication_failed");
    }

    match query.code.as_deref() {
        Some(code) if !code.is_empty() => None,
        _ => Some("authentication_failed"),
    }
}

async fn callback_inner(
    state: AppState,
    jar: CookieJar,
    code: &str,
    oauth_state: Option<&str>,
    headers: HeaderMap,
) -> Result<Response, &'static str> {
    let cloud = state.cloud().map_err(|err| {
        error!("cloud configuration unavailable: {:?}", err);
        "server_error"
    })?;

    let stored_state = jar.get(OAUTH_STATE_COOKIE).map(|cookie| cookie.value());
    match (stored_state, oauth_state) {
        (Some(stored), Some(provided)) if stored == provided => {}
        _ => {
            record_auth_failure(
                &cloud.db,
                "invalid_state",
                trusted_client_ip(&headers, net::trusted_proxy_enabled()).as_deref(),
            )
            .await;
            return Err("invalid_state");
        }
    }

    let ip_address = trusted_client_ip(&headers, net::trusted_proxy_enabled());
    let ip = ip_address.as_deref();
    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok());

    let workos_user = match cloud
        .workos
        .authenticate_with_code(code, ip, user_agent)
        .await
    {
        Ok(user) => user,
        Err(err) => {
            error!("WorkOS authentication failed: {err}");
            record_auth_failure(&cloud.db, "authentication_failed", ip).await;
            return Err("authentication_failed");
        }
    };

    let upsert = upsert_user(&cloud.db, &workos_user).await.map_err(|err| {
        error!("user upsert failed: {err}");
        "server_error"
    })?;
    let user = upsert.user;

    if upsert.is_new {
        record_signup_policy_acceptances(&cloud.db, user.id, ip).await;
    }

    let (_session, cookie) = cloud.sessions.create(user.id).await.map_err(|err| {
        error!("session creation failed: {err}");
        "server_error"
    })?;

    let mut response = Redirect::to("/?signed_in=1").into_response();
    append_set_cookie(&mut response, cookie).map_err(|_| "server_error")?;
    append_set_cookie(
        &mut response,
        clear_oauth_state_cookie(&cloud.workos_redirect_uri),
    )
    .map_err(|_| "server_error")?;

    record_event(
        &cloud.db,
        AuditEvent {
            event_type: "auth.login.success",
            actor_user_id: Some(user.id),
            resource_type: Some("auth"),
            resource_id: None,
            metadata: serde_json::json!({}),
            ip_address: ip,
        },
    )
    .await;

    Ok(response)
}

/// Clear the session cookie and delete the server-side session row.
pub async fn logout(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    let cloud = state.cloud()?;
    let mut actor_user_id = None;
    if let Some(cookie) = jar.get(SESSION_COOKIE) {
        actor_user_id = cloud
            .sessions
            .user_for_token(cookie.value())
            .await
            .ok()
            .flatten()
            .map(|user| user.id);
        cloud.sessions.delete(cookie.value()).await.map_err(|err| {
            error!("session deletion failed: {err}");
            ApiError::internal("internal server error")
        })?;
    }

    record_event(
        &cloud.db,
        AuditEvent {
            event_type: "auth.logout",
            actor_user_id,
            resource_type: Some("auth"),
            resource_id: None,
            metadata: serde_json::json!({}),
            ip_address: trusted_client_ip(&headers, net::trusted_proxy_enabled()).as_deref(),
        },
    )
    .await;

    let clear = cloud.sessions.clear_cookie();
    let mut response = (StatusCode::NO_CONTENT, ()).into_response();
    append_set_cookie(&mut response, clear)?;
    Ok(response)
}

/// Return the currently authenticated user (requires session cookie).
#[utoipa::path(
    get,
    path = "/auth/me",
    tag = "Auth",
    responses(
        (status = 200, description = "Authenticated user", body = AuthUserResponse),
        (status = 401, description = "Not authenticated", body = AuthMeUnauthorizedResponse),
        (status = 404, description = "Cloud auth not enabled", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn me(State(state): State<AppState>, jar: CookieJar) -> Result<Response, ApiError> {
    let cloud = state.cloud()?;
    let require_auth = state.require_auth;

    if let Some(cookie) = jar.get(SESSION_COOKIE) {
        if let Some(user) = cloud
            .sessions
            .user_for_token(cookie.value())
            .await
            .map_err(|err| {
                error!("session lookup failed: {err}");
                ApiError::internal("internal server error")
            })?
        {
            let access = subscription::load_access(&cloud.db, user.id).await?;
            return Ok(Json(AuthUserResponse::from_user(
                user,
                require_auth,
                access.to_info(),
            ))
            .into_response());
        }
    }

    Ok((
        StatusCode::UNAUTHORIZED,
        Json(AuthMeUnauthorizedResponse {
            error: "Not authenticated".to_string(),
            require_auth,
        }),
    )
        .into_response())
}

fn oauth_error_redirect(code: &'static str) -> Response {
    let path = match code {
        "invalid_state" => "/?auth_error=invalid_state",
        "authentication_failed" => "/?auth_error=authentication_failed",
        "server_error" => "/?auth_error=server_error",
        _ => "/?auth_error=server_error",
    };
    Redirect::to(path).into_response()
}

fn oauth_cookie_secure(redirect_uri: &str) -> bool {
    redirect_uri.starts_with("https://")
}

fn build_oauth_state_cookie(oauth_state: &str, redirect_uri: &str) -> Cookie<'static> {
    Cookie::build((OAUTH_STATE_COOKIE, oauth_state.to_string()))
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(cookie::time::Duration::minutes(OAUTH_STATE_TTL_MINUTES))
        .secure(oauth_cookie_secure(redirect_uri))
        .into()
}

fn clear_oauth_state_cookie(redirect_uri: &str) -> Cookie<'static> {
    Cookie::build((OAUTH_STATE_COOKIE, ""))
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(cookie::time::Duration::ZERO)
        .secure(oauth_cookie_secure(redirect_uri))
        .into()
}

fn append_set_cookie(response: &mut Response, cookie: Cookie<'static>) -> Result<(), ApiError> {
    let header_value = cookie
        .to_string()
        .parse::<header::HeaderValue>()
        .map_err(|err| ApiError::internal(format!("invalid cookie header: {err}")))?;
    response
        .headers_mut()
        .append(header::SET_COOKIE, header_value);
    Ok(())
}

async fn record_auth_failure(pool: &sqlx::PgPool, reason: &str, ip_address: Option<&str>) {
    record_event(
        pool,
        AuditEvent {
            event_type: "auth.login.failure",
            actor_user_id: None,
            resource_type: Some("auth"),
            resource_id: None,
            metadata: serde_json::json!({ "reason": reason }),
            ip_address,
        },
    )
    .await;
}

async fn audit_callback_failure(state: &AppState, reason: &str, ip_address: Option<&str>) {
    if let Ok(cloud) = state.cloud() {
        record_auth_failure(&cloud.db, reason, ip_address).await;
    }
}

#[cfg(test)]
mod policy_acceptance_tests {
    use super::*;
    use crate::auth::workos::{upsert_user, WorkOsUser};
    use crate::config;
    use crate::policy::record_signup_policy_acceptances;
    use sqlx::postgres::PgPoolOptions;
    use sqlx::Row;
    use uuid::Uuid;

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
                "SKIP auth policy acceptance tests: set TEST_DATABASE_URL (or DATABASE_URL) to a database whose name contains _test"
            );
            None
        }
    }

    async fn connect_test_pool(database_url: &str) -> sqlx::PgPool {
        let pool = PgPoolOptions::new()
            .max_connections(2)
            .connect(database_url)
            .await
            .expect("connect to test database for auth policy acceptance tests");
        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .expect("run migrations for auth policy acceptance tests");
        pool
    }

    async fn cleanup_user(pool: &sqlx::PgPool, user_id: Uuid) {
        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(user_id)
            .execute(pool)
            .await
            .expect("cleanup user");
    }

    async fn count_policy_acceptances(pool: &sqlx::PgPool, user_id: Uuid) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*)::bigint FROM policy_acceptances WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await
            .expect("count policy acceptances")
    }

    fn sample_workos_user(suffix: &str) -> WorkOsUser {
        WorkOsUser {
            id: format!("workos_policy_{suffix}"),
            email: format!("policy-{suffix}@example.com"),
            first_name: Some("Policy".to_string()),
            last_name: Some("Tester".to_string()),
        }
    }

    #[tokio::test]
    async fn signup_records_policy_acceptances_for_new_user_only() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };

        let pool = connect_test_pool(&database_url).await;
        let suffix = Uuid::new_v4().to_string();
        let workos_user = sample_workos_user(&suffix);

        let first = upsert_user(&pool, &workos_user)
            .await
            .expect("first upsert");
        assert!(first.is_new);

        record_signup_policy_acceptances(&pool, first.user.id, Some("203.0.113.10")).await;

        assert_eq!(count_policy_acceptances(&pool, first.user.id).await, 2);

        let rows = sqlx::query(
            "SELECT policy, version FROM policy_acceptances WHERE user_id = $1 ORDER BY policy",
        )
        .bind(first.user.id)
        .fetch_all(&pool)
        .await
        .expect("fetch policy acceptances");

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].get::<String, _>("policy"), "privacy");
        assert_eq!(rows[0].get::<String, _>("version"), config::PRIVACY_VERSION);
        assert_eq!(rows[1].get::<String, _>("policy"), "terms");
        assert_eq!(rows[1].get::<String, _>("version"), config::TERMS_VERSION);

        let second = upsert_user(&pool, &workos_user)
            .await
            .expect("second upsert");
        assert!(!second.is_new);
        assert_eq!(second.user.id, first.user.id);

        assert_eq!(count_policy_acceptances(&pool, first.user.id).await, 2);

        cleanup_user(&pool, first.user.id).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn oauth_error_redirect_uses_safe_query_code() {
        let response = oauth_error_redirect("invalid_state");
        assert_eq!(response.status(), StatusCode::SEE_OTHER);
        assert_eq!(
            response
                .headers()
                .get(header::LOCATION)
                .and_then(|value| value.to_str().ok()),
            Some("/?auth_error=invalid_state")
        );
    }

    #[test]
    fn oauth_callback_error_code_when_workos_returns_error() {
        let query = CallbackQuery {
            code: None,
            state: Some("state".to_string()),
            error: Some("access_denied".to_string()),
        };

        assert_eq!(
            oauth_callback_error_code(&query),
            Some("authentication_failed")
        );
    }

    #[test]
    fn oauth_callback_error_code_when_code_is_missing() {
        let query = CallbackQuery {
            code: None,
            state: Some("state".to_string()),
            error: None,
        };

        assert_eq!(
            oauth_callback_error_code(&query),
            Some("authentication_failed")
        );
    }

    #[test]
    fn oauth_callback_error_code_none_when_code_present() {
        let query = CallbackQuery {
            code: Some("auth_code".to_string()),
            state: Some("state".to_string()),
            error: None,
        };

        assert_eq!(oauth_callback_error_code(&query), None);
    }
}
