//! WorkOS AuthKit OAuth client and user persistence helpers.

use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

use crate::auth::username::generate_username;
use crate::db::User;

const WORKOS_API_BASE: &str = "https://api.workos.com";
const WORKOS_HTTP_TIMEOUT_SECS: u64 = 10;

/// HTTP client for WorkOS User Management API calls.
#[derive(Clone)]
pub struct WorkOsClient {
    http: Client,
    client_id: String,
    api_key: String,
}

impl WorkOsClient {
    /// Create a client with the given WorkOS application credentials.
    pub fn new(client_id: String, api_key: String) -> Self {
        Self {
            http: Client::new(),
            client_id,
            api_key,
        }
    }

    /// WorkOS client ID exposed for diagnostics and tests.
    pub fn client_id(&self) -> &str {
        &self.client_id
    }

    /// Build the AuthKit authorization URL for the OAuth redirect.
    pub fn authorize_url(&self, redirect_uri: &str, state: &str) -> String {
        format!(
            "{WORKOS_API_BASE}/user_management/authorize?response_type=code&client_id={}&redirect_uri={}&provider=authkit&state={}&prompt=login",
            urlencoding::encode(&self.client_id),
            urlencoding::encode(redirect_uri),
            urlencoding::encode(state),
        )
    }

    /// Exchange an authorization code for a WorkOS user profile.
    pub async fn authenticate_with_code(
        &self,
        code: &str,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<WorkOsUser, WorkOsAuthError> {
        let mut body = serde_json::json!({
            "client_id": self.client_id,
            "client_secret": self.api_key,
            "grant_type": "authorization_code",
            "code": code,
        });

        if let Some(ip) = ip_address {
            body["ip_address"] = ip.into();
        }
        if let Some(ua) = user_agent {
            body["user_agent"] = ua.into();
        }

        let response = self
            .http
            .post(format!("{WORKOS_API_BASE}/user_management/authenticate"))
            .json(&body)
            .timeout(Duration::from_secs(WORKOS_HTTP_TIMEOUT_SECS))
            .send()
            .await
            .map_err(|err| WorkOsAuthError::Transport(err.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|e| format!("failed to read response: {e}"));
            let body = if body.chars().count() > 200 {
                let truncated: String = body.chars().take(200).collect();
                format!("{truncated}… (truncated)")
            } else {
                body
            };
            return Err(WorkOsAuthError::Api {
                status: status.as_u16(),
                body,
            });
        }

        let payload: AuthenticateResponse = response
            .json()
            .await
            .map_err(|err| WorkOsAuthError::Transport(err.to_string()))?;

        Ok(payload.user)
    }

    /// Delete a WorkOS user by ID. Best-effort during account erasure.
    pub async fn delete_user(&self, workos_user_id: &str) -> Result<(), WorkOsAuthError> {
        let response = self
            .http
            .delete(format!(
                "{WORKOS_API_BASE}/user_management/users/{workos_user_id}"
            ))
            .bearer_auth(&self.api_key)
            .timeout(Duration::from_secs(WORKOS_HTTP_TIMEOUT_SECS))
            .send()
            .await
            .map_err(|err| WorkOsAuthError::Transport(err.to_string()))?;

        if response.status().is_success() || response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(());
        }

        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|e| format!("failed to read response: {e}"));
        let body = if body.chars().count() > 200 {
            let truncated: String = body.chars().take(200).collect();
            format!("{truncated}… (truncated)")
        } else {
            body
        };
        Err(WorkOsAuthError::Api {
            status: status.as_u16(),
            body,
        })
    }
}

#[derive(Debug, Deserialize)]
struct AuthenticateResponse {
    user: WorkOsUser,
}

/// Normalized WorkOS user returned after code exchange.
#[derive(Debug, Clone, Deserialize)]
pub struct WorkOsUser {
    pub id: String,
    pub email: String,
}

/// Errors returned when communicating with WorkOS.
#[derive(Debug, thiserror::Error)]
pub enum WorkOsAuthError {
    #[error("WorkOS request failed: {0}")]
    Transport(String),
    #[error("WorkOS API error ({status}): {body}")]
    Api { status: u16, body: String },
}

/// Result of inserting or updating a user from a WorkOS profile.
#[derive(Debug)]
pub struct UpsertUserResult {
    /// Persisted user row.
    pub user: User,
    /// Whether this callback created a new user row.
    pub is_new: bool,
}

#[derive(Debug, sqlx::FromRow)]
struct UpsertedUser {
    id: uuid::Uuid,
    workos_id: String,
    plan: String,
    paddle_customer_id: Option<String>,
    email: Option<String>,
    username: String,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
    is_new: bool,
}

