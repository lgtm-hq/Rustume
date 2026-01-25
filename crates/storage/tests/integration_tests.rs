//! Integration tests for the storage crate.
//!
//! These tests verify the storage backend implementations work correctly.

use rustume_schema::{Basics, Experience, ResumeData, Section};
use rustume_storage::{MemoryStorage, StorageBackend, StorageError};

/// Create a sample resume for testing.
#[allow(clippy::field_reassign_with_default)]
fn sample_resume(name: &str) -> ResumeData {
    let mut resume = ResumeData::default();
    resume.basics = Basics::new(name)
        .with_headline("Software Engineer")
        .with_email(format!(
            "{}@example.com",
            name.to_lowercase().replace(' ', ".")
        ));

    resume.sections.experience = Section::new("experience", "Experience");
    resume.sections.experience.add_item(
        Experience::new("Test Company", "Developer")
            .with_date("2020 - Present")
            .with_summary("Building great software."),
    );

    resume
}

/// Create a sample resume with an index for concurrent testing.
#[allow(clippy::field_reassign_with_default)]
fn sample_resume_indexed(index: usize) -> ResumeData {
    let name = format!("User {}", index);
    sample_resume(&name)
}

// ============================================================================
// MemoryStorage Tests
// ============================================================================

#[tokio::test(flavor = "current_thread")]
async fn test_memory_storage_new() {
    let storage = MemoryStorage::new();
    let list = storage.list().await.unwrap();
    assert!(list.is_empty());
}

#[tokio::test(flavor = "current_thread")]
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

#[tokio::test(flavor = "current_thread")]
async fn test_memory_storage_list() {
    let storage = MemoryStorage::new();

    storage
        .save("id-1", &sample_resume("User 1"))
        .await
        .unwrap();
    storage
        .save("id-2", &sample_resume("User 2"))
        .await
        .unwrap();
    storage
        .save("id-3", &sample_resume("User 3"))
        .await
        .unwrap();

    let list = storage.list().await.unwrap();
    assert_eq!(list.len(), 3);
    assert!(list.contains(&"id-1".to_string()));
    assert!(list.contains(&"id-2".to_string()));
    assert!(list.contains(&"id-3".to_string()));
}

#[tokio::test(flavor = "current_thread")]
async fn test_memory_storage_update() {
    let storage = MemoryStorage::new();

    // Save initial
    storage
        .save("test-id", &sample_resume("Initial"))
        .await
        .unwrap();

    // Update (save again with same ID)
    storage
        .save("test-id", &sample_resume("Updated"))
        .await
        .unwrap();

    // Verify update
    let loaded = storage.get("test-id").await.unwrap();
    assert_eq!(loaded.basics.name, "Updated");
}

#[tokio::test(flavor = "current_thread")]
async fn test_memory_storage_delete() {
    let storage = MemoryStorage::new();

    storage
        .save("to-delete", &sample_resume("Delete Me"))
        .await
        .unwrap();
    assert!(storage.exists("to-delete").await.unwrap());

    storage.delete("to-delete").await.unwrap();
    assert!(!storage.exists("to-delete").await.unwrap());
}

#[tokio::test(flavor = "current_thread")]
async fn test_memory_storage_delete_not_found() {
    let storage = MemoryStorage::new();

    let result = storage.delete("nonexistent").await;
    assert!(matches!(result, Err(StorageError::NotFound(_))));
}

#[tokio::test(flavor = "current_thread")]
async fn test_memory_storage_get_not_found() {
    let storage = MemoryStorage::new();

    let result = storage.get("nonexistent").await;
    assert!(matches!(result, Err(StorageError::NotFound(_))));
}

#[tokio::test(flavor = "current_thread")]
async fn test_memory_storage_exists() {
    let storage = MemoryStorage::new();

    assert!(!storage.exists("test-id").await.unwrap());

    storage
        .save("test-id", &sample_resume("Test"))
        .await
        .unwrap();
    assert!(storage.exists("test-id").await.unwrap());
}

