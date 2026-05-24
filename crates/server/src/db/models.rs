use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct User {
    pub id: Uuid,
    pub workos_id: String,
    pub email: String,
    pub name: Option<String>,
    pub plan: String,
    pub stripe_customer_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

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
    pub password_hash: Option<String>,
    pub version: i32,
    #[schema(value_type = String, format = "date-time")]
    pub created_at: DateTime<Utc>,
    #[schema(value_type = String, format = "date-time")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
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

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateResumeRequest {
    #[schema(value_type = Option<String>, format = "uuid")]
    pub id: Option<Uuid>,
    pub title: Option<String>,
    #[schema(value_type = Object)]
    pub data: serde_json::Value,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateResumeRequest {
    pub title: Option<String>,
    #[schema(value_type = Object)]
    pub data: serde_json::Value,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ImportResumeItem {
    #[schema(value_type = Option<String>, format = "uuid")]
    pub id: Option<Uuid>,
    pub title: Option<String>,
    #[schema(value_type = Object)]
    pub data: serde_json::Value,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ImportResumesRequest {
    pub resumes: Vec<ImportResumeItem>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AuthUserResponse {
    #[schema(value_type = String, format = "uuid")]
    pub id: Uuid,
    pub email: String,
    pub name: Option<String>,
    pub plan: String,
}

impl From<User> for AuthUserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            email: user.email,
            name: user.name,
            plan: user.plan,
        }
    }
}
