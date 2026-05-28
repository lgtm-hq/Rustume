//! WorkOS AuthKit OAuth client and user persistence helpers.

use reqwest::Client;
use serde::Deserialize;

use crate::db::User;

const WORKOS_API_BASE: &str = "https://api.workos.com";

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
            url_encode(&self.client_id),
            url_encode(redirect_uri),
            url_encode(state),
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
}

#[derive(Debug, Deserialize)]
struct AuthenticateResponse {
    user: WorkOsUser,
}

/// Normalized WorkOS user returned after code exchange.
///
/// We only use `id` to link the auth session; personal fields are deserialized
/// by serde but immediately discarded — never stored.
#[derive(Debug, Clone, Deserialize)]
pub struct WorkOsUser {
    pub id: String,
    #[allow(dead_code)]
    email: String,
    #[allow(dead_code)]
    first_name: Option<String>,
    #[allow(dead_code)]
    last_name: Option<String>,
}

/// Errors returned when communicating with WorkOS.
#[derive(Debug, thiserror::Error)]
pub enum WorkOsAuthError {
    #[error("WorkOS request failed: {0}")]
    Transport(String),
    #[error("WorkOS API error ({status}): {body}")]
    Api { status: u16, body: String },
}

/// Insert or update a user row from a WorkOS profile.
///
/// Privacy: we only persist the opaque `workos_id` — no email, name, or other PII.
pub async fn upsert_user(
    pool: &sqlx::PgPool,
    workos_user: &WorkOsUser,
) -> Result<User, sqlx::Error> {
    sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (workos_id, plan)
        VALUES ($1, 'free')
        ON CONFLICT (workos_id) DO UPDATE
        SET updated_at = now()
        RETURNING id, workos_id, plan, paddle_customer_id, created_at, updated_at
        "#,
    )
    .bind(&workos_user.id)
    .fetch_one(pool)
    .await
}

fn url_encode(value: &str) -> String {
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
