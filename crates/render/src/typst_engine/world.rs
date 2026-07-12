//! Typst World implementation for Rustume.
//!
//! This module provides the `World` trait implementation required by Typst
//! to compile documents.
//!
//! ## Template loading
//!
//! Templates are embedded at build time via [`include_dir!`] and serve as the
//! default set. On native targets, set `RUSTUME_TEMPLATES_DIR` to a directory
//! containing `<name>.typ` files. Override files are resolved on each render
//! (no server restart required); names not present in the override directory
//! fall back to the embedded copy. WASM builds use embedded templates only.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
#[cfg(test)]
use std::sync::Mutex;
use std::sync::OnceLock;

use chrono::Datelike;
use include_dir::{include_dir, Dir};
use crate::traits::RenderError;
use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime};
use typst::syntax::{FileId, Source, VirtualPath};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt};

/// Embedded template directory (all `.typ` files under `templates/`).
static TEMPLATE_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/src/typst_engine/templates");

/// Cached embedded template contents keyed by file stem (without `.typ`).
static EMBEDDED_TEMPLATES: OnceLock<HashMap<String, String>> = OnceLock::new();

/// Injectable override directory for unit tests (avoids process-global env vars).
#[cfg(test)]
static TEST_TEMPLATES_OVERRIDE: Mutex<Option<PathBuf>> = Mutex::new(None);

/// Shared font cache to avoid duplicate font loading
static FONTS_CACHE: OnceLock<(FontBook, Vec<Font>)> = OnceLock::new();

/// Return the cached map of embedded template name → content.
fn embedded_templates() -> &'static HashMap<String, String> {
    EMBEDDED_TEMPLATES.get_or_init(|| {
        let mut map = HashMap::new();
        for file in TEMPLATE_DIR.files() {
            let Some(stem) = file.path().file_stem().and_then(|name| name.to_str()) else {
                continue;
            };
            let Some(content) = file.contents_utf8() else {
                continue;
            };
            map.insert(stem.to_string(), content.to_string());
        }
        map
    })
}

