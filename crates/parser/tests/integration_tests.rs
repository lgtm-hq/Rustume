//! Integration tests for all resume parsers.
//!
//! These tests verify the complete parsing pipeline from file input
//! to validated ResumeData output using realistic fixture data.

use rustume_parser::{JsonResumeParser, LinkedInParser, Parser, ReactiveResumeV3Parser};
use std::fs;
use std::path::PathBuf;

/// Get the path to test fixtures directory.
fn fixtures_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("Parser crate should have parent directory")
        .parent()
        .expect("crates directory should have parent (workspace root)")
        .join("tests")
        .join("fixtures")
}

// ============================================================================
// JSON Resume Parser Integration Tests
// ============================================================================

mod json_resume {
    use super::*;

    #[test]
    fn test_parse_minimal_json_resume() {
        let fixture_path = fixtures_path().join("json_resume").join("minimal.json");
        let data = fs::read(&fixture_path).expect("Failed to read minimal.json fixture");

        let parser = JsonResumeParser;
        let result = parser.parse(&data);

        assert!(
            result.is_ok(),
            "Failed to parse minimal.json: {:?}",
            result.err()
        );

        let resume = result.unwrap();

        // Verify basics
        assert_eq!(resume.basics.name, "John Doe");
        assert_eq!(resume.basics.headline, "Software Engineer");
        assert_eq!(resume.basics.email, "john@example.com");
        assert_eq!(resume.basics.phone, "+1-555-123-4567");
        assert_eq!(resume.basics.url.href, "https://johndoe.dev");

        // Verify location
        assert!(resume.basics.location.contains("San Francisco"));

        // Verify summary
        assert!(resume
            .sections
            .summary
            .content
            .contains("passionate software engineer"));

        // Verify profiles
        assert_eq!(resume.sections.profiles.items.len(), 1);
        assert_eq!(resume.sections.profiles.items[0].network, "GitHub");
        assert_eq!(resume.sections.profiles.items[0].username, "johndoe");
    }

    #[test]
    fn test_parse_full_json_resume() {
        let fixture_path = fixtures_path().join("json_resume").join("full.json");
        let data = fs::read(&fixture_path).expect("Failed to read full.json fixture");

        let parser = JsonResumeParser;
        let result = parser.parse(&data);

        assert!(
            result.is_ok(),
            "Failed to parse full.json: {:?}",
            result.err()
        );

        let resume = result.unwrap();

        // Verify basics
        assert_eq!(resume.basics.name, "Jane Smith");
        assert_eq!(resume.basics.headline, "Senior Software Engineer");
        assert_eq!(resume.basics.email, "jane@example.com");

        // Verify work experience
        assert_eq!(resume.sections.experience.items.len(), 2);
        assert_eq!(resume.sections.experience.items[0].company, "Tech Corp");
        assert_eq!(
            resume.sections.experience.items[0].position,
            "Senior Software Engineer"
        );
        assert!(resume.sections.experience.items[0]
            .summary
            .contains("microservices"));

        // Verify education
        assert_eq!(resume.sections.education.items.len(), 1);
        assert_eq!(resume.sections.education.items[0].institution, "MIT");
        assert_eq!(resume.sections.education.items[0].area, "Computer Science");
        assert_eq!(resume.sections.education.items[0].study_type, "Bachelor");

        // Verify skills
        assert_eq!(resume.sections.skills.items.len(), 2);
        assert_eq!(resume.sections.skills.items[0].name, "Backend Development");
        // JSON Resume uses string levels like "Expert" which are stored in description
        assert!(resume.sections.skills.items[0]
            .keywords
            .contains(&"Rust".to_string()));

        // Verify languages
        assert_eq!(resume.sections.languages.items.len(), 2);
        assert_eq!(resume.sections.languages.items[0].name, "English");
        assert_eq!(resume.sections.languages.items[0].level, 5); // Native

        // Verify projects
        assert_eq!(resume.sections.projects.items.len(), 1);
        assert_eq!(
            resume.sections.projects.items[0].name,
            "Open Source CLI Tool"
        );

        // Verify profiles
        assert_eq!(resume.sections.profiles.items.len(), 2);
    }

