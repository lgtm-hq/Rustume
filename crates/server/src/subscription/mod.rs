//! Subscription status and grace-period access rules for Rustume Cloud.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use tracing::error;
use uuid::Uuid;

use crate::db::SubscriptionInfo;
use crate::error::ApiError;

/// Known subscription status values stored in PostgreSQL.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubscriptionStatus {
    Active,
    Canceled,
    PastDue,
    Paused,
    Trialing,
}

impl SubscriptionStatus {
    /// Parse a database status string.
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "active" => Some(Self::Active),
            "canceled" => Some(Self::Canceled),
            "past_due" => Some(Self::PastDue),
            "paused" => Some(Self::Paused),
            "trialing" => Some(Self::Trialing),
            _ => None,
        }
    }

    /// Serialize to the database/API status string.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Canceled => "canceled",
            Self::PastDue => "past_due",
            Self::Paused => "paused",
            Self::Trialing => "trialing",
        }
    }
}

/// Effective subscription access for API enforcement.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SubscriptionAccess {
    /// Full read/write access (active subscription or no subscription row).
    Active,
    /// Canceled subscription still within the grace period.
    GracePeriod {
        expires_at: DateTime<Utc>,
        status: SubscriptionStatus,
    },
    /// Subscription expired or otherwise blocked from resume access.
    Expired { status: SubscriptionStatus },
}

impl SubscriptionAccess {
    /// Build access rules from a subscription row, if any.
    pub fn from_row(status: &str, period_end: Option<DateTime<Utc>>) -> Self {
        let now = Utc::now();
        let grace_or_expired = |status: SubscriptionStatus| match period_end {
            Some(expires_at) if expires_at > now => Self::GracePeriod { expires_at, status },
            _ => Self::Expired { status },
        };

        let Some(status) = SubscriptionStatus::parse(status) else {
            // Fail closed: a status this build does not understand is never
            // treated as paid access. It behaves like `past_due` — read-only
            // until the current period ends, then expired. (The webhook
            // handler already maps unknown Paddle statuses to `past_due`
            // before insert because of the CHECK constraint; this branch
            // guards rows written by other means.)
            tracing::warn!(
                status = status,
                "unknown subscription status, treating as past_due"
            );
            return grace_or_expired(SubscriptionStatus::PastDue);
        };

        match status {
            SubscriptionStatus::Active | SubscriptionStatus::Trialing => Self::Active,
            SubscriptionStatus::Canceled
            | SubscriptionStatus::PastDue
            | SubscriptionStatus::Paused => grace_or_expired(status),
        }
    }

    /// No subscription row — free users retain full access.
    pub fn without_subscription() -> Self {
        Self::Active
    }

    /// API-facing subscription summary for `/auth/me`.
    pub fn to_info(&self) -> Option<SubscriptionInfo> {
        match self {
            Self::Active => None,
            Self::GracePeriod { expires_at, status } => Some(SubscriptionInfo {
                status: status.as_str().to_string(),
                expires_at: Some(*expires_at),
            }),
            Self::Expired { status } => Some(SubscriptionInfo {
                status: status.as_str().to_string(),
                expires_at: None,
            }),
        }
    }

    /// Reject when resume reads are not allowed.
    pub fn ensure_read(&self) -> Result<(), ApiError> {
        if matches!(self, Self::Expired { .. }) {
            return Err(ApiError::forbidden(
                "Cloud subscription expired — resume access is disabled",
            ));
        }
        Ok(())
    }

    /// Reject when resume writes are not allowed.
    pub fn ensure_write(&self) -> Result<(), ApiError> {
        match self {
            Self::Active => Ok(()),
            Self::GracePeriod { .. } => Err(ApiError::forbidden(
                "Cloud account is read-only during subscription cancellation",
            )),
            Self::Expired { .. } => Err(ApiError::forbidden(
                "Cloud subscription expired — resume writes are disabled",
            )),
        }
    }

    /// Reject when resume deletes are not allowed.
    pub fn ensure_delete(&self) -> Result<(), ApiError> {
        self.ensure_read()
    }

    /// Reject when render endpoints are not allowed.
    pub fn ensure_render(&self) -> Result<(), ApiError> {
        self.ensure_read()
    }

