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
/// Profile fields (`email`, `first_name`, `last_name`) are synced from WorkOS
/// on each sign-in. WorkOS requires an email for every user and may receive
/// name fields from the identity provider (Google, GitHub, SSO, etc.).
/// Rustume stores these so the account UI can greet the user by name.
///
/// Resume documents (stored separately) may contain additional personal data.
#[derive(Debug, Clone, FromRow, Serialize)]
pub struct User {
    /// Primary key.
    pub id: Uuid,
    /// WorkOS user identifier (`user_…`).
    pub workos_id: String,
    /// Hosted-service subscription status for billing (`free`, `pro`, `team`).
    pub plan: String,
    /// Paddle customer ID, set after first paid subscription.
    pub paddle_customer_id: Option<String>,
    /// Account email synced from WorkOS on sign-in.
    pub email: Option<String>,
    /// Given name synced from WorkOS on sign-in, when available.
    pub first_name: Option<String>,
    /// Family name synced from WorkOS on sign-in, when available.
    pub last_name: Option<String>,
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

/// Request body for `PUT /api/resumes/{id}/sharing`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateSharingRequest {
    pub is_public: bool,
}

/// Response body for `PUT /api/resumes/{id}/sharing`.
#[derive(Debug, Serialize, ToSchema)]
pub struct SharingResponse {
    pub is_public: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub public_slug: Option<String>,
}

/// Request body for `PUT /api/resumes/{id}`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateResumeRequest {
    pub title: Option<String>,
    #[schema(value_type = Object)]
    pub data: Option<serde_json::Value>,
    /// Expected resume version for optimistic concurrency control.
    pub version: Option<i32>,
}

/// Request body for `POST /api/resumes/{id}/versions/{version}/restore`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct RestoreResumeRequest {
    /// Expected current resume version for optimistic concurrency control.
    pub version: i32,
}

/// Version summary returned by `GET /api/resumes/{id}/versions`.
#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct ResumeVersionSummary {
    pub version: i32,
    #[schema(value_type = String, format = "date-time")]
    pub created_at: DateTime<Utc>,
}

/// Full snapshot returned by `GET /api/resumes/{id}/versions/{version}`.
#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct ResumeSnapshot {
    #[schema(value_type = String, format = "uuid")]
    pub id: Uuid,
    #[schema(value_type = String, format = "uuid")]
    pub resume_id: Uuid,
    pub version: i32,
    #[schema(value_type = Object)]
    pub data: serde_json::Value,
    #[schema(value_type = String, format = "date-time")]
    pub created_at: DateTime<Utc>,
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

/// Subscription summary returned by `GET /auth/me` for linked instances.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SubscriptionInfo {
    /// Paddle subscription status (`active`, `canceled`, etc.).
    pub status: String,
    /// Grace period end timestamp, when applicable.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Option<String>, format = "date-time")]
    pub expires_at: Option<DateTime<Utc>>,
}

/// Authenticated user profile returned by `GET /auth/me`.
///
/// Includes account identity and display-friendly profile fields synced from
/// WorkOS. Resume content is not included.
#[derive(Debug, Serialize, ToSchema)]
pub struct AuthUserResponse {
    #[schema(value_type = String, format = "uuid")]
    pub id: Uuid,
    /// Hosted-service subscription status for billing.
    pub plan: String,
    /// Account email from WorkOS, when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    /// Given name from WorkOS, when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    /// Family name from WorkOS, when available.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    /// Whether billable routes require sign-in on this deployment.
    pub require_auth: bool,
    /// Subscription lifecycle state for grace-period UX and local sync.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription: Option<SubscriptionInfo>,
}

/// Single resume in a bulk JSON export.
#[derive(Debug, Serialize, ToSchema)]
pub struct ResumeExportItem {
    #[schema(value_type = String, format = "uuid")]
    pub id: Uuid,
    pub title: String,
    #[schema(value_type = Object)]
    pub data: serde_json::Value,
}

/// Bulk JSON export payload for `GET /api/resumes/export`.
#[derive(Debug, Serialize, ToSchema)]
pub struct ResumeBulkExport {
    #[schema(value_type = String, format = "date-time")]
    pub exported_at: DateTime<Utc>,
    pub resumes: Vec<ResumeExportItem>,
}