    #[test]
    fn test_json_resume_validation_errors() {
        // Test invalid JSON
        let parser = JsonResumeParser;
        let result = parser.parse(b"not valid json");
        assert!(result.is_err());

        // Empty JSON and minimal JSON are valid (parser is lenient)
        // The parser fills in defaults for missing fields
    }

    #[test]
    fn test_json_resume_date_formatting() {
        let json = r#"{
            "basics": {
                "name": "Test User",
                "label": "Developer",
                "email": "test@example.com"
            },
            "work": [
                {
                    "name": "Company",
                    "position": "Developer",
                    "startDate": "2020-01-15",
                    "endDate": "2023-06-30"
                }
            ]
        }"#;

        let parser = JsonResumeParser;
        let result = parser.parse(json.as_bytes());
        assert!(result.is_ok());

        let resume = result.unwrap();
        assert_eq!(resume.sections.experience.items.len(), 1);
        // Date should be formatted as "Jan 2020 - Jun 2023"
        assert!(resume.sections.experience.items[0].date.contains("2020"));
        assert!(resume.sections.experience.items[0].date.contains("2023"));
    }

    #[test]
    fn test_json_resume_with_all_sections() {
        let json = r#"{
            "basics": {
                "name": "Complete User",
                "label": "Full Stack Developer",
                "email": "complete@example.com",
                "summary": "A complete resume test."
            },
            "work": [{"name": "Work Co", "position": "Dev"}],
            "education": [{"institution": "University", "area": "CS"}],
            "skills": [{"name": "Rust", "level": "Expert"}],
            "languages": [{"language": "English", "fluency": "Native"}],
            "projects": [{"name": "Project", "description": "Desc"}],
            "awards": [{"title": "Award", "awarder": "Org"}],
            "certificates": [{"name": "Cert", "issuer": "Issuer"}],
            "publications": [{"name": "Paper", "publisher": "Journal"}],
            "volunteer": [{"organization": "Charity", "position": "Helper"}],
            "interests": [{"name": "Coding", "keywords": ["Open Source"]}],
            "references": [{"name": "Ref Person", "reference": "Great worker"}]
        }"#;

        let parser = JsonResumeParser;
        let result = parser.parse(json.as_bytes());
        assert!(result.is_ok(), "Failed: {:?}", result.err());

        let resume = result.unwrap();
        assert_eq!(resume.sections.experience.items.len(), 1);
        assert_eq!(resume.sections.education.items.len(), 1);
        assert_eq!(resume.sections.skills.items.len(), 1);
        assert_eq!(resume.sections.languages.items.len(), 1);
        assert_eq!(resume.sections.projects.items.len(), 1);
        assert_eq!(resume.sections.awards.items.len(), 1);
        assert_eq!(resume.sections.certifications.items.len(), 1);
        assert_eq!(resume.sections.publications.items.len(), 1);
        assert_eq!(resume.sections.volunteer.items.len(), 1);
        assert_eq!(resume.sections.interests.items.len(), 1);
        assert_eq!(resume.sections.references.items.len(), 1);
    }
}

// ============================================================================
// LinkedIn Parser Integration Tests
// ============================================================================

mod linkedin {
    use super::*;