/// Resolve the override directory: test injectable path on native, env var otherwise.
fn templates_override_dir() -> Option<PathBuf> {
    #[cfg(test)]
    {
        if let Ok(guard) = TEST_TEMPLATES_OVERRIDE.lock() {
            if let Some(dir) = guard.clone() {
                return Some(dir);
            }
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        std::env::var_os("RUSTUME_TEMPLATES_DIR").map(PathBuf::from)
    }

    #[cfg(target_arch = "wasm32")]
    {
        None
    }
}

/// Read a template override from disk when the override directory contains `<name>.typ`.
#[cfg(not(target_arch = "wasm32"))]
fn read_override_template(dir: &Path, name: &str) -> std::io::Result<Option<String>> {
    let path = dir.join(format!("{name}.typ"));
    if !path.is_file() {
        return Ok(None);
    }
    std::fs::read_to_string(&path).map(Some)
}

/// Resolve template content: override directory first, then embedded defaults.
fn resolve_template_content(name: &str) -> Result<String, RenderError> {
    if let Some(dir) = templates_override_dir() {
        #[cfg(not(target_arch = "wasm32"))]
        {
            match read_override_template(&dir, name) {
                Ok(Some(content)) => return Ok(content),
                Ok(None) => {}
                Err(err) => {
                    let path = dir.join(format!("{name}.typ"));
                    return Err(RenderError::RenderFailed(format!(
                        "Failed to read template override '{}': {err}",
                        path.display(),
                    )));
                }
            }
        }
    }
    embedded_templates()
        .get(name)
        .cloned()
        .ok_or_else(|| RenderError::TemplateNotFound(name.to_string()))
}

/// Set an injectable templates override directory for unit tests.
#[cfg(test)]
pub(crate) fn set_test_templates_override(dir: Option<PathBuf>) {
    *TEST_TEMPLATES_OVERRIDE.lock().unwrap() = dir;
}

/// The Rustume Typst world.
pub struct RustumeWorld {
    /// The main source file.
    main: Source,
    /// The standard library.
    library: OnceLock<LazyHash<Library>>,
    /// The font book.
    book: OnceLock<LazyHash<FontBook>>,
    /// Additional source files (templates).
    sources: HashMap<FileId, Source>,
}

impl RustumeWorld {
    /// Create a new world with the given main source content.
    pub fn new(main_content: String) -> Result<Self, RenderError> {
        let main_id = FileId::new(None, VirtualPath::new("main.typ"));
        let main = Source::new(main_id, main_content);

        // Pre-load template sources (override resolved per render).
        let mut sources = HashMap::new();
        for name in embedded_templates().keys() {
            let content = resolve_template_content(name)?;
            let path = format!("templates/{name}.typ");
            let id = FileId::new(None, VirtualPath::new(&path));
            sources.insert(id, Source::new(id, content));
        }

        Ok(Self {
            main,
            library: OnceLock::new(),
            book: OnceLock::new(),
            sources,
        })
    }

    /// Get the main source file ID.
    pub fn main_id(&self) -> FileId {
        self.main.id()
    }

    /// Load system fonts.
    fn load_fonts() -> (FontBook, Vec<Font>) {
        let mut book = FontBook::new();
        let mut fonts = Vec::new();

        // Load bundled fonts from typst-assets
        for entry in typst_assets::fonts() {
            let buffer = Bytes::new(entry.to_vec());
            for font in Font::iter(buffer) {
                book.push(font.info().clone());
                fonts.push(font);
            }
        }

        // Also try to load fonts from common system paths
        #[cfg(target_os = "macos")]
        {
            let font_paths = ["/System/Library/Fonts", "/Library/Fonts"];
            for path in font_paths {
                Self::load_fonts_from_dir(path, &mut book, &mut fonts);
            }
        }

        #[cfg(target_os = "linux")]
        {
            let font_paths = ["/usr/share/fonts", "/usr/local/share/fonts"];
            for path in font_paths {
                Self::load_fonts_from_dir(path, &mut book, &mut fonts);
            }
            // Also check user fonts directory
            if let Some(home) = std::env::var_os("HOME") {
                let user_fonts = std::path::Path::new(&home).join(".fonts");
                if let Some(path) = user_fonts.to_str() {
                    Self::load_fonts_from_dir(path, &mut book, &mut fonts);
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            if let Some(windir) = std::env::var_os("WINDIR") {
                let font_path = std::path::Path::new(&windir).join("Fonts");
                if let Some(path) = font_path.to_str() {
                    Self::load_fonts_from_dir(path, &mut book, &mut fonts);
                }
            }
        }

        (book, fonts)
    }

    /// Supported font file extensions.
    const FONT_EXTENSIONS: &'static [&'static str] = &["ttf", "otf", "ttc", "woff", "woff2"];

    /// Load fonts from a directory (recursively).
    /// Skips symlinks to avoid potential cycles or unbounded traversal.
    fn load_fonts_from_dir(path: &str, book: &mut FontBook, fonts: &mut Vec<Font>) {
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let entry_path = entry.path();

                // Use file_type() instead of is_dir()/is_file() to avoid following symlinks
                let file_type = match entry.file_type() {
                    Ok(t) => t,
                    Err(_) => continue,
                };

                if file_type.is_dir() {
                    // Recursively load fonts from subdirectories
                    if let Some(subpath) = entry_path.to_str() {
                        Self::load_fonts_from_dir(subpath, book, fonts);
                    }
                } else if file_type.is_file() {
                    // Only read files with font extensions
                    let is_font = entry_path
                        .extension()
                        .and_then(|ext| ext.to_str())
                        .map(|ext| Self::FONT_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
                        .unwrap_or(false);

                    if is_font {
                        if let Ok(data) = std::fs::read(&entry_path) {
                            let buffer = Bytes::new(data);
                            for font in Font::iter(buffer) {
                                book.push(font.info().clone());
                                fonts.push(font);
                            }
                        }
                    }
                }
                // Symlinks are implicitly skipped (file_type.is_symlink() would be true)
            }
        }
    }
}

/// Get the shared font cache, loading fonts only once.
fn get_fonts_cache() -> &'static (FontBook, Vec<Font>) {
    FONTS_CACHE.get_or_init(RustumeWorld::load_fonts)
}

impl typst::World for RustumeWorld {
    fn library(&self) -> &LazyHash<Library> {
        self.library
            .get_or_init(|| LazyHash::new(Library::default()))
    }

