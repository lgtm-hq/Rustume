//! Resume sections.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use validator::Validate;

use crate::shared::Url;

/// All resume sections.
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Default)]
pub struct Sections {
    #[validate(nested)]
    #[serde(default)]
    pub summary: SummarySection,

    #[validate(nested)]
    #[serde(default)]
    pub experience: Section<Experience>,

    #[validate(nested)]
    #[serde(default)]
    pub education: Section<Education>,

    #[validate(nested)]
    #[serde(default)]
    pub skills: Section<Skill>,

    #[validate(nested)]
    #[serde(default)]
    pub projects: Section<Project>,

    #[validate(nested)]
    #[serde(default)]
    pub profiles: Section<Profile>,

    #[validate(nested)]
    #[serde(default)]
    pub awards: Section<Award>,

    #[validate(nested)]
    #[serde(default)]
    pub certifications: Section<Certification>,

    #[validate(nested)]
    #[serde(default)]
    pub publications: Section<Publication>,

    #[validate(nested)]
    #[serde(default)]
    pub languages: Section<Language>,

    #[validate(nested)]
    #[serde(default)]
    pub interests: Section<Interest>,

    #[validate(nested)]
    #[serde(default)]
    pub volunteer: Section<Volunteer>,

    #[validate(nested)]
    #[serde(default)]
    pub references: Section<Reference>,

    /// Custom sections (dynamic keys).
    #[validate(nested)]
    #[serde(default)]
    pub custom: HashMap<String, Section<CustomItem>>,
}

/// Generic section wrapper.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
#[serde(bound(deserialize = "T: serde::de::DeserializeOwned"))]
pub struct Section<T: Validate> {
    /// Section identifier.
    pub id: String,

    /// Display name.
    #[serde(default)]
    pub name: String,

    /// Number of columns (1-5).
    #[validate(range(min = 1, max = 5))]
    #[serde(default = "default_columns")]
    pub columns: u8,

    /// Show links separately.
    #[serde(default = "default_true")]
    pub separate_links: bool,

    /// Section visibility.
    #[serde(default = "default_true")]
    pub visible: bool,

    /// Section items.
    #[validate(nested)]
    #[serde(default)]
    pub items: Vec<T>,
}

impl<T: Validate> Section<T> {
    /// Create a new section with the given ID and name.
    pub fn new(id: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            columns: 1,
            separate_links: true,
            visible: true,
            items: Vec::new(),
        }
    }

    /// Add an item to the section.
    pub fn add_item(&mut self, item: T) {
        self.items.push(item);
    }

    /// Set section visibility.
    pub fn set_visible(&mut self, visible: bool) {
        self.visible = visible;
    }

    /// Set number of columns.
    pub fn set_columns(&mut self, columns: u8) {
        self.columns = columns.clamp(1, 5);
    }

    /// Check if section has any items.
    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    /// Get number of items.
    pub fn len(&self) -> usize {
        self.items.len()
    }
}

impl<T: Default + Validate> Default for Section<T> {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            columns: 1,
            separate_links: true,
            visible: true,
            items: Vec::new(),
        }
    }
}

/// Summary section (special - no items, just content).
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct SummarySection {
    pub id: String,

    #[serde(default)]
    pub name: String,

    #[validate(range(min = 1, max = 5))]
    #[serde(default = "default_columns")]
    pub columns: u8,

    #[serde(default = "default_true")]
    pub separate_links: bool,

    #[serde(default = "default_true")]
    pub visible: bool,

    /// Summary content (HTML/Markdown).
    #[serde(default)]
    pub content: String,
}

impl Default for SummarySection {
    fn default() -> Self {
        Self {
            id: "summary".to_string(),
            name: "Summary".to_string(),
            columns: 1,
            separate_links: true,
            visible: true,
            content: String::new(),
        }
    }
}

impl SummarySection {
    /// Create a new summary section with content.
    pub fn new(content: impl Into<String>) -> Self {
        Self {
            content: content.into(),
            ..Default::default()
        }
    }