    #[test]
    fn test_parse_linkedin_export() {
        let fixture_path = fixtures_path().join("linkedin").join("complete_export.zip");
        let data = fs::read(&fixture_path).expect("Failed to read LinkedIn ZIP fixture");

        let parser = LinkedInParser;
        let result = parser.parse(&data);

        assert!(
            result.is_ok(),
            "Failed to parse LinkedIn export: {:?}",
            result.err()
        );

        let resume = result.unwrap();

        // Verify basics from Profile.csv
        assert_eq!(resume.basics.name, "David Chen");
        assert_eq!(resume.basics.headline, "Senior Backend Engineer");
        assert!(resume.basics.location.contains("San Francisco"));
        assert!(resume
            .sections
            .summary
            .content
            .contains("distributed systems"));

        // Verify email
        assert_eq!(resume.basics.email, "david@example.com");

        // Verify experience from Positions.csv
        assert_eq!(resume.sections.experience.items.len(), 3);
        assert_eq!(resume.sections.experience.items[0].company, "Scale AI");
        assert_eq!(
            resume.sections.experience.items[0].position,
            "Senior Backend Engineer"
        );
        assert!(resume.sections.experience.items[0]
            .summary
            .contains("data processing"));

        // Verify education from Education.csv
        assert_eq!(resume.sections.education.items.len(), 2);
        assert_eq!(
            resume.sections.education.items[0].institution,
            "Stanford University"
        );
        assert_eq!(
            resume.sections.education.items[0].study_type,
            "Master of Science"
        );
        assert_eq!(resume.sections.education.items[0].area, "Computer Science");

        // Verify skills from Skills.csv - LinkedIn groups skills into a single entry
        assert!(!resume.sections.skills.items.is_empty());
        // Skills may be grouped or stored individually depending on parser implementation
        let all_keywords: Vec<&str> = resume
            .sections
            .skills
            .items
            .iter()
            .flat_map(|s| s.keywords.iter().map(|k| k.as_str()))
            .collect();
        let skill_names: Vec<&str> = resume
            .sections
            .skills
            .items
            .iter()
            .map(|s| s.name.as_str())
            .collect();
        // Check if skills are in either the name or keywords
        let has_python = skill_names.contains(&"Python") || all_keywords.contains(&"Python");
        let has_rust = skill_names.contains(&"Rust") || all_keywords.contains(&"Rust");
        assert!(
            has_python || has_rust,
            "Expected to find Python or Rust in skills"
        );

        // Verify languages from Languages.csv
        assert_eq!(resume.sections.languages.items.len(), 3);
        assert_eq!(resume.sections.languages.items[0].name, "English");
        assert_eq!(resume.sections.languages.items[0].level, 5); // Native

        // Verify certifications from Certifications.csv
        assert_eq!(resume.sections.certifications.items.len(), 2);
        assert_eq!(
            resume.sections.certifications.items[0].name,
            "Certified Kubernetes Administrator"
        );
        assert_eq!(resume.sections.certifications.items[0].issuer, "CNCF");

        // Verify projects from Projects.csv
        assert_eq!(resume.sections.projects.items.len(), 2);
        assert_eq!(
            resume.sections.projects.items[0].name,
            "Distributed Cache Library"
        );
    }

    #[test]
    fn test_linkedin_invalid_zip() {
        let parser = LinkedInParser;
        let result = parser.parse(b"not a zip file");
        assert!(result.is_err());
    }

    #[test]
    fn test_linkedin_empty_zip() {
        // Create an empty ZIP in memory
        let mut buffer = Vec::new();
        {
            let writer = std::io::Cursor::new(&mut buffer);
            let zip = zip::ZipWriter::new(writer);
            zip.finish().unwrap();
        }

        let parser = LinkedInParser;
        let result = parser.parse(&buffer);

        // Should succeed but with empty data
        assert!(result.is_ok());
        let resume = result.unwrap();
        assert!(resume.basics.name.is_empty() || resume.basics.name == "Unknown");
    }

    #[test]
    fn test_linkedin_proficiency_levels() {
        // Test different proficiency level mappings
        // Note: LinkedIn's "Full professional proficiency" maps to 5 due to matching "full professional"
        let proficiencies = vec![
            ("Native or bilingual proficiency", 5),
            ("Full professional proficiency", 5), // matches "full professional" -> 5
            ("Professional working proficiency", 4),
            ("Limited working proficiency", 3),
            ("Elementary proficiency", 2),
        ];

        for (proficiency, expected_level) in proficiencies {
            // Create a minimal ZIP with just languages
            let mut buffer = Vec::new();
            {
                let writer = std::io::Cursor::new(&mut buffer);
                let mut zip = zip::ZipWriter::new(writer);
                let options = zip::write::SimpleFileOptions::default();

                zip.start_file("Languages.csv", options).unwrap();
                use std::io::Write;
                writeln!(zip, "Name,Proficiency").unwrap();
                writeln!(zip, "Test Language,{}", proficiency).unwrap();
                zip.finish().unwrap();
            }

            let parser = LinkedInParser;
            let result = parser.parse(&buffer);
            assert!(result.is_ok(), "Failed for proficiency: {}", proficiency);

            let resume = result.unwrap();
            assert_eq!(resume.sections.languages.items.len(), 1);
            assert_eq!(
                resume.sections.languages.items[0].level, expected_level,
                "Wrong level for proficiency: {}",
                proficiency
            );
        }
    }
}

