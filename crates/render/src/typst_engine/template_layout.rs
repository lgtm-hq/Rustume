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

/// How a template draws section headings (main or sidebar).
///
/// Data, not CSS — the sheet maps each variant to a shared modifier class.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HeadingStyle {
    /// Filled accent chip with contrasting title text (pikachu main).
    Band,
    /// Title above a full-width rule (most templates).
    Underline,
    /// Title with a trailing rule on the same row (nosepass).
    Rule,
    /// Title only — no rule or fill (pikachu sidebar).
    Plain,
}

impl HeadingStyle {
    /// Wire representation used by the HTTP API.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Band => "band",
            Self::Underline => "underline",
            Self::Rule => "rule",
            Self::Plain => "plain",
        }
    }
}

/// Letter-case transform applied to section titles in Typst.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HeadingCase {
    /// `upper(title)` — the common template treatment.
    Upper,
    /// Title as written, no forced case (nosepass, glalie).
    AsWritten,
}

impl HeadingCase {
    /// Wire representation used by the HTTP API.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Upper => "upper",
            Self::AsWritten => "as-written",
        }
    }
}

/// Ink colour for section heading text.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HeadingInk {
    /// Accent / primary-derived colour (most headings).
    Accent,
    /// Body text colour (gengar main column).
    Text,
}

impl HeadingInk {
    /// Wire representation used by the HTTP API.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Accent => "accent",
            Self::Text => "text",
        }
    }
}

/// Body typeface the template hardcodes in Typst (`#set text(font: ...)`).
///
/// Wire values are stable ids; the sheet maps them to a font stack. Not
/// free-form CSS family strings.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BodyFont {
    /// `IBM Plex Sans` — every template except nosepass.
    IbmPlexSans,
    /// `IBM Plex Serif` — nosepass.
    IbmPlexSerif,
}

impl BodyFont {
    /// Wire representation used by the HTTP API.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::IbmPlexSans => "ibm-plex-sans",
            Self::IbmPlexSerif => "ibm-plex-serif",
        }
    }
}

/// How keyword lists render on the sheet / PDF.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeywordStyle {
    /// Accent-tinted pill chips (onyx, azurill, ditto, …).
    Chips,
    /// Comma / middot-joined plain text (rhyhorn, pikachu, …).
    Plain,
}

impl KeywordStyle {
    /// Wire representation used by the HTTP API.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Chips => "chips",
            Self::Plain => "plain",
        }
    }
}

/// Presentation chrome for a template — enough for the document sheet to
/// mirror Typst section headings, typeface, and accent usage without
/// free-form CSS.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TemplateChrome {
    /// Main-column (and single-column) section heading treatment.
    pub heading_style: HeadingStyle,
    /// Sidebar section heading treatment; equals [`Self::heading_style`]
    /// when the template does not differentiate columns.
    pub sidebar_heading_style: HeadingStyle,
    /// Case transform for section titles.
    pub heading_case: HeadingCase,
    /// Ink for main-column section titles. Band headings ignore this (they
    /// always use contrasting fill text).
    pub heading_ink: HeadingInk,
    /// Ink for sidebar section titles.
    pub sidebar_heading_ink: HeadingInk,
    /// Body typeface id.
    pub font_body: BodyFont,
    /// Whether the sidebar column paints a tinted background.
    pub sidebar_tint: bool,
    /// Keyword list presentation.
    pub keyword_style: KeywordStyle,
    /// Whether an accent rule sits under the identity header block.
    pub header_rule: bool,
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
    /// Per-template presentation chrome (headings, fonts, accent usage).
    pub chrome: TemplateChrome,
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

/// Shared chrome: uppercase accent underline headings, Plex Sans, plain keywords.
const fn chrome_underline_plain(header_rule: bool) -> TemplateChrome {
    TemplateChrome {
        heading_style: HeadingStyle::Underline,
        sidebar_heading_style: HeadingStyle::Underline,
        heading_case: HeadingCase::Upper,
        heading_ink: HeadingInk::Accent,
        sidebar_heading_ink: HeadingInk::Accent,
        font_body: BodyFont::IbmPlexSans,
        sidebar_tint: false,
        keyword_style: KeywordStyle::Plain,
        header_rule,
    }
}

