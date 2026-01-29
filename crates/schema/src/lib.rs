//! Resume data types and validation for Rustume.
//!
//! This crate defines the core data structures for resume data,
//! including basics, sections, metadata, and shared types.
//!
//! # Example
//!
//! ```
//! use rustume_schema::{ResumeData, Basics};
//! use validator::Validate;
//!
//! let mut resume = ResumeData::default();
//! resume.basics.name = "John Doe".to_string();
//! resume.basics.email = "john@example.com".to_string();
//!
//! assert!(resume.validate().is_ok());
//! ```

mod basics;
mod metadata;
mod sections;
mod shared;
mod validation;

pub use basics::*;
pub use metadata::*;
pub use sections::*;
pub use shared::*;
pub use validation::*;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

/// Root resume data structure.
///
/// This is the main type that represents a complete resume.
/// It contains three main sections:
/// - `basics`: Personal information (name, email, etc.)
/// - `sections`: All resume sections (experience, education, skills, etc.)
/// - `metadata`: Display settings (template, theme, layout, etc.)
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Default, ToSchema)]
#[serde(rename_all = "camelCase", default)]
pub struct ResumeData {
    /// Basic personal information.
    #[validate(nested)]
    pub basics: Basics,

    /// All resume sections.
    #[validate(nested)]
    pub sections: Sections,

    /// Display metadata (template, theme, layout).
    #[validate(nested)]
    pub metadata: Metadata,
}

impl ResumeData {
    /// Create a new empty resume with defaults.
    pub fn new() -> Self {
        Self::default()
    }

    /// Create a resume with basic info.
    pub fn with_basics(name: impl Into<String>, email: impl Into<String>) -> Self {
        let mut resume = Self::default();
        resume.basics.name = name.into();
        resume.basics.email = email.into();
        resume
    }

    /// Serialize to JSON string.
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    /// Deserialize from JSON string.
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Serialize to JSON bytes.
    pub fn to_json_bytes(&self) -> Result<Vec<u8>, serde_json::Error> {
        serde_json::to_vec_pretty(self)
    }

    /// Deserialize from JSON bytes.
    pub fn from_json_bytes(bytes: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_resume_is_valid() {
        let resume = ResumeData::default();
        assert!(resume.validate().is_ok());
    }

    #[test]
    fn test_resume_with_basics() {
        let resume = ResumeData::with_basics("John Doe", "john@example.com");
        assert_eq!(resume.basics.name, "John Doe");
        assert_eq!(resume.basics.email, "john@example.com");
        assert!(resume.validate().is_ok());
    }

    #[test]
    fn test_resume_json_roundtrip() {
        let resume = ResumeData::with_basics("Jane Doe", "jane@example.com");
        let json = resume.to_json().unwrap();
        let parsed = ResumeData::from_json(&json).unwrap();

        assert_eq!(parsed.basics.name, resume.basics.name);
        assert_eq!(parsed.basics.email, resume.basics.email);
    }

    #[test]
    fn test_resume_validation_fails_for_invalid_email() {
        let mut resume = ResumeData::default();
        resume.basics.email = "not-an-email".to_string();

        assert!(resume.validate().is_err());
    }

    #[test]
    fn test_resume_validation_fails_for_invalid_url() {
        let mut resume = ResumeData::default();
        resume.basics.url.href = "not-a-url".to_string();

        assert!(resume.validate().is_err());
    }
}
