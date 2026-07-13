//! Per-user and per-IP rate limiting for Rustume Cloud.

use axum::{
    extract::{ConnectInfo, Request, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use governor::{
    clock::{Clock, DefaultClock},
    RateLimiter,
};
use metrics::gauge;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, UNIX_EPOCH};
use tracing::warn;

use crate::auth::session::SESSION_COOKIE;
use crate::config::RateLimitConfig;
use crate::net::trusted_client_ip;
use crate::state::AppState;

type KeyedRateLimiter =
    RateLimiter<String, dashmap::DashMap<String, governor::state::InMemoryState>, DefaultClock>;

/// Route groups with distinct rate limits.
#[derive(Debug, Clone, Copy)]
pub enum RateLimitGroup {
    ResumeCrud,
    Import,
    Preview,
    Pdf,
    Auth,
    AccountDelete,
    Health,
    Metrics,
    Billable,
    Unauthenticated,
}

/// Shared in-memory keyed rate limiters for cloud mode.
pub struct RateLimitState {
    trusted_proxy: bool,
    resume_crud: KeyedRateLimiter,
    import: KeyedRateLimiter,
    preview: KeyedRateLimiter,
    pdf: KeyedRateLimiter,
    auth: KeyedRateLimiter,
    account_delete: KeyedRateLimiter,
    health: KeyedRateLimiter,
    metrics: KeyedRateLimiter,
    billable: KeyedRateLimiter,
    unauthenticated: KeyedRateLimiter,
}

impl RateLimitState {
    /// Build limiters from configuration.
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            trusted_proxy: config.trusted_proxy,
            resume_crud: RateLimiter::dashmap(config.resume_crud_quota()),
            import: RateLimiter::dashmap(config.import_quota()),
            preview: RateLimiter::dashmap(config.preview_quota()),
            pdf: RateLimiter::dashmap(config.pdf_quota()),
            auth: RateLimiter::dashmap(config.auth_quota()),
            account_delete: RateLimiter::dashmap(config.account_delete_quota()),
            health: RateLimiter::dashmap(config.health_quota()),
            metrics: RateLimiter::dashmap(config.metrics_quota()),
            billable: RateLimiter::dashmap(config.billable_quota()),
            unauthenticated: RateLimiter::dashmap(config.unauthenticated_quota()),
        }
    }

    fn limiter(&self, group: RateLimitGroup) -> &KeyedRateLimiter {
        match group {
            RateLimitGroup::ResumeCrud => &self.resume_crud,
            RateLimitGroup::Import => &self.import,
            RateLimitGroup::Preview => &self.preview,
            RateLimitGroup::Pdf => &self.pdf,
            RateLimitGroup::Auth => &self.auth,
            RateLimitGroup::AccountDelete => &self.account_delete,
            RateLimitGroup::Health => &self.health,
            RateLimitGroup::Metrics => &self.metrics,
            RateLimitGroup::Billable => &self.billable,
            RateLimitGroup::Unauthenticated => &self.unauthenticated,
        }
    }

    fn check(&self, group: RateLimitGroup, key: &String) -> Result<(), RateLimitExceeded> {
        match self.limiter(group).check_key(key) {
            Ok(()) => Ok(()),
            Err(not_until) => {
                let wait = not_until.wait_time_from(DefaultClock::default().now());
                Err(RateLimitExceeded::new(wait))
            }
        }
    }

    /// Remove stale keyed state from all limiters and refresh the Prometheus gauge.
    pub fn evict_stale(&self) {
        self.resume_crud.retain_recent();
        self.resume_crud.shrink_to_fit();
        self.import.retain_recent();
        self.import.shrink_to_fit();
        self.preview.retain_recent();
        self.preview.shrink_to_fit();
        self.pdf.retain_recent();
        self.pdf.shrink_to_fit();
        self.auth.retain_recent();
        self.auth.shrink_to_fit();
        self.account_delete.retain_recent();
        self.account_delete.shrink_to_fit();
        self.health.retain_recent();
        self.health.shrink_to_fit();
        self.metrics.retain_recent();
        self.metrics.shrink_to_fit();
        self.billable.retain_recent();
        self.billable.shrink_to_fit();
        self.unauthenticated.retain_recent();
        self.unauthenticated.shrink_to_fit();

        gauge!("rustume_rate_limit_keys").set(self.key_count() as f64);
    }

    /// Total number of keyed entries across all limiters.
    fn key_count(&self) -> usize {
        self.resume_crud.len()
            + self.import.len()
            + self.preview.len()
            + self.pdf.len()
            + self.auth.len()
            + self.account_delete.len()
            + self.health.len()
            + self.metrics.len()
            + self.billable.len()
            + self.unauthenticated.len()
    }

    /// Spawn a background task that evicts stale rate-limit keys on a fixed interval.
    pub fn spawn_eviction_task(rate_limits: Arc<Self>) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(5 * 60));
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                interval.tick().await;
                rate_limits.evict_stale();
            }
        });
    }
}

/// JSON body returned when a client exceeds a rate limit.
#[derive(Debug, Serialize, Deserialize)]
pub struct RateLimitErrorBody {
    pub error: String,
    pub retry_after: u64,
}