/// Insert or update a user row from a WorkOS profile.
pub async fn upsert_user(
    pool: &sqlx::PgPool,
    workos_user: &WorkOsUser,
) -> Result<UpsertUserResult, sqlx::Error> {
    upsert_user_with_generator(pool, workos_user, generate_username).await
}

/// [`upsert_user`] with an injectable handle generator, so tests can force a
/// collision on a known handle and observe the retry.
async fn upsert_user_with_generator(
    pool: &sqlx::PgPool,
    workos_user: &WorkOsUser,
    mut next_username: impl FnMut() -> String,
) -> Result<UpsertUserResult, sqlx::Error> {
    const MAX_USERNAME_ATTEMPTS: u8 = 8;

    // Returning users are refreshed in place and never touch the username
    // column, so a generated handle cannot collide with the unique index on
    // their sign-in. Only genuinely new accounts go through generation.
    if let Some(existing) = refresh_existing_user(pool, workos_user).await? {
        return Ok(existing.into());
    }

    for _ in 0..MAX_USERNAME_ATTEMPTS {
        let username = next_username();
        match upsert_user_with_username(pool, workos_user, &username).await {
            Ok(upserted) => return Ok(upserted.into()),
            Err(err) if is_username_collision(&err) => continue,
            Err(err) => return Err(err),
        }
    }

    // Friendly handles are exhausted (astronomically unlikely). Fall back to a
    // random `user-xxxxxxxx` handle that satisfies the same validation rules,
    // retrying on collision rather than deriving it from the WorkOS id, whose
    // suffix is neither lowercase nor guaranteed unique.
    let mut last_err = None;
    for _ in 0..MAX_USERNAME_ATTEMPTS {
        let fallback = fallback_username();
        debug_assert!(crate::auth::username::validate_username(&fallback).is_ok());
        match upsert_user_with_username(pool, workos_user, &fallback).await {
            Ok(upserted) => return Ok(upserted.into()),
            Err(err) if is_username_collision(&err) => last_err = Some(err),
            Err(err) => return Err(err),
        }
    }
    Err(last_err.expect("at least one fallback attempt"))
}

/// Only a unique violation on the username index is worth retrying with a
/// new handle; any other 23505 (for example a duplicate email) is a real
/// failure and must surface immediately instead of burning retries.
fn is_username_collision(err: &sqlx::Error) -> bool {
    match err {
        sqlx::Error::Database(db_err) => {
            db_err.code().as_deref() == Some("23505")
                && db_err.constraint() == Some(USERNAME_UNIQUE_INDEX)
        }
        _ => false,
    }
}

/// Unique index created by migration 010. CONTRACT with the migration: the
/// index is defined over `COALESCE(username, replace(id::text, '-', ''))` and
/// its name is what `is_username_collision` matches on; renaming it there
/// without updating this constant would silently disable sign-up retries.
const USERNAME_UNIQUE_INDEX: &str = "idx_users_username_unique";

/// Random lowercase-hex fallback handle: `user-` plus eight hex characters.
fn fallback_username() -> String {
    let id = uuid::Uuid::new_v4();
    let hex = id.simple().to_string();
    format!("user-{}", &hex[..8])
}

impl From<UpsertedUser> for UpsertUserResult {
    fn from(upserted: UpsertedUser) -> Self {
        Self {
            user: User {
                id: upserted.id,
                workos_id: upserted.workos_id,
                plan: upserted.plan,
                paddle_customer_id: upserted.paddle_customer_id,
                email: upserted.email,
                username: upserted.username,
                created_at: upserted.created_at,
                updated_at: upserted.updated_at,
            },
            is_new: upserted.is_new,
        }
    }
}

/// Refresh a known user's email on sign-in. Returns `None` when this WorkOS
/// id has never been seen.
async fn refresh_existing_user(
    pool: &sqlx::PgPool,
    workos_user: &WorkOsUser,
) -> Result<Option<UpsertedUser>, sqlx::Error> {
    sqlx::query_as::<_, UpsertedUser>(
        r#"
        UPDATE users
        SET email = $2, updated_at = now()
        WHERE workos_id = $1
        RETURNING
            id,
            workos_id,
            plan,
            paddle_customer_id,
            email,
            -- CONTRACT: same fallback expression as the migration 010 backfill
            -- and the unique index; see auth/session.rs too.
            COALESCE(username, replace(id::text, '-', '')) AS username,
            created_at,
            updated_at,
            false AS is_new
        "#,
    )
    .bind(&workos_user.id)
    .bind(&workos_user.email)
    .fetch_optional(pool)
    .await
}

