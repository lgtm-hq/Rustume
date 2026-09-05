use axum::extract::{Request, State};
use axum::http::header::HeaderValue;
use axum::middleware::Next;
use axum::response::Response;

use crate::state::AppState;

/// Baseline Content-Security-Policy when Paddle billing is disabled.
const BASE_CSP: &str = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

/// Content-Security-Policy when Paddle billing is enabled.
///
/// The checkout flow loads Paddle.js from the Paddle CDN (script-src), which
/// renders the checkout overlay in iframes served from buy.paddle.com /
/// sandbox-buy.paddle.com (frame-src) and calls the Paddle checkout-service
/// API from the parent page (connect-src). Sandbox and production hosts are
/// both allowed so a single policy covers either billing environment.
const BILLING_CSP: &str = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.paddle.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://checkout-service.paddle.com https://sandbox-checkout-service.paddle.com; worker-src 'self' blob:; frame-src 'self' https://buy.paddle.com https://sandbox-buy.paddle.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

/// Middleware that adds security headers to every response.
///
/// The CSP is extended with the Paddle checkout hosts only when billing is
/// configured; self-hosted deployments keep the strict baseline policy.
pub async fn security_headers(State(state): State<AppState>, req: Request, next: Next) -> Response {
    let csp = if state.billing.is_some() {
        BILLING_CSP
    } else {
        BASE_CSP
    };

    let mut response = next.run(req).await;
    let headers = response.headers_mut();
    headers
        .entry("x-content-type-options")
        .or_insert(HeaderValue::from_static("nosniff"));
    headers
        .entry("x-frame-options")
        .or_insert(HeaderValue::from_static("DENY"));
    headers
        .entry("x-xss-protection")
        .or_insert(HeaderValue::from_static("0"));
    headers
        .entry("referrer-policy")
        .or_insert(HeaderValue::from_static("strict-origin-when-cross-origin"));
    headers
        .entry("content-security-policy")
        .or_insert(HeaderValue::from_static(csp));
    response
}
