//! Subscription grace-period enforcement for authenticated cloud routes.

use axum::{
    extract::{FromRequestParts, Request, State},
    middleware::Next,
    response::Response,
};

use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::state::AppState;
use crate::subscription;

/// Enforce subscription render access for signed-in cloud users.
///
/// Self-hosted deployments have no accounts and pass straight through. On cloud
/// every request must carry a valid session, so there is no anonymous or
/// stale-cookie relaxation path.
pub async fn require_subscription_render(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let Some(cloud) = state.cloud.clone() else {
        return Ok(next.run(request).await);
    };

    let (mut parts, body) = request.into_parts();
    let AuthUser(user) = AuthUser::from_request_parts(&mut parts, &state).await?;

    let access = subscription::load_access(&cloud.db, user.id).await?;
    access.ensure_render()?;

    Ok(next.run(Request::from_parts(parts, body)).await)
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use axum::body::Body;
    use axum::http::{Request as HttpRequest, StatusCode};
    use axum::routing::get;
    use axum::Router;
    use tower::ServiceExt;

    use super::*;
    use crate::cloud::test_cloud_state;
    use crate::routes::static_dir;

    fn app(state: AppState) -> Router {
        Router::new()
            .route("/render", get(|| async { "ok" }))
            .layer(axum::middleware::from_fn_with_state(
                state.clone(),
                require_subscription_render,
            ))
            .with_state(state)
    }

    async fn status_for(state: AppState) -> StatusCode {
        app(state)
            .oneshot(
                HttpRequest::builder()
                    .uri("/render")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("router response")
            .status()
    }

    /// No anonymous relaxation path survives under cloud, even for a state that
    /// advertises `require_auth: false`.
    #[tokio::test]
    async fn anonymous_cloud_request_is_rejected_even_when_flag_is_off() {
        let state =
            AppState::with_require_auth(Arc::new(static_dir()), Some(test_cloud_state()), false);

        assert_eq!(status_for(state).await, StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn anonymous_self_hosted_request_passes_through() {
        let state = AppState::with_require_auth(Arc::new(static_dir()), None, false);

        assert_eq!(status_for(state).await, StatusCode::OK);
    }
}