// ============================================================================
// Reactive Resume V3 Parser Integration Tests
// ============================================================================

mod reactive_resume_v3 {
    use super::*;

    #[test]
    fn test_parse_complete_v3_resume() {
        let fixture_path = fixtures_path().join("v3").join("complete.json");
        let data = fs::read(&fixture_path).expect("Failed to read complete.json fixture");

        let parser = ReactiveResumeV3Parser;
        let result = parser.parse(&data);

        assert!(
            result.is_ok(),
            "Failed to parse complete.json: {:?}",
            result.err()
        );

        let resume = result.unwrap();

        // Verify basics
        assert_eq!(resume.basics.name, "Alice Johnson");
        assert_eq!(resume.basics.headline, "Full Stack Developer");
        assert_eq!(resume.basics.email, "alice@example.com");
        assert_eq!(resume.basics.phone, "+1-555-234-5678");
        assert_eq!(resume.basics.location, "Seattle, WA");
        assert_eq!(resume.basics.url.href, "https://alicejohnson.dev");

        // Verify summary (object format)
        assert!(resume
            .sections
            .summary
            .content
            .contains("full-stack developer"));
        assert!(resume.sections.summary.visible);

        // Verify experience
        assert_eq!(resume.sections.experience.items.len(), 2);
        assert_eq!(
            resume.sections.experience.items[0].company,
            "Cloud Solutions Inc"
        );
        assert_eq!(
            resume.sections.experience.items[0].position,
            "Senior Full Stack Developer"
        );
        assert_eq!(resume.sections.experience.items[0].date, "2021 - Present");

        // Verify education
        assert_eq!(resume.sections.education.items.len(), 1);
        assert_eq!(
            resume.sections.education.items[0].institution,
            "University of Washington"
        );
        assert_eq!(resume.sections.education.items[0].area, "Computer Science");
        assert_eq!(
            resume.sections.education.items[0].study_type,
            "Bachelor of Science"
        );

        // Verify skills
        assert_eq!(resume.sections.skills.items.len(), 3);
        assert_eq!(resume.sections.skills.items[0].name, "TypeScript");
        assert_eq!(resume.sections.skills.items[0].level, 5);
        assert!(resume.sections.skills.items[0]
            .keywords
            .contains(&"React".to_string()));

        // Verify profiles (mixed URL formats)
        assert_eq!(resume.sections.profiles.items.len(), 2);
        assert_eq!(resume.sections.profiles.items[0].network, "GitHub");
        assert_eq!(
            resume.sections.profiles.items[0].url.href,
            "https://github.com/alicejohnson"
        );
        // Second profile uses string URL format
        assert_eq!(
            resume.sections.profiles.items[1].url.href,
            "https://linkedin.com/in/alicejohnson"
        );

        // Verify languages
        assert_eq!(resume.sections.languages.items.len(), 2);
        assert_eq!(resume.sections.languages.items[0].name, "English");
        assert_eq!(resume.sections.languages.items[0].level, 5);

        // Verify awards
        assert_eq!(resume.sections.awards.items.len(), 1);
        assert_eq!(
            resume.sections.awards.items[0].title,
            "Best Innovation Award"
        );

        // Verify certifications
        assert_eq!(resume.sections.certifications.items.len(), 1);
        assert_eq!(
            resume.sections.certifications.items[0].name,
            "AWS Solutions Architect Professional"
        );

        // Verify projects
        assert_eq!(resume.sections.projects.items.len(), 1);
        assert_eq!(resume.sections.projects.items[0].name, "DevTools CLI");

        // Verify publications
        assert_eq!(resume.sections.publications.items.len(), 1);
        assert_eq!(
            resume.sections.publications.items[0].name,
            "Scaling Microservices in the Cloud"
        );

        // Verify volunteer
        assert_eq!(resume.sections.volunteer.items.len(), 1);
        assert_eq!(
            resume.sections.volunteer.items[0].organization,
            "Code for Seattle"
        );

        // Verify references (marked as not visible)
        assert_eq!(resume.sections.references.items.len(), 1);
        assert!(!resume.sections.references.visible);

        // Verify metadata
        assert_eq!(resume.metadata.template, "rhyhorn");
    }

