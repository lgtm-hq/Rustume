//! Basics section - personal information.

use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::shared::{CustomField, Url};
use crate::validation::validate_optional_email;

/// Basic personal information.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Default)]
#[serde(rename_all = "camelCase")]
pub struct Basics {
    /// Full name.
    #[serde(default)]
    pub name: String,

    /// Professional headline/title.
    #[serde(default)]
    pub headline: String,

    /// Email address (must be empty or valid email).
    #[validate(custom(function = "validate_optional_email"))]
    #[serde(default)]
    pub email: String,

    /// Phone number.
    #[serde(default)]
    pub phone: String,

    /// Location (city, country, etc.).
    #[serde(default)]
    pub location: String,

    /// Personal website or portfolio URL.
    #[validate(nested)]
    #[serde(default)]
    pub url: Url,

    /// Custom fields for additional info.
    #[serde(default)]
    pub custom_fields: Vec<CustomField>,

    /// Profile picture configuration.
    #[validate(nested)]
    #[serde(default)]
    pub picture: Picture,
}

impl Basics {
    /// Create new basics with name.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            ..Default::default()
        }
    }

    /// Builder method to set headline.
    pub fn with_headline(mut self, headline: impl Into<String>) -> Self {
        self.headline = headline.into();
        self
    }

    /// Builder method to set email.
    pub fn with_email(mut self, email: impl Into<String>) -> Self {
        self.email = email.into();
        self
    }

    /// Builder method to set phone.
    pub fn with_phone(mut self, phone: impl Into<String>) -> Self {
        self.phone = phone.into();
        self
    }

    /// Builder method to set location.
    pub fn with_location(mut self, location: impl Into<String>) -> Self {
        self.location = location.into();
        self
    }

    /// Builder method to set URL.
    pub fn with_url(mut self, url: impl Into<String>) -> Self {
        self.url = Url::new(url);
        self
    }

    /// Add a custom field.
    pub fn add_custom_field(&mut self, name: impl Into<String>, value: impl Into<String>) {
        self.custom_fields.push(CustomField::new(name, value));
    }
}

/// Profile picture configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Picture {
    /// URL to the picture (can be data URL or remote URL).
    #[serde(default)]
    pub url: String,

    /// Display size in pixels.
    #[serde(default = "default_picture_size")]
    pub size: u32,

    /// Aspect ratio (width/height).
    #[serde(default = "default_aspect_ratio")]
    pub aspect_ratio: f32,

    /// Border radius in pixels (0 = square, size/2 = circle).
    #[serde(default)]
    pub border_radius: u32,

    /// Picture display effects.
    #[validate(nested)]
    #[serde(default)]
    pub effects: PictureEffects,
}

impl Default for Picture {
    fn default() -> Self {
        Self {
            url: String::new(),
            size: 64,
            aspect_ratio: 1.0,
            border_radius: 0,
            effects: PictureEffects::default(),
        }
    }
}

impl Picture {
    /// Create a new picture with URL.
    pub fn new(url: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            ..Default::default()
        }
    }

    /// Check if picture has a URL set.
    pub fn has_url(&self) -> bool {
        !self.url.is_empty()
    }

    /// Check if picture should be displayed.
    pub fn is_visible(&self) -> bool {
        self.has_url() && !self.effects.hidden
    }
}

/// Picture display effects.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Default)]
pub struct PictureEffects {
    /// Hide the picture.
    #[serde(default)]
    pub hidden: bool,

    /// Show a border around the picture.
    #[serde(default)]
    pub border: bool,

    /// Apply grayscale filter.
    #[serde(default)]
    pub grayscale: bool,
}

fn default_picture_size() -> u32 {
    64
}

fn default_aspect_ratio() -> f32 {
    1.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use validator::Validate;

    #[test]
    fn test_basics_builder() {
        let basics = Basics::new("John Doe")
            .with_headline("Software Engineer")
            .with_email("john@example.com")
            .with_phone("+1-555-123-4567")
            .with_location("San Francisco, CA")
            .with_url("https://johndoe.dev");

        assert_eq!(basics.name, "John Doe");
        assert_eq!(basics.headline, "Software Engineer");
        assert_eq!(basics.email, "john@example.com");
        assert_eq!(basics.phone, "+1-555-123-4567");
        assert_eq!(basics.location, "San Francisco, CA");
        assert_eq!(basics.url.href, "https://johndoe.dev");
        assert!(basics.validate().is_ok());
    }

    #[test]
    fn test_basics_email_validation() {
        let valid = Basics::new("Test").with_email("test@example.com");
        assert!(valid.validate().is_ok());

        let empty = Basics::new("Test");
        assert!(empty.validate().is_ok());

        let invalid = Basics::new("Test").with_email("not-an-email");
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_picture_visibility() {
        let mut pic = Picture::new("https://example.com/photo.jpg");
        assert!(pic.is_visible());

        pic.effects.hidden = true;
        assert!(!pic.is_visible());

        let empty_pic = Picture::default();
        assert!(!empty_pic.is_visible());
    }

    #[test]
    fn test_custom_fields() {
        let mut basics = Basics::new("Test");
        basics.add_custom_field("Pronouns", "they/them");
        basics.add_custom_field("Timezone", "PST");

        assert_eq!(basics.custom_fields.len(), 2);
        assert_eq!(basics.custom_fields[0].name, "Pronouns");
        assert_eq!(basics.custom_fields[1].name, "Timezone");
    }
}