/// Rate limit rejection with retry metadata for response headers.
#[derive(Debug, Clone, Copy)]
pub struct RateLimitExceeded {
    retry_after: Duration,
}

impl RateLimitExceeded {
    fn new(retry_after: Duration) -> Self {
        Self { retry_after }
    }

    fn retry_after_secs(&self) -> u64 {
        self.retry_after.as_secs().max(1)
    }

    fn reset_timestamp(&self) -> u64 {
        std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
            + self.retry_after_secs()
    }
}

impl IntoResponse for RateLimitExceeded {
    fn into_response(self) -> Response {
        let retry_after = self.retry_after_secs();
        let body = RateLimitErrorBody {
            error: "Too many requests. Please try again shortly.".to_string(),
            retry_after,
        };

        let mut response = (StatusCode::TOO_MANY_REQUESTS, Json(body)).into_response();
        let headers = response.headers_mut();
        set_rate_limit_headers(headers, retry_after, self.reset_timestamp());
        response
    }
}

fn set_rate_limit_headers(headers: &mut HeaderMap, retry_after: u64, reset_timestamp: u64) {
    if let Ok(value) = HeaderValue::from_str(&retry_after.to_string()) {
        headers.insert(header::RETRY_AFTER, value);
    }
    if let Ok(value) = HeaderValue::from_str("0") {
        headers.insert("X-RateLimit-Remaining", value);
    }
    if let Ok(value) = HeaderValue::from_str(&reset_timestamp.to_string()) {
        headers.insert("X-RateLimit-Reset", value);
    }
}

fn ip_rate_limit_key(
    headers: &HeaderMap,
    remote_addr: Option<SocketAddr>,
    trusted_proxy: bool,
) -> String {
    if let Some(ip) = trusted_client_ip(headers, trusted_proxy) {
        return format!("ip:{ip}");
    }
    if let Some(addr) = remote_addr {
        return format!("ip:{}", addr.ip());
    }
    "ip:unknown".to_string()
}

fn session_token_from_headers(headers: &HeaderMap) -> Option<String> {
    let cookie_header = headers.get(header::COOKIE)?.to_str().ok()?;
    let prefix = format!("{SESSION_COOKIE}=");

    cookie_header.split(';').find_map(|part| {
        let part = part.trim();
        part.strip_prefix(&prefix)
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    })
}

async fn session_rate_limit_key(
    state: &AppState,
    headers: &HeaderMap,
    remote_addr: Option<SocketAddr>,
    trusted_proxy: bool,
) -> String {
    let Ok(cloud) = state.cloud() else {
        return ip_rate_limit_key(headers, remote_addr, trusted_proxy);
    };

    let Some(token) = session_token_from_headers(headers) else {
        return ip_rate_limit_key(headers, remote_addr, trusted_proxy);
    };

    match cloud.sessions.user_for_token(&token).await {
        Ok(Some(user)) => format!("user:{}", user.id),
        Ok(None) => ip_rate_limit_key(headers, remote_addr, trusted_proxy),
        Err(err) => {
            warn!("session lookup failed during rate limiting: {err}");
            ip_rate_limit_key(headers, remote_addr, trusted_proxy)
        }
    }
}

fn remote_addr_from_request(request: &Request) -> Option<SocketAddr> {
    request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(addr)| *addr)
}

async fn enforce_ip_rate_limit(
    rate_limits: &RateLimitState,
    group: RateLimitGroup,
    headers: &HeaderMap,
    remote_addr: Option<SocketAddr>,
    request: Request,
    next: Next,
) -> Result<Response, RateLimitExceeded> {
    let key = ip_rate_limit_key(headers, remote_addr, rate_limits.trusted_proxy);
    rate_limits.check(group, &key)?;
    Ok(next.run(request).await)
}

async fn enforce_session_rate_limit(
    state: &AppState,
    rate_limits: &RateLimitState,
    group: RateLimitGroup,
    headers: &HeaderMap,
    remote_addr: Option<SocketAddr>,
    request: Request,
    next: Next,
) -> Result<Response, RateLimitExceeded> {
    let trusted_proxy = rate_limits.trusted_proxy;
    let ip_key = ip_rate_limit_key(headers, remote_addr, trusted_proxy);
    let session_key = session_rate_limit_key(state, headers, remote_addr, trusted_proxy).await;

    if session_key != ip_key {
        rate_limits.check(group, &ip_key)?;
        rate_limits.check(group, &session_key)?;
    } else {
        rate_limits.check(group, &ip_key)?;
    }
    Ok(next.run(request).await)
}

