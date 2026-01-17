//! Storage abstraction layer for Rustume.
//!
//! Provides a unified interface for storing resumes across platforms:
//! - IndexedDB (Web/WASM)
//! - SQLite (Mobile/Desktop)
//! - In-memory (Testing)

mod traits;
mod memory;

pub use traits::*;
pub use memory::MemoryStorage;

#[cfg(target_arch = "wasm32")]
mod indexeddb;

#[cfg(target_arch = "wasm32")]
pub use indexeddb::IndexedDbStorage;

/// Storage configuration.
#[derive(Debug, Clone)]
pub struct StorageConfig {
    /// Storage backend type.
    pub backend: StorageBackendType,
    /// Database name/path.
    pub name: String,
    /// Enable encryption.
    pub encrypted: bool,
}

/// Available storage backend types.
#[derive(Debug, Clone, Copy)]
pub enum StorageBackendType {
    /// In-memory (testing only).
    Memory,
    /// IndexedDB (Web/WASM).
    IndexedDb,
    /// SQLite (Mobile/Desktop).
    Sqlite,
}
