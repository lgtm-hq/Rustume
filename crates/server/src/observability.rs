//! Optional observability integrations (Sentry).

use axum::body::Body;
use axum::http::Request;
use sentry_tower::{NewSentryLayer, SentryHttpLayer};

/// Initialize Sentry when `SENTRY_DSN` is set. Returns a guard that must live for the process lifetime.
pub fn init_sentry() -> Option<sentry::ClientInitGuard> {
    let dsn = std::env::var("SENTRY_DSN")
        .ok()
        .filter(|value| !value.is_empty())?;

    let guard = sentry::init((
        dsn,
        sentry::ClientOptions {
            release: sentry::release_name!(),
            ..Default::default()
        },
    ));
    tracing::info!("Sentry error tracking initialized");
    Some(guard)
}

/// Returns `true` when Sentry is configured via a non-empty `SENTRY_DSN`.
pub fn sentry_enabled() -> bool {
    std::env::var("SENTRY_DSN")
        .ok()
        .is_some_and(|value| !value.is_empty())
}

/// Apply Sentry HTTP tracing layers when configured.
pub fn apply_sentry_layers<S>(router: axum::Router<S>) -> axum::Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    if sentry_enabled() {
        router
            .layer(SentryHttpLayer::new().enable_transaction())
            .layer(NewSentryLayer::<Request<Body>>::new_from_top())
    } else {
        router
    }
}
