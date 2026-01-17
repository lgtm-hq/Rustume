//! Shared types used across the schema.

use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::validation::validate_optional_url;

/// URL with label.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Default)]
pub struct Url {
    /// Display label for the URL.
    #[serde(default)]
    pub label: String,

    /// The URL href (must be empty or valid HTTP(S) URL).
    #[validate(custom(function = "validate_optional_url"))]
    #[serde(default)]
    pub href: String,
}

impl Url {
    /// Create a new URL with the given href.
    pub fn new(href: impl Into<String>) -> Self {
        Self {
            label: String::new(),
            href: href.into(),
        }
    }

    /// Create a new URL with label and href.
    pub fn with_label(label: impl Into<String>, href: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            href: href.into(),
        }
    }

    /// Check if the URL is empty.
    pub fn is_empty(&self) -> bool {
        self.href.is_empty()
    }
}

/// Custom field for basics section.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CustomField {
    /// CUID2 format identifier.
    pub id: String,

    /// Icon identifier (e.g., from a icon library).
    #[serde(default)]
    pub icon: String,

    /// Field name/label.
    #[serde(default)]
    pub name: String,

    /// Field value.
    #[serde(default)]
    pub value: String,
}

impl CustomField {
    /// Create a new custom field with generated ID.
    pub fn new(name: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            id: cuid2::create_id(),
            icon: String::new(),
            name: name.into(),
            value: value.into(),
        }
    }

    /// Create a new custom field with icon.
    pub fn with_icon(
        icon: impl Into<String>,
        name: impl Into<String>,
        value: impl Into<String>,
    ) -> Self {
        Self {
            id: cuid2::create_id(),
            icon: icon.into(),
            name: name.into(),
            value: value.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_url_validation() {
        let valid_url = Url::new("https://example.com");
        assert!(valid_url.validate().is_ok());

        let empty_url = Url::default();
        assert!(empty_url.validate().is_ok());

        let invalid_url = Url::new("not-a-url");
        assert!(invalid_url.validate().is_err());
    }

    #[test]
    fn test_url_is_empty() {
        let empty = Url::default();
        assert!(empty.is_empty());

        let not_empty = Url::new("https://example.com");
        assert!(!not_empty.is_empty());
    }

    #[test]
    fn test_custom_field_creation() {
        let field = CustomField::new("Website", "https://example.com");
        assert!(!field.id.is_empty());
        assert_eq!(field.name, "Website");
        assert_eq!(field.value, "https://example.com");
    }
}
