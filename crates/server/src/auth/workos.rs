//! WorkOS AuthKit OAuth client and user persistence helpers.

use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

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
    pub first_name: Option<String>,
    pub last_name: Option<String>,
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

/// Insert or update a user row from a WorkOS profile.
pub async fn upsert_user(
    pool: &sqlx::PgPool,
    workos_user: &WorkOsUser,
) -> Result<UpsertUserResult, sqlx::Error> {
    let existing = sqlx::query_scalar::<_, uuid::Uuid>("SELECT id FROM users WHERE workos_id = $1")
        .bind(&workos_user.id)
        .fetch_optional(pool)
        .await?;

    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (workos_id, plan, email, first_name, last_name)
        VALUES ($1, 'free', $2, $3, $4)
        ON CONFLICT (workos_id) DO UPDATE
        SET
            email = EXCLUDED.email,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            updated_at = now()
        RETURNING
            id,
            workos_id,
            plan,
            paddle_customer_id,
            email,
            first_name,
            last_name,
            created_at,
            updated_at
        "#,
    )
    .bind(&workos_user.id)
    .bind(&workos_user.email)
    .bind(&workos_user.first_name)
    .bind(&workos_user.last_name)
    .fetch_one(pool)
    .await?;

    Ok(UpsertUserResult {
        user,
        is_new: existing.is_none(),
    })
}

#[cfg(test)]
mod tests {
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
