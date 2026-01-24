//! Rustume CLI - Command-line interface for resume building.
//!
//! # Usage
//!
//! ```bash
//! # Parse various formats to Rustume JSON
//! rustume parse resume.json --format json-resume
//! rustume parse linkedin-export.zip --format linkedin
//!
//! # Render resume to PDF
//! rustume render resume.json -o resume.pdf
//!
//! # Preview resume as PNG
//! rustume preview resume.json -o preview.png
//!
//! # List available templates
//! rustume templates
//!
//! # Validate resume data
//! rustume validate resume.json
//!
//! # Create new empty resume
//! rustume init -o my-resume.json
//! ```

use anyhow::{anyhow, Context, Result};
use clap::{Parser, Subcommand, ValueEnum};
use rustume_parser::{JsonResumeParser, LinkedInParser, Parser as ResumeParser, ReactiveResumeV3Parser};
use rustume_render::{get_template_theme, Renderer, TypstRenderer, TEMPLATES};
use rustume_schema::ResumeData;
use std::fs;
use std::io::{self, Read, Write};
use std::path::PathBuf;
use validator::Validate;

/// Rustume - A modern resume builder
#[derive(Parser)]
#[command(name = "rustume")]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Parse a resume file into Rustume format
    Parse {
        /// Input file path (use '-' for stdin)
        input: String,

        /// Input format (auto-detected if not specified)
        #[arg(short, long)]
        format: Option<InputFormat>,

        /// Output file path (defaults to stdout)
        #[arg(short, long)]
        output: Option<PathBuf>,

        /// Pretty print JSON output
        #[arg(long, default_value = "true")]
        pretty: bool,
    },

    /// Render a resume to PDF
    Render {
        /// Input resume JSON file (use '-' for stdin)
        input: String,

        /// Template to use (overrides metadata.template if specified)
        #[arg(short, long)]
        template: Option<String>,

        /// Output PDF file path
        #[arg(short, long)]
        output: Option<PathBuf>,
    },

    /// Generate a PNG preview of a resume page
    Preview {
        /// Input resume JSON file (use '-' for stdin)
        input: String,

        /// Page number to preview (0-indexed)
        #[arg(short, long, default_value = "0")]
        page: usize,

        /// Template to use (overrides metadata.template if specified)
        #[arg(short, long)]
        template: Option<String>,

        /// Output PNG file path
        #[arg(short, long)]
        output: Option<PathBuf>,
    },

    /// List available templates
    Templates {
        /// Show detailed information including theme colors
        #[arg(short, long)]
        verbose: bool,
    },

    /// Validate a resume file
    Validate {
        /// Input resume JSON file (use '-' for stdin)
        input: String,
    },

    /// Create a new empty resume
    Init {
        /// Output file path
        #[arg(short, long)]
        output: Option<PathBuf>,

        /// Pre-fill with sample data
        #[arg(long)]
        sample: bool,
    },
}

#[derive(Clone, ValueEnum)]
enum InputFormat {
    /// JSON Resume format
    JsonResume,
    /// LinkedIn data export (ZIP)
    LinkedIn,
    /// Reactive Resume v3 format
    Rrv3,
    /// Native Rustume format
    Rustume,
}

fn main() {
    if let Err(e) = run() {
        eprintln!("Error: {e:#}");
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Parse { input, format, output, pretty } => {
            cmd_parse(&input, format, output, pretty)
        }
        Commands::Render { input, template, output } => {
            cmd_render(&input, template.as_deref(), output)
        }
        Commands::Preview { input, page, template, output } => {
            cmd_preview(&input, page, template.as_deref(), output)
        }
        Commands::Templates { verbose } => {
            cmd_templates(verbose)
        }
        Commands::Validate { input } => {
            cmd_validate(&input)
        }
        Commands::Init { output, sample } => {
            cmd_init(output, sample)
        }
    }
}

/// Read input from file or stdin
fn read_input(path: &str) -> Result<Vec<u8>> {
    if path == "-" {
        let mut buffer = Vec::new();
        io::stdin()
            .read_to_end(&mut buffer)
            .context("Failed to read from stdin")?;
        Ok(buffer)
    } else {
        fs::read(path).with_context(|| format!("Failed to read file: {}", path))
    }
}

/// Write output to file or stdout
fn write_output(data: &[u8], path: Option<PathBuf>) -> Result<()> {
    match path {
        Some(p) => {
            fs::write(&p, data).with_context(|| format!("Failed to write to: {}", p.display()))?;
            eprintln!("Wrote: {}", p.display());
        }
        None => {
            io::stdout()
                .write_all(data)
                .context("Failed to write to stdout")?;
        }
    }
    Ok(())
}

/// Detect input format from file extension or content
fn detect_format(path: &str, data: &[u8]) -> Result<InputFormat> {
    // Check file extension first
    if path.ends_with(".zip") {
        return Ok(InputFormat::LinkedIn);
    }

    // Try to parse as JSON and detect format
    if let Ok(text) = std::str::from_utf8(data) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(text) {
            // Reactive Resume v3 has specific structure
            if json.get("sections").is_some() && json.get("metadata").is_some() {
                return Ok(InputFormat::Rrv3);
            }
            // JSON Resume has "basics" with "label" (not "headline")
            if let Some(basics) = json.get("basics") {
                if basics.get("label").is_some() {
                    return Ok(InputFormat::JsonResume);
                }
                // Native Rustume has "headline" instead of "label"
                if basics.get("headline").is_some() {
                    return Ok(InputFormat::Rustume);
                }
            }
            // Default to JSON Resume for other JSON
            return Ok(InputFormat::JsonResume);
        }
    }

    Err(anyhow!("Could not detect input format. Please specify --format"))
}

