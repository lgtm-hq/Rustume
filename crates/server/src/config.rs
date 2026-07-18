//! Server configuration constants.

use std::num::NonZeroU32;

use governor::Quota;

/// Maximum request body size (10 MB)
pub const MAX_BODY_SIZE: usize = 10 * 1024 * 1024;

/// Maximum nested JSON depth for resume payloads (root depth = 1).
pub const MAX_JSON_DEPTH: usize = 32;

/// Maximum length for any single string field inside resume JSON.
pub const MAX_STRING_FIELD_LEN: usize = 16_384;

/// Maximum serialized resume JSON size (2 MB).
pub const MAX_RESUME_JSON_BYTES: usize = 2 * 1024 * 1024;

/// Maximum resume title length in characters.
pub const MAX_TITLE_LEN: usize = 512;

/// Default server port
pub const DEFAULT_PORT: u16 = 3000;

/// Default location for the production web bundle in the container image.
pub const DEFAULT_STATIC_DIR: &str = "/app/web";

/// Per-route-group rate limits for Rustume Cloud (requests per minute).
#[derive(Debug, Clone, Copy)]
pub struct RateLimitConfig {
    /// Resume list/get/create/update/delete.
    pub resume_crud_per_min: u32,
    /// Burst allowance for resume CRUD.
    pub resume_crud_burst: u32,
    /// Bulk resume import.
    pub import_per_min: u32,
    /// Live preview renders.
    pub preview_per_min: u32,
    /// PDF export renders.
    pub pdf_per_min: u32,
    /// GDPR account data export.
    pub account_export_per_min: u32,
    /// Auth login/callback/logout/me.
    pub auth_per_min: u32,
    /// Unauthenticated health checks (per IP).
    pub health_per_min: u32,
    /// Unauthenticated metrics scrapes (per IP).
    pub metrics_per_min: u32,
    /// Other unauthenticated requests (per IP).
    pub unauthenticated_per_min: u32,
    /// Templates, parse, and validate routes (per user when authenticated).
    pub billable_per_min: u32,
    /// Whether to trust proxy headers (`X-Real-IP`, append-mode `X-Forwarded-For`).
    pub trusted_proxy: bool,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            resume_crud_per_min: 300,
            resume_crud_burst: 30,
            import_per_min: 10,
            preview_per_min: 60,
            pdf_per_min: 20,
            account_export_per_min: 5,
            auth_per_min: 10,
            health_per_min: 60,
            metrics_per_min: 60,
            unauthenticated_per_min: 30,
            billable_per_min: 30,
            trusted_proxy: false,
        }
    }
}

impl RateLimitConfig {
    /// Load rate limit settings from environment variables with built-in defaults.
    pub fn from_env() -> Self {
        let defaults = Self::default();
        Self {
            resume_crud_per_min: env_u32(
                "RATE_LIMIT_RESUME_CRUD_PER_MIN",
                defaults.resume_crud_per_min,
            ),
            resume_crud_burst: env_u32("RATE_LIMIT_RESUME_CRUD_BURST", defaults.resume_crud_burst),
            import_per_min: env_u32("RATE_LIMIT_IMPORT_PER_MIN", defaults.import_per_min),
            preview_per_min: env_u32("RATE_LIMIT_PREVIEW_PER_MIN", defaults.preview_per_min),
            pdf_per_min: env_u32("RATE_LIMIT_PDF_PER_MIN", defaults.pdf_per_min),
            account_export_per_min: env_u32(
                "RATE_LIMIT_ACCOUNT_EXPORT_PER_MIN",
                defaults.account_export_per_min,
            ),
            auth_per_min: env_u32("RATE_LIMIT_AUTH_PER_MIN", defaults.auth_per_min),
            health_per_min: env_u32("RATE_LIMIT_HEALTH_PER_MIN", defaults.health_per_min),
            metrics_per_min: env_u32("RATE_LIMIT_METRICS_PER_MIN", defaults.metrics_per_min),
            unauthenticated_per_min: env_u32(
                "RATE_LIMIT_UNAUTHENTICATED_PER_MIN",
                defaults.unauthenticated_per_min,
            ),
            billable_per_min: env_u32("RATE_LIMIT_BILLABLE_PER_MIN", defaults.billable_per_min),
            trusted_proxy: trusted_proxy_from_env(),
        }
    }

