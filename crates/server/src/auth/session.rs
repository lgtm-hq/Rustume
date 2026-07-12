//! HttpOnly session cookies backed by PostgreSQL.

use axum_extra::extract::cookie::{Cookie, SameSite};
use chrono::{Duration, Utc};
use cookie::time;
use hmac::{Hmac, KeyInit, Mac};
use sha2_digest11::Sha256;
use sqlx::PgPool;
use subtle::ConstantTimeEq;
use uuid::Uuid;

use crate::db::{Session, User};

type HmacSha256 = Hmac<Sha256>;

/// Name of the session cookie set on login.
pub const SESSION_COOKIE: &str = "rustume_session";
const SESSION_TTL_DAYS: i64 = 30;

/// Creates, validates, and deletes server-side sessions.
#[derive(Clone)]
pub struct SessionService {
    db: PgPool,
    secret: String,
    cookie_secure: bool,
}

impl SessionService {
    /// Create a session service bound to the given pool and signing secret.
    pub fn new(db: PgPool, secret: String, cookie_secure: bool) -> Self {
        Self {
            db,
            secret,
            cookie_secure,
        }
    }

    /// Persist a new session and return the row plus `Set-Cookie` value.
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

    /// Build a cookie that clears the client session.
    pub fn clear_cookie(&self) -> Cookie<'static> {
        Cookie::build((SESSION_COOKIE, ""))
            .http_only(true)
            .same_site(SameSite::Lax)
            .path("/")
            .max_age(time::Duration::ZERO)
            .secure(self.cookie_secure)
            .into()
    }

    /// Resolve a session token to the owning user, if valid and unexpired.
    pub async fn user_for_token(&self, token: &str) -> Result<Option<User>, sqlx::Error> {
        let session_id = match self.parse_session_token(token) {
            Some(id) => id,
            None => return Ok(None),
        };

        let row = sqlx::query_as::<_, User>(
            r#"
            SELECT
                u.id,
                u.workos_id,
                u.plan,
                u.paddle_customer_id,
                u.email,
                u.first_name,
                u.last_name,
                u.created_at,
                u.updated_at
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

    /// Delete a session by token (no-op when the token is invalid).
    pub async fn delete(&self, token: &str) -> Result<(), sqlx::Error> {
        if let Some(session_id) = self.parse_session_token(token) {
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
        expires_at: chrono::DateTime<Utc>,
    ) -> Cookie<'static> {
        let max_age = (expires_at - Utc::now()).num_seconds().max(0);
        let signed_token = self.format_signed_token(session_id);

        Cookie::build((SESSION_COOKIE, signed_token))
            .http_only(true)
            .same_site(SameSite::Lax)
            .path("/")
            .max_age(time::Duration::seconds(max_age))
            .secure(self.cookie_secure)
            .into()
    }

    fn format_signed_token(&self, session_id: &Uuid) -> String {
        format_signed_session_token(session_id, &self.secret)
    }

    fn parse_session_token(&self, token: &str) -> Option<Uuid> {
        parse_signed_session_token(token, &self.secret)
    }
}

fn format_signed_session_token(session_id: &Uuid, secret: &str) -> String {
    format!("{session_id}.{}", sign_session_id(session_id, secret))
}

fn parse_signed_session_token(token: &str, secret: &str) -> Option<Uuid> {
    let (session_id, signature) = token.rsplit_once('.')?;
    let session_id = Uuid::parse_str(session_id).ok()?;
    let expected = sign_session_id(&session_id, secret);
    if !constant_time_eq(signature.as_bytes(), expected.as_bytes()) {
        return None;
    }
    Some(session_id)
}

fn sign_session_id(session_id: &Uuid, secret: &str) -> String {
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC accepts arbitrary key lengths");
    mac.update(session_id.as_bytes());
    hex_encode(&mac.finalize().into_bytes())
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    left.ct_eq(right).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SECRET: &str = "test-secret-at-least-32-characters-long";

    #[test]
    fn signed_session_token_round_trips() {
        let session_id = Uuid::new_v4();
        let token = format_signed_session_token(&session_id, TEST_SECRET);
        assert_eq!(
            parse_signed_session_token(&token, TEST_SECRET),
            Some(session_id)
        );
    }

    #[test]
    fn rejects_tampered_session_token() {
        let session_id = Uuid::new_v4();
        let token = format!("{session_id}.{}", "0".repeat(64));
        assert_eq!(parse_signed_session_token(&token, TEST_SECRET), None);
    }
}
