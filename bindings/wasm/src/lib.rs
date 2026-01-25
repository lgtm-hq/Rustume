//! WebAssembly bindings for Rustume.
//!
//! This crate exposes the Rust core to JavaScript/TypeScript
//! via wasm-bindgen.
//!
//! # Supported Import Formats
//!
//! - **JSON Resume**: Standard JSON Resume format (`parse_json_resume`)
//! - **LinkedIn Export**: ZIP file from LinkedIn data export (`parse_linkedin_export`)
//! - **Reactive Resume V3**: JSON export from Reactive Resume V3 (`parse_reactive_resume_v3`)

use rustume_parser::{JsonResumeParser, LinkedInParser, Parser, ReactiveResumeV3Parser};
use rustume_schema::ResumeData;
use validator::Validate;
use wasm_bindgen::prelude::*;

/// Initialize the WASM module.
#[wasm_bindgen(start)]
pub fn init() {
    // Initialization placeholder for future use
}

// ============================================================================
// Parser Functions
// ============================================================================

/// Parse a JSON Resume format string into Rustume format.
///
/// # Arguments
/// * `input` - JSON string in JSON Resume format
///
/// # Returns
/// A JavaScript object representing the parsed resume data.
///
/// # Example (JavaScript)
/// ```js
/// const resume = parse_json_resume(jsonResumeString);
/// console.log(resume.basics.name);
/// ```
#[wasm_bindgen]
pub fn parse_json_resume(input: &str) -> Result<JsValue, JsError> {
    let parser = JsonResumeParser;
    let resume = parser
        .parse(input.as_bytes())
        .map_err(|e| JsError::new(&e.to_string()))?;

    serde_wasm_bindgen::to_value(&resume).map_err(|e| JsError::new(&e.to_string()))
}

/// Parse a Reactive Resume V3 JSON export into Rustume format.
///
/// This function imports resumes exported from Reactive Resume V3
/// and converts them to the Rustume format.
///
/// # Arguments
/// * `input` - JSON string in Reactive Resume V3 format
///
/// # Returns
/// A JavaScript object representing the parsed resume data.
///
/// # Example (JavaScript)
/// ```js
/// const resume = parse_reactive_resume_v3(v3JsonString);
/// console.log(resume.basics.name);
/// ```
#[wasm_bindgen]
pub fn parse_reactive_resume_v3(input: &str) -> Result<JsValue, JsError> {
    let parser = ReactiveResumeV3Parser;
    let resume = parser
        .parse(input.as_bytes())
        .map_err(|e| JsError::new(&e.to_string()))?;

    serde_wasm_bindgen::to_value(&resume).map_err(|e| JsError::new(&e.to_string()))
}

/// Parse a LinkedIn data export ZIP file into Rustume format.
///
/// LinkedIn allows users to download their data as a ZIP file containing
/// CSV files. This function parses that ZIP file and extracts resume data.
///
/// # Arguments
/// * `data` - Raw bytes of the LinkedIn ZIP export file (Uint8Array in JS)
///
/// # Returns
/// A JavaScript object representing the parsed resume data.
///
/// # Example (JavaScript)
/// ```js
/// // From file input
/// const file = event.target.files[0];
/// const arrayBuffer = await file.arrayBuffer();
/// const data = new Uint8Array(arrayBuffer);
/// const resume = parse_linkedin_export(data);
/// console.log(resume.basics.name);
/// ```
#[wasm_bindgen]
pub fn parse_linkedin_export(data: &[u8]) -> Result<JsValue, JsError> {
    let parser = LinkedInParser;
    let resume = parser
        .parse(data)
        .map_err(|e| JsError::new(&e.to_string()))?;

    serde_wasm_bindgen::to_value(&resume).map_err(|e| JsError::new(&e.to_string()))
}

// ============================================================================
// Utility Functions
// ============================================================================

