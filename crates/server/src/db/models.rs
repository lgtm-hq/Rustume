//! Database row types and cloud API request/response DTOs.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

const DEFAULT_LIST_PAGE: u32 = 1;
const DEFAULT_LIST_PER_PAGE: u32 = 100;
const MAX_LIST_PER_PAGE: u32 = 100;

/// Pagination query parameters for resume list endpoints.
#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct ResumeListQuery {
    /// Page number (1-based).
    #[serde(default = "default_list_page")]
    pub page: u32,
    /// Page size (capped at 100).
    #[serde(default = "default_list_per_page")]
    pub per_page: u32,
}

fn default_list_page() -> u32 {
    DEFAULT_LIST_PAGE
}

fn default_list_per_page() -> u32 {
    DEFAULT_LIST_PER_PAGE
}

impl ResumeListQuery {
    /// Normalized pagination values with safe bounds.
    pub fn normalized(&self) -> (u32, u32, i64) {
        let page = self.page.max(1);
        let per_page = self.per_page.clamp(1, MAX_LIST_PER_PAGE);
        let offset = i64::from(page - 1) * i64::from(per_page);
        (page, per_page, offset)
    }
}

/// Paginated resume list response.
#[derive(Debug, Serialize, ToSchema)]
pub struct PaginatedResumeSummaries {
    pub items: Vec<ResumeSummary>,
    pub total: i64,
    pub page: u32,
    pub per_page: u32,
}

/// Failed import item within a batch response.
#[derive(Debug, Serialize, ToSchema)]
pub struct ImportFailure {
    #[schema(value_type = Option<String>, format = "uuid")]
    pub id: Option<Uuid>,
    pub error: String,
}

/// Import batch response with per-item failures.
#[derive(Debug, Serialize, ToSchema)]
pub struct ImportResumesResponse {
    pub imported: Vec<ResumeSummary>,
    pub failed: Vec<ImportFailure>,
}

/// Authenticated user record stored in PostgreSQL.
///
/// Privacy: account identity metadata is minimized — we store no email or name.
/// The only link to the authentication provider is the opaque `workos_id`.
/// Resume documents (stored separately) may contain sensitive personal data.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct User {
    /// Primary key.
    pub id: Uuid,
    /// WorkOS user identifier (`user_…`) — opaque, non-personal.
    pub workos_id: String,
    /// Hosted-service subscription status for billing (`free`, `pro`, `team`).
    /// Tracks Paddle subscription — not feature entitlements.
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
    pub data: Option<serde_json::Value>,
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
/// Privacy: returns only account ID and hosted-service subscription status.
/// Resume content is not included and may contain personal data when fetched separately.
#[derive(Debug, Serialize, ToSchema)]
pub struct AuthUserResponse {
    #[schema(value_type = String, format = "uuid")]
    pub id: Uuid,
    /// Hosted-service subscription status for billing — not feature entitlements.
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
