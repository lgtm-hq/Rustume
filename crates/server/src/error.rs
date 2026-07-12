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
    /// Conflict (409) - resource already exists
    Conflict,
    /// Payload too large (413) - request exceeds size or count limits
    PayloadTooLarge,
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
            ApiErrorKind::Conflict => StatusCode::CONFLICT,
            ApiErrorKind::PayloadTooLarge => StatusCode::PAYLOAD_TOO_LARGE,
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
    /// Current resource version returned on optimistic concurrency conflicts.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_version: Option<i32>,
    /// Error kind for HTTP status mapping (not serialized)
    #[serde(skip)]
    pub kind: ApiErrorKind,
}

impl ApiError {
    fn with_kind(kind: ApiErrorKind, error: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            details: None,
            current_version: None,
            kind,
        }
    }

    /// Create a 400 Bad Request error.
    pub fn new(error: impl Into<String>) -> Self {
        Self::with_kind(ApiErrorKind::BadRequest, error)
    }

    /// Create a 422 Unprocessable Entity error with validation details.
    pub fn with_details(error: impl Into<String>, details: Vec<String>) -> Self {
        Self {
            error: error.into(),
            details: Some(details),
            current_version: None,
            kind: ApiErrorKind::UnprocessableEntity,
        }
    }

    /// Create a 404 Not Found error.
    pub fn not_found(error: impl Into<String>) -> Self {
        Self::with_kind(ApiErrorKind::NotFound, error)
    }

    /// Create a 500 Internal Server Error.
    pub fn internal(error: impl Into<String>) -> Self {
        Self::with_kind(ApiErrorKind::InternalError, error)
    }

    /// Create a 401 Unauthorized error.
    pub fn unauthorized(error: impl Into<String>) -> Self {
        Self::with_kind(ApiErrorKind::Unauthorized, error)
    }

    /// Create a 403 Forbidden error.
    pub fn forbidden(error: impl Into<String>) -> Self {
        Self::with_kind(ApiErrorKind::Forbidden, error)
    }

    /// Create a 409 Conflict error.
    pub fn conflict(error: impl Into<String>) -> Self {
        Self::with_kind(ApiErrorKind::Conflict, error)
    }

    /// Create a 409 Conflict error with the current resource version.
    pub fn version_conflict(error: impl Into<String>, current_version: i32) -> Self {
        Self {
            error: error.into(),
            details: None,
            current_version: Some(current_version),
            kind: ApiErrorKind::Conflict,
        }
    }

    /// Create a 413 Payload Too Large error.
    pub fn payload_too_large(error: impl Into<String>) -> Self {
        Self::with_kind(ApiErrorKind::PayloadTooLarge, error)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.kind.status_code(), Json(self)).into_response()
    }
}