async fn enforce_rate_limit(
    state: &AppState,
    group: RateLimitGroup,
    request: Request,
    next: Next,
) -> Result<Response, RateLimitExceeded> {
    let Some(rate_limits) = state.rate_limits.as_ref() else {
        return Ok(next.run(request).await);
    };

    let remote_addr = remote_addr_from_request(&request);
    let headers = request.headers().clone();

    match group {
        RateLimitGroup::Health | RateLimitGroup::Metrics | RateLimitGroup::Unauthenticated => {
            enforce_ip_rate_limit(rate_limits, group, &headers, remote_addr, request, next).await
        }
        RateLimitGroup::Auth
        | RateLimitGroup::AccountDelete
        | RateLimitGroup::ResumeCrud
        | RateLimitGroup::Import
        | RateLimitGroup::Preview
        | RateLimitGroup::Pdf
        | RateLimitGroup::Billable => {
            enforce_session_rate_limit(
                state,
                rate_limits,
                group,
                &headers,
                remote_addr,
                request,
                next,
            )
            .await
        }
    }
}

macro_rules! rate_limit_middleware {
    ($name:ident, $group:expr) => {
        #[allow(dead_code)]
        pub async fn $name(
            State(state): State<AppState>,
            request: Request,
            next: Next,
        ) -> Result<Response, RateLimitExceeded> {
            enforce_rate_limit(&state, $group, request, next).await
        }
    };
}

rate_limit_middleware!(rate_limit_resume_crud, RateLimitGroup::ResumeCrud);
rate_limit_middleware!(rate_limit_import, RateLimitGroup::Import);
rate_limit_middleware!(rate_limit_preview, RateLimitGroup::Preview);
rate_limit_middleware!(rate_limit_pdf, RateLimitGroup::Pdf);
rate_limit_middleware!(rate_limit_auth, RateLimitGroup::Auth);
rate_limit_middleware!(rate_limit_account_delete, RateLimitGroup::AccountDelete);
rate_limit_middleware!(rate_limit_health, RateLimitGroup::Health);
rate_limit_middleware!(rate_limit_metrics, RateLimitGroup::Metrics);
rate_limit_middleware!(rate_limit_unauthenticated, RateLimitGroup::Unauthenticated);

/// Per-user rate limiting for billable routes (templates, parse, validate).
pub async fn rate_limit_billable(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, RateLimitExceeded> {
    enforce_rate_limit(&state, RateLimitGroup::Billable, request, next).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::RateLimitConfig;
    use std::num::NonZeroU32;
    use std::sync::Arc;
    use std::thread;
    use std::time::Duration;

    fn test_rate_limits(limit: u32) -> Arc<RateLimitState> {
        let config = RateLimitConfig {
            health_per_min: limit,
            metrics_per_min: limit,
            unauthenticated_per_min: limit,
            auth_per_min: limit,
            account_delete_per_min: limit,
            resume_crud_per_min: limit,
            import_per_min: limit,
            preview_per_min: limit,
            pdf_per_min: limit,
            ..Default::default()
        };
        Arc::new(RateLimitState::new(config))
    }

    fn test_rate_limits_with_quota(quota: governor::Quota) -> RateLimitState {
        RateLimitState {
            trusted_proxy: false,
            resume_crud: RateLimiter::dashmap(quota),
            import: RateLimiter::dashmap(quota),
            preview: RateLimiter::dashmap(quota),
            pdf: RateLimiter::dashmap(quota),
            auth: RateLimiter::dashmap(quota),
            account_delete: RateLimiter::dashmap(quota),
            health: RateLimiter::dashmap(quota),
            metrics: RateLimiter::dashmap(quota),
            billable: RateLimiter::dashmap(quota),
            unauthenticated: RateLimiter::dashmap(quota),
        }
    }

    #[test]
    fn limiter_returns_error_after_threshold() {
        let limits = test_rate_limits(2);
        let key = "ip:test";

        assert!(limits
            .check(RateLimitGroup::Health, &key.to_string())
            .is_ok());
        assert!(limits
            .check(RateLimitGroup::Health, &key.to_string())
            .is_ok());
        assert!(limits
            .check(RateLimitGroup::Health, &key.to_string())
            .is_err());
    }

    #[test]
    fn limiter_keys_are_isolated_by_group() {
        let limits = test_rate_limits(1);
        let key = "ip:test";

        assert!(limits
            .check(RateLimitGroup::Health, &key.to_string())
            .is_ok());
        assert!(limits
            .check(RateLimitGroup::Metrics, &key.to_string())
            .is_ok());
    }

    #[test]
    fn evict_stale_drops_keys_after_quota_window() {
        let quota = governor::Quota::per_second(NonZeroU32::new(1).expect("quota"));
        let limits = test_rate_limits_with_quota(quota);
        let key = "ip:evict-test".to_string();

        assert!(limits.check(RateLimitGroup::Health, &key).is_ok());
        assert_eq!(limits.key_count(), 1);

        thread::sleep(Duration::from_secs(2));
        limits.evict_stale();
        assert_eq!(limits.key_count(), 0);
    }

    #[test]
    fn rate_limit_response_includes_retry_metadata() {
        let exceeded = RateLimitExceeded::new(Duration::from_secs(12));
        let response = exceeded.into_response();
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(response.headers().get("Retry-After").unwrap(), "12");
        assert_eq!(
            response.headers().get("X-RateLimit-Remaining").unwrap(),
            "0"
        );
        assert!(response.headers().get("X-RateLimit-Reset").is_some());
    }
}
