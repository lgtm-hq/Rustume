use axum::{extract::FromRequestParts, http::request::Parts};
use axum_extra::extract::CookieJar;

use crate::auth::session::SESSION_COOKIE;
use crate::db::User;
use crate::error::{ApiError, ApiErrorKind};
use crate::state::AppState;

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
            .map_err(|err| ApiError::internal(err.to_string()))?
            .ok_or_else(|| unauthorized("Invalid or expired session"))?;

        Ok(AuthUser(user))
    }
}

fn unauthorized(message: &str) -> ApiError {
    ApiError {
        error: message.to_string(),
        details: None,
        kind: ApiErrorKind::Unauthorized,
    }
}