    #[test]
    fn test_parse_minimal_v3_resume() {
        let fixture_path = fixtures_path().join("v3").join("minimal.json");
        let data = fs::read(&fixture_path).expect("Failed to read minimal.json fixture");

        let parser = ReactiveResumeV3Parser;
        let result = parser.parse(&data);

        assert!(
            result.is_ok(),
            "Failed to parse minimal.json: {:?}",
            result.err()
        );

        let resume = result.unwrap();

        // Verify basics
        assert_eq!(resume.basics.name, "Bob Wilson");
        assert_eq!(resume.basics.headline, "Developer");
        assert_eq!(resume.basics.email, "bob@example.com");

        // All sections should be empty
        assert!(resume.sections.experience.items.is_empty());
        assert!(resume.sections.education.items.is_empty());
        assert!(resume.sections.skills.items.is_empty());
    }

    #[test]
    fn test_parse_v3_string_formats() {
        let fixture_path = fixtures_path().join("v3").join("string_formats.json");
        let data = fs::read(&fixture_path).expect("Failed to read string_formats.json fixture");

        let parser = ReactiveResumeV3Parser;
        let result = parser.parse(&data);

        assert!(
            result.is_ok(),
            "Failed to parse string_formats.json: {:?}",
            result.err()
        );

        let resume = result.unwrap();

        // Verify basics with string summary/url
        assert_eq!(resume.basics.name, "Carol Davis");
        assert_eq!(resume.basics.url.href, "https://caroldavis.io");
        assert!(resume.sections.summary.content.contains("backend systems"));

        // Verify experience with string URL
        assert_eq!(resume.sections.experience.items.len(), 1);
        assert_eq!(
            resume.sections.experience.items[0].url.href,
            "https://backendsystems.co"
        );

        // Verify certifications with string URL
        assert_eq!(
            resume.sections.certifications.items[0].url.href,
            "https://cncf.io/certification"
        );

        // Verify projects with string URL
        assert_eq!(
            resume.sections.projects.items[0].url.href,
            "https://github.com/caroldavis/api-gateway"
        );

        // Verify publications with string URL
        assert_eq!(
            resume.sections.publications.items[0].url.href,
            "https://dev.to/carol/resilient-apis"
        );

        // Verify profiles with string URL
        assert_eq!(
            resume.sections.profiles.items[0].url.href,
            "https://github.com/caroldavis"
        );

        // Verify metadata
        assert_eq!(resume.metadata.template, "gengar");
    }

    #[test]
    fn test_v3_invalid_json() {
        let parser = ReactiveResumeV3Parser;
        let result = parser.parse(b"not valid json");
        assert!(result.is_err());
    }

    #[test]
    fn test_v3_missing_basics() {
        let parser = ReactiveResumeV3Parser;
        let result = parser.parse(br#"{"id": "test", "sections": {}}"#);
        // Should handle missing basics gracefully and return a valid resume with defaults
        assert!(result.is_ok());
        if let Ok(resume) = result {
            // Verify defaults are applied when basics is missing
            assert!(resume.basics.name.is_empty());
        }
    }

    #[test]
    fn test_v3_empty_sections() {
        let json = r#"{
            "id": "empty-sections",
            "basics": {
                "name": "Empty Test",
                "headline": "Tester"
            },
            "sections": {}
        }"#;

        let parser = ReactiveResumeV3Parser;
        let result = parser.parse(json.as_bytes());
        assert!(result.is_ok());

        let resume = result.unwrap();
        assert_eq!(resume.basics.name, "Empty Test");
        assert!(resume.sections.experience.items.is_empty());
    }