/// Parse command
fn cmd_parse(input: &str, format: Option<InputFormat>, output: Option<PathBuf>, pretty: bool) -> Result<()> {
    let data = read_input(input)?;

    let format = match format {
        Some(f) => f,
        None => detect_format(input, &data)?,
    };

    let resume = match format {
        InputFormat::JsonResume => {
            JsonResumeParser.parse(&data).context("Failed to parse JSON Resume")?
        }
        InputFormat::LinkedIn => {
            LinkedInParser.parse(&data).context("Failed to parse LinkedIn export")?
        }
        InputFormat::Rrv3 => {
            ReactiveResumeV3Parser.parse(&data).context("Failed to parse Reactive Resume v3")?
        }
        InputFormat::Rustume => {
            serde_json::from_slice(&data).context("Failed to parse Rustume JSON")?
        }
    };

    let json = if pretty {
        serde_json::to_string_pretty(&resume)?
    } else {
        serde_json::to_string(&resume)?
    };

    write_output(json.as_bytes(), output)?;
    Ok(())
}

/// Render command
fn cmd_render(input: &str, template: Option<&str>, output: Option<PathBuf>) -> Result<()> {
    let data = read_input(input)?;
    let mut resume: ResumeData = serde_json::from_slice(&data).context("Failed to parse resume JSON")?;

    // Override template only if explicitly specified
    if let Some(t) = template {
        resume.metadata.template = t.to_string();
    }

    // Validate before rendering
    resume.validate().context("Resume validation failed")?;

    let renderer = TypstRenderer::new();
    let pdf = renderer.render_pdf(&resume).context("Failed to render PDF")?;

    let output = output.unwrap_or_else(|| PathBuf::from("resume.pdf"));
    write_output(&pdf, Some(output))?;

    Ok(())
}

/// Preview command
fn cmd_preview(input: &str, page: usize, template: Option<&str>, output: Option<PathBuf>) -> Result<()> {
    let data = read_input(input)?;
    let mut resume: ResumeData = serde_json::from_slice(&data).context("Failed to parse resume JSON")?;

    // Override template only if explicitly specified
    if let Some(t) = template {
        resume.metadata.template = t.to_string();
    }

    // Validate before rendering
    resume.validate().context("Resume validation failed")?;

    let renderer = TypstRenderer::new();
    let png = renderer.render_preview(&resume, page).context("Failed to render preview")?;

    let output = output.unwrap_or_else(|| PathBuf::from("preview.png"));
    write_output(&png, Some(output))?;

    Ok(())
}

/// Templates command
fn cmd_templates(verbose: bool) -> Result<()> {
    if verbose {
        println!("Available templates:\n");
        for name in TEMPLATES {
            let theme = get_template_theme(name);
            println!("  {}", name);
            println!("    Background: {}", theme.background);
            println!("    Text:       {}", theme.text);
            println!("    Primary:    {}", theme.primary);
            println!();
        }
    } else {
        for name in TEMPLATES {
            println!("{}", name);
        }
    }
    Ok(())
}

/// Validate command
fn cmd_validate(input: &str) -> Result<()> {
    let data = read_input(input)?;
    let resume: ResumeData = serde_json::from_slice(&data).context("Failed to parse resume JSON")?;

    match resume.validate() {
        Ok(_) => {
            println!("Valid resume");
            Ok(())
        }
        Err(errors) => {
            eprintln!("Validation errors:");
            for (field, errs) in errors.field_errors() {
                for err in errs {
                    let message = err
                        .message
                        .as_ref()
                        .map(|s| s.as_ref())
                        .unwrap_or("validation failed");
                    eprintln!("  {}: {}", field, message);
                }
            }
            Err(anyhow!("Resume validation failed"))
        }
    }
}

/// Init command
#[allow(clippy::field_reassign_with_default)]
fn cmd_init(output: Option<PathBuf>, sample: bool) -> Result<()> {
    use rustume_schema::{Basics, Education, Experience, Section, Skill};

    let resume = if sample {
        let mut resume = ResumeData::default();
        resume.basics = Basics::new("Jane Doe")
            .with_headline("Software Engineer")
            .with_email("jane@example.com")
            .with_phone("+1-555-123-4567")
            .with_location("San Francisco, CA")
            .with_url("https://janedoe.dev");

        resume.sections.summary.content =
            "Passionate software engineer with 5+ years of experience building web applications."
                .to_string();

        resume.sections.experience = Section::new("experience", "Experience");
        resume.sections.experience.add_item(
            Experience::new("Acme Corp", "Senior Software Engineer")
                .with_location("San Francisco, CA")
                .with_date("2020 - Present")
                .with_summary("Led development of customer-facing features."),
        );

        resume.sections.education = Section::new("education", "Education");
        resume.sections.education.add_item(
            Education::new("University of Technology", "Computer Science")
                .with_study_type("Bachelor of Science")
                .with_date("2012 - 2016"),
        );

        resume.sections.skills = Section::new("skills", "Skills");
        resume.sections.skills.add_item(Skill::new("Rust").with_level(4));
        resume.sections.skills.add_item(Skill::new("TypeScript").with_level(5));
        resume.sections.skills.add_item(Skill::new("Python").with_level(4));

        resume
    } else {
        ResumeData::default()
    };

    let json = serde_json::to_string_pretty(&resume)?;
    let output = output.unwrap_or_else(|| PathBuf::from("resume.json"));
    write_output(json.as_bytes(), Some(output))?;

    Ok(())
}
