//! IndexedDB storage backend for WASM.
//!
//! This module provides persistent storage for resumes in the browser
//! using the IndexedDB API.

use crate::traits::{StorageBackend, StorageError};
use async_trait::async_trait;
use js_sys::Array;
use rustume_schema::ResumeData;
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use web_sys::{console, IdbDatabase, IdbObjectStore, IdbRequest};

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
        let window = web_sys::window()
            .ok_or_else(|| StorageError::Internal("No window object available".to_string()))?;

        let idb_factory = window
            .indexed_db()
            .map_err(|e| StorageError::Internal(format!("Failed to get IndexedDB: {:?}", e)))?
            .ok_or_else(|| StorageError::Internal("IndexedDB not supported".to_string()))?;

        let request = idb_factory
            .open_with_u32(&self.db_name, DB_VERSION)
            .map_err(|e| StorageError::Internal(format!("Failed to open database: {:?}", e)))?;

        // Set up database upgrade handler
        let store_name = STORE_NAME;
        let onupgradeneeded = Closure::once(move |event: web_sys::IdbVersionChangeEvent| {
            let db: IdbDatabase = match event
                .target()
                .and_then(|t| t.dyn_into::<IdbRequest>().ok())
                .and_then(|r| r.result().ok())
                .and_then(|r| r.dyn_into::<IdbDatabase>().ok())
            {
                Some(db) => db,
                None => {
                    console::error_1(&"Failed to get database from upgrade event".into());
                    return;
                }
            };

            // Create object store if it doesn't exist
            if !db.object_store_names().contains(&store_name.into()) {
                if let Err(e) = db.create_object_store(store_name) {
                    console::error_1(&format!("Failed to create object store: {:?}", e).into());
                }
            }
        });

        // Store closure in Rc to prevent memory leak
        let upgrade_closure: Rc<
            RefCell<Option<Closure<dyn FnMut(web_sys::IdbVersionChangeEvent)>>>,
        > = Rc::new(RefCell::new(Some(onupgradeneeded)));
        let closure_ref = upgrade_closure.borrow();
        request.set_onupgradeneeded(closure_ref.as_ref().map(|c| c.as_ref().unchecked_ref()));
        drop(closure_ref);

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
        let db = self.open_db().await?;

        // Use a single readwrite transaction for atomic check-and-delete
        let store = self.get_store(&db, false)?;

        // Issue both requests before awaiting to keep transaction active
        let get_request = store
            .get(&JsValue::from_str(id))
            .map_err(|e| StorageError::Internal(format!("Failed to get: {:?}", e)))?;

        let delete_request = store
            .delete(&JsValue::from_str(id))
            .map_err(|e| StorageError::Internal(format!("Failed to delete: {:?}", e)))?;

        // Now await the get to check existence
        let get_result = JsFuture::from(idb_request_to_promise(&get_request)?)
            .await
            .map_err(|e| StorageError::Internal(format!("Get failed: {:?}", e)))?;

        // Check if item existed (delete is already queued and will execute)
        if get_result.is_undefined() || get_result.is_null() {
            return Err(StorageError::NotFound(id.to_string()));
        }

        // Await the delete to ensure it completes
        JsFuture::from(idb_request_to_promise(&delete_request)?)
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
///
/// Uses Rc<RefCell<Option<Closure>>> pattern to manage closure lifetimes
/// without memory leaks from forget().
fn idb_request_to_promise(request: &IdbRequest) -> Result<js_sys::Promise, StorageError> {
    // Create shared closures that can be cleared after use
    let success_closure: Rc<RefCell<Option<Closure<dyn FnMut(web_sys::Event)>>>> =
        Rc::new(RefCell::new(None));
    let error_closure: Rc<RefCell<Option<Closure<dyn FnMut(web_sys::Event)>>>> =
        Rc::new(RefCell::new(None));

    let success_clone = success_closure.clone();
    let error_clone = error_closure.clone();

    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        let resolve_clone = resolve.clone();
        let reject_clone = reject.clone();
        let success_cleanup = success_clone.clone();
        let error_cleanup = error_clone.clone();

        let onsuccess = Closure::once(move |event: web_sys::Event| {
            // Clear closures to prevent memory leak
            success_cleanup.borrow_mut().take();
            error_cleanup.borrow_mut().take();

            let result = event
                .target()
                .and_then(|t| t.dyn_into::<IdbRequest>().ok())
                .and_then(|r| r.result().ok())
                .unwrap_or(JsValue::UNDEFINED);
            let _ = resolve_clone.call1(&JsValue::UNDEFINED, &result);
        });

        let success_cleanup2 = success_clone.clone();
        let error_cleanup2 = error_clone.clone();

        let onerror = Closure::once(move |event: web_sys::Event| {
            // Clear closures to prevent memory leak
            success_cleanup2.borrow_mut().take();
            error_cleanup2.borrow_mut().take();

            let error_msg = event
                .target()
                .and_then(|t| t.dyn_into::<IdbRequest>().ok())
                .and_then(|r| r.error().ok().flatten())
                .map(|e| e.message())
                .unwrap_or_else(|| "Unknown error".to_string());
            let _ = reject_clone.call1(&JsValue::UNDEFINED, &JsValue::from_str(&error_msg));
        });

        request.set_onsuccess(Some(onsuccess.as_ref().unchecked_ref()));
        request.set_onerror(Some(onerror.as_ref().unchecked_ref()));

        // Store closures to keep them alive until callback completes
        *success_clone.borrow_mut() = Some(onsuccess);
        *error_clone.borrow_mut() = Some(onerror);
    });

    Ok(promise)
}
