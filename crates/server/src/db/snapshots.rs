//! Resume snapshot persistence for version history.

use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::error::ApiError;

/// Maximum snapshots retained per resume after each write.
pub const MAX_SNAPSHOTS_PER_RESUME: i64 = 50;

/// List snapshot metadata for a resume, newest first.
pub async fn list_resume_snapshots(
    db: &PgPool,
    resume_id: Uuid,
) -> Result<Vec<crate::db::ResumeVersionSummary>, ApiError> {
    sqlx::query_as::<_, crate::db::ResumeVersionSummary>(
        r#"
        SELECT version, created_at
        FROM resume_snapshots
        WHERE resume_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(resume_id)
    .fetch_all(db)
    .await
    .map_err(internal_db_error)
}

/// Fetch a single snapshot when owned by the given user.
pub async fn get_resume_snapshot(
    db: &PgPool,
    user_id: Uuid,
    resume_id: Uuid,
    version: i32,
) -> Result<crate::db::ResumeSnapshot, ApiError> {
    sqlx::query_as::<_, crate::db::ResumeSnapshot>(
        r#"
        SELECT s.id, s.resume_id, s.version, s.data, s.created_at
        FROM resume_snapshots s
        INNER JOIN resumes r ON r.id = s.resume_id
        WHERE s.resume_id = $1
          AND s.version = $2
          AND r.user_id = $3
        "#,
    )
    .bind(resume_id)
    .bind(version)
    .bind(user_id)
    .fetch_optional(db)
    .await
    .map_err(internal_db_error)?
    .ok_or_else(|| ApiError::not_found("Resume version not found"))
}

/// Apply a snapshot as the current resume state and record a new snapshot.
pub async fn restore_resume_snapshot(
    db: &PgPool,
    user_id: Uuid,
    resume_id: Uuid,
    version: i32,
) -> Result<crate::db::ResumeRow, ApiError> {
    let snapshot = get_resume_snapshot(db, user_id, resume_id, version).await?;

    let mut tx = db.begin().await.map_err(internal_db_error)?;

    let row = sqlx::query_as::<_, crate::db::ResumeRow>(
        r#"
        UPDATE resumes
        SET data = $1,
            version = version + 1,
            updated_at = now()
        WHERE id = $2 AND user_id = $3
        RETURNING id, user_id, title, data, is_public, public_slug, password_hash, version, created_at, updated_at
        "#,
    )
    .bind(&snapshot.data)
    .bind(resume_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(internal_db_error)?
    .ok_or_else(|| ApiError::not_found("Resume not found"))?;

    write_snapshot_in_tx(&mut tx, resume_id, row.version, &row.data).await?;
    tx.commit().await.map_err(internal_db_error)?;

    Ok(row)
}

/// Capture a snapshot after a successful resume update within an open transaction.
pub async fn capture_resume_snapshot(
    tx: &mut Transaction<'_, Postgres>,
    resume_id: Uuid,
    version: i32,
    data: &Value,
) -> Result<(), ApiError> {
    write_snapshot_in_tx(tx, resume_id, version, data).await
}

async fn write_snapshot_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    resume_id: Uuid,
    version: i32,
    data: &Value,
) -> Result<(), ApiError> {
    sqlx::query(
        r#"
        INSERT INTO resume_snapshots (resume_id, version, data)
        VALUES ($1, $2, $3)
        "#,
    )
    .bind(resume_id)
    .bind(version)
    .bind(data)
    .execute(&mut **tx)
    .await
    .map_err(internal_db_error)?;

    sqlx::query(
        r#"
        DELETE FROM resume_snapshots
        WHERE resume_id = $1
          AND id NOT IN (
              SELECT id
              FROM resume_snapshots
              WHERE resume_id = $1
              ORDER BY created_at DESC
              LIMIT $2
          )
        "#,
    )
    .bind(resume_id)
    .bind(MAX_SNAPSHOTS_PER_RESUME)
    .execute(&mut **tx)
    .await
    .map_err(internal_db_error)?;

    Ok(())
}

fn internal_db_error(err: impl std::fmt::Display + Send + Sync + 'static) -> ApiError {
    tracing::error!("database error: {err}");
    ApiError::internal("internal server error")
}
