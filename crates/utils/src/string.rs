//! String manipulation utilities.

use once_cell::sync::Lazy;
use regex::Regex;

static URL_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"https?://[^\s]+").expect("Invalid URL regex"));

static EMAIL_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").expect("Invalid email regex")
});

/// Extract initials from a name (Unicode-aware).
pub fn get_initials(name: &str) -> String {
    name.split_whitespace()
        .filter_map(|word| word.chars().next())
        .map(|c| c.to_uppercase().to_string())
        .collect()
}

/// Check if string is a valid HTTP(S) URL.
pub fn is_url(s: &str) -> bool {
    !s.is_empty() && URL_REGEX.is_match(s)
}

/// Extract first URL from a string.
pub fn extract_url(s: &str) -> Option<&str> {
    URL_REGEX.find(s).map(|m| m.as_str())
}

/// Check if string is empty or whitespace-only.
/// Also treats "<p></p>" as empty (TipTap editor artifact).
pub fn is_empty_string(s: &str) -> bool {
    let trimmed = s.trim();
    trimmed.is_empty() || trimmed == "<p></p>"
}

/// Sanitize username: lowercase, alphanumeric + dots + hyphens only.
pub fn process_username(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-')
        .collect::<String>()
        .to_lowercase()
}

/// Validate email format.
pub fn is_valid_email(s: &str) -> bool {
    EMAIL_REGEX.is_match(s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_initials() {
        assert_eq!(get_initials("John Doe"), "JD");
        assert_eq!(get_initials("Alice Bob Charlie"), "ABC");
        assert_eq!(get_initials(""), "");
    }

    #[test]
    fn test_is_url() {
        assert!(is_url("https://example.com"));
        assert!(is_url("http://example.com/path"));
        assert!(!is_url("not-a-url"));
        assert!(!is_url(""));
    }

    #[test]
    fn test_is_empty_string() {
        assert!(is_empty_string(""));
        assert!(is_empty_string("   "));
        assert!(is_empty_string("<p></p>"));
        assert!(!is_empty_string("hello"));
    }
}
