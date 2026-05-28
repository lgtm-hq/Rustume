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
    let redirect_uri = std::env::var("WORKOS_REDIRECT_URI")
        .map_err(|_| ApiError::internal("WORKOS_REDIRECT_URI is not configured"))?;
    let oauth_state = Uuid::new_v4().to_string();
    let url = cloud.workos.authorize_url(&redirect_uri, &oauth_state);

    let state_cookie = build_oauth_state_cookie(&oauth_state);
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
) -> Result<Response, ApiError> {
    let cloud = state.cloud()?;

    let stored_state = jar.get(OAUTH_STATE_COOKIE).map(|cookie| cookie.value());
    match (stored_state, query.state.as_deref()) {
        (Some(stored), Some(provided)) if stored == provided => {}
        _ => return Err(ApiError::unauthorized("Invalid OAuth state")),
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
            ApiError::new("Authentication failed")
        })?;

    let user = upsert_user(&cloud.db, &workos_user).await.map_err(|err| {
        error!("user upsert failed: {err}");
        ApiError::internal("internal server error")
    })?;

    let (_session, cookie) = cloud.sessions.create(user.id).await.map_err(|err| {
        error!("session creation failed: {err}");
        ApiError::internal("internal server error")
    })?;

    let mut response = Redirect::to("/").into_response();
    append_set_cookie(&mut response, cookie)?;
    append_set_cookie(&mut response, clear_oauth_state_cookie())?;
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

fn oauth_cookie_secure() -> bool {
    std::env::var("WORKOS_REDIRECT_URI")
        .map(|uri| uri.starts_with("https://"))
        .unwrap_or(false)
}

fn build_oauth_state_cookie(oauth_state: &str) -> Cookie<'static> {
    Cookie::build((OAUTH_STATE_COOKIE, oauth_state.to_string()))
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(cookie::time::Duration::minutes(OAUTH_STATE_TTL_MINUTES))
        .secure(oauth_cookie_secure())
        .into()
}

fn clear_oauth_state_cookie() -> Cookie<'static> {
    Cookie::build((OAUTH_STATE_COOKIE, ""))
        .http_only(true)
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(cookie::time::Duration::ZERO)
        .secure(oauth_cookie_secure())
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