/// Validate resume data.
#[wasm_bindgen]
pub fn validate_resume(input: &str) -> Result<bool, JsError> {
    let resume: ResumeData =
        serde_json::from_str(input).map_err(|e| JsError::new(&e.to_string()))?;

    resume
        .validate()
        .map_err(|e| JsError::new(&e.to_string()))?;

    Ok(true)
}

/// Create a new empty resume with defaults.
#[wasm_bindgen]
pub fn create_empty_resume() -> Result<JsValue, JsError> {
    let resume = ResumeData::default();
    serde_wasm_bindgen::to_value(&resume).map_err(|e| JsError::new(&e.to_string()))
}

/// Serialize resume to JSON string.
#[wasm_bindgen]
pub fn resume_to_json(resume: JsValue) -> Result<String, JsError> {
    let resume: ResumeData =
        serde_wasm_bindgen::from_value(resume).map_err(|e| JsError::new(&e.to_string()))?;

    serde_json::to_string_pretty(&resume).map_err(|e| JsError::new(&e.to_string()))
}

// ============================================================================
// Render Functions
// ============================================================================
// NOTE: PDF rendering via Typst is not available in WASM due to native dependencies.
// PDF rendering should be done server-side or via a separate service.
// The following functions provide template metadata only.

/// List available templates.
///
/// # Returns
/// An array of template names.
///
/// # Example (JavaScript)
/// ```js
/// const templates = list_templates();
/// // ["rhyhorn"]
/// ```
///
/// **Keep in sync with:** `crates/render/src/typst_engine/engine.rs::TEMPLATES`
#[wasm_bindgen]
pub fn list_templates() -> Result<JsValue, JsError> {
    // Hardcoded list since we can't import rustume_render in WASM
    let templates = vec!["rhyhorn", "azurill", "pikachu", "nosepass"];
    serde_wasm_bindgen::to_value(&templates).map_err(|e| JsError::new(&e.to_string()))
}

/// Get the default theme colors for a template.
///
/// # Arguments
/// * `template` - Template name
///
/// # Returns
/// An object with background, text, and primary color hex values.
///
/// # Example (JavaScript)
/// ```js
/// const theme = get_template_theme("rhyhorn");
/// // { background: "#ffffff", text: "#000000", primary: "#dc2626" }
/// ```
#[wasm_bindgen]
pub fn get_template_theme_js(template: &str) -> Result<JsValue, JsError> {
    // Hardcoded themes since we can't import rustume_render in WASM
    let (background, text, primary) = match template {
        "rhyhorn" => ("#ffffff", "#000000", "#dc2626"),
        "azurill" => ("#ffffff", "#000000", "#d97706"),
        "pikachu" => ("#ffffff", "#000000", "#ca8a04"),
        "nosepass" => ("#ffffff", "#000000", "#3b82f6"),
        // Default to rhyhorn theme for unknown templates
        _ => ("#ffffff", "#000000", "#dc2626"),
    };

    serde_wasm_bindgen::to_value(&serde_json::json!({
        "background": background,
        "text": text,
        "primary": primary,
    }))
    .map_err(|e| JsError::new(&e.to_string()))
}

// ============================================================================
// Storage Functions (WASM only - IndexedDB)
// ============================================================================

#[cfg(target_arch = "wasm32")]
mod storage_wasm {
    use super::*;
    use rustume_storage::{IndexedDbStorage, StorageBackend, StorageError};
    use wasm_bindgen_futures::future_to_promise;

    /// Storage wrapper for WASM bindings.
    #[wasm_bindgen]
    pub struct Storage {
        db_name: String,
    }

    #[wasm_bindgen]
    impl Storage {
        /// Create a new storage instance.
        ///
        /// # Arguments
        /// * `db_name` - Name of the IndexedDB database (default: "rustume")
        ///
        /// # Example (JavaScript)
        /// ```js
        /// const storage = new Storage("my-resumes");
        /// ```
        #[wasm_bindgen(constructor)]
        pub fn new(db_name: Option<String>) -> Self {
            Self {
                db_name: db_name.unwrap_or_else(|| "rustume".to_string()),
            }
        }

