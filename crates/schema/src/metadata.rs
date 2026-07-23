//! Resume metadata - template, layout, theme, typography.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

/// Controls how skill and language proficiency levels are rendered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum LevelDisplay {
    #[default]
    TemplateDefault,
    Hidden,
    Circle,
    Square,
    ProgressBar,
    Text,
}

/// Resume metadata.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
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

    #[serde(default)]
    pub level_display: LevelDisplay,

    /// When true, the resume is read-only until unlocked.
    #[serde(default)]
    pub locked: bool,

    /// User-defined organization labels (never rendered on the PDF).
    #[serde(default)]
    pub tags: Vec<String>,
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
            level_display: LevelDisplay::TemplateDefault,
            locked: false,
            tags: Vec::new(),
        }
    }
}

/// Custom CSS configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Default, ToSchema)]
pub struct CustomCss {
    #[serde(default)]
    pub value: String,

    #[serde(default)]
    pub visible: bool,
}

/// Page format.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum PageFormat {
    #[default]
    A4,
    Letter,
}

/// Page configuration.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PageConfig {
    #[serde(default = "default_margin")]
    pub margin: u32,

    #[serde(default)]
    pub format: PageFormat,

    // Omit when unset so clients see the field absent (template default)
    // rather than an explicit null they must special-case.
    #[validate(range(min = 0.1, max = 0.5))]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sidebar_ratio: Option<f32>,

    #[validate(nested)]
    #[serde(default)]
    pub options: PageOptions,
}

impl Default for PageConfig {
    fn default() -> Self {
        Self {
            margin: default_margin(),
            format: PageFormat::A4,
            sidebar_ratio: None,
            options: PageOptions::default(),
        }
    }
}

/// Page display options.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
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
#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
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
            // Rendered as a dedicated page before the resume body; listed
            // first because its column position does not affect placement.
            "coverLetter".to_string(),
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use validator::Validate;

    #[test]
    fn page_config_accepts_sidebar_ratio_bounds_and_none() {
        let none = PageConfig::default();
        assert!(none.validate().is_ok());

        let valid = PageConfig {
            sidebar_ratio: Some(0.25),
            ..Default::default()
        };
        assert!(valid.validate().is_ok());
    }

    #[test]
    fn page_config_omits_unset_sidebar_ratio_when_serialized() {
        let json = serde_json::to_value(PageConfig::default()).unwrap();
        assert!(json.get("sidebarRatio").is_none());

        let set = PageConfig {
            sidebar_ratio: Some(0.25),
            ..Default::default()
        };
        let json = serde_json::to_value(set).unwrap();
        assert_eq!(json["sidebarRatio"], 0.25);
    }

    #[test]
    fn page_config_rejects_sidebar_ratio_outside_bounds() {
        let too_small = PageConfig {
            sidebar_ratio: Some(0.05),
            ..Default::default()
        };
        assert!(too_small.validate().is_err());

        let too_large = PageConfig {
            sidebar_ratio: Some(0.6),
            ..Default::default()
        };
        assert!(too_large.validate().is_err());
    }

    #[test]
    fn level_display_uses_kebab_case_round_trip() {
        let cases = [
            (LevelDisplay::TemplateDefault, "template-default"),
            (LevelDisplay::Hidden, "hidden"),
            (LevelDisplay::Circle, "circle"),
            (LevelDisplay::Square, "square"),
            (LevelDisplay::ProgressBar, "progress-bar"),
            (LevelDisplay::Text, "text"),
        ];

        for (value, serialized) in cases {
            let json = serde_json::to_value(value).unwrap();
            assert_eq!(json, json!(serialized));

            let parsed: LevelDisplay = serde_json::from_value(json).unwrap();
            assert_eq!(parsed, value);
        }
    }

    #[test]
    fn metadata_defaults_missing_level_display_to_template_default() {
        let metadata: Metadata = serde_json::from_value(json!({})).unwrap();
        assert_eq!(metadata.level_display, LevelDisplay::TemplateDefault);
    }
}