    /// Reject when bulk export endpoints are not allowed.
    pub fn ensure_export(&self) -> Result<(), ApiError> {
        self.ensure_read()
    }
}

/// Load the latest subscription access for a user.
pub async fn load_access(pool: &PgPool, user_id: Uuid) -> Result<SubscriptionAccess, ApiError> {
    // A user can accumulate several subscription rows (cancel, then
    // resubscribe under a new Paddle id). Access follows the best row, not the
    // most recently touched one, so a late webhook on an old subscription
    // cannot hide a live one.
    let row = sqlx::query_as::<_, SubscriptionRow>(
        r#"
        SELECT status, current_period_end
        FROM subscriptions
        WHERE user_id = $1
        ORDER BY
            CASE WHEN status IN ('active', 'trialing') THEN 0 ELSE 1 END,
            current_period_end DESC NULLS LAST,
            updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(internal_db_error)?;

    Ok(row
        .map(|row| SubscriptionAccess::from_row(&row.status, row.current_period_end))
        .unwrap_or_else(SubscriptionAccess::without_subscription))
}

#[derive(Debug, sqlx::FromRow)]
struct SubscriptionRow {
    status: String,
    current_period_end: Option<DateTime<Utc>>,
}

fn internal_db_error(err: impl std::fmt::Display) -> ApiError {
    error!("subscription lookup failed: {err}");
    ApiError::internal("internal server error")
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn active_status_grants_full_access() {
        let access = SubscriptionAccess::from_row("active", None);
        assert_eq!(access, SubscriptionAccess::Active);
        assert!(access.ensure_write().is_ok());
        assert!(access.ensure_read().is_ok());
    }

    #[test]
    fn canceled_before_period_end_is_grace_period() {
        let expires_at = Utc.with_ymd_and_hms(2099, 1, 1, 0, 0, 0).unwrap();
        let access = SubscriptionAccess::from_row("canceled", Some(expires_at));
        assert_eq!(
            access,
            SubscriptionAccess::GracePeriod {
                expires_at,
                status: SubscriptionStatus::Canceled,
            }
        );
        assert!(access.ensure_read().is_ok());
        assert!(access.ensure_write().is_err());
        assert!(access.ensure_delete().is_ok());
    }

    #[test]
    fn canceled_after_period_end_is_expired() {
        let expires_at = Utc.with_ymd_and_hms(2020, 1, 1, 0, 0, 0).unwrap();
        let access = SubscriptionAccess::from_row("canceled", Some(expires_at));
        assert_eq!(
            access,
            SubscriptionAccess::Expired {
                status: SubscriptionStatus::Canceled,
            }
        );
        assert!(access.ensure_read().is_err());
        assert!(access.ensure_write().is_err());
    }

    #[test]
    fn grace_period_info_includes_expires_at() {
        let expires_at = Utc.with_ymd_and_hms(2099, 6, 1, 0, 0, 0).unwrap();
        let access = SubscriptionAccess::GracePeriod {
            expires_at,
            status: SubscriptionStatus::Canceled,
        };
        let info = access.to_info().expect("grace info");
        assert_eq!(info.status, "canceled");
        assert_eq!(info.expires_at, Some(expires_at));
    }

    #[test]
    fn unknown_status_never_grants_write_access() {
        let expires_at = Utc.with_ymd_and_hms(2099, 1, 1, 0, 0, 0).unwrap();
        let in_period = SubscriptionAccess::from_row("some_future_status", Some(expires_at));
        assert_eq!(
            in_period,
            SubscriptionAccess::GracePeriod {
                expires_at,
                status: SubscriptionStatus::PastDue,
            }
        );
        assert!(in_period.ensure_read().is_ok());
        assert!(in_period.ensure_write().is_err());

        let no_period = SubscriptionAccess::from_row("some_future_status", None);
        assert_eq!(
            no_period,
            SubscriptionAccess::Expired {
                status: SubscriptionStatus::PastDue,
            }
        );
        assert!(no_period.ensure_read().is_err());
    }

    #[test]
    fn active_subscription_omits_info_from_auth_me() {
        assert!(SubscriptionAccess::Active.to_info().is_none());
    }
}