    /// Check if summary has content.
    pub fn is_empty(&self) -> bool {
        self.content.trim().is_empty() || self.content.trim() == "<p></p>"
    }
}

// ============================================================================
// Section Item Types
// ============================================================================

/// Work experience item.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Experience {
    pub id: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    pub company: String,
    #[serde(default)]
    pub position: String,
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub summary: String,
    #[validate(nested)]
    #[serde(default)]
    pub url: Url,
}

impl Default for Experience {
    fn default() -> Self {
        Self {
            id: String::new(),
            visible: true,
            company: String::new(),
            position: String::new(),
            location: String::new(),
            date: String::new(),
            summary: String::new(),
            url: Url::default(),
        }
    }
}

impl Experience {
    /// Create a new experience item.
    pub fn new(company: impl Into<String>, position: impl Into<String>) -> Self {
        Self {
            id: cuid2::create_id(),
            visible: true,
            company: company.into(),
            position: position.into(),
            ..Default::default()
        }
    }

    /// Builder method to set location.
    pub fn with_location(mut self, location: impl Into<String>) -> Self {
        self.location = location.into();
        self
    }

    /// Builder method to set date range.
    pub fn with_date(mut self, date: impl Into<String>) -> Self {
        self.date = date.into();
        self
    }

    /// Builder method to set summary.
    pub fn with_summary(mut self, summary: impl Into<String>) -> Self {
        self.summary = summary.into();
        self
    }

    /// Builder method to set URL.
    pub fn with_url(mut self, url: impl Into<String>) -> Self {
        self.url = Url::new(url);
        self
    }
}

/// Education item.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Education {
    pub id: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    pub institution: String,
    #[serde(default)]
    pub area: String,
    #[serde(default)]
    pub study_type: String,
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub score: String,
    #[serde(default)]
    pub summary: String,
    #[validate(nested)]
    #[serde(default)]
    pub url: Url,
}

impl Default for Education {
    fn default() -> Self {
        Self {
            id: String::new(),
            visible: true,
            institution: String::new(),
            area: String::new(),
            study_type: String::new(),
            date: String::new(),
            score: String::new(),
            summary: String::new(),
            url: Url::default(),
        }
    }
}

impl Education {
    /// Create a new education item.
    pub fn new(institution: impl Into<String>, area: impl Into<String>) -> Self {
        Self {
            id: cuid2::create_id(),
            visible: true,
            institution: institution.into(),
            area: area.into(),
            ..Default::default()
        }
    }

    /// Builder method to set study type (degree).
    pub fn with_study_type(mut self, study_type: impl Into<String>) -> Self {
        self.study_type = study_type.into();
        self
    }

    /// Builder method to set date.
    pub fn with_date(mut self, date: impl Into<String>) -> Self {
        self.date = date.into();
        self
    }

    /// Builder method to set score/GPA.
    pub fn with_score(mut self, score: impl Into<String>) -> Self {
        self.score = score.into();
        self
    }

    /// Builder method to set summary.
    pub fn with_summary(mut self, summary: impl Into<String>) -> Self {
        self.summary = summary.into();
        self
    }
}

/// Skill item.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub id: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[validate(range(min = 0, max = 5))]
    #[serde(default = "default_level")]
    pub level: u8,
    #[serde(default)]
    pub keywords: Vec<String>,
}

impl Default for Skill {
    fn default() -> Self {
        Self {
            id: String::new(),
            visible: true,
            name: String::new(),
            description: String::new(),
            level: 1,
            keywords: Vec::new(),
        }
    }
}

impl Skill {
    /// Create a new skill item.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: cuid2::create_id(),
            visible: true,
            name: name.into(),
            ..Default::default()
        }
    }

    /// Builder method to set level.
    pub fn with_level(mut self, level: u8) -> Self {
        self.level = level.min(5);
        self
    }

    /// Builder method to set keywords.
    pub fn with_keywords(mut self, keywords: Vec<String>) -> Self {
        self.keywords = keywords;
        self
    }

    /// Builder method to set description.
    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = description.into();
        self
    }
}

