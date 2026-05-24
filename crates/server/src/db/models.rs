//! Database row types and cloud API request/response DTOs.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

/// Authenticated user record stored in PostgreSQL.
///
/// Privacy: we store NO personal information (no email, no name). The only
/// link to the authentication provider is the opaque `workos_id`.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct User {
    /// Primary key.
    pub id: Uuid,
    /// WorkOS user identifier (`user_…`) — opaque, non-personal.
    pub workos_id: String,
    /// Subscription tier (`free`, `pro`, `team`).
    pub plan: String,
    /// Paddle customer ID, set after first paid subscription.
    pub paddle_customer_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Server-side session row backing the `rustume_session` cookie.
#[derive(Debug, Clone, FromRow)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

/// Full resume row as stored in PostgreSQL.
#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct ResumeRow {
    #[schema(value_type = String, format = "uuid")]
    pub id: Uuid,
    #[schema(value_type = String, format = "uuid")]
    pub user_id: Uuid,
    pub title: String,
    #[schema(value_type = Object)]
    pub data: serde_json::Value,
    pub is_public: bool,
    pub public_slug: Option<String>,
    #[serde(skip_serializing)]
    pub password_hash: Option<String>,
    pub version: i32,
    #[schema(value_type = String, format = "date-time")]
    pub created_at: DateTime<Utc>,
    #[schema(value_type = String, format = "date-time")]
    pub updated_at: DateTime<Utc>,
}

/// Lightweight resume summary for list endpoints.
#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct ResumeSummary {
    #[schema(value_type = String, format = "uuid")]
    pub id: Uuid,
    pub title: String,
    #[schema(value_type = String, format = "date-time")]
    pub updated_at: DateTime<Utc>,
}

impl From<ResumeRow> for ResumeSummary {
    fn from(row: ResumeRow) -> Self {
        Self {
            id: row.id,
            title: row.title,
            updated_at: row.updated_at,
        }
    }
}

/// Request body for `POST /api/resumes`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateResumeRequest {
    #[schema(value_type = Option<String>, format = "uuid")]
    pub id: Option<Uuid>,
    pub title: Option<String>,
    #[schema(value_type = Object)]
    pub data: serde_json::Value,
}

/// Request body for `PUT /api/resumes/{id}`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateResumeRequest {
    pub title: Option<String>,
    #[schema(value_type = Object)]
    pub data: serde_json::Value,
}

/// Single resume payload within an import batch.
#[derive(Debug, Deserialize, ToSchema)]
pub struct ImportResumeItem {
    #[schema(value_type = Option<String>, format = "uuid")]
    pub id: Option<Uuid>,
    pub title: Option<String>,
    #[schema(value_type = Object)]
    pub data: serde_json::Value,
}

/// Request body for `POST /api/resumes/import`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct ImportResumesRequest {
    pub resumes: Vec<ImportResumeItem>,
}

/// Authenticated user profile returned by `GET /auth/me`.
///
/// Privacy: contains NO personal information — only account ID and plan tier.
#[derive(Debug, Serialize, ToSchema)]
pub struct AuthUserResponse {
    #[schema(value_type = String, format = "uuid")]
    pub id: Uuid,
    pub plan: String,
}

impl From<User> for AuthUserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            plan: user.plan,
        }
    }
}
