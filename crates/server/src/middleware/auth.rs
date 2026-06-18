//! Session cookie authentication extractor for cloud routes.

use axum::{
    extract::{FromRequestParts, Request, State},
    http::request::Parts,
    middleware::Next,
    response::Response,
};
use axum_extra::extract::CookieJar;
use tracing::error;

use crate::auth::session::SESSION_COOKIE;
use crate::db::User;
use crate::error::ApiError;
use crate::state::AppState;

/// Authenticated user extracted from a valid `rustume_session` cookie.
pub struct AuthUser(pub User);

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let cloud = state.cloud()?;
        let jar = CookieJar::from_request_parts(parts, state)
            .await
            .map_err(|_| unauthorized("Missing session cookie"))?;

        let token = jar
            .get(SESSION_COOKIE)
            .map(|cookie| cookie.value().to_string())
            .ok_or_else(|| unauthorized("Not authenticated"))?;

        let user = cloud
            .sessions
            .user_for_token(&token)
            .await
            .map_err(|err| {
                error!("session lookup failed: {err}");
                ApiError::internal("internal server error")
            })?
            .ok_or_else(|| unauthorized("Invalid or expired session"))?;

        Ok(AuthUser(user))
    }
}

fn unauthorized(message: &str) -> ApiError {
    ApiError::unauthorized(message)
}

/// Require a session on billable routes when hosted require-auth mode is enabled.
pub async fn require_auth_when_enabled(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    if !state.require_auth {
        return Ok(next.run(request).await);
    }

    let (mut parts, body) = request.into_parts();
    AuthUser::from_request_parts(&mut parts, &state).await?;
    Ok(next.run(Request::from_parts(parts, body)).await)
}
