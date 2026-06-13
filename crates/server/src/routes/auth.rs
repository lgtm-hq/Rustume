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

use crate::auth::session::SESSION_COOKIE;
use crate::auth::workos::upsert_user;
use crate::db::AuthUserResponse;
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::state::AppState;

const OAUTH_STATE_COOKIE: &str = "rustume_oauth_state";
const OAUTH_STATE_TTL_MINUTES: i64 = 10;

/// OAuth query parameters returned by WorkOS on `/auth/callback`.
#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    code: String,
    state: Option<String>,
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
    Query(query): Query<CallbackQuery>,
    headers: HeaderMap,
) -> Response {
    match callback_inner(state, jar, query, headers).await {
        Ok(response) => response,
        Err(code) => oauth_error_redirect(code),
    }
}

async fn callback_inner(
    state: AppState,
    jar: CookieJar,
    query: CallbackQuery,
    headers: HeaderMap,
) -> Result<Response, &'static str> {
    let cloud = state.cloud().map_err(|_| "server_error")?;

    let stored_state = jar.get(OAUTH_STATE_COOKIE).map(|cookie| cookie.value());
    match (stored_state, query.state.as_deref()) {
        (Some(stored), Some(provided)) if stored == provided => {}
        _ => return Err("invalid_state"),
    }

    let ip = trusted_client_ip(&headers);
    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok());

    let workos_user = cloud
        .workos
        .authenticate_with_code(&query.code, ip, user_agent)
        .await
        .map_err(|err| {
            error!("WorkOS authentication failed: {err}");
            "authentication_failed"
        })?;

    let user = upsert_user(&cloud.db, &workos_user).await.map_err(|err| {
        error!("user upsert failed: {err}");
        "server_error"
    })?;

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
    Ok(response)
}

/// Clear the session cookie and delete the server-side session row.
pub async fn logout(State(state): State<AppState>, jar: CookieJar) -> Result<Response, ApiError> {
    let cloud = state.cloud()?;
    if let Some(cookie) = jar.get(SESSION_COOKIE) {
        cloud.sessions.delete(cookie.value()).await.map_err(|err| {
            error!("session deletion failed: {err}");
            ApiError::internal("internal server error")
        })?;
    }

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
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 404, description = "Cloud auth not enabled", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn me(AuthUser(user): AuthUser) -> Json<AuthUserResponse> {
    Json(user.into())
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

fn trusted_client_ip(headers: &HeaderMap) -> Option<&str> {
    if !matches!(std::env::var("TRUSTED_PROXY").as_deref(), Ok("true" | "1")) {
        return None;
    }

    headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
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
}
