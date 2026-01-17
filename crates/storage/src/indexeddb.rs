//! IndexedDB storage backend for WASM.
//!
//! This module provides persistent storage for resumes in the browser
//! using the IndexedDB API.

use crate::traits::{StorageBackend, StorageError};
use async_trait::async_trait;
use js_sys::{Array, Object, Reflect};
use rustume_schema::ResumeData;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use web_sys::{IdbDatabase, IdbObjectStore, IdbRequest, IdbTransaction};

const DB_VERSION: u32 = 1;
const STORE_NAME: &str = "resumes";

/// IndexedDB storage backend.
pub struct IndexedDbStorage {
    db_name: String,
}

impl IndexedDbStorage {
    /// Create a new IndexedDB storage with the given database name.
    pub fn new(db_name: impl Into<String>) -> Self {
        Self {
            db_name: db_name.into(),
        }
    }

    /// Get the database name.
    pub fn db_name(&self) -> String {
        self.db_name.clone()
    }

    /// Open the IndexedDB database.
    async fn open_db(&self) -> Result<IdbDatabase, StorageError> {
        let window = web_sys::window().ok_or_else(|| {
            StorageError::Internal("No window object available".to_string())
        })?;

        let idb_factory = window.indexed_db().map_err(|e| {
            StorageError::Internal(format!("Failed to get IndexedDB: {:?}", e))
        })?.ok_or_else(|| {
            StorageError::Internal("IndexedDB not supported".to_string())
        })?;

        let request = idb_factory
            .open_with_u32(&self.db_name, DB_VERSION)
            .map_err(|e| StorageError::Internal(format!("Failed to open database: {:?}", e)))?;

        // Set up database upgrade handler
        let store_name = STORE_NAME;
        let onupgradeneeded = Closure::once(move |event: web_sys::IdbVersionChangeEvent| {
            let db: IdbDatabase = event
                .target()
                .and_then(|t| t.dyn_into::<IdbRequest>().ok())
                .and_then(|r| r.result().ok())
                .and_then(|r| r.dyn_into::<IdbDatabase>().ok())
                .expect("Failed to get database from upgrade event");

            // Create object store if it doesn't exist
            if !db.object_store_names().contains(&store_name.into()) {
                db.create_object_store(store_name)
                    .expect("Failed to create object store");
            }
        });

        request.set_onupgradeneeded(Some(onupgradeneeded.as_ref().unchecked_ref()));
        onupgradeneeded.forget();

        // Wait for the request to complete
        let result = JsFuture::from(idb_request_to_promise(&request)?).await;

        result
            .map_err(|e| StorageError::Internal(format!("Database open failed: {:?}", e)))?
            .dyn_into::<IdbDatabase>()
            .map_err(|e| StorageError::Internal(format!("Invalid database object: {:?}", e)))
    }

    /// Get an object store for read/write operations.
    fn get_store(&self, db: &IdbDatabase, readonly: bool) -> Result<IdbObjectStore, StorageError> {
        let mode = if readonly {
            web_sys::IdbTransactionMode::Readonly
        } else {
            web_sys::IdbTransactionMode::Readwrite
        };

        let transaction = db
            .transaction_with_str_and_mode(STORE_NAME, mode)
            .map_err(|e| StorageError::Internal(format!("Transaction failed: {:?}", e)))?;

        transaction
            .object_store(STORE_NAME)
            .map_err(|e| StorageError::Internal(format!("Failed to get object store: {:?}", e)))
    }
}

#[async_trait(?Send)]
impl StorageBackend for IndexedDbStorage {
    async fn list(&self) -> Result<Vec<String>, StorageError> {
        let db = self.open_db().await?;
        let store = self.get_store(&db, true)?;

        let request = store
            .get_all_keys()
            .map_err(|e| StorageError::Internal(format!("Failed to get keys: {:?}", e)))?;

        let result = JsFuture::from(idb_request_to_promise(&request)?)
            .await
            .map_err(|e| StorageError::Internal(format!("Get keys failed: {:?}", e)))?;

        let array: Array = result
            .dyn_into()
            .map_err(|e| StorageError::Internal(format!("Invalid keys array: {:?}", e)))?;

        let mut keys = Vec::new();
        for i in 0..array.length() {
            if let Some(key) = array.get(i).as_string() {
                keys.push(key);
            }
        }

        Ok(keys)
    }

