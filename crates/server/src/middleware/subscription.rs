//! Subscription grace-period enforcement for authenticated cloud routes.

use axum::{
    extract::{FromRequestParts, Request, State},
    middleware::Next,
    response::Response,
};
use axum_extra::extract::CookieJar;

use crate::auth::session::SESSION_COOKIE;
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::state::AppState;
use crate::subscription;

/// Enforce subscription render access for signed-in cloud users.
///
/// Anonymous requests pass through when hosted require-auth is disabled.
/// Stale session cookies on open deployments also pass through so render stays
/// available without manual cookie clearing.
pub async fn require_subscription_render(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    if state.cloud.is_none() {
        return Ok(next.run(request).await);
    }

    let (mut parts, body) = request.into_parts();
    let jar = CookieJar::from_request_parts(&mut parts, &state)
        .await
        .map_err(|_| ApiError::internal("failed to read cookies"))?;

    if jar.get(SESSION_COOKIE).is_none() && !state.require_auth {
        return Ok(next.run(Request::from_parts(parts, body)).await);
    }

    let user = match AuthUser::from_request_parts(&mut parts, &state).await {
        Ok(AuthUser(user)) => user,
        Err(_err) if !state.require_auth => {
            return Ok(next.run(Request::from_parts(parts, body)).await);
        }
        Err(err) => return Err(err),
    };

    let cloud = state.cloud()?;
    let access = subscription::load_access(&cloud.db, user.id).await?;
    access.ensure_render()?;

    Ok(next.run(Request::from_parts(parts, body)).await)
}