#[tokio::test(flavor = "current_thread")]
async fn test_memory_storage_multiple_operations() {
    let storage = MemoryStorage::new();

    // Create multiple resumes
    for i in 0..5 {
        storage
            .save(
                &format!("resume-{}", i),
                &sample_resume(&format!("User {}", i)),
            )
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

#[tokio::test(flavor = "current_thread")]
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
    assert_eq!(
        loaded.sections.summary.content,
        resume.sections.summary.content
    );
    assert_eq!(loaded.metadata.template, resume.metadata.template);
    assert_eq!(
        loaded.sections.experience.items.len(),
        resume.sections.experience.items.len()
    );
}

// ============================================================================
// Concurrency Tests
// ============================================================================
//
// Note: These tests verify concurrent access patterns work correctly.
// Since the storage trait returns non-Send futures (due to async_trait),
// we test concurrency by rapidly interleaving operations rather than
// using tokio::spawn across threads.

#[tokio::test(flavor = "current_thread")]
async fn test_rapid_sequential_save_operations() {
    let storage = MemoryStorage::new();

    // Rapidly save many items
    for i in 0..100 {
        storage
            .save(&format!("id-{}", i), &sample_resume_indexed(i))
            .await
            .unwrap();
    }

    let list = storage.list().await.unwrap();
    assert_eq!(list.len(), 100);

    // Verify all items are accessible
    for i in 0..100 {
        let loaded = storage.get(&format!("id-{}", i)).await.unwrap();
        assert_eq!(loaded.basics.name, format!("User {}", i));
    }
}

#[tokio::test(flavor = "current_thread")]
async fn test_interleaved_read_write() {
    let storage = MemoryStorage::new();

    // Pre-populate with some data
    for i in 0..10 {
        storage
            .save(&format!("resume-{}", i), &sample_resume_indexed(i))
            .await
            .unwrap();
    }

    // Interleave reads and writes
    for i in 10..50 {
        // Write
        storage
            .save(&format!("resume-{}", i), &sample_resume_indexed(i))
            .await
            .unwrap();

        // Read an earlier item
        let read_idx = i % 10;
        let loaded = storage.get(&format!("resume-{}", read_idx)).await.unwrap();
        assert_eq!(loaded.basics.name, format!("User {}", read_idx));
    }

    // Verify final state
    let list = storage.list().await.unwrap();
    assert_eq!(list.len(), 50);
}

#[tokio::test(flavor = "current_thread")]
async fn test_rapid_update_same_key() {
    let storage = MemoryStorage::new();

    // Initial save
    storage
        .save("shared-key", &sample_resume_indexed(0))
        .await
        .unwrap();

    // Rapidly update the same key many times
    for i in 1..=100 {
        storage
            .save("shared-key", &sample_resume_indexed(i))
            .await
            .unwrap();
    }

    // Key should exist and have the final value
    let loaded = storage.get("shared-key").await.unwrap();
    assert_eq!(loaded.basics.name, "User 100");
}

#[tokio::test(flavor = "current_thread")]
async fn test_interleaved_save_delete() {
    let storage = MemoryStorage::new();

    // Create and delete items interleaved
    for i in 0..50 {
        storage
            .save(&format!("item-{}", i), &sample_resume_indexed(i))
            .await
            .unwrap();

        // Delete every other item
        if i > 0 && i % 2 == 0 {
            storage.delete(&format!("item-{}", i - 1)).await.unwrap();
        }
    }

    // After interleaved saves and deletes, we should have exactly 26 items:
    // Saved 0-49, deleted odd indices 1,3,5,...,49 = 25 deletions, leaving 25 items
    // Wait, let's trace: save(0), save(1), del(0)?, save(2), del(1), ...
    // Actually: i=0 save, i=1 save (no del), i=2 save + del(1), i=3 save (no del), i=4 save + del(3), ...
    // Deletions happen at i=2,4,6,...,48 deleting items 1,3,5,...,47 = 24 deletions
    // 50 saves - 24 deletions = 26 remaining
    let list = storage.list().await.unwrap();
    assert_eq!(list.len(), 26);
}
