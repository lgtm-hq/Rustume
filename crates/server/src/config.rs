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

/// Current Terms of Service version (ISO date).
/// Must match `apps/web/src/lib/policies.ts` (`TERMS_VERSION`).
pub const TERMS_VERSION: &str = "2026-07-10";

/// Current Privacy Policy version (ISO date).
/// Must match `apps/web/src/lib/policies.ts` (`PRIVACY_VERSION`).
pub const PRIVACY_VERSION: &str = "2026-07-10";

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
    /// Auth login/callback/logout/me.
    pub auth_per_min: u32,
    /// Account deletion (per user when authenticated, per IP otherwise).
    pub account_delete_per_min: u32,
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
            auth_per_min: 10,
            account_delete_per_min: 5,
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
            auth_per_min: env_u32("RATE_LIMIT_AUTH_PER_MIN", defaults.auth_per_min),
            account_delete_per_min: env_u32(
                "RATE_LIMIT_ACCOUNT_DELETE_PER_MIN",
                defaults.account_delete_per_min,
            ),
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

    /// Quota for auth routes.
    pub fn auth_quota(self) -> Quota {
        Self::quota_per_minute(self.auth_per_min)
    }

    /// Quota for account deletion routes.
    pub fn account_delete_quota(self) -> Quota {
        Self::quota_per_minute(self.account_delete_per_min)
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

/// Whether cloud-mode rate limit middleware should be installed for a raw env value.
pub fn rate_limits_enabled(disabled_flag: Option<&str>) -> bool {
    !matches!(disabled_flag, Some("true" | "1"))
}

/// Whether cloud-mode rate limit middleware should be installed.
///
/// Set `RATE_LIMIT_DISABLED=true` for local cloud development so preview/PDF
/// editing is not capped by production quotas.
pub fn rate_limits_enabled_from_env() -> bool {
    rate_limits_enabled(std::env::var("RATE_LIMIT_DISABLED").ok().as_deref())
}

/// Paddle production API base URL.
pub const PADDLE_API_BASE: &str = "https://api.paddle.com";
/// Paddle sandbox API base URL, selected by `PADDLE_SANDBOX=true`.
pub const PADDLE_SANDBOX_API_BASE: &str = "https://sandbox-api.paddle.com";

/// Paddle Billing credentials loaded from the environment.
///
/// Secrets are redacted via [`Display`]; do not derive `Debug` (it would leak them).
#[derive(Clone)]
pub struct BillingConfig {
    /// Server-side Paddle API key (`PADDLE_API_KEY`).
    pub api_key: String,
    /// Webhook destination secret for signature verification (`PADDLE_WEBHOOK_SECRET`).
    pub webhook_secret: String,
    /// Default hosted price ID for checkout (`PADDLE_PRICE_ID`).
    pub price_id: String,
    /// Client-side token for Paddle.js (`PADDLE_CLIENT_TOKEN`).
    pub client_token: String,
    /// Paddle API base URL (`PADDLE_API_BASE`, default production).
    pub api_base: String,
    /// When true, Paddle.js should use the sandbox environment.
    pub sandbox: bool,
}

impl BillingConfig {
    /// Load billing settings when all required env vars are present.
    pub fn from_env() -> Option<Self> {
        let api_key = optional_non_empty_env("PADDLE_API_KEY")?;
        let webhook_secret = optional_non_empty_env("PADDLE_WEBHOOK_SECRET")?;
        let price_id = optional_non_empty_env("PADDLE_PRICE_ID")?;
        let client_token = optional_non_empty_env("PADDLE_CLIENT_TOKEN")?;

        // PADDLE_SANDBOX: unset follows the API base; true/1 or false/0 is
        // an explicit choice that the API base must agree with.
        let sandbox_flag = match std::env::var("PADDLE_SANDBOX").as_deref() {
            Ok("true" | "1") => Some(true),
            Ok("false" | "0") => Some(false),
            _ => None,
        };
        let explicit_api_base = optional_non_empty_env("PADDLE_API_BASE");
        let api_base = explicit_api_base.clone().unwrap_or_else(|| {
            if sandbox_flag == Some(true) {
                PADDLE_SANDBOX_API_BASE.to_string()
            } else {
                PADDLE_API_BASE.to_string()
            }
        });
        let api_base_is_sandbox = api_base.contains("sandbox");

        // Paddle.js (client) and the Paddle API (server) must target the same
        // environment; a sandbox client token against the production API (or
        // vice versa) fails in confusing ways, so refuse to start billing.
        if let Some(flag) = sandbox_flag {
            if explicit_api_base.is_some() && flag != api_base_is_sandbox {
                tracing::error!(
                    api_base = %api_base,
                    sandbox_flag = flag,
                    "PADDLE_SANDBOX and PADDLE_API_BASE disagree; billing disabled until fixed"
                );
                return None;
            }
        }
        let sandbox = sandbox_flag.unwrap_or(api_base_is_sandbox);

        Some(Self {
            api_key,
            webhook_secret,
            price_id,
            client_token,
            api_base,
            sandbox,
        })
    }
}

impl std::fmt::Display for BillingConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BillingConfig")
            .field("api_key", &"<redacted>")
            .field("webhook_secret", &"<redacted>")
            .field("price_id", &self.price_id)
            .field("client_token", &"<redacted>")
            .field("api_base", &self.api_base)
            .field("sandbox", &self.sandbox)
            .finish()
    }
}

