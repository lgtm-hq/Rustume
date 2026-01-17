//! Custom validation functions for resume data.

use once_cell::sync::Lazy;
use regex::Regex;
use validator::ValidationError;

static URL_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^https?://[^\s]+$").expect("Invalid URL regex"));

static EMAIL_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").expect("Invalid email regex")
});

/// Validate that a string is either empty or a valid URL.
pub fn validate_optional_url(url: &str) -> Result<(), ValidationError> {
    if url.is_empty() {
        return Ok(());
    }

    if URL_REGEX.is_match(url) {
        Ok(())
    } else {
        let mut error = ValidationError::new("invalid_url");
        error.message = Some("Must be a valid HTTP(S) URL".into());
        Err(error)
    }
}

/// Validate that a string is either empty or a valid email.
pub fn validate_optional_email(email: &str) -> Result<(), ValidationError> {
    if email.is_empty() {
        return Ok(());
    }

    if EMAIL_REGEX.is_match(email) {
        Ok(())
    } else {
        let mut error = ValidationError::new("invalid_email");
        error.message = Some("Must be a valid email address".into());
        Err(error)
    }
}

/// Validate that a hex color is valid (#RRGGBB format).
pub fn validate_hex_color(color: &str) -> Result<(), ValidationError> {
    if color.is_empty() {
        return Ok(());
    }

    let color = color.trim_start_matches('#');
    if color.len() == 6 && color.chars().all(|c| c.is_ascii_hexdigit()) {
        Ok(())
    } else {
        let mut error = ValidationError::new("invalid_hex_color");
        error.message = Some("Must be a valid hex color (#RRGGBB)".into());
        Err(error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_optional_url() {
        // Empty is valid
        assert!(validate_optional_url("").is_ok());

        // Valid URLs
        assert!(validate_optional_url("https://example.com").is_ok());
        assert!(validate_optional_url("http://example.com/path?query=1").is_ok());
        assert!(validate_optional_url("https://sub.domain.com:8080/path").is_ok());

        // Invalid URLs
        assert!(validate_optional_url("not-a-url").is_err());
        assert!(validate_optional_url("ftp://example.com").is_err());
        assert!(validate_optional_url("example.com").is_err());
    }

    #[test]
    fn test_validate_optional_email() {
        // Empty is valid
        assert!(validate_optional_email("").is_ok());

        // Valid emails
        assert!(validate_optional_email("test@example.com").is_ok());
        assert!(validate_optional_email("user.name+tag@domain.co.uk").is_ok());

        // Invalid emails
        assert!(validate_optional_email("not-an-email").is_err());
        assert!(validate_optional_email("@domain.com").is_err());
        assert!(validate_optional_email("user@").is_err());
    }

    #[test]
    fn test_validate_hex_color() {
        // Empty is valid
        assert!(validate_hex_color("").is_ok());

        // Valid colors
        assert!(validate_hex_color("#ffffff").is_ok());
        assert!(validate_hex_color("#000000").is_ok());
        assert!(validate_hex_color("#dc2626").is_ok());
        assert!(validate_hex_color("AABBCC").is_ok()); // Without #

        // Invalid colors
        assert!(validate_hex_color("#fff").is_err()); // Too short
        assert!(validate_hex_color("#gggggg").is_err()); // Invalid chars
        assert!(validate_hex_color("red").is_err()); // Named color
    }
}
