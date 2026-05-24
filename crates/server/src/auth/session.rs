use axum_extra::extract::cookie::{Cookie, SameSite};
use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::db::{Session, User};

pub const SESSION_COOKIE: &str = "rustume_session";
const SESSION_TTL_DAYS: i64 = 30;

#[derive(Clone)]
pub struct SessionService {
    db: PgPool,
    secret: String,
}

impl SessionService {
    pub fn new(db: PgPool, secret: String) -> Self {
        Self { db, secret }
    }

    pub async fn create(&self, user_id: Uuid) -> Result<(Session, Cookie<'static>), sqlx::Error> {
        let expires_at = Utc::now() + Duration::days(SESSION_TTL_DAYS);
        let session = sqlx::query_as::<_, Session>(
            r#"
            INSERT INTO sessions (user_id, expires_at)
            VALUES ($1, $2)
            RETURNING id, user_id, expires_at, created_at
            "#,
        )
        .bind(user_id)
        .bind(expires_at)
        .fetch_one(&self.db)
        .await?;

        Ok((session.clone(), self.build_cookie(&session.id, expires_at)))
    }

    pub fn clear_cookie(&self) -> Cookie<'static> {
        Cookie::build((SESSION_COOKIE, ""))
            .http_only(true)
            .same_site(SameSite::Lax)
            .path("/")
            .into()
    }

    pub async fn user_for_token(&self, token: &str) -> Result<Option<User>, sqlx::Error> {
        let session_id = match Uuid::parse_str(token) {
            Ok(id) => id,
            Err(_) => return Ok(None),
        };

        let row = sqlx::query_as::<_, User>(
            r#"
            SELECT u.id, u.workos_id, u.email, u.name, u.plan, u.stripe_customer_id, u.created_at, u.updated_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.id = $1 AND s.expires_at > now()
            "#,
        )
        .bind(session_id)
        .fetch_optional(&self.db)
        .await?;

        Ok(row)
    }

    pub async fn delete(&self, token: &str) -> Result<(), sqlx::Error> {
        if let Ok(session_id) = Uuid::parse_str(token) {
            sqlx::query("DELETE FROM sessions WHERE id = $1")
                .bind(session_id)
                .execute(&self.db)
                .await?;
        }
        Ok(())
    }

    fn build_cookie(
        &self,
        session_id: &Uuid,
        _expires_at: chrono::DateTime<Utc>,
    ) -> Cookie<'static> {
        let secure = std::env::var("WORKOS_REDIRECT_URI")
            .map(|uri| uri.starts_with("https://"))
            .unwrap_or(false);

        Cookie::build((SESSION_COOKIE, session_id.to_string()))
            .http_only(true)
            .same_site(SameSite::Lax)
            .path("/")
            .secure(secure)
            .into()
    }

    #[allow(dead_code)]
    pub fn secret(&self) -> &str {
        &self.secret
    }
}