/// Shared chrome: uppercase accent underline headings, Plex Sans, chip keywords.
const fn chrome_underline_chips(header_rule: bool, sidebar_tint: bool) -> TemplateChrome {
    TemplateChrome {
        heading_style: HeadingStyle::Underline,
        sidebar_heading_style: HeadingStyle::Underline,
        heading_case: HeadingCase::Upper,
        heading_ink: HeadingInk::Accent,
        sidebar_heading_ink: HeadingInk::Accent,
        font_body: BodyFont::IbmPlexSans,
        sidebar_tint,
        keyword_style: KeywordStyle::Chips,
        header_rule,
    }
}

/// Layout for a single-column template: everything in the main slot.
fn single(header_style: HeaderStyle, chrome: TemplateChrome) -> TemplateLayout {
    TemplateLayout {
        layout_mode: LayoutMode::Single,
        default_columns: [all_sections(), Vec::new()],
        header_style,
        contact_in: ContactIn::Header,
        sidebar_width: None,
        chrome,
    }
}

/// Layout for a two-column template using the shared column fallbacks.
fn two_column(
    layout_mode: LayoutMode,
    header_style: HeaderStyle,
    contact_in: ContactIn,
    sidebar_width: Option<u32>,
    chrome: TemplateChrome,
) -> TemplateLayout {
    TemplateLayout {
        layout_mode,
        default_columns: [main_with_custom(), sidebar_default()],
        header_style,
        contact_in,
        sidebar_width,
        chrome,
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
        "rhyhorn" => single(HeaderStyle::Left, chrome_underline_plain(true)),
        "onyx" => single(HeaderStyle::Left, chrome_underline_chips(true, false)),
        "nosepass" => single(
            HeaderStyle::Left,
            TemplateChrome {
                heading_style: HeadingStyle::Rule,
                sidebar_heading_style: HeadingStyle::Rule,
                heading_case: HeadingCase::AsWritten,
                heading_ink: HeadingInk::Accent,
                sidebar_heading_ink: HeadingInk::Accent,
                font_body: BodyFont::IbmPlexSerif,
                sidebar_tint: false,
                keyword_style: KeywordStyle::Plain,
                header_rule: true,
            },
        ),
        "bronzor" => single(HeaderStyle::Center, chrome_underline_plain(true)),
        "kakuna" => single(HeaderStyle::Boxed, chrome_underline_chips(false, false)),
        "azurill" => two_column(
            LayoutMode::SidebarLeft,
            HeaderStyle::Center,
            ContactIn::Header,
            None,
            chrome_underline_chips(true, false),
        ),
        "chikorita" => two_column(
            LayoutMode::SidebarRight,
            HeaderStyle::Left,
            ContactIn::Header,
            None,
            // Tinted: chikorita.typ wraps the right column in a light-bg box.
            chrome_underline_chips(true, true),
        ),
        "ditto" => two_column(
            LayoutMode::SidebarLeft,
            HeaderStyle::Banner,
            ContactIn::Banner,
            Some(160),
            chrome_underline_chips(false, true),
        ),
        "gengar" => two_column(
            LayoutMode::SidebarLeft,
            HeaderStyle::Sidebar,
            ContactIn::Sidebar,
            Some(170),
            TemplateChrome {
                heading_style: HeadingStyle::Underline,
                sidebar_heading_style: HeadingStyle::Underline,
                heading_case: HeadingCase::Upper,
                heading_ink: HeadingInk::Text,
                sidebar_heading_ink: HeadingInk::Accent,
                font_body: BodyFont::IbmPlexSans,
                sidebar_tint: true,
                keyword_style: KeywordStyle::Chips,
                header_rule: false,
            },
        ),
        "glalie" => two_column(
            LayoutMode::SidebarLeft,
            HeaderStyle::Sidebar,
            ContactIn::Sidebar,
            Some(170),
            TemplateChrome {
                heading_style: HeadingStyle::Underline,
                sidebar_heading_style: HeadingStyle::Underline,
                heading_case: HeadingCase::AsWritten,
                heading_ink: HeadingInk::Accent,
                sidebar_heading_ink: HeadingInk::Accent,
                font_body: BodyFont::IbmPlexSans,
                sidebar_tint: true,
                keyword_style: KeywordStyle::Plain,
                header_rule: false,
            },
        ),
        "pikachu" => two_column(
            LayoutMode::SidebarLeft,
            HeaderStyle::Left,
            ContactIn::Sidebar,
            Some(180),
            TemplateChrome {
                heading_style: HeadingStyle::Band,
                sidebar_heading_style: HeadingStyle::Plain,
                heading_case: HeadingCase::Upper,
                heading_ink: HeadingInk::Accent,
                sidebar_heading_ink: HeadingInk::Accent,
                font_body: BodyFont::IbmPlexSans,
                sidebar_tint: true,
                keyword_style: KeywordStyle::Plain,
                header_rule: false,
            },
        ),
        "leafish" => TemplateLayout {
            layout_mode: LayoutMode::HeaderSplit,
            default_columns: [
                unique_sections(&[MAIN_SECTIONS]),
                unique_sections(&[SIDEBAR_SECTIONS, &["custom"]]),
            ],
            header_style: HeaderStyle::Banner,
            contact_in: ContactIn::Banner,
            sidebar_width: None,
            chrome: chrome_underline_chips(false, false),
        },
        _ => single(HeaderStyle::Left, chrome_underline_plain(true)),
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
        assert_eq!(HeadingStyle::Band.as_str(), "band");
        assert_eq!(HeadingStyle::Rule.as_str(), "rule");
        assert_eq!(HeadingCase::AsWritten.as_str(), "as-written");
        assert_eq!(HeadingInk::Text.as_str(), "text");
        assert_eq!(BodyFont::IbmPlexSerif.as_str(), "ibm-plex-serif");
        assert_eq!(KeywordStyle::Chips.as_str(), "chips");
    }

    #[test]
    fn chrome_matches_the_template_sources() {
        assert_eq!(
            get_template_layout("onyx").chrome.heading_style,
            HeadingStyle::Underline
        );
        assert_eq!(
            get_template_layout("onyx").chrome.keyword_style,
            KeywordStyle::Chips
        );
        assert_eq!(
            get_template_layout("pikachu").chrome.heading_style,
            HeadingStyle::Band
        );
        assert_eq!(
            get_template_layout("pikachu").chrome.sidebar_heading_style,
            HeadingStyle::Plain
        );
        assert_eq!(
            get_template_layout("nosepass").chrome.font_body,
            BodyFont::IbmPlexSerif
        );
        assert_eq!(
            get_template_layout("nosepass").chrome.heading_style,
            HeadingStyle::Rule
        );
        assert_eq!(
            get_template_layout("gengar").chrome.heading_ink,
            HeadingInk::Text
        );
        assert!(get_template_layout("pikachu").chrome.sidebar_tint);
        assert!(!get_template_layout("azurill").chrome.sidebar_tint);
        // chikorita.typ fills the right column with light-bg.
        assert!(get_template_layout("chikorita").chrome.sidebar_tint);
    }

    const UNKNOWN_TEMPLATE_ID: &str = "not-a-template";

    /// Wire shape of the lockstep fixture. Paired with `LayoutInfo` in
    /// `crates/server/src/dto.rs` — if `LayoutInfo` gains a field this struct
    /// lacks, the fixture strips it and the #824/#837 lockstep cannot catch
    /// the drift. Keep `LAYOUT_WIRE_FIELD_COUNT` and the dto test in lockstep.
    #[derive(serde::Serialize)]
    #[serde(rename_all = "camelCase")]
    struct LayoutWire<'a> {
        layout_mode: &'a str,
        default_columns: &'a [Vec<String>; 2],
        header_style: &'a str,
        contact_in: &'a str,
        sidebar_width: Option<u32>,
        heading_style: &'a str,
        sidebar_heading_style: &'a str,
        heading_case: &'a str,
        heading_ink: &'a str,
        sidebar_heading_ink: &'a str,
        font_body: &'a str,
        sidebar_tint: bool,
        keyword_style: &'a str,
        header_rule: bool,
    }

    /// Owned twin of [`LayoutWire`] used to `deny_unknown_fields` round-trip
    /// the fixture. Field list must stay identical to `LayoutWire` / `LayoutInfo`.
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    #[allow(dead_code)]
    struct LayoutWireOwned {
        layout_mode: String,
        default_columns: [Vec<String>; 2],
        header_style: String,
        contact_in: String,
        sidebar_width: Option<u32>,
        heading_style: String,
        sidebar_heading_style: String,
        heading_case: String,
        heading_ink: String,
        sidebar_heading_ink: String,
        font_body: String,
        sidebar_tint: bool,
        keyword_style: String,
        header_rule: bool,
    }

    /// Must match the number of serde fields on `LayoutInfo` (`dto.rs`) and
    /// `LayoutWire` above. Bump this in the same change that adds a field.
    const LAYOUT_WIRE_FIELD_COUNT: usize = 14;

    const UPDATE_LAYOUTS_FIXTURE_HINT: &str = concat!(
        "UPDATE_FIXTURES=1 cargo test -p rustume-render ",
        "template_layouts_fixture_is_up_to_date --lib"
    );

    fn layout_wire(layout: &TemplateLayout) -> LayoutWire<'_> {
        LayoutWire {
            layout_mode: layout.layout_mode.as_str(),
            default_columns: &layout.default_columns,
            header_style: layout.header_style.as_str(),
            contact_in: layout.contact_in.as_str(),
            sidebar_width: layout.sidebar_width,
            heading_style: layout.chrome.heading_style.as_str(),
            sidebar_heading_style: layout.chrome.sidebar_heading_style.as_str(),
            heading_case: layout.chrome.heading_case.as_str(),
            heading_ink: layout.chrome.heading_ink.as_str(),
            sidebar_heading_ink: layout.chrome.sidebar_heading_ink.as_str(),
            font_body: layout.chrome.font_body.as_str(),
            sidebar_tint: layout.chrome.sidebar_tint,
            keyword_style: layout.chrome.keyword_style.as_str(),
            header_rule: layout.chrome.header_rule,
        }
    }

    fn workspace_root() -> std::path::PathBuf {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("crates parent")
            .parent()
            .expect("workspace root")
            .to_path_buf()
    }

    fn fixture_path() -> std::path::PathBuf {
        workspace_root().join("tests/fixtures/template-layouts.json")
    }

    fn expected_fixture_json() -> String {
        let mut map = serde_json::Map::new();
        for id in TEMPLATES {
            map.insert(
                (*id).to_string(),
                serde_json::to_value(layout_wire(&get_template_layout(id)))
                    .expect("LayoutWire serializes"),
            );
        }
        map.insert(
            UNKNOWN_TEMPLATE_ID.to_string(),
            serde_json::to_value(layout_wire(&get_template_layout(UNKNOWN_TEMPLATE_ID)))
                .expect("fallback LayoutWire serializes"),
        );
        let mut json = serde_json::to_string_pretty(&serde_json::Value::Object(map))
            .expect("fixture JSON pretty-prints");
        json.push('\n');
        json
    }

    #[test]
    fn layout_wire_field_count_pairs_layout_info() {
        // LayoutWire (this module) ↔ LayoutInfo (`crates/server/src/dto.rs`).
        let value = serde_json::to_value(layout_wire(&get_template_layout("rhyhorn")))
            .expect("LayoutWire serializes");
        let keys = value
            .as_object()
            .expect("LayoutWire serializes as an object")
            .len();
        assert_eq!(
            keys, LAYOUT_WIRE_FIELD_COUNT,
            "LayoutWire field count changed; add the same field to LayoutInfo in \
             crates/server/src/dto.rs and bump LAYOUT_WIRE_FIELD_COUNT"
        );
    }

    #[test]
    fn template_layouts_fixture_rejects_unknown_fields() {
        let expected = expected_fixture_json();
        let parsed: serde_json::Value =
            serde_json::from_str(&expected).expect("fixture JSON parses");
        let rhyhorn = parsed
            .get("rhyhorn")
            .expect("fixture includes rhyhorn")
            .clone();
        let _: LayoutWireOwned = serde_json::from_value(rhyhorn)
            .expect("fixture entry deserializes as deny_unknown_fields LayoutWireOwned");
    }

    #[test]
    fn template_layouts_fixture_is_up_to_date() {
        let actual = expected_fixture_json();
        let path = fixture_path();
        if std::env::var_os("UPDATE_FIXTURES").is_some() {
            std::fs::create_dir_all(path.parent().expect("fixture has a parent"))
                .expect("create tests/fixtures");
            std::fs::write(&path, &actual)
                .unwrap_or_else(|err| panic!("write {}: {err}", path.display()));
            return;
        }
        let expected = std::fs::read_to_string(&path).unwrap_or_else(|err| {
            panic!(
                "missing fixture {}: {err}; regenerate with {UPDATE_LAYOUTS_FIXTURE_HINT}",
                path.display()
            )
        });
        assert_eq!(
            actual,
            expected,
            "fixture out of date at {}\nregenerate with: {UPDATE_LAYOUTS_FIXTURE_HINT}",
            path.display()
        );
    }
}