fn optional_non_empty_env(key: &str) -> Option<String> {
    match std::env::var(key) {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        Err(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn policy_versions_match_web_constants() {
        // Keep in sync with apps/web/src/lib/policies.ts
        assert_eq!(TERMS_VERSION, "2026-07-10");
        assert_eq!(PRIVACY_VERSION, "2026-07-10");
    }

    #[test]
    fn default_limits_match_issue() {
        let config = RateLimitConfig::default();
        assert_eq!(config.resume_crud_per_min, 300);
        assert_eq!(config.resume_crud_burst, 30);
        assert_eq!(config.import_per_min, 10);
        assert_eq!(config.preview_per_min, 60);
        assert_eq!(config.pdf_per_min, 20);
        assert_eq!(config.auth_per_min, 10);
        assert_eq!(config.account_delete_per_min, 5);
        assert_eq!(config.health_per_min, 60);
        assert_eq!(config.metrics_per_min, 60);
        assert_eq!(config.unauthenticated_per_min, 30);
        assert_eq!(config.billable_per_min, 30);
        assert!(!config.trusted_proxy);
    }

    #[test]
    fn rate_limits_enabled_respects_disable_flag() {
        assert!(rate_limits_enabled(None));
        assert!(rate_limits_enabled(Some("false")));
        assert!(!rate_limits_enabled(Some("true")));
        assert!(!rate_limits_enabled(Some("1")));
    }

    static PADDLE_ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
    const PADDLE_KEYS: [&str; 6] = [
        "PADDLE_API_KEY",
        "PADDLE_WEBHOOK_SECRET",
        "PADDLE_PRICE_ID",
        "PADDLE_CLIENT_TOKEN",
        "PADDLE_API_BASE",
        "PADDLE_SANDBOX",
    ];

    /// Run `f` with the four required PADDLE_* vars set and the optional ones
    /// as given, restoring the process environment afterwards.
    fn with_paddle_env(api_base: Option<&str>, sandbox: Option<&str>, f: impl FnOnce()) {
        // A failed assertion in one test must not poison the lock for the rest.
        let _guard = PADDLE_ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let previous: Vec<(String, Option<String>)> = PADDLE_KEYS
            .iter()
            .map(|key| ((*key).to_string(), std::env::var(key).ok()))
            .collect();

        std::env::set_var("PADDLE_API_KEY", "api_test");
        std::env::set_var("PADDLE_WEBHOOK_SECRET", "secret_test");
        std::env::set_var("PADDLE_PRICE_ID", "pri_test");
        std::env::set_var("PADDLE_CLIENT_TOKEN", "client_test");
        match api_base {
            Some(value) => std::env::set_var("PADDLE_API_BASE", value),
            None => std::env::remove_var("PADDLE_API_BASE"),
        }
        match sandbox {
            Some(value) => std::env::set_var("PADDLE_SANDBOX", value),
            None => std::env::remove_var("PADDLE_SANDBOX"),
        }

        f();

        for (key, value) in previous {
            match value {
                Some(value) => std::env::set_var(&key, value),
                None => std::env::remove_var(&key),
            }
        }
    }

    #[test]
    fn billing_config_requires_all_vars() {
        with_paddle_env(None, None, || {
            let config = BillingConfig::from_env().expect("billing config");
            assert_eq!(config.price_id, "pri_test");
            assert!(!config.sandbox);
            assert_eq!(config.api_base, PADDLE_API_BASE);

            std::env::remove_var("PADDLE_CLIENT_TOKEN");
            assert!(BillingConfig::from_env().is_none());
        });
    }

    #[test]
    fn billing_config_sandbox_flag_selects_sandbox_api() {
        with_paddle_env(None, Some("true"), || {
            let config = BillingConfig::from_env().expect("billing config");
            assert!(config.sandbox);
            assert_eq!(config.api_base, PADDLE_SANDBOX_API_BASE);
        });
    }

    #[test]
    fn billing_config_infers_sandbox_from_api_base() {
        with_paddle_env(Some(PADDLE_SANDBOX_API_BASE), None, || {
            let config = BillingConfig::from_env().expect("billing config");
            assert!(config.sandbox);
            assert_eq!(config.api_base, PADDLE_SANDBOX_API_BASE);
        });
    }

    #[test]
    fn billing_config_rejects_sandbox_flag_with_production_api() {
        with_paddle_env(Some(PADDLE_API_BASE), Some("true"), || {
            assert!(
                BillingConfig::from_env().is_none(),
                "sandbox client against production API must be refused"
            );
        });
        with_paddle_env(Some(PADDLE_SANDBOX_API_BASE), Some("false"), || {
            // Explicitly production by flag but sandbox by URL: also refused.
            assert!(BillingConfig::from_env().is_none());
        });
    }
}
