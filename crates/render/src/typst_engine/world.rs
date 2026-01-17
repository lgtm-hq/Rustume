//! Typst World implementation for Rustume.
//!
//! This module provides the `World` trait implementation required by Typst
//! to compile documents.

use std::collections::HashMap;
use std::sync::OnceLock;

use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime};
use typst::syntax::{FileId, Source, VirtualPath};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::Library;

/// Embedded templates
static TEMPLATES: OnceLock<HashMap<&'static str, &'static str>> = OnceLock::new();

fn get_templates() -> &'static HashMap<&'static str, &'static str> {
    TEMPLATES.get_or_init(|| {
        let mut map = HashMap::new();
        map.insert("rhyhorn", include_str!("templates/rhyhorn.typ"));
        map.insert("azurill", include_str!("templates/azurill.typ"));
        map.insert("pikachu", include_str!("templates/pikachu.typ"));
        map.insert("nosepass", include_str!("templates/nosepass.typ"));
        map
    })
}

/// The Rustume Typst world.
pub struct RustumeWorld {
    /// The main source file.
    main: Source,
    /// The standard library.
    library: OnceLock<LazyHash<Library>>,
    /// The font book.
    book: OnceLock<LazyHash<FontBook>>,
    /// Loaded fonts.
    fonts: OnceLock<Vec<Font>>,
    /// Additional source files (templates).
    sources: HashMap<FileId, Source>,
}

impl RustumeWorld {
    /// Create a new world with the given main source content.
    pub fn new(main_content: String) -> Self {
        let main_id = FileId::new(None, VirtualPath::new("main.typ"));
        let main = Source::new(main_id, main_content);

        // Pre-load template sources
        let mut sources = HashMap::new();
        for (name, content) in get_templates().iter() {
            let path = format!("templates/{}.typ", name);
            let id = FileId::new(None, VirtualPath::new(&path));
            sources.insert(id, Source::new(id, (*content).to_string()));
        }

        Self {
            main,
            library: OnceLock::new(),
            book: OnceLock::new(),
            fonts: OnceLock::new(),
            sources,
        }
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
            let buffer = Bytes::from_static(entry);
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
                if let Ok(entries) = std::fs::read_dir(path) {
                    for entry in entries.flatten() {
                        if let Ok(data) = std::fs::read(entry.path()) {
                            let buffer = Bytes::from(data);
                            for font in Font::iter(buffer) {
                                book.push(font.info().clone());
                                fonts.push(font);
                            }
                        }
                    }
                }
            }
        }

        (book, fonts)
    }
}

impl typst::World for RustumeWorld {
    fn library(&self) -> &LazyHash<Library> {
        self.library
            .get_or_init(|| LazyHash::new(Library::default()))
    }

    fn book(&self) -> &LazyHash<FontBook> {
        self.book.get_or_init(|| {
            let (book, _) = Self::load_fonts();
            LazyHash::new(book)
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
        let fonts = self.fonts.get_or_init(|| {
            let (_, fonts) = Self::load_fonts();
            fonts
        });
        fonts.get(index).cloned()
    }

    fn today(&self, _offset: Option<i64>) -> Option<Datetime> {
        let now = chrono::Local::now();
        Datetime::from_ymd(
            now.format("%Y").to_string().parse().ok()?,
            now.format("%m").to_string().parse().ok()?,
            now.format("%d").to_string().parse().ok()?,
        )
    }
}
