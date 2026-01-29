//! Storage trait definitions.

use async_trait::async_trait;
use rustume_schema::ResumeData;
use thiserror::Error;

/// Storage error types.
#[derive(Error, Debug)]
pub enum StorageError {
    /// The requested resource was not found.
    #[error("Not found: {0}")]
    NotFound(String),

    /// A resource with the same identifier already exists.
    ///
    /// **Note:** Reserved for future `create` method. Current `save` uses upsert semantics.
    #[error("Already exists: {0}")]
    AlreadyExists(String),

    /// An internal storage error occurred.
    #[error("Storage error: {0}")]
    Internal(String),
}

/// Storage backend trait.
#[async_trait(?Send)]
pub trait StorageBackend {
    /// List all resume IDs.
    async fn list(&self) -> Result<Vec<String>, StorageError>;

    /// Get resume by ID.
    async fn get(&self, id: &str) -> Result<ResumeData, StorageError>;

    /// Save resume (upsert).
    async fn save(&self, id: &str, data: &ResumeData) -> Result<(), StorageError>;

    /// Delete resume.
    async fn delete(&self, id: &str) -> Result<(), StorageError>;

    /// Check if resume exists.
    async fn exists(&self, id: &str) -> Result<bool, StorageError>;
}
