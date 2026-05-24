use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Redirect, Response},
    Json,
};
use axum_extra::extract::cookie::CookieJar;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::session::SESSION_COOKIE;
use crate::auth::workos::upsert_user;
use crate::db::AuthUserResponse;
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    code: String,
    #[allow(dead_code)]
    state: Option<String>,
}

pub async fn login(State(state): State<AppState>) -> Result<Redirect, ApiError> {
    let cloud = state.cloud()?;
    let redirect_uri = std::env::var("WORKOS_REDIRECT_URI")
        .map_err(|_| ApiError::internal("WORKOS_REDIRECT_URI is not configured"))?;
    let oauth_state = Uuid::new_v4().to_string();
    let url = cloud.workos.authorize_url(&redirect_uri, &oauth_state);
    Ok(Redirect::temporary(&url))
}

pub async fn callback(
    State(state): State<AppState>,
    Query(query): Query<CallbackQuery>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    let cloud = state.cloud()?;
    let ip = client_ip(&headers);
    let user_agent = headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok());

    let workos_user = cloud
        .workos
        .authenticate_with_code(&query.code, ip, user_agent)
        .await
        .map_err(|err| ApiError::new(err.to_string()))?;

    let user = upsert_user(&cloud.db, &workos_user)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;

    let (_session, cookie) = cloud
        .sessions
        .create(user.id)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;

    let mut response = Redirect::to("/").into_response();
    let header_value = cookie
        .to_string()
        .parse::<header::HeaderValue>()
        .map_err(|err| ApiError::internal(format!("invalid session cookie header: {err}")))?;
    response
        .headers_mut()
        .append(header::SET_COOKIE, header_value);
    Ok(response)
}

pub async fn logout(State(state): State<AppState>, jar: CookieJar) -> Result<Response, ApiError> {
    let cloud = state.cloud()?;
    if let Some(cookie) = jar.get(SESSION_COOKIE) {
        cloud
            .sessions
            .delete(cookie.value())
            .await
            .map_err(|err| ApiError::internal(err.to_string()))?;
    }

    let clear = cloud.sessions.clear_cookie();
    let mut response = (StatusCode::NO_CONTENT, ()).into_response();
    let header_value = clear
        .to_string()
        .parse::<header::HeaderValue>()
        .map_err(|err| ApiError::internal(format!("invalid clear-cookie header: {err}")))?;
    response
        .headers_mut()
        .append(header::SET_COOKIE, header_value);
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

fn client_ip(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .or_else(|| {
            headers
                .get(header::FORWARDED)
                .and_then(|value| value.to_str().ok())
        })
}
