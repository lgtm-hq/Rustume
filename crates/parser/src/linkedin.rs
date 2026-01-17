//! LinkedIn data export parser.
//!
//! Parses the ZIP file export from LinkedIn containing CSV files for:
//! - Profile.csv - Basic information
//! - Positions.csv - Work experience
//! - Education.csv - Education history
//! - Skills.csv - Skills
//! - Languages.csv - Languages
//! - Certifications.csv - Certifications
//! - Projects.csv - Projects
//! - Email Addresses.csv - Email addresses

use crate::traits::{ParseError, Parser};
use csv::ReaderBuilder;
use rustume_schema::{
    Basics, Certification, Education, Experience, Language, Profile, Project, ResumeData, Section,
    Skill, Url,
};
use std::collections::HashMap;
use std::io::{Cursor, Read};
use zip::ZipArchive;

/// LinkedIn data export parser.
///
/// Parses the ZIP file export that users can download from LinkedIn's
/// "Get a copy of your data" feature.
pub struct LinkedInParser;

// ============================================================================
// LinkedIn CSV Data Structures
// ============================================================================

/// Parsed LinkedIn data from ZIP export.
#[derive(Debug, Default)]
pub struct LinkedInData {
    /// Profile information (name, headline, etc.)
    pub profile: Option<LinkedInProfile>,
    /// Work positions/experience
    pub positions: Vec<LinkedInPosition>,
    /// Education entries
    pub education: Vec<LinkedInEducation>,
    /// Skills
    pub skills: Vec<LinkedInSkill>,
    /// Languages
    pub languages: Vec<LinkedInLanguage>,
    /// Certifications
    pub certifications: Vec<LinkedInCertification>,
    /// Projects
    pub projects: Vec<LinkedInProject>,
    /// Email addresses
    pub emails: Vec<String>,
}

/// LinkedIn profile data from Profile.csv
#[derive(Debug, Default, Clone)]
#[allow(dead_code)]
pub struct LinkedInProfile {
    pub first_name: String,
    pub last_name: String,
    pub maiden_name: Option<String>,
    pub headline: Option<String>,
    pub summary: Option<String>,
    pub industry: Option<String>,
    pub location: Option<String>,
    pub geo_location: Option<String>,
    pub websites: Vec<String>,
}

/// LinkedIn position data from Positions.csv
#[derive(Debug, Default, Clone)]
#[allow(dead_code)]
pub struct LinkedInPosition {
    pub company_name: String,
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub started_on: Option<String>,
    pub finished_on: Option<String>,
}

/// LinkedIn education data from Education.csv
#[derive(Debug, Default, Clone)]
#[allow(dead_code)]
pub struct LinkedInEducation {
    pub school_name: String,
    pub degree_name: Option<String>,
    pub field_of_study: Option<String>,
    pub started_on: Option<String>,
    pub finished_on: Option<String>,
    pub notes: Option<String>,
    pub activities: Option<String>,
}

/// LinkedIn skill data from Skills.csv
#[derive(Debug, Default, Clone)]
pub struct LinkedInSkill {
    pub name: String,
}

/// LinkedIn language data from Languages.csv
#[derive(Debug, Default, Clone)]
#[allow(dead_code)]
pub struct LinkedInLanguage {
    pub name: String,
    pub proficiency: Option<String>,
}

/// LinkedIn certification data from Certifications.csv
#[derive(Debug, Default, Clone)]
#[allow(dead_code)]
pub struct LinkedInCertification {
    pub name: String,
    pub authority: Option<String>,
    pub license_number: Option<String>,
    pub url: Option<String>,
    pub started_on: Option<String>,
    pub finished_on: Option<String>,
}

/// LinkedIn project data from Projects.csv
#[derive(Debug, Default, Clone)]
#[allow(dead_code)]
pub struct LinkedInProject {
    pub title: String,
    pub description: Option<String>,
    pub url: Option<String>,
    pub started_on: Option<String>,
    pub finished_on: Option<String>,
}

