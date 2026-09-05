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
#[derive(Debug, Serialize, Deserialize, ToSchema)]
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

/// Account metadata included in GDPR portability export.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AccountExportProfile {
    #[schema(value_type = String, format = "uuid")]
    pub id: Uuid,
    /// Account email synced from WorkOS, when available.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    /// Given name synced from WorkOS, when available.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    /// Family name synced from WorkOS, when available.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    pub plan: String,
    #[schema(value_type = String, format = "date-time")]
    pub created_at: DateTime<Utc>,
}

/// Versioned policy acceptance included in the GDPR portability export.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, ToSchema)]
pub struct PolicyAcceptanceExport {
    /// Policy identifier (`terms`, `privacy`).
    pub policy: String,
    /// Policy version accepted by the user.
    pub version: String,
    #[schema(value_type = String, format = "date-time")]
    pub accepted_at: DateTime<Utc>,
    /// Client IP recorded at acceptance time, when available.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,
}

/// Resume version-history snapshot included in the GDPR portability export.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ResumeSnapshotExport {
    #[schema(value_type = String, format = "uuid")]
    pub resume_id: Uuid,
    pub version: i32,
    #[schema(value_type = String, format = "date-time")]
    pub created_at: DateTime<Utc>,
    #[schema(value_type = Object)]
    pub data: serde_json::Value,
}

/// Resume as it appears in the GDPR portability export: the bulk-export
/// fields plus the sharing state and timestamps the account holds about it.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AccountResumeExportItem {
    #[schema(value_type = String, format = "uuid")]
    pub id: Uuid,
    pub title: String,
    /// Whether the resume is published at its public URL.
    pub is_public: bool,
    /// Public URL slug, present once the resume has ever been shared.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub public_slug: Option<String>,
    #[schema(value_type = String, format = "date-time")]
    pub created_at: DateTime<Utc>,
    #[schema(value_type = String, format = "date-time")]
    pub updated_at: DateTime<Utc>,
    #[schema(value_type = Object)]
    pub data: serde_json::Value,
}

/// Hosted-billing subscription record included in the GDPR portability export.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, ToSchema)]
pub struct SubscriptionExport {
    /// Paddle subscription identifier (the customer can use it with Paddle support).
    pub paddle_subscription_id: String,
    pub paddle_price_id: String,
    pub plan: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Option<String>, format = "date-time")]
    pub current_period_end: Option<DateTime<Utc>>,
    #[schema(value_type = String, format = "date-time")]
    pub created_at: DateTime<Utc>,
    #[schema(value_type = String, format = "date-time")]
    pub updated_at: DateTime<Utc>,
}

/// Security/audit log entry recorded for the account's own actions, included in
/// the GDPR portability export (it carries the client IP at the time).
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AuditEventExport {
    pub event_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resource_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Option<String>, format = "uuid")]
    pub resource_id: Option<Uuid>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,
    #[schema(value_type = String, format = "date-time")]
    pub created_at: DateTime<Utc>,
    #[schema(value_type = Object)]
    pub metadata: serde_json::Value,
}

/// Full account data export payload for `GET /api/account/export`.
///
/// This is an explicit allow-list of the account-linked data Rustume holds.
/// Session rows are deliberately excluded: they are short-lived credential
/// material (hashed tokens and expiries), not information about the person.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AccountDataExport {
    #[schema(value_type = String, format = "date-time")]
    pub exported_at: DateTime<Utc>,
    pub account: AccountExportProfile,
    /// Terms and Privacy Policy versions the user accepted.
    pub policy_acceptances: Vec<PolicyAcceptanceExport>,
    /// Hosted-billing subscriptions ever attached to the account.
    pub subscriptions: Vec<SubscriptionExport>,
    pub resumes: Vec<AccountResumeExportItem>,
    /// Retained version-history snapshots for every exported resume.
    pub resume_snapshots: Vec<ResumeSnapshotExport>,
    /// Audit trail of the account's own actions, oldest first.
    pub audit_events: Vec<AuditEventExport>,
}