    #[test]
    fn test_v3_visibility_handling() {
        let json = r#"{
            "id": "visibility-test",
            "basics": {
                "name": "Visibility Test",
                "headline": "Tester",
                "summary": {
                    "body": "Hidden summary",
                    "visible": false
                }
            },
            "sections": {
                "experience": {
                    "visible": false,
                    "items": [
                        {
                            "id": "exp-1",
                            "visible": false,
                            "company": "Hidden Company",
                            "position": "Secret Agent"
                        }
                    ]
                }
            }
        }"#;

        let parser = ReactiveResumeV3Parser;
        let result = parser.parse(json.as_bytes());
        assert!(result.is_ok());

        let resume = result.unwrap();
        // Summary visibility should be preserved
        assert!(!resume.sections.summary.visible);
        // Experience section visibility
        assert!(!resume.sections.experience.visible);
        // Individual item visibility
        assert!(!resume.sections.experience.items[0].visible);
    }
}

// ============================================================================
// Cross-Parser Tests
// ============================================================================

mod cross_parser {
    use super::*;
    use ::validator::Validate;

    #[test]
    #[allow(clippy::type_complexity)]
    fn test_all_parsers_produce_valid_resume_data() {
        let parsers_and_fixtures: Vec<(
            &str,
            Box<dyn Fn(&[u8]) -> Result<rustume_schema::ResumeData, _>>,
        )> = vec![
            (
                "json_resume/full.json",
                Box::new(|data| JsonResumeParser.parse(data)),
            ),
            (
                "linkedin/complete_export.zip",
                Box::new(|data| LinkedInParser.parse(data)),
            ),
            (
                "v3/complete.json",
                Box::new(|data| ReactiveResumeV3Parser.parse(data)),
            ),
        ];

        for (fixture, parser_fn) in parsers_and_fixtures {
            let fixture_path = fixtures_path().join(fixture);
            let data = fs::read(&fixture_path)
                .unwrap_or_else(|_| panic!("Failed to read fixture: {}", fixture));

            let result = parser_fn(&data);
            assert!(
                result.is_ok(),
                "Parser failed for {}: {:?}",
                fixture,
                result.err()
            );

            let resume = result.unwrap();

            // All parsed resumes should pass validation
            let validation = resume.validate();
            assert!(
                validation.is_ok(),
                "Validation failed for {}: {:?}",
                fixture,
                validation.err()
            );
        }
    }

    #[test]
    fn test_parsers_generate_unique_ids() {
        let fixture_path = fixtures_path().join("json_resume").join("full.json");
        let data = fs::read(&fixture_path).expect("Failed to read fixture");

        let parser = JsonResumeParser;
        let resume1 = parser.parse(&data).unwrap();
        let resume2 = parser.parse(&data).unwrap();

        // IDs should be unique between parses
        if !resume1.sections.experience.items.is_empty()
            && !resume2.sections.experience.items.is_empty()
        {
            assert_ne!(
                resume1.sections.experience.items[0].id, resume2.sections.experience.items[0].id,
                "Parser should generate unique IDs for each parse"
            );
        }
    }

    #[test]
    fn test_all_parsers_handle_special_characters() {
        // Test with unicode and special characters
        let json = r#"{
            "basics": {
                "name": "José García-López",
                "label": "Développeur & Ingénieur",
                "email": "jose@example.com",
                "summary": "Experience with: C++, C#, and SQL <queries>. Speaks: 日本語, 中文, العربية"
            }
        }"#;

        let parser = JsonResumeParser;
        let result = parser.parse(json.as_bytes());
        assert!(result.is_ok());

        let resume = result.unwrap();
        assert_eq!(resume.basics.name, "José García-López");
        assert!(resume.sections.summary.content.contains("日本語"));
    }
}
