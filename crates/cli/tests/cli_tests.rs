use assert_cmd::Command;
use predicates::prelude::*;
use std::fs;
use std::path::PathBuf;
use tempfile::tempdir;

/// Returns the workspace root by navigating up from the CLI crate directory.
/// Path: crates/cli/ -> crates/ -> workspace root
fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("CLI crate should have parent directory")
        .parent()
        .expect("crates directory should have parent (workspace root)")
        .to_path_buf()
}

fn rustume_cmd() -> Command {
    let mut cmd = Command::cargo_bin("rustume").unwrap();
    cmd.current_dir(workspace_root());
    cmd
}

#[test]
fn test_help() {
    rustume_cmd()
        .arg("--help")
        .assert()
        .success()
        .stdout(predicate::str::contains("Rustume"))
        .stdout(predicate::str::contains("parse"))
        .stdout(predicate::str::contains("render"))
        .stdout(predicate::str::contains("templates"));
}

#[test]
fn test_templates_list() {
    rustume_cmd()
        .arg("templates")
        .assert()
        .success()
        .stdout(predicate::str::contains("rhyhorn"));
}

#[test]
fn test_templates_verbose() {
    rustume_cmd()
        .args(["templates", "--verbose"])
        .assert()
        .success()
        .stdout(predicate::str::contains("Background:"))
        .stdout(predicate::str::contains("Primary:"));
}

#[test]
fn test_init_default() {
    let dir = tempdir().unwrap();
    let output = dir.path().join("resume.json");

    rustume_cmd()
        .args(["init", "-o"])
        .arg(&output)
        .assert()
        .success();

    assert!(output.exists());
    let content = fs::read_to_string(&output).unwrap();
    assert!(content.contains("\"name\""));
}

#[test]
fn test_init_sample() {
    let dir = tempdir().unwrap();
    let output = dir.path().join("sample.json");

    rustume_cmd()
        .args(["init", "--sample", "-o"])
        .arg(&output)
        .assert()
        .success();

    let content = fs::read_to_string(&output).unwrap();
    assert!(content.contains("Jane Doe"));
    assert!(content.contains("Software Engineer"));
}

#[test]
fn test_validate_valid() {
    let dir = tempdir().unwrap();
    let resume_path = dir.path().join("test.json");

    // Create a valid resume first
    rustume_cmd()
        .args(["init", "--sample", "-o"])
        .arg(&resume_path)
        .assert()
        .success();

    // Validate it
    rustume_cmd()
        .arg("validate")
        .arg(&resume_path)
        .assert()
        .success()
        .stdout(predicate::str::contains("Valid resume"));
}

#[test]
fn test_validate_invalid_json() {
    let dir = tempdir().unwrap();
    let invalid = dir.path().join("invalid.json");
    fs::write(&invalid, "not valid json").unwrap();

    rustume_cmd()
        .arg("validate")
        .arg(&invalid)
        .assert()
        .failure()
        .stderr(predicate::str::contains("Failed to parse"));
}

#[test]
fn test_parse_json_resume() {
    rustume_cmd()
        .args(["parse", "tests/fixtures/json_resume/full.json"])
        .assert()
        .success()
        .stdout(predicate::str::contains("\"name\""))
        .stdout(predicate::str::contains("\"basics\""));
}

#[test]
fn test_parse_rrv3() {
    rustume_cmd()
        .args([
            "parse",
            "tests/fixtures/v3/complete.json",
            "--format",
            "rrv3",
        ])
        .assert()
        .success()
        .stdout(predicate::str::contains("\"name\""));
}

#[test]
fn test_parse_to_file() {
    let dir = tempdir().unwrap();
    let output = dir.path().join("parsed.json");

    rustume_cmd()
        .args(["parse", "tests/fixtures/json_resume/full.json", "-o"])
        .arg(&output)
        .assert()
        .success();

    assert!(output.exists());
    let content = fs::read_to_string(&output).unwrap();
    assert!(content.contains("\"basics\""));
}

#[test]
fn test_render_pdf() {
    let dir = tempdir().unwrap();
    let resume = dir.path().join("resume.json");
    let pdf = dir.path().join("output.pdf");

    // Create sample resume
    rustume_cmd()
        .args(["init", "--sample", "-o"])
        .arg(&resume)
        .assert()
        .success();

    // Render to PDF
    rustume_cmd()
        .args(["render"])
        .arg(&resume)
        .arg("-o")
        .arg(&pdf)
        .assert()
        .success();

    assert!(pdf.exists());
    let content = fs::read(&pdf).unwrap();
    // PDF magic bytes
    assert!(content.starts_with(b"%PDF"));
}

#[test]
fn test_preview_png() {
    let dir = tempdir().unwrap();
    let resume = dir.path().join("resume.json");
    let png = dir.path().join("preview.png");

    // Create sample resume
    rustume_cmd()
        .args(["init", "--sample", "-o"])
        .arg(&resume)
        .assert()
        .success();

    // Render preview
    rustume_cmd()
        .args(["preview"])
        .arg(&resume)
        .arg("-o")
        .arg(&png)
        .assert()
        .success();

    assert!(png.exists());
    let content = fs::read(&png).unwrap();
    // PNG magic bytes
    assert!(content.starts_with(&[0x89, 0x50, 0x4E, 0x47]));
}

#[test]
fn test_stdin_parse() {
    let fixture_path = workspace_root().join("tests/fixtures/json_resume/minimal.json");
    let input = std::fs::read_to_string(&fixture_path).unwrap();

    rustume_cmd()
        .args(["parse", "-"])
        .write_stdin(input)
        .assert()
        .success()
        .stdout(predicate::str::contains("\"basics\""));
}

#[test]
fn test_nonexistent_file() {
    rustume_cmd()
        .args(["parse", "does_not_exist.json"])
        .assert()
        .failure()
        .stderr(predicate::str::contains("Failed to read file"));
}

#[test]
fn test_parse_and_render_pipeline() {
    let dir = tempdir().unwrap();
    let parsed = dir.path().join("parsed.json");
    let pdf = dir.path().join("output.pdf");

    // Parse JSON Resume fixture to our format
    rustume_cmd()
        .args(["parse", "tests/fixtures/json_resume/full.json", "-o"])
        .arg(&parsed)
        .assert()
        .success();

    // Render the parsed resume to PDF
    rustume_cmd()
        .args(["render"])
        .arg(&parsed)
        .arg("-o")
        .arg(&pdf)
        .assert()
        .success();

    assert!(pdf.exists());
    let content = fs::read(&pdf).unwrap();
    assert!(content.starts_with(b"%PDF"));
}
