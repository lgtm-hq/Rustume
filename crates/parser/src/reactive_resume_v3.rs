//! Reactive Resume V3 format migration parser.
//!
//! Migrates resumes from Reactive Resume V3 format to the current Rustume format.
//! V3 was the previous major version of Reactive Resume and has some structural
//! differences from the current format.
//!
//! Key differences handled:
//! - Summary can be a string OR an object with `body` field
//! - Different metadata/theme structure
//! - Skill levels are 0-5 (same as current)
//! - Profile pictures use different field names

use crate::traits::{ParseError, Parser};
use rustume_schema::{
    Award, Basics, Certification, CustomCss, CustomField, CustomItem, Education, Experience,
    FontConfig, Interest, Language, Metadata, PageConfig, PageFormat, PageOptions, Profile,
    Project, Publication, Reference, ResumeData, Section, Skill, SummarySection, Theme, Typography,
    Url, Volunteer,
};
use serde::Deserialize;
use std::collections::HashMap;

/// Reactive Resume V3 migration parser.
///
/// Converts V3 format resumes to the current Rustume format.
pub struct ReactiveResumeV3Parser;

// ============================================================================
// V3 Schema Types
// ============================================================================

/// V3 Resume root structure
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Resume {
    pub id: Option<String>,
    pub name: Option<String>,
    pub slug: Option<String>,
    pub public: Option<bool>,
    #[serde(default)]
    pub basics: V3Basics,
    #[serde(default)]
    pub sections: V3Sections,
    #[serde(default)]
    pub metadata: V3Metadata,
}

/// V3 Basics section
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Basics {
    pub name: Option<String>,
    pub headline: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub location: Option<String>,
    pub url: Option<V3Url>,
    pub picture: Option<V3Picture>,
    #[serde(default)]
    pub summary: V3Summary,
    #[serde(default)]
    pub custom_fields: Vec<V3CustomField>,
}

/// V3 URL - can be simple string or object
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(untagged)]
pub enum V3Url {
    #[default]
    Empty,
    String(String),
    Object {
        label: Option<String>,
        href: Option<String>,
    },
}

impl V3Url {
    fn to_href(&self) -> String {
        match self {
            V3Url::Empty => String::new(),
            V3Url::String(s) => s.clone(),
            V3Url::Object { href, .. } => href.clone().unwrap_or_default(),
        }
    }

    fn to_label(&self) -> String {
        match self {
            V3Url::Empty => String::new(),
            V3Url::String(s) => s.clone(),
            V3Url::Object { label, href } => {
                label.clone().unwrap_or_else(|| href.clone().unwrap_or_default())
            }
        }
    }
}

/// V3 Picture structure
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Picture {
    pub url: Option<String>,
    pub visible: Option<bool>,
    pub size: Option<u32>,
    pub aspect_ratio: Option<f32>,
    pub border_radius: Option<u32>,
    pub effects: Option<V3PictureEffects>,
}

#[derive(Debug, Deserialize, Default, Clone)]
#[allow(dead_code)]
pub struct V3PictureEffects {
    pub hidden: Option<bool>,
    pub grayscale: Option<bool>,
    pub border: Option<bool>,
}

/// V3 Summary - can be a string OR an object
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(untagged)]
pub enum V3Summary {
    #[default]
    Empty,
    String(String),
    Object {
        body: Option<String>,
        visible: Option<bool>,
    },
}

impl V3Summary {
    fn to_content(&self) -> String {
        match self {
            V3Summary::Empty => String::new(),
            V3Summary::String(s) => s.clone(),
            V3Summary::Object { body, .. } => body.clone().unwrap_or_default(),
        }
    }

    fn is_visible(&self) -> bool {
        match self {
            V3Summary::Empty => true,
            V3Summary::String(_) => true,
            V3Summary::Object { visible, .. } => visible.unwrap_or(true),
        }
    }
}

/// V3 Custom field
#[derive(Debug, Deserialize, Default, Clone)]
#[allow(dead_code)]
pub struct V3CustomField {
    pub id: Option<String>,
    pub icon: Option<String>,
    pub name: Option<String>,
    pub value: Option<String>,
}

