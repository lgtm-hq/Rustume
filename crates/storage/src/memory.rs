//! In-memory storage backend for testing.

use crate::traits::{StorageBackend, StorageError};
use async_trait::async_trait;
use rustume_schema::ResumeData;
use std::collections::HashMap;
use std::sync::RwLock;

/// In-memory storage backend.
pub struct MemoryStorage {
    data: RwLock<HashMap<String, ResumeData>>,
}

impl MemoryStorage {
    pub fn new() -> Self {
        Self {
            data: RwLock::new(HashMap::new()),
        }
    }
}

impl Default for MemoryStorage {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait(?Send)]
impl StorageBackend for MemoryStorage {
    async fn list(&self) -> Result<Vec<String>, StorageError> {
        let data = self
            .data
            .read()
            .map_err(|e| StorageError::Internal(e.to_string()))?;
        Ok(data.keys().cloned().collect())
    }

    async fn get(&self, id: &str) -> Result<ResumeData, StorageError> {
        let data = self
            .data
            .read()
            .map_err(|e| StorageError::Internal(e.to_string()))?;
        data.get(id)
            .cloned()
            .ok_or_else(|| StorageError::NotFound(id.to_string()))
    }

    async fn save(&self, id: &str, resume: &ResumeData) -> Result<(), StorageError> {
        let mut data = self
            .data
            .write()
            .map_err(|e| StorageError::Internal(e.to_string()))?;
        data.insert(id.to_string(), resume.clone());
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), StorageError> {
        let mut data = self
            .data
            .write()
            .map_err(|e| StorageError::Internal(e.to_string()))?;
        data.remove(id)
            .ok_or_else(|| StorageError::NotFound(id.to_string()))?;
        Ok(())
    }

    async fn exists(&self, id: &str) -> Result<bool, StorageError> {
        let data = self
            .data
            .read()
            .map_err(|e| StorageError::Internal(e.to_string()))?;
        Ok(data.contains_key(id))
    }
}
