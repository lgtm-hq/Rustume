//! String manipulation utilities.

use once_cell::sync::Lazy;
use regex::Regex;

/// Anchored regex for checking if entire string is a valid URL
static URL_REGEX_ANCHORED: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^https?://[^\s]+$").expect("Invalid URL regex"));

/// Unanchored regex for extracting URLs from text
static URL_REGEX_EXTRACT: Lazy<Regex> =
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

/// Check if string is a valid HTTP(S) URL (entire string must be a URL).
pub fn is_url(s: &str) -> bool {
    !s.is_empty() && URL_REGEX_ANCHORED.is_match(s)
}

/// Extract first URL from a string (can be embedded in text).
pub fn extract_url(s: &str) -> Option<&str> {
    URL_REGEX_EXTRACT.find(s).map(|m| m.as_str())
}

/// Check if string is empty or whitespace-only.
/// Also treats common empty HTML patterns as empty (TipTap/editor artifacts).
pub fn is_empty_string(s: &str) -> bool {
    let trimmed = s.trim();
    trimmed.is_empty()
        || matches!(trimmed, "<p></p>" | "<p><br></p>" | "<p>&nbsp;</p>")
}

/// Sanitize username: lowercase, alphanumeric + dots + hyphens only.
/// Lowercases first to ensure combining marks from case-folding are filtered.
pub fn process_username(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-')
        .collect()
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
        // Should reject strings with URLs embedded in text
        assert!(!is_url("check out https://example.com for more"));
        assert!(!is_url("prefix https://example.com"));
    }

    #[test]
    fn test_extract_url() {
        assert_eq!(extract_url("check out https://example.com for more"), Some("https://example.com"));
        assert_eq!(extract_url("no url here"), None);
    }

    #[test]
    fn test_is_empty_string() {
        assert!(is_empty_string(""));
        assert!(is_empty_string("   "));
        assert!(is_empty_string("<p></p>"));
        assert!(!is_empty_string("hello"));
    }

    #[test]
    fn test_is_valid_email_valid() {
        assert!(is_valid_email("test@example.com"));
        assert!(is_valid_email("user.name+tag@domain.co.uk"));
        assert!(is_valid_email("user_name@example.org"));
        assert!(is_valid_email("name123@company.io"));
    }

    #[test]
    fn test_is_valid_email_invalid() {
        assert!(!is_valid_email(""));
        assert!(!is_valid_email("not-an-email"));
        assert!(!is_valid_email("@example.com"));
        assert!(!is_valid_email("test@"));
        assert!(!is_valid_email("test@.com"));
        assert!(!is_valid_email("test @example.com"));
    }

    #[test]
    fn test_process_username() {
        assert_eq!(process_username("John Doe"), "johndoe");
        assert_eq!(process_username("user.name"), "user.name");
        assert_eq!(process_username("User-Name"), "user-name");
        assert_eq!(process_username("Über"), "über"); // Unicode letters are preserved (is_alphanumeric)
        assert_eq!(process_username("test_user"), "testuser"); // underscore stripped
        assert_eq!(process_username("  spaces  "), "spaces");
    }
}