    /// Build a governor quota for the given requests-per-minute limit.
    pub fn quota_per_minute(limit: u32) -> Quota {
        let limit = NonZeroU32::new(limit.max(1)).expect("rate limit must be at least 1");
        Quota::per_minute(limit)
    }

    /// Build a governor quota with a separate burst size (resume CRUD).
    pub fn quota_with_burst(per_minute: u32, burst: u32) -> Quota {
        let limit = NonZeroU32::new(per_minute.max(1)).expect("rate limit must be at least 1");
        let burst = NonZeroU32::new(burst.max(1)).expect("burst must be at least 1");
        Quota::per_minute(limit).allow_burst(burst)
    }

    /// Quota for resume CRUD routes.
    pub fn resume_crud_quota(self) -> Quota {
        Self::quota_with_burst(self.resume_crud_per_min, self.resume_crud_burst)
    }

    /// Quota for resume import routes.
    pub fn import_quota(self) -> Quota {
        Self::quota_per_minute(self.import_per_min)
    }

    /// Quota for preview render routes.
    pub fn preview_quota(self) -> Quota {
        Self::quota_per_minute(self.preview_per_min)
    }

    /// Quota for PDF render routes.
    pub fn pdf_quota(self) -> Quota {
        Self::quota_per_minute(self.pdf_per_min)
    }

    /// Quota for GDPR account export routes.
    pub fn account_export_quota(self) -> Quota {
        Self::quota_per_minute(self.account_export_per_min)
    }

    /// Quota for auth routes.
    pub fn auth_quota(self) -> Quota {
        Self::quota_per_minute(self.auth_per_min)
    }

    /// Quota for unauthenticated health checks.
    pub fn health_quota(self) -> Quota {
        Self::quota_per_minute(self.health_per_min)
    }

    /// Quota for unauthenticated metrics scrapes.
    pub fn metrics_quota(self) -> Quota {
        Self::quota_per_minute(self.metrics_per_min)
    }

    /// Quota for other unauthenticated traffic.
    pub fn unauthenticated_quota(self) -> Quota {
        Self::quota_per_minute(self.unauthenticated_per_min)
    }

    /// Quota for billable template/parse/validate routes.
    pub fn billable_quota(self) -> Quota {
        Self::quota_per_minute(self.billable_per_min)
    }
}

fn env_u32(key: &str, default: u32) -> u32 {
    match std::env::var(key) {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return default;
            }
            match trimmed.parse::<u32>() {
                Ok(parsed) => parsed,
                Err(_) => {
                    tracing::warn!(
                        "{key}={trimmed:?} is invalid; using default rate limit {default}"
                    );
                    default
                }
            }
        }
        Err(_) => default,
    }
}

fn trusted_proxy_from_env() -> bool {
    matches!(std::env::var("TRUSTED_PROXY").as_deref(), Ok("true" | "1"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_limits_match_issue() {
        let config = RateLimitConfig::default();
        assert_eq!(config.resume_crud_per_min, 300);
        assert_eq!(config.resume_crud_burst, 30);
        assert_eq!(config.import_per_min, 10);
        assert_eq!(config.preview_per_min, 60);
        assert_eq!(config.pdf_per_min, 20);
        assert_eq!(config.account_export_per_min, 5);
        assert_eq!(config.auth_per_min, 10);
        assert_eq!(config.health_per_min, 60);
        assert_eq!(config.metrics_per_min, 60);
        assert_eq!(config.unauthenticated_per_min, 30);
        assert_eq!(config.billable_per_min, 30);
        assert!(!config.trusted_proxy);
    }
}