    async fn get(&self, id: &str) -> Result<ResumeData, StorageError> {
        let db = self.open_db().await?;
        let store = self.get_store(&db, true)?;

        let request = store
            .get(&JsValue::from_str(id))
            .map_err(|e| StorageError::Internal(format!("Failed to get: {:?}", e)))?;

        let result = JsFuture::from(idb_request_to_promise(&request)?)
            .await
            .map_err(|e| StorageError::Internal(format!("Get failed: {:?}", e)))?;

        if result.is_undefined() || result.is_null() {
            return Err(StorageError::NotFound(id.to_string()));
        }

        // The stored value is a JSON string
        let json_str = result
            .as_string()
            .ok_or_else(|| StorageError::Internal("Stored value is not a string".to_string()))?;

        serde_json::from_str(&json_str)
            .map_err(|e| StorageError::Internal(format!("Deserialization failed: {}", e)))
    }

    async fn save(&self, id: &str, data: &ResumeData) -> Result<(), StorageError> {
        let db = self.open_db().await?;
        let store = self.get_store(&db, false)?;

        // Serialize to JSON string for storage
        let json_str = serde_json::to_string(data)
            .map_err(|e| StorageError::Internal(format!("Serialization failed: {}", e)))?;

        let request = store
            .put_with_key(&JsValue::from_str(&json_str), &JsValue::from_str(id))
            .map_err(|e| StorageError::Internal(format!("Failed to put: {:?}", e)))?;

        JsFuture::from(idb_request_to_promise(&request)?)
            .await
            .map_err(|e| StorageError::Internal(format!("Put failed: {:?}", e)))?;

        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<(), StorageError> {
        // Check if exists first
        if !self.exists(id).await? {
            return Err(StorageError::NotFound(id.to_string()));
        }

        let db = self.open_db().await?;
        let store = self.get_store(&db, false)?;

        let request = store
            .delete(&JsValue::from_str(id))
            .map_err(|e| StorageError::Internal(format!("Failed to delete: {:?}", e)))?;

        JsFuture::from(idb_request_to_promise(&request)?)
            .await
            .map_err(|e| StorageError::Internal(format!("Delete failed: {:?}", e)))?;

        Ok(())
    }

    async fn exists(&self, id: &str) -> Result<bool, StorageError> {
        let db = self.open_db().await?;
        let store = self.get_store(&db, true)?;

        let request = store
            .get(&JsValue::from_str(id))
            .map_err(|e| StorageError::Internal(format!("Failed to check existence: {:?}", e)))?;

        let result = JsFuture::from(idb_request_to_promise(&request)?)
            .await
            .map_err(|e| StorageError::Internal(format!("Existence check failed: {:?}", e)))?;

        Ok(!result.is_undefined() && !result.is_null())
    }
}

/// Convert an IdbRequest to a Promise.
fn idb_request_to_promise(request: &IdbRequest) -> Result<js_sys::Promise, StorageError> {
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        let resolve_clone = resolve.clone();
        let reject_clone = reject.clone();

        let onsuccess = Closure::once(move |event: web_sys::Event| {
            let target = event.target().unwrap();
            let request: IdbRequest = target.dyn_into().unwrap();
            let result = request.result().unwrap_or(JsValue::UNDEFINED);
            resolve_clone.call1(&JsValue::UNDEFINED, &result).unwrap();
        });

        let onerror = Closure::once(move |event: web_sys::Event| {
            let target = event.target().unwrap();
            let request: IdbRequest = target.dyn_into().unwrap();
            let error = request.error().ok().flatten();
            let error_msg = error
                .map(|e| e.message())
                .unwrap_or_else(|| "Unknown error".to_string());
            reject_clone
                .call1(&JsValue::UNDEFINED, &JsValue::from_str(&error_msg))
                .unwrap();
        });

        request.set_onsuccess(Some(onsuccess.as_ref().unchecked_ref()));
        request.set_onerror(Some(onerror.as_ref().unchecked_ref()));

        // Leak the closures to prevent them from being dropped
        onsuccess.forget();
        onerror.forget();
    });

    Ok(promise)
}