/// V3 Sections container
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Sections {
    #[serde(default)]
    pub profiles: V3Section<V3Profile>,
    #[serde(default)]
    pub experience: V3Section<V3Experience>,
    #[serde(default)]
    pub education: V3Section<V3Education>,
    #[serde(default)]
    pub skills: V3Section<V3Skill>,
    #[serde(default)]
    pub languages: V3Section<V3Language>,
    #[serde(default)]
    pub awards: V3Section<V3Award>,
    #[serde(default)]
    pub certifications: V3Section<V3Certification>,
    #[serde(default)]
    pub interests: V3Section<V3Interest>,
    #[serde(default)]
    pub projects: V3Section<V3Project>,
    #[serde(default)]
    pub publications: V3Section<V3Publication>,
    #[serde(default)]
    pub volunteer: V3Section<V3Volunteer>,
    #[serde(default)]
    pub references: V3Section<V3Reference>,
    #[serde(default)]
    pub custom: HashMap<String, V3Section<V3CustomItem>>,
}

/// V3 Section wrapper
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Section<T> {
    pub id: Option<String>,
    pub name: Option<String>,
    pub columns: Option<u8>,
    pub visible: Option<bool>,
    #[serde(default)]
    pub items: Vec<T>,
}

/// V3 Profile item
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Profile {
    pub id: Option<String>,
    pub visible: Option<bool>,
    pub network: Option<String>,
    pub username: Option<String>,
    pub icon: Option<String>,
    pub url: Option<V3Url>,
}

/// V3 Experience item
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Experience {
    pub id: Option<String>,
    pub visible: Option<bool>,
    pub company: Option<String>,
    pub position: Option<String>,
    pub location: Option<String>,
    pub date: Option<String>,
    pub summary: Option<String>,
    pub url: Option<V3Url>,
}

/// V3 Education item
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Education {
    pub id: Option<String>,
    pub visible: Option<bool>,
    pub institution: Option<String>,
    pub area: Option<String>,
    pub study_type: Option<String>,
    pub score: Option<String>,
    pub date: Option<String>,
    pub summary: Option<String>,
    pub url: Option<V3Url>,
}

/// V3 Skill item
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Skill {
    pub id: Option<String>,
    pub visible: Option<bool>,
    pub name: Option<String>,
    pub level: Option<u8>,
    pub description: Option<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
}

/// V3 Language item
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Language {
    pub id: Option<String>,
    pub visible: Option<bool>,
    pub name: Option<String>,
    pub level: Option<u8>,
    pub description: Option<String>,
}

/// V3 Award item
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Award {
    pub id: Option<String>,
    pub visible: Option<bool>,
    pub title: Option<String>,
    pub awarder: Option<String>,
    pub date: Option<String>,
    pub summary: Option<String>,
    pub url: Option<V3Url>,
}

/// V3 Certification item
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Certification {
    pub id: Option<String>,
    pub visible: Option<bool>,
    pub name: Option<String>,
    pub issuer: Option<String>,
    pub date: Option<String>,
    pub summary: Option<String>,
    pub url: Option<V3Url>,
}

/// V3 Interest item
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Interest {
    pub id: Option<String>,
    pub visible: Option<bool>,
    pub name: Option<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
}

/// V3 Project item
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Project {
    pub id: Option<String>,
    pub visible: Option<bool>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub date: Option<String>,
    pub summary: Option<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
    pub url: Option<V3Url>,
}

/// V3 Publication item
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Publication {
    pub id: Option<String>,
    pub visible: Option<bool>,
    pub name: Option<String>,
    pub publisher: Option<String>,
    pub date: Option<String>,
    pub summary: Option<String>,
    pub url: Option<V3Url>,
}

/// V3 Volunteer item
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Volunteer {
    pub id: Option<String>,
    pub visible: Option<bool>,
    pub organization: Option<String>,
    pub position: Option<String>,
    pub location: Option<String>,
    pub date: Option<String>,
    pub summary: Option<String>,
    pub url: Option<V3Url>,
}

/// V3 Reference item
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Reference {
    pub id: Option<String>,
    pub visible: Option<bool>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub summary: Option<String>,
    pub url: Option<V3Url>,
}

/// V3 Custom section item
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3CustomItem {
    pub id: Option<String>,
    pub visible: Option<bool>,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub date: Option<String>,
    pub location: Option<String>,
    pub summary: Option<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
    pub url: Option<V3Url>,
}

/// V3 Metadata
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Metadata {
    pub template: Option<String>,
    pub layout: Option<Vec<Vec<Vec<String>>>>,
    #[serde(default)]
    pub theme: V3Theme,
    #[serde(default)]
    pub typography: V3Typography,
    #[serde(default)]
    pub page: V3Page,
    pub css: Option<V3Css>,
    pub locale: Option<String>,
    pub date: Option<V3DateConfig>,
}

