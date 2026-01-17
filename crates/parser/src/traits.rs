//! Parser trait definitions.

use rustume_schema::ResumeData;
use thiserror::Error;

/// Parser error types.
#[derive(Error, Debug)]
pub enum ParseError {
    #[error("Failed to read file: {0}")]
    ReadError(String),

    #[error("Invalid format: {0}")]
    ValidationError(String),

    #[error("Conversion failed: {0}")]
    ConversionError(String),
}

/// Three-stage parser pipeline.
pub trait Parser {
    type RawData;
    type ValidatedData;

    /// Stage 1: Read and parse raw input.
    fn read(&self, input: &[u8]) -> Result<Self::RawData, ParseError>;

    /// Stage 2: Validate and transform.
    fn validate(&self, data: Self::RawData) -> Result<Self::ValidatedData, ParseError>;

    /// Stage 3: Convert to ResumeData.
    fn convert(&self, data: Self::ValidatedData) -> Result<ResumeData, ParseError>;

    /// Convenience method: full pipeline.
    fn parse(&self, input: &[u8]) -> Result<ResumeData, ParseError> {
        let raw = self.read(input)?;
        let validated = self.validate(raw)?;
        self.convert(validated)
    }
}
