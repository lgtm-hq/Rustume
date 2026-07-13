//! Shared resume format dispatch for server and CLI.

use rustume_schema::ResumeData;

use crate::{JsonResumeParser, LinkedInParser, ParseError, Parser, ReactiveResumeV3Parser};

/// Supported resume input formats.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResumeFormat {
    /// JSON Resume standard format (https://jsonresume.org)
    JsonResume,
    /// LinkedIn data export ZIP file
    LinkedIn,
    /// Reactive Resume v3 format
    Rrv3,
    /// Native Rustume format
    Rustume,
}

impl ResumeFormat {
    /// Human-readable label for error messages.
    pub fn label(self) -> &'static str {
        match self {
            Self::JsonResume => "JSON Resume",
            Self::LinkedIn => "LinkedIn export",
            Self::Rrv3 => "Reactive Resume v3",
            Self::Rustume => "Rustume JSON",
        }
    }
}

/// Parse resume data from the given format into unified Rustume schema.
pub fn parse_resume(format: ResumeFormat, data: &[u8]) -> Result<ResumeData, ParseError> {
    match format {
        ResumeFormat::JsonResume => JsonResumeParser.parse(data),
        ResumeFormat::LinkedIn => LinkedInParser.parse(data),
        ResumeFormat::Rrv3 => ReactiveResumeV3Parser.parse(data),
        ResumeFormat::Rustume => serde_json::from_slice(data)
            .map_err(|err| ParseError::DeserializeError(err.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn fixtures_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("Parser crate should have parent directory")
            .parent()
            .expect("crates directory should have parent (workspace root)")
            .join("tests")
            .join("fixtures")
    }

    #[test]
    fn test_parse_json_resume_success() {
        let data = fs::read(fixtures_path().join("json_resume/minimal.json"))
            .expect("Failed to read minimal.json fixture");

        let resume = parse_resume(ResumeFormat::JsonResume, &data).expect("parse should succeed");
        assert_eq!(resume.basics.name, "John Doe");
    }

    #[test]
    fn test_parse_json_resume_failure() {
        let result = parse_resume(ResumeFormat::JsonResume, b"not valid json");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_linkedin_success() {
        let data = fs::read(fixtures_path().join("linkedin/complete_export.zip"))
            .expect("Failed to read LinkedIn ZIP fixture");

        let resume = parse_resume(ResumeFormat::LinkedIn, &data).expect("parse should succeed");
        assert_eq!(resume.basics.name, "David Chen");
    }

    #[test]
    fn test_parse_linkedin_failure() {
        let result = parse_resume(ResumeFormat::LinkedIn, b"not a zip file");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_rrv3_success() {
        let data = fs::read(fixtures_path().join("v3/complete.json"))
            .expect("Failed to read complete.json fixture");

        let resume = parse_resume(ResumeFormat::Rrv3, &data).expect("parse should succeed");
        assert_eq!(resume.basics.name, "Alice Johnson");
    }

    #[test]
    fn test_parse_rrv3_failure() {
        let result = parse_resume(ResumeFormat::Rrv3, b"not valid json");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_rustume_success() {
        let resume = ResumeData::default();
        let data = serde_json::to_vec(&resume).expect("serialize default resume");

        let parsed = parse_resume(ResumeFormat::Rustume, &data).expect("parse should succeed");
        assert_eq!(parsed.basics.name, resume.basics.name);
    }

    #[test]
    fn test_parse_rustume_failure() {
        let result = parse_resume(ResumeFormat::Rustume, b"{ invalid json }");
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            ParseError::DeserializeError(_)
        ));
    }

    #[test]
    fn test_resume_format_labels() {
        assert_eq!(ResumeFormat::JsonResume.label(), "JSON Resume");
        assert_eq!(ResumeFormat::LinkedIn.label(), "LinkedIn export");
        assert_eq!(ResumeFormat::Rrv3.label(), "Reactive Resume v3");
        assert_eq!(ResumeFormat::Rustume.label(), "Rustume JSON");
    }
}
