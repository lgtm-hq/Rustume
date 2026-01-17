//! Integration tests for the storage crate.
//!
//! These tests verify the storage backend implementations work correctly.

use rustume_schema::{Basics, Experience, ResumeData, Section};
use rustume_storage::{MemoryStorage, StorageBackend, StorageError};

/// Create a sample resume for testing.
fn sample_resume(name: &str) -> ResumeData {
    let mut resume = ResumeData::default();
    resume.basics = Basics::new(name)
        .with_headline("Software Engineer")
        .with_email(format!("{}@example.com", name.to_lowercase().replace(' ', ".")));

    resume.sections.experience = Section::new("experience", "Experience");
    resume.sections.experience.add_item(
        Experience::new("Test Company", "Developer")
            .with_date("2020 - Present")
            .with_summary("Building great software."),
    );

    resume
}

// ============================================================================
// MemoryStorage Tests
// ============================================================================

#[tokio::test]
async fn test_memory_storage_new() {
    let storage = MemoryStorage::new();
    let list = storage.list().await.unwrap();
    assert!(list.is_empty());
}

#[tokio::test]
async fn test_memory_storage_save_and_get() {
    let storage = MemoryStorage::new();
    let resume = sample_resume("John Doe");

    // Save
    storage.save("test-id", &resume).await.unwrap();

    // Get
    let loaded = storage.get("test-id").await.unwrap();
    assert_eq!(loaded.basics.name, "John Doe");
    assert_eq!(loaded.basics.email, "john.doe@example.com");
}

#[tokio::test]
async fn test_memory_storage_list() {
    let storage = MemoryStorage::new();

    storage.save("id-1", &sample_resume("User 1")).await.unwrap();
    storage.save("id-2", &sample_resume("User 2")).await.unwrap();
    storage.save("id-3", &sample_resume("User 3")).await.unwrap();

    let list = storage.list().await.unwrap();
    assert_eq!(list.len(), 3);
    assert!(list.contains(&"id-1".to_string()));
    assert!(list.contains(&"id-2".to_string()));
    assert!(list.contains(&"id-3".to_string()));
}

#[tokio::test]
async fn test_memory_storage_update() {
    let storage = MemoryStorage::new();

    // Save initial
    storage.save("test-id", &sample_resume("Initial")).await.unwrap();

    // Update (save again with same ID)
    storage.save("test-id", &sample_resume("Updated")).await.unwrap();

    // Verify update
    let loaded = storage.get("test-id").await.unwrap();
    assert_eq!(loaded.basics.name, "Updated");
}

#[tokio::test]
async fn test_memory_storage_delete() {
    let storage = MemoryStorage::new();

    storage.save("to-delete", &sample_resume("Delete Me")).await.unwrap();
    assert!(storage.exists("to-delete").await.unwrap());

    storage.delete("to-delete").await.unwrap();
    assert!(!storage.exists("to-delete").await.unwrap());
}

#[tokio::test]
async fn test_memory_storage_delete_not_found() {
    let storage = MemoryStorage::new();

    let result = storage.delete("nonexistent").await;
    assert!(matches!(result, Err(StorageError::NotFound(_))));
}

#[tokio::test]
async fn test_memory_storage_get_not_found() {
    let storage = MemoryStorage::new();

    let result = storage.get("nonexistent").await;
    assert!(matches!(result, Err(StorageError::NotFound(_))));
}

#[tokio::test]
async fn test_memory_storage_exists() {
    let storage = MemoryStorage::new();

    assert!(!storage.exists("test-id").await.unwrap());

    storage.save("test-id", &sample_resume("Test")).await.unwrap();
    assert!(storage.exists("test-id").await.unwrap());
}

#[tokio::test]
async fn test_memory_storage_multiple_operations() {
    let storage = MemoryStorage::new();

    // Create multiple resumes
    for i in 0..5 {
        storage
            .save(&format!("resume-{}", i), &sample_resume(&format!("User {}", i)))
            .await
            .unwrap();
    }

    // Verify all exist
    for i in 0..5 {
        assert!(storage.exists(&format!("resume-{}", i)).await.unwrap());
    }

    // Delete some
    storage.delete("resume-1").await.unwrap();
    storage.delete("resume-3").await.unwrap();

    // Verify deletions
    assert!(!storage.exists("resume-1").await.unwrap());
    assert!(storage.exists("resume-2").await.unwrap());
    assert!(!storage.exists("resume-3").await.unwrap());

    // Update one
    let mut updated = sample_resume("Updated User 2");
    updated.sections.summary.content = "Updated summary".to_string();
    storage.save("resume-2", &updated).await.unwrap();

    // Verify update
    let loaded = storage.get("resume-2").await.unwrap();
    assert_eq!(loaded.sections.summary.content, "Updated summary");

    // List remaining
    let list = storage.list().await.unwrap();
    assert_eq!(list.len(), 3);
}

#[tokio::test]
async fn test_memory_storage_preserves_full_resume_data() {
    let storage = MemoryStorage::new();

    let mut resume = sample_resume("Full Test");
    resume.sections.summary.content = "This is a detailed summary.".to_string();
    resume.metadata.template = "rhyhorn".to_string();

    storage.save("full-test", &resume).await.unwrap();

    let loaded = storage.get("full-test").await.unwrap();

    // Verify all data is preserved
    assert_eq!(loaded.basics.name, resume.basics.name);
    assert_eq!(loaded.basics.headline, resume.basics.headline);
    assert_eq!(loaded.basics.email, resume.basics.email);
    assert_eq!(loaded.sections.summary.content, resume.sections.summary.content);
    assert_eq!(loaded.metadata.template, resume.metadata.template);
    assert_eq!(
        loaded.sections.experience.items.len(),
        resume.sections.experience.items.len()
    );
}