/// V3 Theme
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Theme {
    pub primary: Option<String>,
    pub background: Option<String>,
    pub text: Option<String>,
}

/// V3 Typography
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Typography {
    pub font: Option<V3Font>,
    pub line_height: Option<f32>,
    pub hide_icons: Option<bool>,
    pub underline_links: Option<bool>,
}

/// V3 Font
#[derive(Debug, Deserialize, Default)]
#[allow(dead_code)]
pub struct V3Font {
    pub family: Option<String>,
    pub subset: Option<String>,
    pub variants: Option<Vec<String>>,
    pub size: Option<u32>,
}

/// V3 Page config
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3Page {
    pub format: Option<String>,
    pub margin: Option<u32>,
    pub options: Option<V3PageOptions>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct V3PageOptions {
    pub break_line: Option<bool>,
    pub page_numbers: Option<bool>,
}

/// V3 CSS config
#[derive(Debug, Deserialize, Default)]
#[allow(dead_code)]
pub struct V3Css {
    pub value: Option<String>,
    pub visible: Option<bool>,
}

/// V3 Date config
#[derive(Debug, Deserialize, Default)]
#[allow(dead_code)]
pub struct V3DateConfig {
    pub format: Option<String>,
}

// ============================================================================
// Parser Implementation
// ============================================================================

impl Parser for ReactiveResumeV3Parser {
    type RawData = serde_json::Value;
    type ValidatedData = V3Resume;

    fn read(&self, input: &[u8]) -> Result<Self::RawData, ParseError> {
        serde_json::from_slice(input).map_err(|e| ParseError::ReadError(e.to_string()))
    }

    fn validate(&self, data: Self::RawData) -> Result<Self::ValidatedData, ParseError> {
        serde_json::from_value(data)
            .map_err(|e| ParseError::ValidationError(format!("Invalid V3 format: {}", e)))
    }

    #[allow(clippy::field_reassign_with_default)]
    fn convert(&self, data: Self::ValidatedData) -> Result<ResumeData, ParseError> {
        let mut resume = ResumeData::default();

        // Convert basics
        resume.basics = convert_basics(&data.basics);

        // Convert summary
        resume.sections.summary = SummarySection {
            id: "summary".to_string(),
            name: "Summary".to_string(),
            columns: 1,
            separate_links: true,
            visible: data.basics.summary.is_visible(),
            content: data.basics.summary.to_content(),
        };

        // Convert sections
        convert_profiles(&data.sections.profiles, &mut resume.sections.profiles);
        convert_experience(&data.sections.experience, &mut resume.sections.experience);
        convert_education(&data.sections.education, &mut resume.sections.education);
        convert_skills(&data.sections.skills, &mut resume.sections.skills);
        convert_languages(&data.sections.languages, &mut resume.sections.languages);
        convert_awards(&data.sections.awards, &mut resume.sections.awards);
        convert_certifications(
            &data.sections.certifications,
            &mut resume.sections.certifications,
        );
        convert_interests(&data.sections.interests, &mut resume.sections.interests);
        convert_projects(&data.sections.projects, &mut resume.sections.projects);
        convert_publications(
            &data.sections.publications,
            &mut resume.sections.publications,
        );
        convert_volunteer(&data.sections.volunteer, &mut resume.sections.volunteer);
        convert_references(&data.sections.references, &mut resume.sections.references);
        convert_custom_sections(&data.sections.custom, &mut resume.sections.custom);

        // Convert metadata
        resume.metadata = convert_metadata(&data.metadata);

        Ok(resume)
    }
}

// ============================================================================
// Conversion Functions
// ============================================================================

fn convert_basics(v3: &V3Basics) -> Basics {
    let mut basics = Basics::new(v3.name.clone().unwrap_or_default());

    if let Some(headline) = &v3.headline {
        basics = basics.with_headline(headline);
    }

    if let Some(email) = &v3.email {
        basics = basics.with_email(email);
    }

    if let Some(phone) = &v3.phone {
        basics = basics.with_phone(phone);
    }

    if let Some(location) = &v3.location {
        basics = basics.with_location(location);
    }

    if let Some(url) = &v3.url {
        basics.url = Url {
            label: url.to_label(),
            href: url.to_href(),
        };
    }

    // Convert picture
    if let Some(pic) = &v3.picture {
        basics.picture.url = pic.url.clone().unwrap_or_default();
        basics.picture.size = pic.size.unwrap_or(64);
        basics.picture.aspect_ratio = pic.aspect_ratio.unwrap_or(1.0);
        basics.picture.border_radius = pic.border_radius.unwrap_or(0);
        // Handle picture visible field - visible: false means hidden: true
        if let Some(visible) = pic.visible {
            basics.picture.effects.hidden = !visible;
        }
        if let Some(effects) = &pic.effects {
            basics.picture.effects.hidden = effects.hidden.unwrap_or(basics.picture.effects.hidden);
            basics.picture.effects.grayscale = effects.grayscale.unwrap_or(false);
            basics.picture.effects.border = effects.border.unwrap_or(false);
        }
    }

    // Convert custom fields
    basics.custom_fields = v3
        .custom_fields
        .iter()
        .map(|cf| CustomField {
            id: cf.id.clone().unwrap_or_else(cuid2::create_id),
            icon: cf.icon.clone().unwrap_or_default(),
            name: cf.name.clone().unwrap_or_default(),
            value: cf.value.clone().unwrap_or_default(),
        })
        .collect();

    basics
}

fn convert_profiles(v3: &V3Section<V3Profile>, section: &mut Section<Profile>) {
    section.id = v3.id.clone().unwrap_or_else(|| "profiles".to_string());
    section.name = v3.name.clone().unwrap_or_else(|| "Profiles".to_string());
    section.columns = v3.columns.unwrap_or(1);
    section.visible = v3.visible.unwrap_or(true);

    section.items = v3
        .items
        .iter()
        .map(|p| {
            let mut profile = Profile::new(
                p.network.clone().unwrap_or_default(),
                p.username.clone().unwrap_or_default(),
            );
            profile.id = p.id.clone().unwrap_or_else(cuid2::create_id);
            profile.visible = p.visible.unwrap_or(true);
            if let Some(icon) = &p.icon {
                profile = profile.with_icon(icon);
            }
            if let Some(url) = &p.url {
                profile = profile.with_url(url.to_href());
            }
            profile
        })
        .collect();
}

fn convert_experience(v3: &V3Section<V3Experience>, section: &mut Section<Experience>) {
    section.id = v3.id.clone().unwrap_or_else(|| "experience".to_string());
    section.name = v3.name.clone().unwrap_or_else(|| "Experience".to_string());
    section.columns = v3.columns.unwrap_or(1);
    section.visible = v3.visible.unwrap_or(true);

    section.items = v3
        .items
        .iter()
        .map(|e| {
            let mut exp = Experience::new(
                e.company.clone().unwrap_or_default(),
                e.position.clone().unwrap_or_default(),
            );
            exp.id = e.id.clone().unwrap_or_else(cuid2::create_id);
            exp.visible = e.visible.unwrap_or(true);
            if let Some(location) = &e.location {
                exp = exp.with_location(location);
            }
            if let Some(date) = &e.date {
                exp = exp.with_date(date);
            }
            if let Some(summary) = &e.summary {
                exp = exp.with_summary(summary);
            }
            if let Some(url) = &e.url {
                exp = exp.with_url(url.to_href());
            }
            exp
        })
        .collect();
}

fn convert_education(v3: &V3Section<V3Education>, section: &mut Section<Education>) {
    section.id = v3.id.clone().unwrap_or_else(|| "education".to_string());
    section.name = v3.name.clone().unwrap_or_else(|| "Education".to_string());
    section.columns = v3.columns.unwrap_or(1);
    section.visible = v3.visible.unwrap_or(true);

    section.items = v3
        .items
        .iter()
        .map(|e| {
            let mut edu = Education::new(
                e.institution.clone().unwrap_or_default(),
                e.area.clone().unwrap_or_default(),
            );
            edu.id = e.id.clone().unwrap_or_else(cuid2::create_id);
            edu.visible = e.visible.unwrap_or(true);
            if let Some(study_type) = &e.study_type {
                edu = edu.with_study_type(study_type);
            }
            if let Some(score) = &e.score {
                edu = edu.with_score(score);
            }
            if let Some(date) = &e.date {
                edu = edu.with_date(date);
            }
            if let Some(summary) = &e.summary {
                edu = edu.with_summary(summary);
            }
            edu
        })
        .collect();
}

fn convert_skills(v3: &V3Section<V3Skill>, section: &mut Section<Skill>) {
    section.id = v3.id.clone().unwrap_or_else(|| "skills".to_string());
    section.name = v3.name.clone().unwrap_or_else(|| "Skills".to_string());
    section.columns = v3.columns.unwrap_or(1);
    section.visible = v3.visible.unwrap_or(true);

    section.items = v3
        .items
        .iter()
        .map(|s| {
            let mut skill = Skill::new(s.name.clone().unwrap_or_default());
            skill.id = s.id.clone().unwrap_or_else(cuid2::create_id);
            skill.visible = s.visible.unwrap_or(true);
            if let Some(level) = s.level {
                skill = skill.with_level(level);
            }
            if let Some(desc) = &s.description {
                skill = skill.with_description(desc);
            }
            if !s.keywords.is_empty() {
                skill = skill.with_keywords(s.keywords.clone());
            }
            skill
        })
        .collect();
}

fn convert_languages(v3: &V3Section<V3Language>, section: &mut Section<Language>) {
    section.id = v3.id.clone().unwrap_or_else(|| "languages".to_string());
    section.name = v3.name.clone().unwrap_or_else(|| "Languages".to_string());
    section.columns = v3.columns.unwrap_or(1);
    section.visible = v3.visible.unwrap_or(true);

    section.items = v3
        .items
        .iter()
        .map(|l| {
            let mut lang = Language::new(l.name.clone().unwrap_or_default());
            lang.id = l.id.clone().unwrap_or_else(cuid2::create_id);
            lang.visible = l.visible.unwrap_or(true);
            if let Some(level) = l.level {
                lang = lang.with_level(level);
            }
            if let Some(desc) = &l.description {
                lang = lang.with_description(desc);
            }
            lang
        })
        .collect();
}

fn convert_awards(v3: &V3Section<V3Award>, section: &mut Section<Award>) {
    section.id = v3.id.clone().unwrap_or_else(|| "awards".to_string());
    section.name = v3.name.clone().unwrap_or_else(|| "Awards".to_string());
    section.columns = v3.columns.unwrap_or(1);
    section.visible = v3.visible.unwrap_or(true);

    section.items = v3
        .items
        .iter()
        .map(|a| {
            let mut award = Award::new(a.title.clone().unwrap_or_default());
            award.id = a.id.clone().unwrap_or_else(cuid2::create_id);
            award.visible = a.visible.unwrap_or(true);
            if let Some(awarder) = &a.awarder {
                award = award.with_awarder(awarder);
            }
            if let Some(date) = &a.date {
                award = award.with_date(date);
            }
            if let Some(summary) = &a.summary {
                award = award.with_summary(summary);
            }
            if let Some(url) = &a.url {
                award = award.with_url(url.to_href());
            }
            award
        })
        .collect();
}

fn convert_certifications(v3: &V3Section<V3Certification>, section: &mut Section<Certification>) {
    section.id = v3
        .id
        .clone()
        .unwrap_or_else(|| "certifications".to_string());
    section.name = v3
        .name
        .clone()
        .unwrap_or_else(|| "Certifications".to_string());
    section.columns = v3.columns.unwrap_or(1);
    section.visible = v3.visible.unwrap_or(true);

    section.items = v3
        .items
        .iter()
        .map(|c| {
            let mut cert = Certification::new(
                c.name.clone().unwrap_or_default(),
                c.issuer.clone().unwrap_or_default(),
            );
            cert.id = c.id.clone().unwrap_or_else(cuid2::create_id);
            cert.visible = c.visible.unwrap_or(true);
            if let Some(date) = &c.date {
                cert = cert.with_date(date);
            }
            if let Some(url) = &c.url {
                cert = cert.with_url(url.to_href());
            }
            if let Some(summary) = &c.summary {
                cert = cert.with_summary(summary);
            }
            cert
        })
        .collect();
}

fn convert_interests(v3: &V3Section<V3Interest>, section: &mut Section<Interest>) {
    section.id = v3.id.clone().unwrap_or_else(|| "interests".to_string());
    section.name = v3.name.clone().unwrap_or_else(|| "Interests".to_string());
    section.columns = v3.columns.unwrap_or(1);
    section.visible = v3.visible.unwrap_or(true);

    section.items = v3
        .items
        .iter()
        .map(|i| {
            let mut interest = Interest::new(i.name.clone().unwrap_or_default());
            interest.id = i.id.clone().unwrap_or_else(cuid2::create_id);
            interest.visible = i.visible.unwrap_or(true);
            if !i.keywords.is_empty() {
                interest = interest.with_keywords(i.keywords.clone());
            }
            interest
        })
        .collect();
}

fn convert_projects(v3: &V3Section<V3Project>, section: &mut Section<Project>) {
    section.id = v3.id.clone().unwrap_or_else(|| "projects".to_string());
    section.name = v3.name.clone().unwrap_or_else(|| "Projects".to_string());
    section.columns = v3.columns.unwrap_or(1);
    section.visible = v3.visible.unwrap_or(true);

    section.items = v3
        .items
        .iter()
        .map(|p| {
            let mut project = Project::new(p.name.clone().unwrap_or_default());
            project.id = p.id.clone().unwrap_or_else(cuid2::create_id);
            project.visible = p.visible.unwrap_or(true);
            if let Some(desc) = &p.description {
                project = project.with_description(desc);
            }
            if let Some(date) = &p.date {
                project = project.with_date(date);
            }
            if let Some(summary) = &p.summary {
                project = project.with_summary(summary);
            }
            if !p.keywords.is_empty() {
                project = project.with_keywords(p.keywords.clone());
            }
            if let Some(url) = &p.url {
                project = project.with_url(url.to_href());
            }
            project
        })
        .collect();
}

fn convert_publications(v3: &V3Section<V3Publication>, section: &mut Section<Publication>) {
    section.id = v3.id.clone().unwrap_or_else(|| "publications".to_string());
    section.name = v3
        .name
        .clone()
        .unwrap_or_else(|| "Publications".to_string());
    section.columns = v3.columns.unwrap_or(1);
    section.visible = v3.visible.unwrap_or(true);

    section.items = v3
        .items
        .iter()
        .map(|p| {
            let mut pub_item = Publication::new(p.name.clone().unwrap_or_default());
            pub_item.id = p.id.clone().unwrap_or_else(cuid2::create_id);
            pub_item.visible = p.visible.unwrap_or(true);
            if let Some(publisher) = &p.publisher {
                pub_item.publisher = publisher.clone();
            }
            if let Some(date) = &p.date {
                pub_item.date = date.clone();
            }
            if let Some(summary) = &p.summary {
                pub_item.summary = summary.clone();
            }
            if let Some(url) = &p.url {
                pub_item.url = Url::new(url.to_href());
            }
            pub_item
        })
        .collect();
}

fn convert_volunteer(v3: &V3Section<V3Volunteer>, section: &mut Section<Volunteer>) {
    section.id = v3.id.clone().unwrap_or_else(|| "volunteer".to_string());
    section.name = v3.name.clone().unwrap_or_else(|| "Volunteer".to_string());
    section.columns = v3.columns.unwrap_or(1);
    section.visible = v3.visible.unwrap_or(true);

    section.items = v3
        .items
        .iter()
        .map(|v| {
            let mut vol = Volunteer::new(
                v.organization.clone().unwrap_or_default(),
                v.position.clone().unwrap_or_default(),
            );
            vol.id = v.id.clone().unwrap_or_else(cuid2::create_id);
            vol.visible = v.visible.unwrap_or(true);
            if let Some(location) = &v.location {
                vol.location = location.clone();
            }
            if let Some(date) = &v.date {
                vol.date = date.clone();
            }
            if let Some(summary) = &v.summary {
                vol.summary = summary.clone();
            }
            if let Some(url) = &v.url {
                vol.url = Url::new(url.to_href());
            }
            vol
        })
        .collect();
}

fn convert_references(v3: &V3Section<V3Reference>, section: &mut Section<Reference>) {
    section.id = v3.id.clone().unwrap_or_else(|| "references".to_string());
    section.name = v3.name.clone().unwrap_or_else(|| "References".to_string());
    section.columns = v3.columns.unwrap_or(1);
    section.visible = v3.visible.unwrap_or(true);

    section.items = v3
        .items
        .iter()
        .map(|r| {
            let mut reference = Reference::new(r.name.clone().unwrap_or_default());
            reference.id = r.id.clone().unwrap_or_else(cuid2::create_id);
            reference.visible = r.visible.unwrap_or(true);
            if let Some(desc) = &r.description {
                reference.description = desc.clone();
            }
            if let Some(summary) = &r.summary {
                reference.summary = summary.clone();
            }
            if let Some(url) = &r.url {
                reference.url = Url::new(url.to_href());
            }
            reference
        })
        .collect();
}

fn convert_custom_sections(
    v3: &HashMap<String, V3Section<V3CustomItem>>,
    custom: &mut HashMap<String, Section<CustomItem>>,
) {
    for (key, v3_section) in v3 {
        let mut section = Section::new(
            v3_section.id.clone().unwrap_or_else(|| key.clone()),
            v3_section.name.clone().unwrap_or_else(|| key.clone()),
        );
        section.columns = v3_section.columns.unwrap_or(1);
        section.visible = v3_section.visible.unwrap_or(true);

        section.items = v3_section
            .items
            .iter()
            .map(|item| {
                let mut custom_item = CustomItem::new(item.title.clone().unwrap_or_default());
                custom_item.id = item.id.clone().unwrap_or_else(cuid2::create_id);
                custom_item.visible = item.visible.unwrap_or(true);
                custom_item.description = item.subtitle.clone().unwrap_or_default();
                custom_item.date = item.date.clone().unwrap_or_default();
                custom_item.location = item.location.clone().unwrap_or_default();
                custom_item.summary = item.summary.clone().unwrap_or_default();
                custom_item.keywords = item.keywords.clone();
                if let Some(url) = &item.url {
                    custom_item.url = Url::new(url.to_href());
                }
                custom_item
            })
            .collect();

        custom.insert(key.clone(), section);
    }
}

fn convert_metadata(v3: &V3Metadata) -> Metadata {
    Metadata {
        template: v3.template.clone().unwrap_or_else(|| "rhyhorn".to_string()),
        layout: v3.layout.clone().unwrap_or_default(),
        css: CustomCss {
            value: v3
                .css
                .as_ref()
                .and_then(|c| c.value.clone())
                .unwrap_or_default(),
            visible: v3
                .css
                .as_ref()
                .and_then(|c| c.visible)
                .unwrap_or(false),
        },
        page: PageConfig {
            format: match v3
                .page
                .format
                .as_deref()
                .map(|s| s.to_ascii_lowercase())
                .as_deref()
            {
                Some("letter") | Some("us-letter") => PageFormat::Letter,
                _ => PageFormat::A4,
            },
            margin: v3.page.margin.unwrap_or(18),
            options: PageOptions {
                break_line: v3
                    .page
                    .options
                    .as_ref()
                    .and_then(|o| o.break_line)
                    .unwrap_or(true),
                page_numbers: v3
                    .page
                    .options
                    .as_ref()
                    .and_then(|o| o.page_numbers)
                    .unwrap_or(true),
            },
        },
        theme: Theme {
            primary: v3
                .theme
                .primary
                .clone()
                .unwrap_or_else(|| "#dc2626".to_string()),
            background: v3
                .theme
                .background
                .clone()
                .unwrap_or_else(|| "#ffffff".to_string()),
            text: v3
                .theme
                .text
                .clone()
                .unwrap_or_else(|| "#000000".to_string()),
        },
        typography: Typography {
            font: FontConfig {
                family: v3
                    .typography
                    .font
                    .as_ref()
                    .and_then(|f| f.family.clone())
                    .unwrap_or_else(|| "IBM Plex Serif".to_string()),
                subset: v3
                    .typography
                    .font
                    .as_ref()
                    .and_then(|f| f.subset.clone())
                    .unwrap_or_else(|| "latin".to_string()),
                variants: v3
                    .typography
                    .font
                    .as_ref()
                    .and_then(|f| f.variants.clone())
                    .unwrap_or_else(|| vec!["regular".to_string()]),
                size: v3
                    .typography
                    .font
                    .as_ref()
                    .and_then(|f| f.size)
                    .unwrap_or(14),
            },
            line_height: v3.typography.line_height.unwrap_or(1.5),
            hide_icons: v3.typography.hide_icons.unwrap_or(false),
            underline_links: v3.typography.underline_links.unwrap_or(true),
        },
        notes: String::new(),
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_v3_resume() {
        let json = r##"{
            "id": "test-resume-id",
            "name": "My Resume",
            "basics": {
                "name": "John Doe",
                "headline": "Senior Software Engineer",
                "email": "john@example.com",
                "phone": "+1-555-123-4567",
                "location": "San Francisco, CA",
                "summary": {
                    "body": "Experienced software engineer with 10+ years of experience.",
                    "visible": true
                },
                "url": {
                    "href": "https://johndoe.com",
                    "label": "Portfolio"
                }
            },
            "sections": {
                "experience": {
                    "id": "experience",
                    "name": "Work Experience",
                    "visible": true,
                    "columns": 1,
                    "items": [
                        {
                            "id": "exp-1",
                            "visible": true,
                            "company": "Acme Corp",
                            "position": "Senior Engineer",
                            "location": "San Francisco",
                            "date": "2020 - Present",
                            "summary": "Led development of core platform."
                        }
                    ]
                },
                "education": {
                    "id": "education",
                    "name": "Education",
                    "visible": true,
                    "columns": 1,
                    "items": [
                        {
                            "id": "edu-1",
                            "visible": true,
                            "institution": "Stanford University",
                            "area": "Computer Science",
                            "studyType": "Bachelor of Science",
                            "date": "2010 - 2014"
                        }
                    ]
                },
                "skills": {
                    "id": "skills",
                    "name": "Skills",
                    "visible": true,
                    "columns": 2,
                    "items": [
                        {
                            "id": "skill-1",
                            "visible": true,
                            "name": "Rust",
                            "level": 5,
                            "keywords": ["Systems", "WebAssembly"]
                        }
                    ]
                },
                "profiles": { "items": [] },
                "languages": { "items": [] },
                "awards": { "items": [] },
                "certifications": { "items": [] },
                "interests": { "items": [] },
                "projects": { "items": [] },
                "publications": { "items": [] },
                "volunteer": { "items": [] },
                "references": { "items": [] },
                "custom": {}
            },
            "metadata": {
                "template": "rhyhorn",
                "theme": {
                    "primary": "#dc2626",
                    "background": "#ffffff",
                    "text": "#000000"
                },
                "typography": {
                    "font": {
                        "family": "IBM Plex Serif",
                        "size": 14
                    },
                    "lineHeight": 1.5
                },
                "page": {
                    "format": "a4",
                    "margin": 18
                }
            }
        }"##;

        let parser = ReactiveResumeV3Parser;
        let result = parser.parse(json.as_bytes());

        assert!(result.is_ok(), "Failed to parse: {:?}", result.err());

        let resume = result.unwrap();

        // Check basics
        assert_eq!(resume.basics.name, "John Doe");
        assert_eq!(resume.basics.headline, "Senior Software Engineer");
        assert_eq!(resume.basics.email, "john@example.com");
        assert_eq!(resume.basics.location, "San Francisco, CA");
        assert_eq!(resume.basics.url.href, "https://johndoe.com");

        // Check summary
        assert!(resume
            .sections
            .summary
            .content
            .contains("Experienced software engineer"));
        assert!(resume.sections.summary.visible);

        // Check experience
        assert_eq!(resume.sections.experience.items.len(), 1);
        assert_eq!(resume.sections.experience.items[0].company, "Acme Corp");
        assert_eq!(
            resume.sections.experience.items[0].position,
            "Senior Engineer"
        );

        // Check education
        assert_eq!(resume.sections.education.items.len(), 1);
        assert_eq!(
            resume.sections.education.items[0].institution,
            "Stanford University"
        );

        // Check skills
        assert_eq!(resume.sections.skills.items.len(), 1);
        assert_eq!(resume.sections.skills.items[0].name, "Rust");
        assert_eq!(resume.sections.skills.items[0].level, 5);
        assert_eq!(resume.sections.skills.items[0].keywords.len(), 2);

        // Check metadata
        assert_eq!(resume.metadata.template, "rhyhorn");
        assert_eq!(resume.metadata.theme.primary, "#dc2626");
    }

    #[test]
    fn test_v3_summary_as_string() {
        let json = r#"{
            "basics": {
                "name": "Jane Doe",
                "summary": "This is a plain string summary."
            },
            "sections": {
                "profiles": { "items": [] },
                "experience": { "items": [] },
                "education": { "items": [] },
                "skills": { "items": [] },
                "languages": { "items": [] },
                "awards": { "items": [] },
                "certifications": { "items": [] },
                "interests": { "items": [] },
                "projects": { "items": [] },
                "publications": { "items": [] },
                "volunteer": { "items": [] },
                "references": { "items": [] },
                "custom": {}
            },
            "metadata": {}
        }"#;

        let parser = ReactiveResumeV3Parser;
        let result = parser.parse(json.as_bytes());

        assert!(result.is_ok());

        let resume = result.unwrap();
        assert_eq!(
            resume.sections.summary.content,
            "This is a plain string summary."
        );
    }

    #[test]
    fn test_v3_url_formats() {
        // Test URL as string
        let url_string = V3Url::String("https://example.com".to_string());
        assert_eq!(url_string.to_href(), "https://example.com");
        assert_eq!(url_string.to_label(), "https://example.com");

        // Test URL as object
        let url_object = V3Url::Object {
            href: Some("https://example.com".to_string()),
            label: Some("My Website".to_string()),
        };
        assert_eq!(url_object.to_href(), "https://example.com");
        assert_eq!(url_object.to_label(), "My Website");
    }
}