    fn book(&self) -> &LazyHash<FontBook> {
        self.book.get_or_init(|| {
            let (book, _) = get_fonts_cache();
            LazyHash::new(book.clone())
        })
    }

    fn main(&self) -> FileId {
        self.main_id()
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.main.id() {
            Ok(self.main.clone())
        } else if let Some(source) = self.sources.get(&id) {
            Ok(source.clone())
        } else {
            Err(FileError::NotFound(id.vpath().as_rootless_path().into()))
        }
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        // For now, we only support source files, not binary files
        Err(FileError::NotFound(id.vpath().as_rootless_path().into()))
    }

    fn font(&self, index: usize) -> Option<Font> {
        let (_, fonts) = get_fonts_cache();
        fonts.get(index).cloned()
    }

    fn today(&self, offset: Option<i64>) -> Option<Datetime> {
        let now = chrono::Utc::now();
        let offset_hours = offset.unwrap_or(0);
        let adjusted = now + chrono::Duration::hours(offset_hours);
        Datetime::from_ymd(
            adjusted.year(),
            adjusted.month() as u8,
            adjusted.day() as u8,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Serializes override tests that mutate process-global template state.
    static OVERRIDE_TEST_LOCK: Mutex<()> = Mutex::new(());

    const EXPECTED_TEMPLATES: &[&str] = &[
        "rhyhorn",
        "azurill",
        "pikachu",
        "nosepass",
        "bronzor",
        "chikorita",
        "ditto",
        "gengar",
        "glalie",
        "kakuna",
        "leafish",
        "onyx",
    ];

    fn reset_test_override() {
        set_test_templates_override(None);
    }

    #[test]
    fn embedded_templates_include_all_defaults() {
        let embedded = embedded_templates();
        for name in EXPECTED_TEMPLATES {
            assert!(
                embedded.contains_key(*name),
                "embedded set missing template '{name}'"
            );
        }
        assert!(
            embedded.contains_key("_common"),
            "embedded set missing '_common'"
        );
        assert_eq!(
            embedded.len(),
            EXPECTED_TEMPLATES.len() + 1,
            "unexpected embedded template count"
        );
    }

    #[test]
    fn override_dir_takes_precedence_over_embedded() {
        let _lock = OVERRIDE_TEST_LOCK.lock().unwrap();
        reset_test_override();
        let temp = tempfile::tempdir().expect("tempdir");
        let marker = "OVERRIDE_MARKER_FOR_RHYHORN";
        fs::write(temp.path().join("rhyhorn.typ"), marker).expect("write override");

        set_test_templates_override(Some(temp.path().to_path_buf()));
        let content = resolve_template_content("rhyhorn").expect("rhyhorn content");
        reset_test_override();

        assert!(content.contains(marker));
    }

    #[test]
    fn override_dir_falls_back_to_embedded_for_missing_files() {
        let _lock = OVERRIDE_TEST_LOCK.lock().unwrap();
        reset_test_override();
        let temp = tempfile::tempdir().expect("tempdir");
        set_test_templates_override(Some(temp.path().to_path_buf()));

        let embedded = embedded_templates()
            .get("azurill")
            .expect("embedded azurill")
            .clone();
        let resolved = resolve_template_content("azurill").expect("azurill content");
        reset_test_override();

        assert_eq!(resolved, embedded);
    }

    #[test]
    fn override_dir_errors_on_unreadable_file() {
        let _lock = OVERRIDE_TEST_LOCK.lock().unwrap();
        reset_test_override();
        let temp = tempfile::tempdir().expect("tempdir");
        let override_path = temp.path().join("rhyhorn.typ");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            fs::write(&override_path, "content").expect("write override");
            fs::set_permissions(&override_path, fs::Permissions::from_mode(0o000))
                .expect("chmod override");
        }
        #[cfg(not(unix))]
        {
            fs::create_dir(&override_path).expect("create override dir");
        }

        set_test_templates_override(Some(temp.path().to_path_buf()));
        let err = resolve_template_content("rhyhorn").expect_err("expected read error");
        reset_test_override();

        match err {
            RenderError::RenderFailed(message) => {
                assert!(message.contains("Failed to read template override"));
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }
}