/// Signed-out probe payload returned by `GET /auth/me` with HTTP 401.
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct AuthMeUnauthorizedResponse {
    pub error: String,
    pub require_auth: bool,
}

/// Request body for `DELETE /api/account`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct DeleteAccountRequest {
    /// Typed confirmation; must be exactly `DELETE`.
    pub confirmation: String,
}

/// Response body for `DELETE /api/account`.
#[derive(Debug, Serialize, ToSchema)]
pub struct DeleteAccountResponse {
    pub deleted: bool,
    pub message: String,
}

impl AuthUserResponse {
    /// Build a profile response with the hosted require-auth flag.
    pub fn from_user(
        user: User,
        require_auth: bool,
        subscription: Option<SubscriptionInfo>,
    ) -> Self {
        Self {
            id: user.id,
            plan: user.plan,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            require_auth,
            subscription,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn resume_row_never_exposes_password_hash() {
        let row = ResumeRow {
            id: Uuid::nil(),
            user_id: Uuid::nil(),
            title: "Resume".to_string(),
            data: serde_json::json!({}),
            is_public: false,
            public_slug: None,
            password_hash: Some("$argon2id$v=19$m=65536,t=3,p=4$secret".to_string()),
            version: 1,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_value(&row).unwrap();

        assert!(json.get("password_hash").is_none());
    }

    #[test]
    fn sharing_response_serializes_public_state() {
        let response = SharingResponse {
            is_public: true,
            public_slug: Some("clxyz123".to_string()),
        };
        let json = serde_json::to_value(&response).unwrap();

        assert_eq!(json["is_public"], true);
        assert_eq!(json["public_slug"], "clxyz123");
    }

    #[test]
    fn sharing_response_omits_null_public_slug() {
        let response = SharingResponse {
            is_public: false,
            public_slug: None,
        };
        let json = serde_json::to_value(&response).unwrap();

        assert_eq!(json["is_public"], false);
        assert!(json.get("public_slug").is_none());
    }

    #[test]
    fn sharing_response_keeps_slug_when_unpublished() {
        let response = SharingResponse {
            is_public: false,
            public_slug: Some("clxyz123".to_string()),
        };
        let json = serde_json::to_value(&response).unwrap();

        assert_eq!(json["is_public"], false);
        assert_eq!(json["public_slug"], "clxyz123");
    }

    #[test]
    fn auth_user_response_includes_profile_fields() {
        let user = User {
            id: Uuid::nil(),
            workos_id: "user_01".to_string(),
            plan: "free".to_string(),
            paddle_customer_id: None,
            email: Some("dev@example.com".to_string()),
            first_name: Some("Ada".to_string()),
            last_name: Some("Lovelace".to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let response = AuthUserResponse::from_user(user, true, None);
        let json = serde_json::to_value(&response).unwrap();

        assert_eq!(json["id"], Uuid::nil().to_string());
        assert_eq!(json["plan"], "free");
        assert_eq!(json["email"], "dev@example.com");
        assert_eq!(json["first_name"], "Ada");
        assert_eq!(json["last_name"], "Lovelace");
        assert_eq!(json["require_auth"], true);
        assert!(json.get("subscription").is_none());
    }

    #[test]
    fn auth_user_response_omits_empty_profile_fields() {
        let user = User {
            id: Uuid::nil(),
            workos_id: "user_01".to_string(),
            plan: "free".to_string(),
            paddle_customer_id: None,
            email: None,
            first_name: None,
            last_name: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_value(AuthUserResponse::from_user(user, false, None)).unwrap();

        assert!(json.get("email").is_none());
        assert!(json.get("first_name").is_none());
        assert!(json.get("last_name").is_none());
    }

    #[test]
    fn auth_user_response_includes_subscription_when_present() {
        let user = User {
            id: Uuid::nil(),
            workos_id: "user_01".to_string(),
            plan: "pro".to_string(),
            paddle_customer_id: None,
            email: None,
            first_name: None,
            last_name: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let expires_at = Utc::now();
        let response = AuthUserResponse::from_user(
            user,
            true,
            Some(SubscriptionInfo {
                status: "canceled".to_string(),
                expires_at: Some(expires_at),
            }),
        );
        let json = serde_json::to_value(&response).unwrap();

        assert_eq!(json["subscription"]["status"], "canceled");
        assert!(json["subscription"]["expires_at"].as_str().is_some());
    }
}
