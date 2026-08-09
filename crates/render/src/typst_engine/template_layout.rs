//! Structural layout metadata for the bundled Typst templates.
//!
//! Every value here is derived from the template's own Typst source in
//! `crates/render/src/typst_engine/templates/<name>.typ` — specifically from
//! the `render-resume(data, (...))` configuration and the header markup that
//! precedes it. The prose comments on [`TEMPLATES`](crate::TEMPLATES) are a
//! cross-check only; the Typst source wins.
//!
//! Column indices follow the layout editor's convention: column `0` is the
//! main column and column `1` is the sidebar column, regardless of which side
//! the template paints them on.

/// How a template arranges its page-0 columns.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LayoutMode {
    /// One linear column; every section flows top to bottom.
    Single,
    /// Narrow sidebar on the visual left, main column on the right.
    SidebarLeft,
    /// Main column on the visual left, narrow sidebar on the right.
    SidebarRight,
    /// Full-width header band above two equally weighted columns.
    HeaderSplit,
}

impl LayoutMode {
    /// Wire representation used by the HTTP API.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Single => "single",
            Self::SidebarLeft => "sidebar-left",
            Self::SidebarRight => "sidebar-right",
            Self::HeaderSplit => "header-split",
        }
    }
}

/// How a template presents the name/headline block.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HeaderStyle {
    /// Left-aligned name block at the top of the content area.
    Left,
    /// Centered name block at the top of the content area.
    Center,
    /// Full-bleed filled band spanning the page width.
    Banner,
    /// Name block inside a stroked/rounded box.
    Boxed,
    /// Name block rendered inside the sidebar column.
    Sidebar,
}

impl HeaderStyle {
    /// Wire representation used by the HTTP API.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Left => "left",
            Self::Center => "center",
            Self::Banner => "banner",
            Self::Boxed => "boxed",
            Self::Sidebar => "sidebar",
        }
    }
}

/// Where a template prints the contact details (email, phone, location, URL).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContactIn {
    /// Inside the sidebar column.
    Sidebar,
    /// Inside the header block, above the content columns.
    Header,
    /// Inside the full-bleed header band.
    Banner,
}

impl ContactIn {
    /// Wire representation used by the HTTP API.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Sidebar => "sidebar",
            Self::Header => "header",
            Self::Banner => "banner",
        }
    }
}

/// Structural description of a template, enough for a client to draw the
/// sheet chrome without re-deriving it from the Typst source.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateLayout {
    /// Column arrangement of the page.
    pub layout_mode: LayoutMode,
    /// Page-0 section ids per column as `[main, sidebar]`, used when the
    /// resume carries no explicit `metadata.layout`. Single-column templates
    /// return every section in the main slot and an empty sidebar slot.
    pub default_columns: [Vec<String>; 2],
    /// Presentation of the name/headline block.
    pub header_style: HeaderStyle,
    /// Placement of the contact details.
    pub contact_in: ContactIn,
    /// Default sidebar width in typographic points, for templates whose
    /// sidebar is a fixed width. `None` when the split is proportional
    /// (`fr` units) or when the template has no sidebar at all.
    pub sidebar_width: Option<u32>,
}

/// `default-main-sections` in `templates/_common.typ`.
const MAIN_SECTIONS: &[&str] = &[
    "summary",
    "experience",
    "education",
    "awards",
    "certifications",
    "publications",
    "volunteer",
    "projects",
    "references",
];

/// `default-sidebar-sections` in `templates/_common.typ`.
const SIDEBAR_SECTIONS: &[&str] = &[
    "profiles",
    "skills",
    "interests",
    "certifications",
    "awards",
    "publications",
    "languages",
];

/// De-duplicate section ids while preserving first-seen order, mirroring
/// `unique-section-order` in `templates/_common.typ`.
fn unique_sections(sources: &[&[&str]]) -> Vec<String> {
    let mut keys: Vec<String> = Vec::new();
    for source in sources {
        for key in *source {
            if !keys.iter().any(|existing| existing == key) {
                keys.push((*key).to_string());
            }
        }
    }
    keys
}

/// `default-main-sections + ("custom",)`.
fn main_with_custom() -> Vec<String> {
    unique_sections(&[MAIN_SECTIONS, &["custom"]])
}

/// `default-sidebar-sections`.
fn sidebar_default() -> Vec<String> {
    unique_sections(&[SIDEBAR_SECTIONS])
}