// ============================================================================
// Parser Implementation
// ============================================================================

impl LinkedInParser {
    /// Extract and parse CSV files from LinkedIn ZIP export.
    fn parse_zip(&self, data: &[u8]) -> Result<LinkedInData, ParseError> {
        let cursor = Cursor::new(data);
        let mut archive = ZipArchive::new(cursor)
            .map_err(|e| ParseError::ReadError(format!("Failed to open ZIP archive: {}", e)))?;

        let mut linkedin_data = LinkedInData::default();

        // Iterate through files in the archive
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| {
                ParseError::ReadError(format!("Failed to read ZIP entry {}: {}", i, e))
            })?;

            let file_name = file.name().to_lowercase();

            // Skip directories and non-CSV files
            if file.is_dir() || !file_name.ends_with(".csv") {
                continue;
            }

            // Read file contents
            let mut contents = String::new();
            file.read_to_string(&mut contents).map_err(|e| {
                ParseError::ReadError(format!("Failed to read file {}: {}", file_name, e))
            })?;

            // Parse based on file name
            if file_name.contains("profile") {
                linkedin_data.profile = self.parse_profile_csv(&contents)?;
            } else if file_name.contains("position") {
                linkedin_data.positions = self.parse_positions_csv(&contents)?;
            } else if file_name.contains("education") {
                linkedin_data.education = self.parse_education_csv(&contents)?;
            } else if file_name.contains("skill") {
                linkedin_data.skills = self.parse_skills_csv(&contents)?;
            } else if file_name.contains("language") {
                linkedin_data.languages = self.parse_languages_csv(&contents)?;
            } else if file_name.contains("certification") {
                linkedin_data.certifications = self.parse_certifications_csv(&contents)?;
            } else if file_name.contains("project") {
                linkedin_data.projects = self.parse_projects_csv(&contents)?;
            } else if file_name.contains("email") {
                linkedin_data.emails = self.parse_emails_csv(&contents)?;
            }
        }

        Ok(linkedin_data)
    }

    /// Parse Profile.csv
    fn parse_profile_csv(&self, contents: &str) -> Result<Option<LinkedInProfile>, ParseError> {
        let mut reader = ReaderBuilder::new()
            .has_headers(true)
            .flexible(true)
            .from_reader(contents.as_bytes());

        let headers: Vec<String> = reader
            .headers()
            .map_err(|e| ParseError::ReadError(format!("Failed to read CSV headers: {}", e)))?
            .iter()
            .map(|s| s.to_lowercase().replace(' ', "_"))
            .collect();

        for result in reader.records() {
            let record = result
                .map_err(|e| ParseError::ReadError(format!("Failed to read CSV record: {}", e)))?;

            let row: HashMap<String, String> = headers
                .iter()
                .zip(record.iter())
                .map(|(h, v)| (h.clone(), v.to_string()))
                .collect();

            return Ok(Some(LinkedInProfile {
                first_name: row.get("first_name").cloned().unwrap_or_default(),
                last_name: row.get("last_name").cloned().unwrap_or_default(),
                maiden_name: row.get("maiden_name").cloned().filter(|s| !s.is_empty()),
                headline: row.get("headline").cloned().filter(|s| !s.is_empty()),
                summary: row.get("summary").cloned().filter(|s| !s.is_empty()),
                industry: row.get("industry").cloned().filter(|s| !s.is_empty()),
                location: row
                    .get("geo_location")
                    .or_else(|| row.get("location"))
                    .cloned()
                    .filter(|s| !s.is_empty()),
                geo_location: row.get("geo_location").cloned().filter(|s| !s.is_empty()),
                websites: row
                    .get("websites")
                    .map(|s| {
                        s.split('\n')
                            .map(|s| s.trim().to_string())
                            .filter(|s| !s.is_empty())
                            .collect()
                    })
                    .unwrap_or_default(),
            }));
        }

        Ok(None)
    }

    /// Parse Positions.csv
    fn parse_positions_csv(&self, contents: &str) -> Result<Vec<LinkedInPosition>, ParseError> {
        let mut positions = Vec::new();

        let mut reader = ReaderBuilder::new()
            .has_headers(true)
            .flexible(true)
            .from_reader(contents.as_bytes());

        let headers: Vec<String> = reader
            .headers()
            .map_err(|e| ParseError::ReadError(format!("Failed to read CSV headers: {}", e)))?
            .iter()
            .map(|s| s.to_lowercase().replace(' ', "_"))
            .collect();

        for result in reader.records() {
            let record = result
                .map_err(|e| ParseError::ReadError(format!("Failed to read CSV record: {}", e)))?;

            let row: HashMap<String, String> = headers
                .iter()
                .zip(record.iter())
                .map(|(h, v)| (h.clone(), v.to_string()))
                .collect();

            positions.push(LinkedInPosition {
                company_name: row.get("company_name").cloned().unwrap_or_default(),
                title: row.get("title").cloned().unwrap_or_default(),
                description: row.get("description").cloned().filter(|s| !s.is_empty()),
                location: row.get("location").cloned().filter(|s| !s.is_empty()),
                started_on: row.get("started_on").cloned().filter(|s| !s.is_empty()),
                finished_on: row.get("finished_on").cloned().filter(|s| !s.is_empty()),
            });
        }

        Ok(positions)
    }

    /// Parse Education.csv
    fn parse_education_csv(&self, contents: &str) -> Result<Vec<LinkedInEducation>, ParseError> {
        let mut education = Vec::new();

        let mut reader = ReaderBuilder::new()
            .has_headers(true)
            .flexible(true)
            .from_reader(contents.as_bytes());

        let headers: Vec<String> = reader
            .headers()
            .map_err(|e| ParseError::ReadError(format!("Failed to read CSV headers: {}", e)))?
            .iter()
            .map(|s| s.to_lowercase().replace(' ', "_"))
            .collect();

        for result in reader.records() {
            let record = result
                .map_err(|e| ParseError::ReadError(format!("Failed to read CSV record: {}", e)))?;

            let row: HashMap<String, String> = headers
                .iter()
                .zip(record.iter())
                .map(|(h, v)| (h.clone(), v.to_string()))
                .collect();

            education.push(LinkedInEducation {
                school_name: row.get("school_name").cloned().unwrap_or_default(),
                degree_name: row.get("degree_name").cloned().filter(|s| !s.is_empty()),
                field_of_study: row.get("field_of_study").cloned().filter(|s| !s.is_empty()),
                started_on: row.get("start_date").cloned().filter(|s| !s.is_empty()),
                finished_on: row.get("end_date").cloned().filter(|s| !s.is_empty()),
                notes: row.get("notes").cloned().filter(|s| !s.is_empty()),
                activities: row
                    .get("activities_and_societies")
                    .cloned()
                    .filter(|s| !s.is_empty()),
            });
        }

        Ok(education)
    }

    /// Parse Skills.csv
    fn parse_skills_csv(&self, contents: &str) -> Result<Vec<LinkedInSkill>, ParseError> {
        let mut skills = Vec::new();

        let mut reader = ReaderBuilder::new()
            .has_headers(true)
            .flexible(true)
            .from_reader(contents.as_bytes());

        let headers: Vec<String> = reader
            .headers()
            .map_err(|e| ParseError::ReadError(format!("Failed to read CSV headers: {}", e)))?
            .iter()
            .map(|s| s.to_lowercase().replace(' ', "_"))
            .collect();

        for result in reader.records() {
            let record = result
                .map_err(|e| ParseError::ReadError(format!("Failed to read CSV record: {}", e)))?;

            let row: HashMap<String, String> = headers
                .iter()
                .zip(record.iter())
                .map(|(h, v)| (h.clone(), v.to_string()))
                .collect();

            let name = row.get("name").cloned().unwrap_or_default();
            if !name.is_empty() {
                skills.push(LinkedInSkill { name });
            }
        }

        Ok(skills)
    }

    /// Parse Languages.csv
    fn parse_languages_csv(&self, contents: &str) -> Result<Vec<LinkedInLanguage>, ParseError> {
        let mut languages = Vec::new();

        let mut reader = ReaderBuilder::new()
            .has_headers(true)
            .flexible(true)
            .from_reader(contents.as_bytes());

        let headers: Vec<String> = reader
            .headers()
            .map_err(|e| ParseError::ReadError(format!("Failed to read CSV headers: {}", e)))?
            .iter()
            .map(|s| s.to_lowercase().replace(' ', "_"))
            .collect();

        for result in reader.records() {
            let record = result
                .map_err(|e| ParseError::ReadError(format!("Failed to read CSV record: {}", e)))?;

            let row: HashMap<String, String> = headers
                .iter()
                .zip(record.iter())
                .map(|(h, v)| (h.clone(), v.to_string()))
                .collect();

            let name = row.get("name").cloned().unwrap_or_default();
            if !name.is_empty() {
                languages.push(LinkedInLanguage {
                    name,
                    proficiency: row.get("proficiency").cloned().filter(|s| !s.is_empty()),
                });
            }
        }

        Ok(languages)
    }

    /// Parse Certifications.csv
    fn parse_certifications_csv(
        &self,
        contents: &str,
    ) -> Result<Vec<LinkedInCertification>, ParseError> {
        let mut certifications = Vec::new();

        let mut reader = ReaderBuilder::new()
            .has_headers(true)
            .flexible(true)
            .from_reader(contents.as_bytes());

        let headers: Vec<String> = reader
            .headers()
            .map_err(|e| ParseError::ReadError(format!("Failed to read CSV headers: {}", e)))?
            .iter()
            .map(|s| s.to_lowercase().replace(' ', "_"))
            .collect();

        for result in reader.records() {
            let record = result
                .map_err(|e| ParseError::ReadError(format!("Failed to read CSV record: {}", e)))?;

            let row: HashMap<String, String> = headers
                .iter()
                .zip(record.iter())
                .map(|(h, v)| (h.clone(), v.to_string()))
                .collect();

            let name = row.get("name").cloned().unwrap_or_default();
            if !name.is_empty() {
                certifications.push(LinkedInCertification {
                    name,
                    authority: row.get("authority").cloned().filter(|s| !s.is_empty()),
                    license_number: row.get("license_number").cloned().filter(|s| !s.is_empty()),
                    url: row.get("url").cloned().filter(|s| !s.is_empty()),
                    started_on: row.get("started_on").cloned().filter(|s| !s.is_empty()),
                    finished_on: row.get("finished_on").cloned().filter(|s| !s.is_empty()),
                });
            }
        }

        Ok(certifications)
    }

    /// Parse Projects.csv
    fn parse_projects_csv(&self, contents: &str) -> Result<Vec<LinkedInProject>, ParseError> {
        let mut projects = Vec::new();

        let mut reader = ReaderBuilder::new()
            .has_headers(true)
            .flexible(true)
            .from_reader(contents.as_bytes());

        let headers: Vec<String> = reader
            .headers()
            .map_err(|e| ParseError::ReadError(format!("Failed to read CSV headers: {}", e)))?
            .iter()
            .map(|s| s.to_lowercase().replace(' ', "_"))
            .collect();

        for result in reader.records() {
            let record = result
                .map_err(|e| ParseError::ReadError(format!("Failed to read CSV record: {}", e)))?;

            let row: HashMap<String, String> = headers
                .iter()
                .zip(record.iter())
                .map(|(h, v)| (h.clone(), v.to_string()))
                .collect();

            let title = row.get("title").cloned().unwrap_or_default();
            if !title.is_empty() {
                projects.push(LinkedInProject {
                    title,
                    description: row.get("description").cloned().filter(|s| !s.is_empty()),
                    url: row.get("url").cloned().filter(|s| !s.is_empty()),
                    started_on: row.get("started_on").cloned().filter(|s| !s.is_empty()),
                    finished_on: row.get("finished_on").cloned().filter(|s| !s.is_empty()),
                });
            }
        }

        Ok(projects)
    }

    /// Parse Email Addresses.csv
    fn parse_emails_csv(&self, contents: &str) -> Result<Vec<String>, ParseError> {
        let mut emails = Vec::new();

        let mut reader = ReaderBuilder::new()
            .has_headers(true)
            .flexible(true)
            .from_reader(contents.as_bytes());

        let headers: Vec<String> = reader
            .headers()
            .map_err(|e| ParseError::ReadError(format!("Failed to read CSV headers: {}", e)))?
            .iter()
            .map(|s| s.to_lowercase().replace(' ', "_"))
            .collect();

        for result in reader.records() {
            let record = result
                .map_err(|e| ParseError::ReadError(format!("Failed to read CSV record: {}", e)))?;

            let row: HashMap<String, String> = headers
                .iter()
                .zip(record.iter())
                .map(|(h, v)| (h.clone(), v.to_string()))
                .collect();

            if let Some(email) = row
                .get("email_address")
                .or_else(|| row.get("email"))
                .cloned()
            {
                if !email.is_empty() {
                    emails.push(email);
                }
            }
        }

        Ok(emails)
    }
}