/// Insert a new user with the given generated username. `ON CONFLICT
/// (workos_id)` covers the race where two first sign-ins for the same WorkOS
/// id interleave: the loser refreshes the winner's row and keeps its handle.
async fn upsert_user_with_username(
    pool: &sqlx::PgPool,
    workos_user: &WorkOsUser,
    username: &str,
) -> Result<UpsertedUser, sqlx::Error> {
    sqlx::query_as::<_, UpsertedUser>(
        r#"
        INSERT INTO users (workos_id, plan, email, username)
        VALUES ($1, 'free', $2, $3)
        ON CONFLICT (workos_id) DO UPDATE
        SET
            email = EXCLUDED.email,
            updated_at = now()
        RETURNING
            id,
            workos_id,
            plan,
            paddle_customer_id,
            email,
            -- CONTRACT: same fallback expression as the migration 010 backfill
            -- and the unique index; see auth/session.rs too.
            COALESCE(username, replace(id::text, '-', '')) AS username,
            created_at,
            updated_at,
            (xmax = 0) AS is_new
        "#,
    )
    .bind(&workos_user.id)
    .bind(&workos_user.email)
    .bind(username)
    .fetch_one(pool)
    .await
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn only_username_unique_violations_are_retried_when_database_available() {
        let Some(url) = std::env::var("TEST_DATABASE_URL")
            .ok()
            .filter(|url| url.contains("_test"))
        else {
            if std::env::var("CI").is_ok() {
                panic!("workos integration test needs TEST_DATABASE_URL naming a *_test database");
            }
            eprintln!("SKIP workos integration test: TEST_DATABASE_URL not set");
            return;
        };
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(2)
            .connect(&url)
            .await
            .expect("connect");
        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .expect("migrate");

        let suffix = &uuid::Uuid::new_v4().simple().to_string()[..8];
        let taken = format!("taken-{suffix}");
        let existing_email = format!("existing-{suffix}@example.com");
        let existing_workos = format!("user_EXISTING{suffix}");
        sqlx::query("INSERT INTO users (workos_id, email, username) VALUES ($1, $2, $3)")
            .bind(&existing_workos)
            .bind(&existing_email)
            .bind(&taken)
            .execute(&pool)
            .await
            .expect("seed existing user");

        // Same handle, new WorkOS id: a username collision, retryable.
        let newcomer = super::WorkOsUser {
            id: format!("user_NEW{suffix}"),
            email: format!("new-{suffix}@example.com"),
        };
        let err = super::upsert_user_with_username(&pool, &newcomer, &taken)
            .await
            .expect_err("duplicate username must fail");
        assert!(super::is_username_collision(&err), "{err:?}");

        // Duplicate email, fresh handle: a different unique index, not retryable.
        let duplicate_email = super::WorkOsUser {
            id: format!("user_DUP{suffix}"),
            email: existing_email.clone(),
        };
        let err =
            super::upsert_user_with_username(&pool, &duplicate_email, &format!("free-{suffix}"))
                .await
                .expect_err("duplicate email must fail");
        assert!(!super::is_username_collision(&err), "{err:?}");

        // Through the public entry point the email conflict surfaces at once
        // rather than after the retry budget.
        let err = super::upsert_user(&pool, &duplicate_email)
            .await
            .expect_err("duplicate email must surface");
        assert!(matches!(err, sqlx::Error::Database(_)));

        // A returning user is refreshed without touching their handle.
        let returning = super::WorkOsUser {
            id: existing_workos.clone(),
            email: format!("renamed-{suffix}@example.com"),
        };
        let refreshed = super::upsert_user(&pool, &returning)
            .await
            .expect("returning user");
        assert!(!refreshed.is_new);
        assert_eq!(refreshed.user.username, taken);
        assert_eq!(
            refreshed.user.email.as_deref(),
            Some(returning.email.as_str())
        );

        // Retry path through the public flow: the generator first yields the
        // taken handle, then a free one; the free one must be stored.
        let free = format!("free-{suffix}");
        let mut attempts = 0usize;
        let candidates = [taken.clone(), free.clone()];
        let created = super::upsert_user_with_generator(&pool, &newcomer, || {
            let candidate = candidates[attempts.min(1)].clone();
            attempts += 1;
            candidate
        })
        .await
        .expect("new user after one collision");
        assert!(created.is_new);
        assert_eq!(created.user.username, free);
        assert_eq!(attempts, 2, "exactly one retry after the collision");

        sqlx::query("DELETE FROM users WHERE workos_id = ANY($1)")
            .bind(vec![existing_workos.clone(), newcomer.id.clone()])
            .execute(&pool)
            .await
            .expect("cleanup");
    }

    #[tokio::test]
    async fn legacy_rows_without_username_read_back_with_fallback_when_database_available() {
        let Some(url) = std::env::var("TEST_DATABASE_URL")
            .ok()
            .filter(|url| url.contains("_test"))
        else {
            if std::env::var("CI").is_ok() {
                panic!("workos integration test needs TEST_DATABASE_URL naming a *_test database");
            }
            eprintln!("SKIP workos integration test: TEST_DATABASE_URL not set");
            return;
        };
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(2)
            .connect(&url)
            .await
            .expect("connect");
        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .expect("migrate");

        // The expand-only migration keeps the legacy columns and leaves
        // username nullable, exactly what a mixed-binary rollout needs.
        let legacy_columns: Vec<String> = sqlx::query_scalar(
            r#"
            SELECT column_name::text FROM information_schema.columns
            WHERE table_name = 'users' AND column_name IN ('first_name', 'last_name')
            ORDER BY column_name
            "#,
        )
        .fetch_all(&pool)
        .await
        .expect("legacy columns");
        assert_eq!(legacy_columns, ["first_name", "last_name"]);
        let nullable: String = sqlx::query_scalar(
            "SELECT is_nullable::text FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username'",
        )
        .fetch_one(&pool)
        .await
        .expect("username nullability");
        assert_eq!(nullable, "YES");

        // The index name the retry logic matches on exists, is unique, and is
        // defined over the effective (coalesced) handle.
        let index_def: String = sqlx::query_scalar(
            "SELECT indexdef FROM pg_indexes WHERE tablename = 'users' AND indexname = $1",
        )
        .bind(super::USERNAME_UNIQUE_INDEX)
        .fetch_one(&pool)
        .await
        .expect("username unique index exists under the contracted name");
        assert!(index_def.starts_with("CREATE UNIQUE INDEX"), "{index_def}");
        assert!(index_def.contains("COALESCE(username"), "{index_def}");

        // A row written by a pre-username replica: no username at all.
        let suffix = &uuid::Uuid::new_v4().simple().to_string()[..8];
        let workos_id = format!("user_LEGACY{suffix}");
        let user_id: uuid::Uuid = sqlx::query_scalar(
            "INSERT INTO users (workos_id, email, first_name, last_name) VALUES ($1, $2, 'Ada', 'Lovelace') RETURNING id",
        )
        .bind(&workos_id)
        .bind(format!("legacy-{suffix}@example.com"))
        .fetch_one(&pool)
        .await
        .expect("insert legacy row");
        let expected_handle = user_id.simple().to_string();

        // Sign-in refresh and session lookup both read the backfill fallback.
        let refreshed = super::upsert_user(
            &pool,
            &super::WorkOsUser {
                id: workos_id.clone(),
                email: format!("legacy-{suffix}@example.com"),
            },
        )
        .await
        .expect("returning legacy user");
        assert!(!refreshed.is_new);
        assert_eq!(refreshed.user.username, expected_handle);
        assert_eq!(
            crate::auth::username::validate_username(&expected_handle),
            Ok(())
        );

        let sessions = crate::auth::session::SessionService::new(
            pool.clone(),
            "test-session-secret-at-least-32-chars".into(),
            false,
        );
        let (_, cookie) = sessions.create(user_id).await.expect("session");
        let via_session = sessions
            .user_for_token(cookie.value())
            .await
            .expect("lookup")
            .expect("user");
        assert_eq!(via_session.username, expected_handle);

        // Nobody else can take the legacy row's effective handle while its
        // stored username is still NULL: the expression index reserves it.
        let squatter = format!("user_SQUAT{suffix}");
        let err = sqlx::query("INSERT INTO users (workos_id, email, username) VALUES ($1, $2, $3)")
            .bind(&squatter)
            .bind(format!("squat-{suffix}@example.com"))
            .bind(&expected_handle)
            .execute(&pool)
            .await
            .expect_err("effective handle must be reserved");
        assert!(super::is_username_collision(&err), "{err:?}");

        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(user_id)
            .execute(&pool)
            .await
            .expect("cleanup");
    }

    #[test]
    fn fallback_username_is_valid_and_random() {
        let first = super::fallback_username();
        let second = super::fallback_username();
        assert!(first.starts_with("user-"));
        assert_eq!(first.len(), 13);
        assert_eq!(crate::auth::username::validate_username(&first), Ok(()));
        assert_ne!(first, second);
    }

    fn legacy_url_encode(value: &str) -> String {
        let mut encoded = String::with_capacity(value.len());
        for byte in value.bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(byte as char);
                }
                _ => encoded.push_str(&format!("%{byte:02X}")),
            }
        }
        encoded
    }

    #[test]
    fn urlencoding_matches_legacy_rfc3986_unreserved_set() {
        let cases = [
            ("client_123", "client_123"),
            ("redirect-uri.test~", "redirect-uri.test~"),
            ("space here", "space%20here"),
            ("a+b&c=d/e:h", "a%2Bb%26c%3Dd%2Fe%3Ah"),
            ("café", "caf%C3%A9"),
        ];

        for (input, expected) in cases {
            assert_eq!(legacy_url_encode(input), expected);
            assert_eq!(urlencoding::encode(input), expected);
        }
    }
}