/// Project item.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[validate(nested)]
    #[serde(default)]
    pub url: Url,
}

impl Default for Project {
    fn default() -> Self {
        Self {
            id: String::new(),
            visible: true,
            name: String::new(),
            description: String::new(),
            date: String::new(),
            summary: String::new(),
            keywords: Vec::new(),
            url: Url::default(),
        }
    }
}

impl Project {
    /// Create a new project item.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: cuid2::create_id(),
            visible: true,
            name: name.into(),
            ..Default::default()
        }
    }

    /// Builder method to set description.
    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = description.into();
        self
    }

    /// Builder method to set date.
    pub fn with_date(mut self, date: impl Into<String>) -> Self {
        self.date = date.into();
        self
    }

    /// Builder method to set summary.
    pub fn with_summary(mut self, summary: impl Into<String>) -> Self {
        self.summary = summary.into();
        self
    }

    /// Builder method to set URL.
    pub fn with_url(mut self, url: impl Into<String>) -> Self {
        self.url = Url::new(url);
        self
    }

    /// Builder method to set keywords.
    pub fn with_keywords(mut self, keywords: Vec<String>) -> Self {
        self.keywords = keywords;
        self
    }
}

/// Social/professional profile.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    pub network: String,
    pub username: String,
    #[serde(default)]
    pub icon: String,
    #[validate(nested)]
    #[serde(default)]
    pub url: Url,
}

impl Default for Profile {
    fn default() -> Self {
        Self {
            id: String::new(),
            visible: true,
            network: String::new(),
            username: String::new(),
            icon: String::new(),
            url: Url::default(),
        }
    }
}

impl Profile {
    /// Create a new profile item.
    pub fn new(network: impl Into<String>, username: impl Into<String>) -> Self {
        let network_str: String = network.into();
        let icon = network_str.to_lowercase();
        Self {
            id: cuid2::create_id(),
            visible: true,
            network: network_str,
            username: username.into(),
            icon,
            url: Url::default(),
        }
    }

    /// Builder method to set URL.
    pub fn with_url(mut self, url: impl Into<String>) -> Self {
        self.url = Url::new(url);
        self
    }

    /// Builder method to set icon.
    pub fn with_icon(mut self, icon: impl Into<String>) -> Self {
        self.icon = icon.into();
        self
    }
}

/// Award item.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Award {
    pub id: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    pub title: String,
    #[serde(default)]
    pub awarder: String,
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub summary: String,
    #[validate(nested)]
    #[serde(default)]
    pub url: Url,
}

impl Default for Award {
    fn default() -> Self {
        Self {
            id: String::new(),
            visible: true,
            title: String::new(),
            awarder: String::new(),
            date: String::new(),
            summary: String::new(),
            url: Url::default(),
        }
    }
}

impl Award {
    /// Create a new award item.
    pub fn new(title: impl Into<String>) -> Self {
        Self {
            id: cuid2::create_id(),
            visible: true,
            title: title.into(),
            ..Default::default()
        }
    }

    /// Builder method to set awarder.
    pub fn with_awarder(mut self, awarder: impl Into<String>) -> Self {
        self.awarder = awarder.into();
        self
    }

    /// Builder method to set date.
    pub fn with_date(mut self, date: impl Into<String>) -> Self {
        self.date = date.into();
        self
    }

    /// Builder method to set summary.
    pub fn with_summary(mut self, summary: impl Into<String>) -> Self {
        self.summary = summary.into();
        self
    }

    /// Builder method to set URL.
    pub fn with_url(mut self, url: impl Into<String>) -> Self {
        self.url = Url::new(url);
        self
    }
}

/// Certification item.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Certification {
    pub id: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    pub name: String,
    #[serde(default)]
    pub issuer: String,
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub summary: String,
    #[validate(nested)]
    #[serde(default)]
    pub url: Url,
}

