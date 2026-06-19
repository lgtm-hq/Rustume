//! Transactional email delivery via the Resend API.

use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::Serialize;
use std::time::Duration;
use tracing::warn;

const RESEND_API_BASE: &str = "https://api.resend.com";
const RESEND_HTTP_TIMEOUT_SECS: u64 = 10;

/// HTTP client for Resend transactional email.
#[derive(Clone)]
pub struct EmailService {
    http: Client,
    api_key: String,
    from: String,
}

impl std::fmt::Debug for EmailService {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("EmailService")
            .field("api_key", &"<redacted>")
            .field("from", &self.from)
            .finish_non_exhaustive()
    }
}

impl EmailService {
    /// Create a client with the given Resend credentials and sender address.
    pub fn new(api_key: String, from: String) -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(RESEND_HTTP_TIMEOUT_SECS))
            .build()
            .expect("reqwest client");
        Self {
            http,
            api_key,
            from,
        }
    }

    /// Sender address used for outbound mail.
    pub fn from_address(&self) -> &str {
        &self.from
    }

    /// Notify the user that subscription cancellation started a grace period.
    pub async fn send_cancellation_warning(
        &self,
        to: &str,
        days_remaining: u32,
    ) -> Result<(), EmailError> {
        let subject = "Your Rustume Cloud subscription has been canceled";
        let days_label = if days_remaining == 1 { "day" } else { "days" };
        let text = format!(
            "Your Rustume Cloud subscription has been canceled.\n\n\
             You can continue using Rustume Cloud for {days_remaining} more {days_label}. \
             Export your resumes before access ends.\n\n\
             To reactivate, sign in at https://app.rustume.com and update billing."
        );
        let html = format!(
            "<p>Your Rustume Cloud subscription has been canceled.</p>\
             <p>You can continue using Rustume Cloud for <strong>{days_remaining}</strong> \
             more {days_label}. Export your resumes before access ends.</p>\
             <p>To reactivate, sign in at \
             <a href=\"https://app.rustume.com\">app.rustume.com</a> and update billing.</p>"
        );
        self.send(to, subject, &text, &html).await
    }

    /// Warn the user that account data will be deleted on a specific date.
    pub async fn send_deletion_warning(
        &self,
        to: &str,
        deletion_date: DateTime<Utc>,
    ) -> Result<(), EmailError> {
        let formatted = deletion_date.format("%Y-%m-%d %H:%M UTC");
        let subject = "Your Rustume Cloud account will be deleted soon";
        let text = format!(
            "Your Rustume Cloud account and stored resumes are scheduled for deletion on \
             {formatted}.\n\n\
             Sign in at https://app.rustume.com to export your data or reactivate your \
             subscription before that date."
        );
        let html = format!(
            "<p>Your Rustume Cloud account and stored resumes are scheduled for deletion on \
             <strong>{formatted}</strong>.</p>\
             <p>Sign in at <a href=\"https://app.rustume.com\">app.rustume.com</a> to export \
             your data or reactivate your subscription before that date.</p>"
        );
        self.send(to, subject, &text, &html).await
    }

    /// Confirm that account deletion completed.
    pub async fn send_deletion_confirmation(&self, to: &str) -> Result<(), EmailError> {
        let subject = "Your Rustume Cloud account has been deleted";
        let text = "Your Rustume Cloud account and associated resume data have been deleted.\n\n\
            If you did not request this, contact support@rustume.com immediately.";
        let html = "<p>Your Rustume Cloud account and associated resume data have been \
            deleted.</p><p>If you did not request this, contact \
            <a href=\"mailto:support@rustume.com\">support@rustume.com</a> immediately.</p>";
        self.send(to, subject, text, html).await
    }

    /// Notify the user that a payment failed and action is required.
    pub async fn send_payment_failed(&self, to: &str) -> Result<(), EmailError> {
        let subject = "Action required: Rustume Cloud payment failed";
        let text = "We could not process your latest Rustume Cloud payment.\n\n\
            Sign in at https://app.rustume.com to update your billing details and avoid \
            service interruption.";
        let html = "<p>We could not process your latest Rustume Cloud payment.</p>\
            <p>Sign in at <a href=\"https://app.rustume.com\">app.rustume.com</a> to update \
            your billing details and avoid service interruption.</p>";
        self.send(to, subject, text, html).await
    }

    async fn send(
        &self,
        to: &str,
        subject: &str,
        text: &str,
        html: &str,
    ) -> Result<(), EmailError> {
        let payload = ResendEmailRequest {
            from: self.from.clone(),
            to: vec![to.to_string()],
            subject: subject.to_string(),
            text: text.to_string(),
            html: html.to_string(),
        };

        let response = self
            .http
            .post(format!("{RESEND_API_BASE}/emails"))
            .bearer_auth(&self.api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|err| EmailError::Transport(err.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|err| format!("failed to read response: {err}"));
            let body = truncate_body(&body);
            return Err(EmailError::Api {
                status: status.as_u16(),
                body,
            });
        }

        Ok(())
    }
}

#[derive(Debug, Serialize)]
struct ResendEmailRequest {
    from: String,
    to: Vec<String>,
    subject: String,
    text: String,
    html: String,
}

/// Errors returned when communicating with Resend.
#[derive(Debug, thiserror::Error)]
pub enum EmailError {
    #[error("Resend request failed: {0}")]
    Transport(String),
    #[error("Resend API error ({status}): {body}")]
    Api { status: u16, body: String },
}

/// Log email delivery failures without failing the caller's primary action.
pub fn log_send_failure(template: &str, recipient: &str, err: &EmailError) {
    let masked_recipient = mask_recipient(recipient);
    match err {
        EmailError::Api { status, .. } => {
            warn!(
                template = template,
                recipient = %masked_recipient,
                status = status,
                "transactional email send failed (Resend API error)"
            );
        }
        EmailError::Transport(message) => {
            warn!(
                template = template,
                recipient = %masked_recipient,
                error = %message,
                "transactional email send failed"
            );
        }
    }
}

fn mask_recipient(recipient: &str) -> String {
    let Some((local, domain)) = recipient.split_once('@') else {
        return "***".to_string();
    };

    let masked_local = match local.chars().next() {
        Some(first) => format!("{first}***"),
        None => "***".to_string(),
    };

    format!("{masked_local}@{domain}")
}

fn truncate_body(body: &str) -> String {
    if body.chars().count() > 200 {
        let truncated: String = body.chars().take(200).collect();
        format!("{truncated}… (truncated)")
    } else {
        body.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resend_payload_serializes_expected_fields() {
        let payload = ResendEmailRequest {
            from: "noreply@rustume.com".to_string(),
            to: vec!["user@example.com".to_string()],
            subject: "Test".to_string(),
            text: "plain".to_string(),
            html: "<p>html</p>".to_string(),
        };

        let json = serde_json::to_value(payload).expect("serialize");
        assert_eq!(json["from"], "noreply@rustume.com");
        assert_eq!(json["to"], serde_json::json!(["user@example.com"]));
        assert_eq!(json["subject"], "Test");
        assert_eq!(json["text"], "plain");
        assert_eq!(json["html"], "<p>html</p>");
    }

    #[test]
    fn mask_recipient_redacts_local_part() {
        assert_eq!(mask_recipient("user@example.com"), "u***@example.com");
        assert_eq!(mask_recipient("a@example.com"), "a***@example.com");
    }

    #[test]
    fn truncate_body_limits_long_api_errors() {
        let long = "x".repeat(250);
        let truncated = truncate_body(&long);
        assert!(truncated.chars().count() <= 220);
        assert!(truncated.ends_with("… (truncated)"));
    }
}