        /// List all resume IDs.
        ///
        /// # Returns
        /// A Promise resolving to an array of resume IDs.
        ///
        /// # Example (JavaScript)
        /// ```js
        /// const ids = await storage.list();
        /// // ["resume-1", "resume-2"]
        /// ```
        pub fn list(&self) -> js_sys::Promise {
            let storage = IndexedDbStorage::new(self.db_name.clone());
            future_to_promise(async move {
                let ids: Vec<String> = storage
                    .list()
                    .await
                    .map_err(|e: StorageError| JsValue::from_str(&e.to_string()))?;
                serde_wasm_bindgen::to_value(&ids).map_err(|e| JsValue::from_str(&e.to_string()))
            })
        }

        /// Get a resume by ID.
        ///
        /// # Arguments
        /// * `id` - Resume ID
        ///
        /// # Returns
        /// A Promise resolving to the resume data, or rejecting if not found.
        ///
        /// # Example (JavaScript)
        /// ```js
        /// const resume = await storage.get("my-resume-id");
        /// console.log(resume.basics.name);
        /// ```
        pub fn get(&self, id: String) -> js_sys::Promise {
            let storage = IndexedDbStorage::new(self.db_name.clone());
            future_to_promise(async move {
                let resume: ResumeData = storage
                    .get(&id)
                    .await
                    .map_err(|e: StorageError| JsValue::from_str(&e.to_string()))?;
                serde_wasm_bindgen::to_value(&resume).map_err(|e| JsValue::from_str(&e.to_string()))
            })
        }

        /// Save a resume.
        ///
        /// # Arguments
        /// * `id` - Resume ID
        /// * `resume` - Resume data to save
        ///
        /// # Returns
        /// A Promise resolving when save is complete.
        ///
        /// # Example (JavaScript)
        /// ```js
        /// await storage.save("my-resume-id", resume);
        /// ```
        pub fn save(&self, id: String, resume: JsValue) -> js_sys::Promise {
            let storage = IndexedDbStorage::new(self.db_name.clone());
            future_to_promise(async move {
                let resume: ResumeData = serde_wasm_bindgen::from_value(resume)
                    .map_err(|e| JsValue::from_str(&e.to_string()))?;
                storage
                    .save(&id, &resume)
                    .await
                    .map_err(|e: StorageError| JsValue::from_str(&e.to_string()))?;
                Ok(JsValue::UNDEFINED)
            })
        }

        /// Delete a resume.
        ///
        /// # Arguments
        /// * `id` - Resume ID
        ///
        /// # Returns
        /// A Promise resolving when delete is complete, or rejecting if not found.
        ///
        /// # Example (JavaScript)
        /// ```js
        /// await storage.delete("my-resume-id");
        /// ```
        pub fn delete(&self, id: String) -> js_sys::Promise {
            let storage = IndexedDbStorage::new(self.db_name.clone());
            future_to_promise(async move {
                storage
                    .delete(&id)
                    .await
                    .map_err(|e: StorageError| JsValue::from_str(&e.to_string()))?;
                Ok(JsValue::UNDEFINED)
            })
        }

        /// Check if a resume exists.
        ///
        /// # Arguments
        /// * `id` - Resume ID
        ///
        /// # Returns
        /// A Promise resolving to a boolean.
        ///
        /// # Example (JavaScript)
        /// ```js
        /// const exists = await storage.exists("my-resume-id");
        /// ```
        pub fn exists(&self, id: String) -> js_sys::Promise {
            let storage = IndexedDbStorage::new(self.db_name.clone());
            future_to_promise(async move {
                let exists: bool = storage
                    .exists(&id)
                    .await
                    .map_err(|e: StorageError| JsValue::from_str(&e.to_string()))?;
                Ok(JsValue::from_bool(exists))
            })
        }
    }
}