impl AccountExportProfile {
    /// Build a portability-safe account profile from the authenticated user row.
    pub fn from_user(user: &User) -> Self {
        Self {
            id: user.id,
            email: user.email.clone(),
            first_name: user.first_name.clone(),
            last_name: user.last_name.clone(),
            plan: user.plan.clone(),
            created_at: user.created_at,
        }
    }
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

    #[test]
    fn account_export_profile_is_an_allow_list() {
        let full = User {
            id: Uuid::nil(),
            workos_id: "user_01SECRET".to_string(),
            plan: "pro".to_string(),
            paddle_customer_id: Some("ctm_secret".to_string()),
            email: Some("dev@example.com".to_string()),
            first_name: Some("Ada".to_string()),
            last_name: Some("Lovelace".to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let json = serde_json::to_value(AccountExportProfile::from_user(&full)).unwrap();
        let keys: std::collections::BTreeSet<&str> = json
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        assert_eq!(
            keys,
            [
                "id",
                "email",
                "first_name",
                "last_name",
                "plan",
                "created_at"
            ]
            .into_iter()
            .collect()
        );
        assert!(json.get("workos_id").is_none());
        assert!(json.get("paddle_customer_id").is_none());
        assert!(json.get("updated_at").is_none());

        // Optional fields are omitted rather than serialised as null.
        let sparse = User {
            email: None,
            first_name: None,
            last_name: None,
            ..full
        };
        let json = serde_json::to_value(AccountExportProfile::from_user(&sparse)).unwrap();
        let keys: std::collections::BTreeSet<&str> = json
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        assert_eq!(keys, ["id", "plan", "created_at"].into_iter().collect());

        // Omitted optionals must read back as None: the export is meant to be
        // re-parseable with these same types.
        let parsed: AccountExportProfile = serde_json::from_value(json).unwrap();
        assert_eq!(parsed.email, None);
        assert_eq!(parsed.first_name, None);
        assert_eq!(parsed.last_name, None);
        assert_eq!(parsed.plan, "pro");
    }

    #[test]
    fn export_items_round_trip_with_omitted_optionals() {
        fn keys(value: &serde_json::Value) -> std::collections::BTreeSet<String> {
            value.as_object().unwrap().keys().cloned().collect()
        }
        let now = Utc::now();

        let resume = AccountResumeExportItem {
            id: Uuid::nil(),
            title: "t".to_string(),
            is_public: false,
            public_slug: None,
            created_at: now,
            updated_at: now,
            data: serde_json::json!({}),
        };
        let json = serde_json::to_value(&resume).unwrap();
        assert!(
            !keys(&json).contains("public_slug"),
            "None must be omitted, not null"
        );
        let back: AccountResumeExportItem = serde_json::from_value(json).unwrap();
        assert_eq!(back.public_slug, None);
        assert_eq!(back.title, "t");

        let sub = SubscriptionExport {
            paddle_subscription_id: "sub_1".to_string(),
            paddle_price_id: "pri_1".to_string(),
            plan: "pro".to_string(),
            status: "canceled".to_string(),
            current_period_end: None,
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_value(&sub).unwrap();
        assert!(!keys(&json).contains("current_period_end"));
        let back: SubscriptionExport = serde_json::from_value(json).unwrap();
        assert_eq!(back.current_period_end, None);
        assert_eq!(back.paddle_subscription_id, "sub_1");

        let event = AuditEventExport {
            event_type: "account.export".to_string(),
            resource_type: None,
            resource_id: None,
            ip_address: None,
            created_at: now,
            metadata: serde_json::json!({ "stage": "started" }),
        };
        let json = serde_json::to_value(&event).unwrap();
        let event_keys = keys(&json);
        for omitted in ["resource_type", "resource_id", "ip_address"] {
            assert!(!event_keys.contains(omitted), "{omitted} must be omitted");
        }
        let back: AuditEventExport = serde_json::from_value(json).unwrap();
        assert_eq!(back.resource_type, None);
        assert_eq!(back.resource_id, None);
        assert_eq!(back.ip_address, None);
        assert_eq!(back.metadata["stage"], "started");

        let acceptance = PolicyAcceptanceExport {
            policy: "terms".to_string(),
            version: "2026-01-01".to_string(),
            accepted_at: now,
            ip_address: None,
        };
        let json = serde_json::to_value(&acceptance).unwrap();
        assert!(!keys(&json).contains("ip_address"));
        let back: PolicyAcceptanceExport = serde_json::from_value(json).unwrap();
        assert_eq!(back.ip_address, None);
        assert_eq!(back.policy, "terms");
    }

    /// The Account page's ACCOUNT_EXPORT_CONTENTS is the web statement of this
    /// module's allow-list. It cannot be imported across languages, so pin its
    /// wording here: adding a collection to `AccountDataExport` without telling
    /// the user fails this test, as does dropping a documented exclusion.
    #[test]
    fn web_export_copy_matches_allow_list() {
        let web = include_str!("../../../../apps/web/src/api/account.ts");
        let constant = &web[web
            .find("export const ACCOUNT_EXPORT_CONTENTS")
            .expect("ACCOUNT_EXPORT_CONTENTS constant exists")..];
        let constant = &constant[..constant.find("} as const;").expect("constant ends")];

        /// Pull the double-quoted string literals out of the `<key>: [ ... ]`
        /// property, anchored to the start of its own line so a phrase that
        /// merely contains the key cannot match.
        fn string_array(source: &str, key: &str) -> Vec<String> {
            let start = source
                .find(key)
                .unwrap_or_else(|| panic!("{key} array present"));
            let body = &source[start + key.len()..];
            let body = &body[..body.find(']').expect("array closes")];
            body.split('"')
                .skip(1)
                .step_by(2)
                .map(str::to_string)
                .collect()
        }

        // The exact arrays, in order: one sentence per exported collection
        // (resumes and their snapshots are one object graph, so one sentence)
        // and every documented exclusion. Substring checks would let stale or
        // extra copy through.
        assert_eq!(
            string_array(constant, "\n  included: ["),
            [
                "your profile",
                "policy acceptances",
                "billing subscriptions (including Paddle subscription and price ids)",
                "every resume with its retained version snapshots",
                "your account's audit trail (including the IP addresses recorded with each event)",
            ]
        );
        assert_eq!(
            string_array(constant, "\n  excluded: ["),
            [
                "sessions",
                "the WorkOS user id",
                "the Paddle customer id",
                "share password hashes",
            ]
        );
        // And the schema itself still has exactly these collections.
        let export = AccountDataExport {
            exported_at: Utc::now(),
            account: AccountExportProfile::from_user(&User {
                id: Uuid::nil(),
                workos_id: String::new(),
                plan: "free".to_string(),
                paddle_customer_id: None,
                email: None,
                first_name: None,
                last_name: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            }),
            policy_acceptances: vec![],
            subscriptions: vec![],
            resumes: vec![],
            resume_snapshots: vec![],
            audit_events: vec![],
        };
        // serde_json orders object keys alphabetically; compare as a set.
        let keys: std::collections::BTreeSet<String> = serde_json::to_value(&export)
            .unwrap()
            .as_object()
            .unwrap()
            .keys()
            .cloned()
            .collect();
        let expected: std::collections::BTreeSet<String> = [
            "exported_at",
            "account",
            "policy_acceptances",
            "subscriptions",
            "resumes",
            "resume_snapshots",
            "audit_events",
        ]
        .into_iter()
        .map(String::from)
        .collect();
        assert_eq!(keys, expected);
    }
}
