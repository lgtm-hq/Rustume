//! Policy acceptance recording for Terms of Service and Privacy Policy.

use sqlx::PgPool;
use uuid::Uuid;

use crate::audit::{record_event, AuditEvent};
use crate::config;

/// Record a user's acceptance of a specific policy version.
///
/// Inserts an audit row in `policy_acceptances` and emits a `policy.accept` audit event.
/// Intended for sign-up browsewrap and future checkout acceptance (#332).
pub async fn record_policy_acceptance(
    pool: &PgPool,
    user_id: Uuid,
    policy: &str,
    version: &str,
    ip_address: Option<&str>,
) {
    let result = sqlx::query(
        r#"
        INSERT INTO policy_acceptances (user_id, policy, version, ip_address)
        VALUES ($1, $2, $3, $4::inet)
        "#,
    )
    .bind(user_id)
    .bind(policy)
    .bind(version)
    .bind(ip_address)
    .execute(pool)
    .await;

    if let Err(err) = result {
        tracing::error!("policy acceptance insert failed: {err}");
        return;
    }

    record_event(
        pool,
        AuditEvent {
            event_type: "policy.accept",
            actor_user_id: Some(user_id),
            resource_type: Some("policy"),
            resource_id: None,
            metadata: serde_json::json!({
                "policy": policy,
                "version": version,
            }),
            ip_address,
        },
    )
    .await;
}

/// Record acceptance of the current Terms and Privacy policies for a new user.
pub async fn record_signup_policy_acceptances(
    pool: &PgPool,
    user_id: Uuid,
    ip_address: Option<&str>,
) {
    record_policy_acceptance(pool, user_id, "terms", config::TERMS_VERSION, ip_address).await;
    record_policy_acceptance(
        pool,
        user_id,
        "privacy",
        config::PRIVACY_VERSION,
        ip_address,
    )
    .await;
}
