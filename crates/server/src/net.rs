//! Network helpers for client IP extraction.

use axum::http::HeaderMap;

/// Whether proxy headers may be trusted for client IP extraction.
pub fn trusted_proxy_enabled() -> bool {
    matches!(std::env::var("TRUSTED_PROXY").as_deref(), Ok("true" | "1"))
}

/// Extract the client IP from proxy headers when the deployment trusts them.
///
/// Prefers `X-Real-IP`, then the rightmost non-empty hop in append-mode
/// `X-Forwarded-For` chains.
pub fn trusted_client_ip(headers: &HeaderMap, trusted_proxy: bool) -> Option<String> {
    if !trusted_proxy {
        return None;
    }

    if let Some(ip) = headers
        .get("x-real-ip")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(ip.to_string());
    }

    headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| {
            value
                .split(',')
                .map(str::trim)
                .rfind(|part| !part.is_empty())
        })
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn trusted_client_ip_uses_proxy_appended_forwarded_value() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("203.0.113.1, 198.51.100.2"),
        );

        assert_eq!(
            trusted_client_ip(&headers, true).as_deref(),
            Some("198.51.100.2")
        );
    }

    #[test]
    fn trusted_client_ip_prefers_x_real_ip() {
        let mut headers = HeaderMap::new();
        headers.insert("x-real-ip", HeaderValue::from_static("198.51.100.2"));
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("203.0.113.1, 198.51.100.2"),
        );

        assert_eq!(
            trusted_client_ip(&headers, true).as_deref(),
            Some("198.51.100.2")
        );
    }
}
