//! JSON Resume format parser.
//!
//! Parses the standard JSON Resume schema (https://jsonresume.org/schema/).

use crate::traits::{ParseError, Parser};
use rustume_schema::{
    Award, Certification, Education, Experience, Interest, Language, Profile, Project, Publication,
    Reference, ResumeData, Section, Skill, SummarySection, Url, Volunteer,
};
use rustume_utils::format_date_range;
use serde::Deserialize;

/// JSON Resume parser.
pub struct JsonResumeParser;

// ============================================================================
// JSON Resume Schema Types
// ============================================================================

/// JSON Resume schema representation.
/// Fields are optional to handle partial data.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct JsonResume {
    basics: Option<JsonResumeBasics>,
    work: Option<Vec<JsonResumeWork>>,
    volunteer: Option<Vec<JsonResumeVolunteer>>,
    education: Option<Vec<JsonResumeEducation>>,
    awards: Option<Vec<JsonResumeAward>>,
    certificates: Option<Vec<JsonResumeCertificate>>,
    publications: Option<Vec<JsonResumePublication>>,
    skills: Option<Vec<JsonResumeSkill>>,
    languages: Option<Vec<JsonResumeLanguage>>,
    interests: Option<Vec<JsonResumeInterest>>,
    references: Option<Vec<JsonResumeReference>>,
    projects: Option<Vec<JsonResumeProject>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonResumeBasics {
    name: Option<String>,
    label: Option<String>,
    image: Option<String>,
    email: Option<String>,
    phone: Option<String>,
    url: Option<String>,
    summary: Option<String>,
    location: Option<JsonResumeLocation>,
    profiles: Option<Vec<JsonResumeProfile>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct JsonResumeLocation {
    address: Option<String>,
    postal_code: Option<String>,
    city: Option<String>,
    country_code: Option<String>,
    region: Option<String>,
}

impl JsonResumeLocation {
    fn to_string(&self) -> String {
        let parts: Vec<&str> = [
            self.city.as_deref(),
            self.region.as_deref(),
            self.country_code.as_deref(),
        ]
        .iter()
        .filter_map(|&s| s)
        .filter(|s| !s.is_empty())
        .collect();

        parts.join(", ")
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonResumeProfile {
    network: Option<String>,
    username: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonResumeWork {
    name: Option<String>,
    position: Option<String>,
    url: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    summary: Option<String>,
    highlights: Option<Vec<String>>,
    location: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct JsonResumeVolunteer {
    organization: Option<String>,
    position: Option<String>,
    url: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    summary: Option<String>,
    highlights: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct JsonResumeEducation {
    institution: Option<String>,
    url: Option<String>,
    area: Option<String>,
    study_type: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    score: Option<String>,
    courses: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct JsonResumeAward {
    title: Option<String>,
    date: Option<String>,
    awarder: Option<String>,
    summary: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonResumeCertificate {
    name: Option<String>,
    date: Option<String>,
    issuer: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct JsonResumePublication {
    name: Option<String>,
    publisher: Option<String>,
    release_date: Option<String>,
    url: Option<String>,
    summary: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonResumeSkill {
    name: Option<String>,
    level: Option<String>,
    keywords: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonResumeLanguage {
    language: Option<String>,
    fluency: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonResumeInterest {
    name: Option<String>,
    keywords: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct JsonResumeReference {
    name: Option<String>,
    reference: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct JsonResumeProject {
    name: Option<String>,
    description: Option<String>,
    highlights: Option<Vec<String>>,
    keywords: Option<Vec<String>>,
    start_date: Option<String>,
    end_date: Option<String>,
    url: Option<String>,
    roles: Option<Vec<String>>,
    entity: Option<String>,
    #[serde(rename = "type")]
    project_type: Option<String>,
}

// ============================================================================
// Parser Implementation
// ============================================================================

impl Parser for JsonResumeParser {
    type RawData = serde_json::Value;
    type ValidatedData = JsonResume;

    fn read(&self, input: &[u8]) -> Result<Self::RawData, ParseError> {
        serde_json::from_slice(input).map_err(|e| ParseError::ReadError(e.to_string()))
    }

    fn validate(&self, data: Self::RawData) -> Result<Self::ValidatedData, ParseError> {
        serde_json::from_value(data).map_err(|e| ParseError::ValidationError(e.to_string()))
    }

    fn convert(&self, data: Self::ValidatedData) -> Result<ResumeData, ParseError> {
        let mut resume = ResumeData::default();

        // Convert basics
        if let Some(basics) = data.basics {
            resume.basics.name = basics.name.unwrap_or_default();
            resume.basics.headline = basics.label.unwrap_or_default();
            resume.basics.picture.url = basics.image.unwrap_or_default();
            resume.basics.email = basics.email.unwrap_or_default();
            resume.basics.phone = basics.phone.unwrap_or_default();
            resume.basics.url = Url::new(basics.url.unwrap_or_default());

            if let Some(location) = basics.location {
                resume.basics.location = location.to_string();
            }

            // Summary goes to summary section
            if let Some(summary) = basics.summary {
                resume.sections.summary = SummarySection::new(summary);
            }

            // Convert profiles
            if let Some(profiles) = basics.profiles {
                resume.sections.profiles = Section::new("profiles", "Profiles");
                for p in profiles {
                    let network = p.network.clone().unwrap_or_default();
                    let mut profile = Profile::new(
                        network.clone(),
                        p.username.unwrap_or_default(),
                    );
                    if let Some(url) = p.url {
                        profile = profile.with_url(url);
                    }
                    resume.sections.profiles.add_item(profile);
                }
            }
        }

        // Convert work -> experience
        if let Some(work) = data.work {
            resume.sections.experience = Section::new("experience", "Experience");
            for w in work {
                let mut exp = Experience::new(
                    w.name.unwrap_or_default(),
                    w.position.unwrap_or_default(),
                );

                if let Some(location) = w.location {
                    exp = exp.with_location(location);
                }

                let date = format_date_range(w.start_date.as_deref(), w.end_date.as_deref());
                if !date.is_empty() {
                    exp = exp.with_date(date);
                }

                // Combine summary and highlights
                let summary = build_summary(w.summary.as_deref(), w.highlights.as_deref());
                if !summary.is_empty() {
                    exp = exp.with_summary(summary);
                }

                if let Some(url) = w.url {
                    exp = exp.with_url(url);
                }

                resume.sections.experience.add_item(exp);
            }
        }

        // Convert education
        if let Some(education) = data.education {
            resume.sections.education = Section::new("education", "Education");
            for e in education {
                let mut edu = Education::new(
                    e.institution.unwrap_or_default(),
                    e.area.unwrap_or_default(),
                );

                if let Some(study_type) = e.study_type {
                    edu = edu.with_study_type(study_type);
                }

                let date = format_date_range(e.start_date.as_deref(), e.end_date.as_deref());
                if !date.is_empty() {
                    edu = edu.with_date(date);
                }

                if let Some(score) = e.score {
                    edu = edu.with_score(score);
                }

                // Courses become summary
                if let Some(courses) = e.courses {
                    if !courses.is_empty() {
                        edu = edu.with_summary(format!("Courses: {}", courses.join(", ")));
                    }
                }

                resume.sections.education.add_item(edu);
            }
        }

        // Convert skills
        if let Some(skills) = data.skills {
            resume.sections.skills = Section::new("skills", "Skills");
            for s in skills {
                let mut skill = Skill::new(s.name.unwrap_or_default());

                if let Some(level) = s.level {
                    skill = skill.with_description(level);
                }

                if let Some(keywords) = s.keywords {
                    skill = skill.with_keywords(keywords);
                }

                resume.sections.skills.add_item(skill);
            }
        }

        // Convert projects
        if let Some(projects) = data.projects {
            resume.sections.projects = Section::new("projects", "Projects");
            for p in projects {
                let mut project = Project::new(p.name.unwrap_or_default());

                if let Some(desc) = p.description {
                    project = project.with_description(desc);
                }

                let summary = build_summary(None, p.highlights.as_deref());
                if !summary.is_empty() {
                    project = project.with_summary(summary);
                }

                if let Some(keywords) = p.keywords {
                    project = project.with_keywords(keywords);
                }

                if let Some(url) = p.url {
                    project = project.with_url(url);
                }

                resume.sections.projects.add_item(project);
            }
        }

        // Convert volunteer
        if let Some(volunteer) = data.volunteer {
            resume.sections.volunteer = Section::new("volunteer", "Volunteer");
            for v in volunteer {
                let vol = Volunteer::new(
                    v.organization.unwrap_or_default(),
                    v.position.unwrap_or_default(),
                );
                resume.sections.volunteer.add_item(vol);
            }
        }

        // Convert awards
        if let Some(awards) = data.awards {
            resume.sections.awards = Section::new("awards", "Awards");
            for a in awards {
                let mut award = Award::new(a.title.unwrap_or_default());
                if let Some(awarder) = a.awarder {
                    award = award.with_awarder(awarder);
                }
                if let Some(date) = a.date {
                    award = award.with_date(date);
                }
                resume.sections.awards.add_item(award);
            }
        }

        // Convert certificates -> certifications
        if let Some(certificates) = data.certificates {
            resume.sections.certifications = Section::new("certifications", "Certifications");
            for c in certificates {
                let mut cert = Certification::new(
                    c.name.unwrap_or_default(),
                    c.issuer.unwrap_or_default(),
                );
                if let Some(date) = c.date {
                    cert = cert.with_date(date);
                }
                if let Some(url) = c.url {
                    cert = cert.with_url(url);
                }
                resume.sections.certifications.add_item(cert);
            }
        }

        // Convert publications
        if let Some(publications) = data.publications {
            resume.sections.publications = Section::new("publications", "Publications");
            for p in publications {
                let pub_item = Publication::new(p.name.unwrap_or_default());
                resume.sections.publications.add_item(pub_item);
            }
        }

        // Convert languages
        if let Some(languages) = data.languages {
            resume.sections.languages = Section::new("languages", "Languages");
            for l in languages {
                let mut lang = Language::new(l.language.unwrap_or_default());
                if let Some(fluency) = l.fluency {
                    // Map fluency to level before consuming fluency
                    let level = fluency_to_level(&fluency);
                    lang = lang.with_description(fluency).with_level(level);
                }
                resume.sections.languages.add_item(lang);
            }
        }

        // Convert interests
        if let Some(interests) = data.interests {
            resume.sections.interests = Section::new("interests", "Interests");
            for i in interests {
                let mut interest = Interest::new(i.name.unwrap_or_default());
                if let Some(keywords) = i.keywords {
                    interest = interest.with_keywords(keywords);
                }
                resume.sections.interests.add_item(interest);
            }
        }

        // Convert references
        if let Some(references) = data.references {
            resume.sections.references = Section::new("references", "References");
            for r in references {
                let ref_item = Reference::new(r.name.unwrap_or_default());
                resume.sections.references.add_item(ref_item);
            }
        }

        Ok(resume)
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Build a summary string from optional summary and highlights.
fn build_summary(summary: Option<&str>, highlights: Option<&[String]>) -> String {
    let mut parts = Vec::new();

    if let Some(s) = summary {
        if !s.is_empty() {
            parts.push(s.to_string());
        }
    }

    if let Some(h) = highlights {
        if !h.is_empty() {
            let bullets: Vec<String> = h.iter().map(|item| format!("• {}", item)).collect();
            parts.push(bullets.join("\n"));
        }
    }

    parts.join("\n\n")
}

/// Map fluency description to numeric level (0-5).
fn fluency_to_level(fluency: &str) -> u8 {
    let lower = fluency.to_lowercase();
    if lower.contains("native") || lower.contains("bilingual") {
        5
    } else if lower.contains("fluent") || lower.contains("professional") {
        4
    } else if lower.contains("advanced") {
        3
    } else if lower.contains("intermediate") || lower.contains("working") {
        2
    } else if lower.contains("elementary") || lower.contains("basic") || lower.contains("beginner")
    {
        1
    } else {
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MINIMAL_JSON: &str = r#"{
        "basics": {
            "name": "John Doe",
            "label": "Software Engineer",
            "email": "john@example.com"
        }
    }"#;

    const FULL_JSON: &str = r#"{
        "basics": {
            "name": "Jane Smith",
            "label": "Senior Developer",
            "email": "jane@example.com",
            "phone": "+1-555-123-4567",
            "url": "https://janesmith.io",
            "summary": "Experienced software engineer.",
            "location": {
                "city": "San Francisco",
                "region": "CA",
                "countryCode": "US"
            },
            "profiles": [
                {
                    "network": "GitHub",
                    "username": "janesmith",
                    "url": "https://github.com/janesmith"
                }
            ]
        },
        "work": [
            {
                "name": "Tech Corp",
                "position": "Senior Developer",
                "startDate": "2020-01-01",
                "endDate": "2024-01-01",
                "summary": "Led development team.",
                "highlights": ["Reduced latency by 40%", "Mentored junior devs"]
            }
        ],
        "education": [
            {
                "institution": "MIT",
                "area": "Computer Science",
                "studyType": "Bachelor",
                "startDate": "2013-09-01",
                "endDate": "2017-05-31",
                "score": "3.9 GPA"
            }
        ],
        "skills": [
            {
                "name": "Backend",
                "level": "Expert",
                "keywords": ["Rust", "Go", "Python"]
            }
        ],
        "languages": [
            {"language": "English", "fluency": "Native"},
            {"language": "Spanish", "fluency": "Intermediate"}
        ]
    }"#;

    #[test]
    fn test_parse_minimal() {
        let parser = JsonResumeParser;
        let result = parser.parse(MINIMAL_JSON.as_bytes()).unwrap();

        assert_eq!(result.basics.name, "John Doe");
        assert_eq!(result.basics.headline, "Software Engineer");
        assert_eq!(result.basics.email, "john@example.com");
    }

    #[test]
    fn test_parse_full() {
        let parser = JsonResumeParser;
        let result = parser.parse(FULL_JSON.as_bytes()).unwrap();

        assert_eq!(result.basics.name, "Jane Smith");
        assert_eq!(result.basics.location, "San Francisco, CA, US");

        // Check profiles
        assert_eq!(result.sections.profiles.len(), 1);
        assert_eq!(result.sections.profiles.items[0].network, "GitHub");

        // Check experience
        assert_eq!(result.sections.experience.len(), 1);
        assert_eq!(result.sections.experience.items[0].company, "Tech Corp");
        assert!(result.sections.experience.items[0]
            .summary
            .contains("Reduced latency"));

        // Check education
        assert_eq!(result.sections.education.len(), 1);
        assert_eq!(result.sections.education.items[0].institution, "MIT");

        // Check skills
        assert_eq!(result.sections.skills.len(), 1);
        assert_eq!(result.sections.skills.items[0].keywords.len(), 3);

        // Check languages with fluency mapping
        assert_eq!(result.sections.languages.len(), 2);
        assert_eq!(result.sections.languages.items[0].level, 5); // Native -> 5
        assert_eq!(result.sections.languages.items[1].level, 2); // Intermediate -> 2
    }

    #[test]
    fn test_fluency_to_level() {
        assert_eq!(fluency_to_level("Native speaker"), 5);
        assert_eq!(fluency_to_level("Bilingual"), 5);
        assert_eq!(fluency_to_level("Fluent"), 4);
        assert_eq!(fluency_to_level("Professional working proficiency"), 4);
        assert_eq!(fluency_to_level("Advanced"), 3);
        assert_eq!(fluency_to_level("Intermediate"), 2);
        assert_eq!(fluency_to_level("Elementary"), 1);
        assert_eq!(fluency_to_level("Unknown"), 0);
    }

    #[test]
    fn test_build_summary() {
        let summary = build_summary(Some("Main summary"), Some(&["Point 1".to_string()]));
        assert!(summary.contains("Main summary"));
        assert!(summary.contains("• Point 1"));
    }
}