/// `default-all-sections`, the fallback for single-column templates.
fn all_sections() -> Vec<String> {
    unique_sections(&[MAIN_SECTIONS, SIDEBAR_SECTIONS, &["custom"]])
}

/// Layout for a single-column template: everything in the main slot.
fn single(header_style: HeaderStyle) -> TemplateLayout {
    TemplateLayout {
        layout_mode: LayoutMode::Single,
        default_columns: [all_sections(), Vec::new()],
        header_style,
        contact_in: ContactIn::Header,
        sidebar_width: None,
    }
}

/// Layout for a two-column template using the shared column fallbacks.
fn two_column(
    layout_mode: LayoutMode,
    header_style: HeaderStyle,
    contact_in: ContactIn,
    sidebar_width: Option<u32>,
) -> TemplateLayout {
    TemplateLayout {
        layout_mode,
        default_columns: [main_with_custom(), sidebar_default()],
        header_style,
        contact_in,
        sidebar_width,
    }
}

/// Get the structural layout of a template.
///
/// Unknown template ids fall back to `rhyhorn`, mirroring
/// [`get_template_theme`](crate::get_template_theme).
///
/// # Examples
///
/// ```
/// use rustume_render::get_template_layout;
///
/// let layout = rustume_render::get_template_layout("pikachu");
/// assert_eq!(layout.sidebar_width, Some(180));
/// ```
#[must_use]
pub fn get_template_layout(template: &str) -> TemplateLayout {
    match template {
        // Single-column, name left with contact stacked right, accent rule.
        "rhyhorn" | "onyx" => single(HeaderStyle::Left),
        // Single-column, name over a thick accent underline.
        "nosepass" => single(HeaderStyle::Left),
        // Single-column, centered name and inline contact row.
        "bronzor" => single(HeaderStyle::Center),
        // Single-column, centered name inside a stroked box.
        "kakuna" => single(HeaderStyle::Boxed),
        // Centered header above proportional (1fr, 2fr) columns; the sidebar
        // column is painted on the visual left.
        "azurill" => two_column(
            LayoutMode::SidebarLeft,
            HeaderStyle::Center,
            ContactIn::Header,
            None,
        ),
        // Left-aligned header above proportional (2fr, 1fr) columns; the
        // sidebar column is painted on the visual right.
        "chikorita" => two_column(
            LayoutMode::SidebarRight,
            HeaderStyle::Left,
            ContactIn::Header,
            None,
        ),
        // Full-width accent banner above a fixed 160pt left sidebar.
        "ditto" => two_column(
            LayoutMode::SidebarLeft,
            HeaderStyle::Banner,
            ContactIn::Banner,
            Some(160),
        ),
        // Name, headline and contact all live inside a fixed 170pt sidebar.
        "gengar" | "glalie" => two_column(
            LayoutMode::SidebarLeft,
            HeaderStyle::Sidebar,
            ContactIn::Sidebar,
            Some(170),
        ),
        // Name and headline head the main column; contact lives in the fixed
        // 180pt sidebar.
        "pikachu" => two_column(
            LayoutMode::SidebarLeft,
            HeaderStyle::Left,
            ContactIn::Sidebar,
            Some(180),
        ),
        // Two-tier full-width header band above equal (1fr, 1fr) columns.
        // `custom` sits in the right column here, not the left one.
        "leafish" => TemplateLayout {
            layout_mode: LayoutMode::HeaderSplit,
            default_columns: [
                unique_sections(&[MAIN_SECTIONS]),
                unique_sections(&[SIDEBAR_SECTIONS, &["custom"]]),
            ],
            header_style: HeaderStyle::Banner,
            contact_in: ContactIn::Banner,
            sidebar_width: None,
        },
        // Unknown templates mirror the rhyhorn fallback.
        _ => single(HeaderStyle::Left),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::TEMPLATES;

    /// Templates whose sidebar is a fixed point width in the Typst source.
    const FIXED_SIDEBAR_WIDTHS: &[(&str, u32)] = &[
        ("ditto", 160),
        ("gengar", 170),
        ("glalie", 170),
        ("pikachu", 180),
    ];

    const SINGLE_COLUMN: &[&str] = &["rhyhorn", "nosepass", "bronzor", "kakuna", "onyx"];

    #[test]
    fn every_template_has_a_non_empty_main_column() {
        for template in TEMPLATES {
            let layout = get_template_layout(template);
            assert!(
                !layout.default_columns[0].is_empty(),
                "{template} has an empty main column"
            );
        }
    }

    #[test]
    fn single_column_templates_have_an_empty_sidebar_column() {
        for template in SINGLE_COLUMN {
            let layout = get_template_layout(template);
            assert_eq!(
                layout.layout_mode,
                LayoutMode::Single,
                "{template} should be single-column"
            );
            assert!(
                layout.default_columns[1].is_empty(),
                "{template} should have an empty sidebar column"
            );
            assert_eq!(layout.sidebar_width, None, "{template} has no sidebar");
        }
    }

    #[test]
    fn multi_column_templates_have_a_non_empty_sidebar_column() {
        for template in TEMPLATES {
            let layout = get_template_layout(template);
            if layout.layout_mode == LayoutMode::Single {
                continue;
            }
            assert!(
                !layout.default_columns[1].is_empty(),
                "{template} should populate its sidebar column"
            );
        }
    }

    #[test]
    fn fixed_sidebar_templates_declare_their_width() {
        for (template, width) in FIXED_SIDEBAR_WIDTHS {
            let layout = get_template_layout(template);
            assert_eq!(
                layout.sidebar_width,
                Some(*width),
                "{template} sidebar width"
            );
        }
    }

    #[test]
    fn proportional_sidebar_templates_declare_no_fixed_width() {
        for template in ["azurill", "chikorita", "leafish"] {
            let layout = get_template_layout(template);
            assert_ne!(layout.layout_mode, LayoutMode::Single);
            assert_eq!(
                layout.sidebar_width, None,
                "{template} splits proportionally"
            );
        }
    }

    #[test]
    fn columns_never_repeat_a_section_within_themselves() {
        for template in TEMPLATES {
            let layout = get_template_layout(template);
            for column in &layout.default_columns {
                let mut seen = column.clone();
                seen.sort_unstable();
                seen.dedup();
                assert_eq!(seen.len(), column.len(), "{template} repeats a section id");
            }
        }
    }

    #[test]
    fn unknown_templates_fall_back_to_rhyhorn() {
        assert_eq!(
            get_template_layout("not-a-template"),
            get_template_layout("rhyhorn")
        );
    }

    #[test]
    fn layout_modes_match_the_template_sources() {
        let expected = [
            ("rhyhorn", LayoutMode::Single),
            ("azurill", LayoutMode::SidebarLeft),
            ("pikachu", LayoutMode::SidebarLeft),
            ("nosepass", LayoutMode::Single),
            ("bronzor", LayoutMode::Single),
            ("chikorita", LayoutMode::SidebarRight),
            ("ditto", LayoutMode::SidebarLeft),
            ("gengar", LayoutMode::SidebarLeft),
            ("glalie", LayoutMode::SidebarLeft),
            ("kakuna", LayoutMode::Single),
            ("leafish", LayoutMode::HeaderSplit),
            ("onyx", LayoutMode::Single),
        ];
        assert_eq!(expected.len(), TEMPLATES.len());
        for (template, mode) in expected {
            assert_eq!(
                get_template_layout(template).layout_mode,
                mode,
                "{template}"
            );
        }
    }

    #[test]
    fn header_and_contact_placement_match_the_template_sources() {
        let expected = [
            ("rhyhorn", HeaderStyle::Left, ContactIn::Header),
            ("azurill", HeaderStyle::Center, ContactIn::Header),
            ("pikachu", HeaderStyle::Left, ContactIn::Sidebar),
            ("nosepass", HeaderStyle::Left, ContactIn::Header),
            ("bronzor", HeaderStyle::Center, ContactIn::Header),
            ("chikorita", HeaderStyle::Left, ContactIn::Header),
            ("ditto", HeaderStyle::Banner, ContactIn::Banner),
            ("gengar", HeaderStyle::Sidebar, ContactIn::Sidebar),
            ("glalie", HeaderStyle::Sidebar, ContactIn::Sidebar),
            ("kakuna", HeaderStyle::Boxed, ContactIn::Header),
            ("leafish", HeaderStyle::Banner, ContactIn::Banner),
            ("onyx", HeaderStyle::Left, ContactIn::Header),
        ];
        for (template, header_style, contact_in) in expected {
            let layout = get_template_layout(template);
            assert_eq!(layout.header_style, header_style, "{template} header");
            assert_eq!(layout.contact_in, contact_in, "{template} contact");
        }
    }

    #[test]
    fn leafish_keeps_custom_in_the_sidebar_column() {
        let layout = get_template_layout("leafish");
        assert!(!layout.default_columns[0].iter().any(|id| id == "custom"));
        assert!(layout.default_columns[1].iter().any(|id| id == "custom"));
    }

    #[test]
    fn wire_values_are_kebab_case() {
        assert_eq!(LayoutMode::SidebarLeft.as_str(), "sidebar-left");
        assert_eq!(LayoutMode::HeaderSplit.as_str(), "header-split");
        assert_eq!(HeaderStyle::Boxed.as_str(), "boxed");
        assert_eq!(ContactIn::Banner.as_str(), "banner");
    }

    /// Unknown id included in the lockstep fixture so both suites assert the
    /// rhyhorn fallback, not only the known `TEMPLATES` entries.
    const UNKNOWN_TEMPLATE_ID: &str = "not-a-template";

    /// Wire shape for `tests/fixtures/template-layouts.json`.
    ///
    /// Field names match `LayoutInfo` in `crates/server/src/dto.rs`
    /// (`#[serde(rename_all = "camelCase")]`) and the web `TemplateLayout`
    /// interface — no mapping layer on either side of the lockstep test.
    #[derive(serde::Serialize)]
    #[serde(rename_all = "camelCase")]
    struct LayoutWire<'a> {
        layout_mode: &'a str,
        default_columns: &'a [Vec<String>; 2],
        header_style: &'a str,
        contact_in: &'a str,
        sidebar_width: Option<u32>,
    }

    fn layout_wire(layout: &TemplateLayout) -> LayoutWire<'_> {
        LayoutWire {
            layout_mode: layout.layout_mode.as_str(),
            default_columns: &layout.default_columns,
            header_style: layout.header_style.as_str(),
            contact_in: layout.contact_in.as_str(),
            sidebar_width: layout.sidebar_width,
        }
    }

    fn fixture_path() -> std::path::PathBuf {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("CARGO_MANIFEST_DIR should have a parent (crates/)")
            .parent()
            .expect("crates/ should have a parent (workspace root)")
            .join("tests")
            .join("fixtures")
            .join("template-layouts.json")
    }

    fn expected_fixture_json() -> String {
        let mut map = serde_json::Map::new();
        for id in TEMPLATES {
            let layout = get_template_layout(id);
            map.insert(
                (*id).to_string(),
                serde_json::to_value(layout_wire(&layout)).expect("layout serializes"),
            );
        }
        let unknown = get_template_layout(UNKNOWN_TEMPLATE_ID);
        map.insert(
            UNKNOWN_TEMPLATE_ID.to_string(),
            serde_json::to_value(layout_wire(&unknown)).expect("layout serializes"),
        );
        let mut json = serde_json::to_string_pretty(&serde_json::Value::Object(map))
            .expect("fixture serializes");
        json.push('\n');
        json
    }

    /// Keep `tests/fixtures/template-layouts.json` in lockstep with
    /// [`get_template_layout`]. The web suite reads the same fixture and
    /// asserts `bundledTemplateLayout` matches every entry.
    ///
    /// Regenerate with:
    /// `UPDATE_FIXTURES=1 cargo test -p rustume-render template_layouts_fixture_is_up_to_date --lib`
    #[test]
    fn template_layouts_fixture_is_up_to_date() {
        let actual = expected_fixture_json();
        let path = fixture_path();

        if std::env::var_os("UPDATE_FIXTURES").is_some() {
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent).expect("create fixtures directory");
            }
            std::fs::write(&path, &actual).expect("write template-layouts.json");
            return;
        }

        let expected = std::fs::read_to_string(&path).unwrap_or_else(|err| {
            panic!(
                "missing template layout fixture at {}: {err}\n\
                 regenerate with UPDATE_FIXTURES=1 cargo test -p rustume-render \
                 template_layouts_fixture_is_up_to_date --lib",
                path.display()
            )
        });

        assert_eq!(
            actual,
            expected,
            "template layout fixture is out of date at {}\n\
             get_template_layout changed; review the diff, then regenerate with:\n\
             UPDATE_FIXTURES=1 cargo test -p rustume-render \
             template_layouts_fixture_is_up_to_date --lib",
            path.display()
        );
    }
}
