//! API key token generation, hashing, and header parsing.

use axum::http::{header, HeaderMap};
use base64::Engine as _;
use rand::Rng;
use sha2::{Digest, Sha256};

/// Prefix for all issued API tokens.
pub const TOKEN_PREFIX: &str = "rk_";

/// Number of base64url characters after the prefix (32 CSPRNG bytes).
pub const TOKEN_BODY_LEN: usize = 43;

/// Display prefix length (first N chars after `rk_`).
pub const PREFIX_DISPLAY_LEN: usize = 8;

/// Maximum active (non-revoked) keys per user.
pub const MAX_ACTIVE_KEYS: i64 = 20;

/// Maximum key name length in characters.
pub const MAX_NAME_LEN: usize = 100;

/// Minimum key name length in characters.
pub const MIN_NAME_LEN: usize = 1;

/// Total token length including the `rk_` prefix.
pub const TOKEN_LEN: usize = TOKEN_PREFIX.len() + TOKEN_BODY_LEN;

/// Generate a new API key token (`rk_` + 43 base64url chars).
pub fn generate_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill(&mut bytes);
    let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes);
    format!("{TOKEN_PREFIX}{encoded}")
}

/// Extract the display prefix (first 8 chars after `rk_`).
pub fn display_prefix(token: &str) -> Option<String> {
    let body = token.strip_prefix(TOKEN_PREFIX)?;
    if body.len() < PREFIX_DISPLAY_LEN {
        return None;
    }
    Some(body[..PREFIX_DISPLAY_LEN].to_string())
}

/// SHA-256 hex digest of the full token string.
pub fn hash_token(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Whether the token matches the expected `rk_` + 43-char format.
pub fn is_valid_token_format(token: &str) -> bool {
    if !token.starts_with(TOKEN_PREFIX) {
        return false;
    }
    let body = &token[TOKEN_PREFIX.len()..];
    body.len() == TOKEN_BODY_LEN && body.bytes().all(|b| is_base64url_byte(b))
}

fn is_base64url_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_'
}

/// Parse an API key from request headers.
///
/// `Authorization: Bearer rk_...` takes precedence over `x-api-key`.
pub fn extract_token_from_headers(headers: &HeaderMap) -> Option<String> {
    if let Some(value) = headers
        .get(header::AUTHORIZATION)
        .and_then(|header| header.to_str().ok())
    {
        if let Some(token) = value.strip_prefix("Bearer ") {
            let token = token.trim();
            if is_valid_token_format(token) {
                return Some(token.to_string());
            }
        }
    }

    if let Some(value) = headers
        .get("x-api-key")
        .and_then(|header| header.to_str().ok())
    {
        let token = value.trim();
        if is_valid_token_format(token) {
            return Some(token.to_string());
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_token_has_expected_prefix_and_length() {
        let token = generate_token();
        assert!(token.starts_with(TOKEN_PREFIX));
        assert_eq!(token.len(), TOKEN_LEN);
    }

    #[test]
    fn hashing_is_deterministic_hex() {
        let token = "rk_testtoken";
        let first = hash_token(token);
        let second = hash_token(token);

        assert_eq!(first, second);
        assert_eq!(first.len(), 64);
        assert!(first.chars().all(|ch| ch.is_ascii_hexdigit()));
    }

    #[test]
    fn display_prefix_extracts_first_eight_body_chars() {
        let token = format!("{TOKEN_PREFIX}abcdefghijklmnop");
        assert_eq!(display_prefix(&token).as_deref(), Some("abcdefgh"));
    }

    #[test]
    fn bearer_header_takes_precedence_over_x_api_key() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            "Bearer rk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                .parse()
                .unwrap(),
        );
        headers.insert(
            "x-api-key",
            "rk_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                .parse()
                .unwrap(),
        );

        let token = extract_token_from_headers(&headers).expect("token");
        assert!(token.starts_with("rk_aaaa"));
    }

    #[test]
    fn x_api_key_header_is_accepted() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-api-key",
            "rk_ccccccccccccccccccccccccccccccccccccccccccc"
                .parse()
                .unwrap(),
        );

        assert!(extract_token_from_headers(&headers).is_some());
    }

    #[test]
    fn malformed_tokens_are_rejected() {
        let mut headers = HeaderMap::new();
        headers.insert(header::AUTHORIZATION, "Bearer not-a-key".parse().unwrap());
        assert!(extract_token_from_headers(&headers).is_none());

        headers.insert(
            header::AUTHORIZATION,
            "Basic rk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                .parse()
                .unwrap(),
        );
        assert!(extract_token_from_headers(&headers).is_none());

        headers.insert("x-api-key", "rk_short".parse().unwrap());
        assert!(extract_token_from_headers(&headers).is_none());
    }
}
