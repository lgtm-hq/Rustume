//! Shared helpers for database-backed integration tests.
//!
//! Tests are skipped unless `TEST_DATABASE_URL` (or `DATABASE_URL`) points at
//! a database whose name contains `_test`, matching the CI setup script.

use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;

use crate::encryption::EncryptionService;
use crate::storage::StorageState;

/// Return the test database URL, or `None` (with a skip notice) when unset.
pub(crate) fn database_url_for_tests() -> Option<String> {
    let url = std::env::var("TEST_DATABASE_URL")
        .ok()
        .map(|url| url.trim().to_owned())
        .filter(|url| !url.is_empty())
        .or_else(|| {
            std::env::var("DATABASE_URL")
                .ok()
                .map(|url| url.trim().to_owned())
                .filter(|url| !url.is_empty())
        })?;

    if looks_like_test_database_url(&url) {
        Some(url)
    } else {
        eprintln!(
            "SKIP DB integration tests: set TEST_DATABASE_URL (or DATABASE_URL) to a database \
             whose name contains _test"
        );
        None
    }
}

fn looks_like_test_database_url(url: &str) -> bool {
    let db_name = url
        .split(['?', '#'])
        .next()
        .unwrap_or(url)
        .rsplit('/')
        .next()
        .unwrap_or("");
    db_name.contains("_test")
}

/// Connect a small pool to the test database and apply migrations.
pub(crate) async fn connect_test_pool(database_url: &str) -> sqlx::PgPool {
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(database_url)
        .await
        .expect("connect to test database");
    sqlx::migrate!("./src/db/migrations")
        .run(&pool)
        .await
        .expect("run migrations for integration tests");
    pool
}

/// Build a storage state around an existing pool with a fixed test key.
pub(crate) fn storage_state(pool: sqlx::PgPool, encrypt_at_rest: bool) -> Arc<StorageState> {
    Arc::new(StorageState::new(
        pool,
        Some(EncryptionService::from_key(&[42u8; 32])),
        encrypt_at_rest,
    ))
}