impl Parser for LinkedInParser {
    type RawData = Vec<u8>;
    type ValidatedData = LinkedInData;

    fn read(&self, input: &[u8]) -> Result<Self::RawData, ParseError> {
        // Just pass through the bytes - we'll parse in validate
        Ok(input.to_vec())
    }

    fn validate(&self, data: Self::RawData) -> Result<Self::ValidatedData, ParseError> {
        // Parse the ZIP file and extract CSV data
        self.parse_zip(&data)
    }

    fn convert(&self, data: Self::ValidatedData) -> Result<ResumeData, ParseError> {
        let mut resume = ResumeData::default();

        // Convert profile/basics
        if let Some(profile) = data.profile {
            let full_name = format!("{} {}", profile.first_name, profile.last_name).trim().to_string();

            resume.basics = Basics::new(&full_name);

            if let Some(headline) = profile.headline {
                resume.basics = resume.basics.with_headline(&headline);
            }

            if let Some(location) = profile.location {
                resume.basics = resume.basics.with_location(&location);
            }

            // Use first website as URL
            if let Some(website) = profile.websites.first() {
                resume.basics.url = Url::new(website);
            }

            // Add summary
            if let Some(summary) = profile.summary {
                resume.sections.summary.content = summary;
            }
        }

        // Add email from parsed emails
        if let Some(email) = data.emails.first() {
            resume.basics = resume.basics.with_email(email);
        }

        // Add LinkedIn profile
        resume.sections.profiles = Section::new("profiles", "Profiles");
        resume.sections.profiles.add_item(
            Profile::new("LinkedIn", "").with_url("https://linkedin.com/in/"),
        );

        // Convert positions to experience
        if !data.positions.is_empty() {
            resume.sections.experience = Section::new("experience", "Experience");
            for pos in data.positions {
                let mut exp = Experience::new(&pos.company_name, &pos.title);

                // Format date range
                let date = format_linkedin_date_range(pos.started_on.as_deref(), pos.finished_on.as_deref());
                if !date.is_empty() {
                    exp = exp.with_date(&date);
                }

                if let Some(location) = pos.location {
                    exp = exp.with_location(&location);
                }

                if let Some(description) = pos.description {
                    exp = exp.with_summary(&description);
                }

                resume.sections.experience.add_item(exp);
            }
        }

        // Convert education
        if !data.education.is_empty() {
            resume.sections.education = Section::new("education", "Education");
            for edu in data.education {
                // Education requires institution and area
                let area = edu.field_of_study.clone().unwrap_or_default();
                let mut education = Education::new(&edu.school_name, &area);

                if let Some(degree) = edu.degree_name {
                    education = education.with_study_type(&degree);
                }

                // Format date range
                let date = format_linkedin_date_range(edu.started_on.as_deref(), edu.finished_on.as_deref());
                if !date.is_empty() {
                    education = education.with_date(&date);
                }

                resume.sections.education.add_item(education);
            }
        }

        // Convert skills - group them into a single skill entry with keywords
        if !data.skills.is_empty() {
            resume.sections.skills = Section::new("skills", "Skills");

            // Group skills into categories of ~10 for better display
            let skill_names: Vec<String> = data.skills.into_iter().map(|s| s.name).collect();
            let chunks: Vec<&[String]> = skill_names.chunks(10).collect();

            for (i, chunk) in chunks.iter().enumerate() {
                let skill = Skill::new(if i == 0 { "Technical Skills" } else { "Additional Skills" })
                    .with_keywords(chunk.to_vec());
                resume.sections.skills.add_item(skill);
            }
        }

        // Convert languages
        if !data.languages.is_empty() {
            resume.sections.languages = Section::new("languages", "Languages");
            for lang in data.languages {
                let mut language = Language::new(&lang.name);

                if let Some(proficiency) = lang.proficiency {
                    let level = proficiency_to_level(&proficiency);
                    language = language.with_description(&proficiency).with_level(level);
                }

                resume.sections.languages.add_item(language);
            }
        }

        // Convert certifications
        if !data.certifications.is_empty() {
            resume.sections.certifications = Section::new("certifications", "Certifications");
            for cert in data.certifications {
                // Certification requires name and issuer
                let issuer = cert.authority.clone().unwrap_or_default();
                let mut certification = Certification::new(&cert.name, &issuer);

                if let Some(url) = cert.url {
                    certification = certification.with_url(&url);
                }

                // Use started_on as the date
                if let Some(date) = cert.started_on {
                    certification = certification.with_date(&format_linkedin_date(Some(&date)));
                }

                resume.sections.certifications.add_item(certification);
            }
        }

        // Convert projects
        if !data.projects.is_empty() {
            resume.sections.projects = Section::new("projects", "Projects");
            for proj in data.projects {
                let mut project = Project::new(&proj.title);

                if let Some(description) = proj.description {
                    project = project.with_description(&description);
                }

                if let Some(url) = proj.url {
                    project = project.with_url(&url);
                }

                // Format date range
                let date = format_linkedin_date_range(proj.started_on.as_deref(), proj.finished_on.as_deref());
                if !date.is_empty() {
                    project = project.with_date(&date);
                }

                resume.sections.projects.add_item(project);
            }
        }

        Ok(resume)
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Format LinkedIn date (typically "Mon YYYY" or "YYYY")
fn format_linkedin_date(date: Option<&str>) -> String {
    date.map(|d| d.trim().to_string()).unwrap_or_default()
}

/// Format LinkedIn date range
fn format_linkedin_date_range(start: Option<&str>, end: Option<&str>) -> String {
    let start_str = start.map(|s| s.trim()).filter(|s| !s.is_empty());
    let end_str = end.map(|s| s.trim()).filter(|s| !s.is_empty());

    match (start_str, end_str) {
        (Some(s), Some(e)) => format!("{} - {}", s, e),
        (Some(s), None) => format!("{} - Present", s),
        (None, Some(e)) => e.to_string(),
        (None, None) => String::new(),
    }
}

/// Convert LinkedIn proficiency to skill level (1-5)
fn proficiency_to_level(proficiency: &str) -> u8 {
    let lower = proficiency.to_lowercase();
    if lower.contains("native") || lower.contains("bilingual") || lower.contains("full professional") {
        5
    } else if lower.contains("professional working") || lower.contains("fluent") {
        4
    } else if lower.contains("limited working") || lower.contains("intermediate") {
        3
    } else if lower.contains("elementary") || lower.contains("basic") {
        2
    } else {
        3 // Default to intermediate
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// Create a test ZIP file with sample LinkedIn data
    fn create_test_zip() -> Vec<u8> {
        let mut buffer = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(Cursor::new(&mut buffer));
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored);

            // Profile.csv
            zip.start_file("Profile.csv", options).unwrap();
            zip.write_all(b"First Name,Last Name,Headline,Summary,Geo Location\n").unwrap();
            zip.write_all(b"John,Doe,Senior Software Engineer,Passionate developer with 10 years of experience.,San Francisco Bay Area\n").unwrap();

            // Positions.csv
            zip.start_file("Positions.csv", options).unwrap();
            zip.write_all(b"Company Name,Title,Description,Location,Started On,Finished On\n").unwrap();
            zip.write_all(b"Acme Corp,Senior Engineer,Led development of core platform,San Francisco,Jan 2020,\n").unwrap();
            zip.write_all(b"StartupXYZ,Software Developer,Full stack development,New York,Jun 2017,Dec 2019\n").unwrap();

            // Education.csv
            zip.start_file("Education.csv", options).unwrap();
            zip.write_all(b"School Name,Degree Name,Field of Study,Start Date,End Date\n").unwrap();
            zip.write_all(b"Stanford University,Bachelor of Science,Computer Science,2013,2017\n").unwrap();

            // Skills.csv
            zip.start_file("Skills.csv", options).unwrap();
            zip.write_all(b"Name\n").unwrap();
            zip.write_all(b"Rust\n").unwrap();
            zip.write_all(b"TypeScript\n").unwrap();
            zip.write_all(b"Python\n").unwrap();

            // Languages.csv
            zip.start_file("Languages.csv", options).unwrap();
            zip.write_all(b"Name,Proficiency\n").unwrap();
            zip.write_all(b"English,Native or Bilingual Proficiency\n").unwrap();
            zip.write_all(b"Spanish,Professional Working Proficiency\n").unwrap();

            // Email Addresses.csv
            zip.start_file("Email Addresses.csv", options).unwrap();
            zip.write_all(b"Email Address\n").unwrap();
            zip.write_all(b"john.doe@example.com\n").unwrap();

            zip.finish().unwrap();
        }
        buffer
    }

    #[test]
    fn test_parse_linkedin_zip() {
        let zip_data = create_test_zip();
        let parser = LinkedInParser;

        let result = parser.parse(&zip_data);
        assert!(result.is_ok(), "Failed to parse: {:?}", result.err());

        let resume = result.unwrap();

        // Check basics
        assert_eq!(resume.basics.name, "John Doe");
        assert_eq!(resume.basics.headline, "Senior Software Engineer");
        assert_eq!(resume.basics.email, "john.doe@example.com");
        assert_eq!(resume.basics.location, "San Francisco Bay Area");

        // Check summary
        assert!(resume.sections.summary.content.contains("Passionate developer"));

        // Check experience
        assert_eq!(resume.sections.experience.items.len(), 2);

        // Check education
        assert_eq!(resume.sections.education.items.len(), 1);

        // Check skills
        assert!(!resume.sections.skills.items.is_empty());

        // Check languages
        assert_eq!(resume.sections.languages.items.len(), 2);
    }

    #[test]
    fn test_proficiency_to_level() {
        assert_eq!(proficiency_to_level("Native or Bilingual Proficiency"), 5);
        assert_eq!(proficiency_to_level("Professional Working Proficiency"), 4);
        assert_eq!(proficiency_to_level("Limited Working Proficiency"), 3);
        assert_eq!(proficiency_to_level("Elementary Proficiency"), 2);
        assert_eq!(proficiency_to_level("Unknown"), 3);
    }

    #[test]
    fn test_format_linkedin_date_range() {
        assert_eq!(format_linkedin_date_range(Some("Jan 2020"), Some("Dec 2022")), "Jan 2020 - Dec 2022");
        assert_eq!(format_linkedin_date_range(Some("Jan 2020"), None), "Jan 2020 - Present");
        assert_eq!(format_linkedin_date_range(None, Some("Dec 2022")), "Dec 2022");
        assert_eq!(format_linkedin_date_range(None, None), "");
    }
}