impl Default for Certification {
    fn default() -> Self {
        Self {
            id: String::new(),
            visible: true,
            name: String::new(),
            issuer: String::new(),
            date: String::new(),
            summary: String::new(),
            url: Url::default(),
        }
    }
}

impl Certification {
    /// Create a new certification item.
    pub fn new(name: impl Into<String>, issuer: impl Into<String>) -> Self {
        Self {
            id: cuid2::create_id(),
            visible: true,
            name: name.into(),
            issuer: issuer.into(),
            ..Default::default()
        }
    }

    /// Builder method to set date.
    pub fn with_date(mut self, date: impl Into<String>) -> Self {
        self.date = date.into();
        self
    }

    /// Builder method to set URL.
    pub fn with_url(mut self, url: impl Into<String>) -> Self {
        self.url = Url::new(url);
        self
    }

    /// Builder method to set summary.
    pub fn with_summary(mut self, summary: impl Into<String>) -> Self {
        self.summary = summary.into();
        self
    }
}

/// Publication item.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Publication {
    pub id: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    pub name: String,
    #[serde(default)]
    pub publisher: String,
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub summary: String,
    #[validate(nested)]
    #[serde(default)]
    pub url: Url,
}

impl Default for Publication {
    fn default() -> Self {
        Self {
            id: String::new(),
            visible: true,
            name: String::new(),
            publisher: String::new(),
            date: String::new(),
            summary: String::new(),
            url: Url::default(),
        }
    }
}

impl Publication {
    /// Create a new publication item.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: cuid2::create_id(),
            visible: true,
            name: name.into(),
            ..Default::default()
        }
    }
}

/// Language item.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Language {
    pub id: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[validate(range(min = 0, max = 5))]
    #[serde(default = "default_level")]
    pub level: u8,
}

impl Default for Language {
    fn default() -> Self {
        Self {
            id: String::new(),
            visible: true,
            name: String::new(),
            description: String::new(),
            level: 1,
        }
    }
}

impl Language {
    /// Create a new language item.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: cuid2::create_id(),
            visible: true,
            name: name.into(),
            ..Default::default()
        }
    }

    /// Builder method to set level.
    pub fn with_level(mut self, level: u8) -> Self {
        self.level = level.min(5);
        self
    }

    /// Builder method to set description (e.g., "Native", "Fluent").
    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = description.into();
        self
    }
}

/// Interest item.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Interest {
    pub id: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    pub name: String,
    #[serde(default)]
    pub keywords: Vec<String>,
}

impl Default for Interest {
    fn default() -> Self {
        Self {
            id: String::new(),
            visible: true,
            name: String::new(),
            keywords: Vec::new(),
        }
    }
}

impl Interest {
    /// Create a new interest item.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: cuid2::create_id(),
            visible: true,
            name: name.into(),
            keywords: Vec::new(),
        }
    }

    /// Builder method to set keywords.
    pub fn with_keywords(mut self, keywords: Vec<String>) -> Self {
        self.keywords = keywords;
        self
    }
}

/// Volunteer experience item.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Volunteer {
    pub id: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    pub organization: String,
    #[serde(default)]
    pub position: String,
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub summary: String,
    #[validate(nested)]
    #[serde(default)]
    pub url: Url,
}

impl Default for Volunteer {
    fn default() -> Self {
        Self {
            id: String::new(),
            visible: true,
            organization: String::new(),
            position: String::new(),
            location: String::new(),
            date: String::new(),
            summary: String::new(),
            url: Url::default(),
        }
    }
}

impl Volunteer {
    /// Create a new volunteer item.
    pub fn new(organization: impl Into<String>, position: impl Into<String>) -> Self {
        Self {
            id: cuid2::create_id(),
            visible: true,
            organization: organization.into(),
            position: position.into(),
            ..Default::default()
        }
    }
}

/// Reference item.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct Reference {
    pub id: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub summary: String,
    #[validate(nested)]
    #[serde(default)]
    pub url: Url,
}

impl Default for Reference {
    fn default() -> Self {
        Self {
            id: String::new(),
            visible: true,
            name: String::new(),
            description: String::new(),
            summary: String::new(),
            url: Url::default(),
        }
    }
}

