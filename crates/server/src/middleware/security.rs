use axum::extract::Request;
use axum::http::header::HeaderValue;
use axum::middleware::Next;
use axum::response::Response;

/// Middleware that adds security headers to every response.
pub async fn security_headers(req: Request, next: Next) -> Response {
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
    headers.entry("content-security-policy").or_insert(
        HeaderValue::from_static(
            "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        ),
    );
    response
}
