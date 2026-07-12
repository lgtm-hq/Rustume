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
use std::sync::{Mutex, OnceLock};

use crate::traits::RenderError;
use chrono::Datelike;
use include_dir::{include_dir, Dir};
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

// Shared override directory for unit tests (visible to typst worker threads).
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
        TEST_TEMPLATES_OVERRIDE
            .lock()
            .ok()
            .and_then(|guard| guard.clone())
    }

    #[cfg(not(test))]
    #[cfg(not(target_arch = "wasm32"))]
    {
        std::env::var_os("RUSTUME_TEMPLATES_DIR").map(PathBuf::from)
    }

    #[cfg(not(test))]
    #[cfg(target_arch = "wasm32")]
    {
        None
    }
}

/// Read a template override from disk when the override directory contains `<name>.typ`.
#[cfg(not(target_arch = "wasm32"))]
fn read_override_template(dir: &Path, name: &str) -> std::io::Result<Option<String>> {
    let path = dir.join(format!("{name}.typ"));
    match path.symlink_metadata() {
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(err),
        Ok(meta) if meta.is_file() => std::fs::read_to_string(&path).map(Some),
        Ok(meta) if meta.file_type().is_symlink() => match std::fs::metadata(&path) {
            Ok(target) if target.is_file() => std::fs::read_to_string(&path).map(Some),
            Ok(_) => Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!(
                    "template override is not a regular file: {}",
                    path.display()
                ),
            )),
            Err(err) => Err(err),
        },
        Ok(_) => Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!(
                "template override is not a regular file: {}",
                path.display()
            ),
        )),
    }
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
    /// Lazily resolved template sources (override errors only fail when that
    /// template is actually requested by Typst).
    sources: Mutex<HashMap<FileId, Source>>,
}

impl RustumeWorld {
    /// Create a new world with the given main source content.
    ///
    /// Template overrides are resolved lazily in [`typst::World::source`] so a
    /// broken override for an unused template cannot block rendering another.
    pub fn new(main_content: String) -> Result<Self, RenderError> {
        let main_id = FileId::new(None, VirtualPath::new("main.typ"));
        let main = Source::new(main_id, main_content);

        Ok(Self {
            main,
            library: OnceLock::new(),
            book: OnceLock::new(),
            sources: Mutex::new(HashMap::new()),
        })
    }

    /// Resolve `templates/<name>.typ` from an override dir or embedded defaults.
    fn load_template_source(id: FileId) -> FileResult<Source> {
        let path = id.vpath().as_rootless_path();
        let path_str = path.to_string_lossy();
        let Some(name) = path_str
            .strip_prefix("templates/")
            .and_then(|rest| rest.strip_suffix(".typ"))
            .filter(|name| !name.is_empty() && !name.contains('/'))
        else {
            return Err(FileError::NotFound(path.into()));
        };

        let content = resolve_template_content(name)
            .map_err(|err| FileError::Other(Some(err.to_string().into())))?;
        Ok(Source::new(id, content))
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
            return Ok(self.main.clone());
        }

        {
            let sources = self
                .sources
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            if let Some(source) = sources.get(&id) {
                return Ok(source.clone());
            }
        }

        let source = Self::load_template_source(id)?;
        let mut sources = self
            .sources
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        Ok(sources.entry(id).or_insert(source).clone())
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
    #[cfg(unix)]
    fn override_dir_follows_symlink_to_file() {
        let _lock = OVERRIDE_TEST_LOCK.lock().unwrap();
        reset_test_override();
        let temp = tempfile::tempdir().expect("tempdir");
        let marker = "SYMLINK_OVERRIDE_MARKER";
        let target = temp.path().join("actual.typ");
        fs::write(&target, marker).expect("write target");
        std::os::unix::fs::symlink(&target, temp.path().join("rhyhorn.typ")).expect("symlink");

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

    #[test]
    fn override_dir_errors_on_non_file_path() {
        let _lock = OVERRIDE_TEST_LOCK.lock().unwrap();
        reset_test_override();
        let temp = tempfile::tempdir().expect("tempdir");
        fs::create_dir(temp.path().join("rhyhorn.typ")).expect("create override dir");

        set_test_templates_override(Some(temp.path().to_path_buf()));
        let err = resolve_template_content("rhyhorn").expect_err("expected non-file error");
        reset_test_override();

        match err {
            RenderError::RenderFailed(message) => {
                assert!(message.contains("not a regular file"));
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[test]
    fn unused_broken_override_does_not_block_other_template() {
        let _lock = OVERRIDE_TEST_LOCK.lock().unwrap();
        reset_test_override();
        let temp = tempfile::tempdir().expect("tempdir");
        // Broken override for an unused template must not prevent loading rhyhorn.
        fs::create_dir(temp.path().join("azurill.typ")).expect("create azurill override dir");
        set_test_templates_override(Some(temp.path().to_path_buf()));

        let world = RustumeWorld::new("// unused-override isolation".into())
            .expect("world construction must ignore unused overrides");
        let rhyhorn_id = FileId::new(None, VirtualPath::new("templates/rhyhorn.typ"));
        let source = typst::World::source(&world, rhyhorn_id).expect("rhyhorn should load");
        assert!(!source.text().is_empty());

        let azurill_id = FileId::new(None, VirtualPath::new("templates/azurill.typ"));
        assert!(
            typst::World::source(&world, azurill_id).is_err(),
            "broken azurill override should still fail when requested"
        );
        reset_test_override();
    }
}