impl Reference {
    /// Create a new reference item.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: cuid2::create_id(),
            visible: true,
            name: name.into(),
            ..Default::default()
        }
    }
}

/// Custom section item.
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct CustomItem {
    pub id: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[validate(nested)]
    #[serde(default)]
    pub url: Url,
}

impl Default for CustomItem {
    fn default() -> Self {
        Self {
            id: String::new(),
            visible: true,
            name: String::new(),
            description: String::new(),
            date: String::new(),
            location: String::new(),
            summary: String::new(),
            keywords: Vec::new(),
            url: Url::default(),
        }
    }
}

impl CustomItem {
    /// Create a new custom item.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: cuid2::create_id(),
            visible: true,
            name: name.into(),
            ..Default::default()
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

fn default_columns() -> u8 {
    1
}

fn default_true() -> bool {
    true
}

fn default_level() -> u8 {
    1
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustume_schema_macros::SectionItem;
    use validator::Validate;

    // Test struct using the SectionItem derive macro
    #[derive(Debug, Clone, Serialize, Deserialize, Validate, SectionItem)]
    #[serde(rename_all = "camelCase")]
    #[section_item(new(title))]
    struct TestItem {
        pub id: String,
        #[serde(default = "default_true")]
        pub visible: bool,
        pub title: String,
        #[serde(default)]
        pub description: String,
        #[validate(nested)]
        #[serde(default)]
        pub url: Url,
    }

    #[test]
    fn test_section_item_macro_new() {
        let item = TestItem::new("Test Title");
        assert!(!item.id.is_empty());
        assert!(item.visible);
        assert_eq!(item.title, "Test Title");
        assert!(item.description.is_empty());
    }

    #[test]
    fn test_section_item_macro_builder() {
        let item = TestItem::new("Test Title")
            .with_description("A description")
            .with_url("https://example.com");

        assert_eq!(item.title, "Test Title");
        assert_eq!(item.description, "A description");
        assert_eq!(item.url.href, "https://example.com");
    }

    #[test]
    fn test_section_item_macro_default() {
        let item = TestItem::default();
        assert!(item.id.is_empty());
        assert!(item.visible);
        assert!(item.title.is_empty());
    }

    #[test]
    fn test_section_add_item() {
        let mut section = Section::new("experience", "Experience");
        assert!(section.is_empty());

        section.add_item(Experience::new("Acme Corp", "Developer"));
        assert_eq!(section.len(), 1);
        assert!(!section.is_empty());
    }

    #[test]
    fn test_experience_builder() {
        let exp = Experience::new("Acme Corp", "Senior Developer")
            .with_location("San Francisco")
            .with_date("2020 - Present")
            .with_summary("Built amazing things")
            .with_url("https://acme.com");

        assert_eq!(exp.company, "Acme Corp");
        assert_eq!(exp.position, "Senior Developer");
        assert_eq!(exp.location, "San Francisco");
        assert!(!exp.id.is_empty());
        assert!(exp.validate().is_ok());
    }

    #[test]
    fn test_skill_level_validation() {
        let valid = Skill::new("Rust").with_level(5);
        assert!(valid.validate().is_ok());

        // Level is clamped to max 5
        let clamped = Skill::new("Rust").with_level(10);
        assert_eq!(clamped.level, 5);
    }

    #[test]
    fn test_profile_auto_icon() {
        let profile = Profile::new("GitHub", "johndoe");
        assert_eq!(profile.icon, "github");

        let linkedin = Profile::new("LinkedIn", "johndoe");
        assert_eq!(linkedin.icon, "linkedin");
    }

    #[test]
    fn test_summary_is_empty() {
        let empty = SummarySection::default();
        assert!(empty.is_empty());

        let with_content = SummarySection::new("A great summary");
        assert!(!with_content.is_empty());

        let tiptap_empty = SummarySection::new("<p></p>");
        assert!(tiptap_empty.is_empty());
    }
}
