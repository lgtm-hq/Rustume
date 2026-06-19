//! RFC 9116 security contact endpoint.

use axum::{
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};

const SECURITY_TXT: &str = "\
Contact: mailto:turbocoder13@gmail.com\n\
Expires: 2027-06-19T00:00:00.000Z\n\
Preferred-Languages: en\n\
Canonical: https://rustume.com/.well-known/security.txt\n\
Policy: https://github.com/lgtm-hq/Rustume/blob/main/SECURITY.md\n\
# Renew Expires annually — see SECURITY.md and issue #248.\n";

/// Serve `/.well-known/security.txt` for responsible disclosure contacts.
pub async fn security_txt() -> Response {
    (
        StatusCode::OK,
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/plain; charset=utf-8"),
        )],
        SECURITY_TXT,
    )
        .into_response()
}
