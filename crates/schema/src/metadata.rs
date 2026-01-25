//! Resume metadata - template, layout, theme, typography.

use serde::{Deserialize, Serialize};
use validator::Validate;

/// Resume metadata.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    #[serde(default = "default_template")]
    pub template: String,

    /// Layout: pages -> columns -> section IDs.
    #[serde(default = "default_layout")]
    pub layout: Vec<Vec<Vec<String>>>,

    #[validate(nested)]
    #[serde(default)]
    pub css: CustomCss,

    #[validate(nested)]
    #[serde(default)]
    pub page: PageConfig,

    #[validate(nested)]
    #[serde(default)]
    pub theme: Theme,

    #[validate(nested)]
    #[serde(default)]
    pub typography: Typography,

    #[serde(default)]
    pub notes: String,
}

impl Default for Metadata {
    fn default() -> Self {
        Self {
            template: default_template(),
            layout: default_layout(),
            css: CustomCss::default(),
            page: PageConfig::default(),
            theme: Theme::default(),
            typography: Typography::default(),
            notes: String::new(),
        }
    }
}

/// Custom CSS configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Default)]
pub struct CustomCss {
    #[serde(default)]
    pub value: String,

    #[serde(default)]
    pub visible: bool,
}

/// Page format.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum PageFormat {
    #[default]
    A4,
    Letter,
}

/// Page configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct PageConfig {
    #[serde(default = "default_margin")]
    pub margin: u32,

    #[serde(default)]
    pub format: PageFormat,

    #[validate(nested)]
    #[serde(default)]
    pub options: PageOptions,
}

impl Default for PageConfig {
    fn default() -> Self {
        Self {
            margin: 18,
            format: PageFormat::A4,
            options: PageOptions::default(),
        }
    }
}

/// Page display options.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct PageOptions {
    #[serde(default = "default_true")]
    pub break_line: bool,

    #[serde(default = "default_true")]
    pub page_numbers: bool,
}

impl Default for PageOptions {
    fn default() -> Self {
        Self {
            break_line: true,
            page_numbers: true,
        }
    }
}

/// Color theme.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct Theme {
    #[validate(custom(function = "crate::validation::validate_hex_color"))]
    #[serde(default = "default_background")]
    pub background: String,

    #[validate(custom(function = "crate::validation::validate_hex_color"))]
    #[serde(default = "default_text")]
    pub text: String,

    #[validate(custom(function = "crate::validation::validate_hex_color"))]
    #[serde(default = "default_primary")]
    pub primary: String,
}

impl Default for Theme {
    fn default() -> Self {
        Self {
            background: "#ffffff".to_string(),
            text: "#000000".to_string(),
            primary: "#dc2626".to_string(),
        }
    }
}

/// Typography configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Typography {
    #[validate(nested)]
    #[serde(default)]
    pub font: FontConfig,

    #[serde(default = "default_line_height")]
    pub line_height: f32,

    #[serde(default)]
    pub hide_icons: bool,

    #[serde(default = "default_true")]
    pub underline_links: bool,
}

impl Default for Typography {
    fn default() -> Self {
        Self {
            font: FontConfig::default(),
            line_height: 1.5,
            hide_icons: false,
            underline_links: true,
        }
    }
}

/// Font configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct FontConfig {
    #[serde(default = "default_font_family")]
    pub family: String,

    #[serde(default = "default_subset")]
    pub subset: String,

    #[serde(default = "default_variants")]
    pub variants: Vec<String>,

    #[serde(default = "default_font_size")]
    pub size: u32,
}

impl Default for FontConfig {
    fn default() -> Self {
        Self {
            family: "IBM Plex Serif".to_string(),
            subset: "latin".to_string(),
            variants: vec!["regular".to_string()],
            size: 14,
        }
    }
}

fn default_template() -> String {
    "rhyhorn".to_string()
}

fn default_margin() -> u32 {
    18
}

fn default_background() -> String {
    "#ffffff".to_string()
}

fn default_text() -> String {
    "#000000".to_string()
}

fn default_primary() -> String {
    "#dc2626".to_string()
}

fn default_line_height() -> f32 {
    1.5
}

fn default_font_family() -> String {
    "IBM Plex Serif".to_string()
}

fn default_subset() -> String {
    "latin".to_string()
}

fn default_variants() -> Vec<String> {
    vec!["regular".to_string()]
}

fn default_font_size() -> u32 {
    14
}

fn default_true() -> bool {
    true
}

fn default_layout() -> Vec<Vec<Vec<String>>> {
    vec![vec![
        vec![
            "profiles".to_string(),
            "summary".to_string(),
            "experience".to_string(),
            "education".to_string(),
            "projects".to_string(),
            "volunteer".to_string(),
            "references".to_string(),
        ],
        vec![
            "skills".to_string(),
            "interests".to_string(),
            "certifications".to_string(),
            "awards".to_string(),
            "publications".to_string(),
            "languages".to_string(),
        ],
    ]]
}
