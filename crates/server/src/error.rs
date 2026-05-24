use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Error kind for mapping to HTTP status codes.
#[derive(Debug, Clone, Copy, Default)]
pub enum ApiErrorKind {
    /// Bad request (400) - malformed input, invalid format
    #[default]
    BadRequest,
    /// Not found (404) - resource does not exist
    NotFound,
    /// Unprocessable entity (422) - validation errors
    UnprocessableEntity,
    /// Internal server error (500) - rendering failures, etc.
    InternalError,
    /// Unauthorized (401)
    Unauthorized,
    /// Forbidden (403)
    Forbidden,
}

impl ApiErrorKind {
    fn status_code(self) -> StatusCode {
        match self {
            ApiErrorKind::BadRequest => StatusCode::BAD_REQUEST,
            ApiErrorKind::NotFound => StatusCode::NOT_FOUND,
            ApiErrorKind::UnprocessableEntity => StatusCode::UNPROCESSABLE_ENTITY,
            ApiErrorKind::InternalError => StatusCode::INTERNAL_SERVER_ERROR,
            ApiErrorKind::Unauthorized => StatusCode::UNAUTHORIZED,
            ApiErrorKind::Forbidden => StatusCode::FORBIDDEN,
        }
    }
}

/// API error response
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ApiError {
    /// Error message
    #[schema(example = "Failed to parse JSON Resume")]
    pub error: String,
    /// Detailed error messages (e.g., validation errors)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = json!(["basics.email: invalid email format"]))]
    pub details: Option<Vec<String>>,
    /// Error kind for HTTP status mapping (not serialized)
    #[serde(skip)]
    pub kind: ApiErrorKind,
}

impl ApiError {
    pub fn new(error: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            details: None,
            kind: ApiErrorKind::BadRequest,
        }
    }

    pub fn with_details(error: impl Into<String>, details: Vec<String>) -> Self {
        Self {
            error: error.into(),
            details: Some(details),
            kind: ApiErrorKind::UnprocessableEntity,
        }
    }

    pub fn not_found(error: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            details: None,
            kind: ApiErrorKind::NotFound,
        }
    }

    pub fn internal(error: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            details: None,
            kind: ApiErrorKind::InternalError,
        }
    }

    pub fn unauthorized(error: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            details: None,
            kind: ApiErrorKind::Unauthorized,
        }
    }

    pub fn forbidden(error: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            details: None,
            kind: ApiErrorKind::Forbidden,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.kind.status_code(), Json(self)).into_response()
    }
}
