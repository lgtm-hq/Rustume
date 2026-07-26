//! Append-only audit logging for security-sensitive events.

use serde_json::Value;
use sqlx::{Executor, PgPool, Postgres};
use tracing::error;
use uuid::Uuid;

/// Security-relevant event to persist in the audit log.
#[derive(Debug)]
pub struct AuditEvent<'a> {
    /// Stable event identifier (for example `auth.login.success`).
    pub event_type: &'a str,
    /// Authenticated user associated with the event, when known.
    pub actor_user_id: Option<Uuid>,
    /// Resource category (for example `resume`).
    pub resource_type: Option<&'a str>,
    /// Resource identifier, when applicable.
    pub resource_id: Option<Uuid>,
    /// Structured metadata without secrets or resume document content.
    pub metadata: Value,
    /// Client IP address, when available.
    pub ip_address: Option<&'a str>,
}

/// Insert an audit event without failing the primary request on persistence errors.
pub async fn record_event(pool: &PgPool, event: AuditEvent<'_>) {
    if let Err(err) = insert_event(pool, event).await {
        error!("audit log insert failed: {err}");
    }
}

/// Insert an audit event and propagate persistence errors to the caller.
pub async fn record_event_required<'e, E>(
    executor: E,
    event: AuditEvent<'_>,
) -> Result<(), sqlx::Error>
where
    E: Executor<'e, Database = Postgres>,
{
    insert_event(executor, event).await
}

async fn insert_event<'e, E>(executor: E, event: AuditEvent<'_>) -> Result<(), sqlx::Error>
where
    E: Executor<'e, Database = Postgres>,
{
    sqlx::query(
        r#"
        INSERT INTO audit_events (
            event_type,
            actor_user_id,
            resource_type,
            resource_id,
            metadata,
            ip_address
        )
        VALUES ($1, $2, $3, $4, $5, $6::inet)
        "#,
    )
    .bind(event.event_type)
    .bind(event.actor_user_id)
    .bind(event.resource_type)
    .bind(event.resource_id)
    .bind(event.metadata)
    .bind(event.ip_address)
    .execute(executor)
    .await?;

    Ok(())
}
