//! JSON complexity limits for resume payloads.

use std::io::{self, Write};

use serde_json::Value;

use crate::config::{MAX_JSON_DEPTH, MAX_RESUME_JSON_BYTES, MAX_STRING_FIELD_LEN, MAX_TITLE_LEN};
use crate::error::ApiError;

/// Reject titles that exceed the configured character limit.
pub fn validate_title(title: &str) -> Result<(), ApiError> {
    if title.chars().count() > MAX_TITLE_LEN {
        return Err(ApiError::new(format!(
            "Title exceeds maximum length of {MAX_TITLE_LEN} characters"
        )));
    }
    Ok(())
}

/// Writer that counts bytes without retaining them.
///
/// Used so size checks match compact `serde_json` serialization exactly
/// (same limit semantics as the former `serde_json::to_vec(...).len()` path)
/// without allocating a full copy of the payload.
struct CountingWriter {
    count: usize,
}

impl Write for CountingWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.count = self.count.saturating_add(buf.len());
        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

/// Byte length of `value` under compact `serde_json` serialization.
///
/// Exactness against serialization form matters here: callers pass an already
/// deserialized [`Value`], and the historical limit measured `to_vec` size
/// (not the raw HTTP body, which may include wrappers/whitespace). A counting
/// writer preserves that measurement without the intermediate buffer.
fn serialized_json_size(value: &Value) -> Result<usize, ApiError> {
    let mut counter = CountingWriter { count: 0 };
    serde_json::to_writer(&mut counter, value)
        .map_err(|_| ApiError::new("Invalid resume JSON"))?;
    Ok(counter.count)
}

/// Validate resume JSON depth, string lengths, and serialized size.
pub fn validate_resume_json(value: &Value) -> Result<(), ApiError> {
    validate_json_depth(value, MAX_JSON_DEPTH, 1)?;
    validate_string_lengths(value)?;
    let size = serialized_json_size(value)?;
    if size > MAX_RESUME_JSON_BYTES {
        return Err(ApiError::new(format!(
            "Resume JSON exceeds maximum size of {MAX_RESUME_JSON_BYTES} bytes"
        )));
    }
    Ok(())
}

fn validate_json_depth(value: &Value, max_depth: usize, current: usize) -> Result<(), ApiError> {
    if current > max_depth {
        return Err(ApiError::new(format!(
            "JSON depth exceeds maximum of {max_depth}"
        )));
    }

    match value {
        Value::Object(map) => {
            for child in map.values() {
                validate_json_depth(child, max_depth, current + 1)?;
            }
        }
        Value::Array(items) => {
            for child in items {
                validate_json_depth(child, max_depth, current + 1)?;
            }
        }
        _ => {}
    }
    Ok(())
}

fn validate_string_lengths(value: &Value) -> Result<(), ApiError> {
    match value {
        Value::String(text) => {
            // Profile photos are stored as `data:image/...;base64,...` and routinely
            // exceed the text-field cap. Overall resume size is still bounded by
            // MAX_RESUME_JSON_BYTES.
            if text.starts_with("data:image/") {
                return Ok(());
            }
            if text.chars().count() > MAX_STRING_FIELD_LEN {
                return Err(ApiError::new(format!(
                    "String field exceeds maximum length of {MAX_STRING_FIELD_LEN} characters"
                )));
            }
        }
        Value::Object(map) => {
            for child in map.values() {
                validate_string_lengths(child)?;
            }
        }
        Value::Array(items) => {
            for child in items {
                validate_string_lengths(child)?;
            }
        }
        _ => {}
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rejects_deeply_nested_json() {
        let mut value = json!(1);
        for _ in 0..MAX_JSON_DEPTH {
            value = json!({ "nested": value });
        }

        let err = validate_resume_json(&value).expect_err("expected depth error");
        assert!(err.error.contains("depth"));
    }

    #[test]
    fn rejects_oversized_string_field() {
        let value = json!({ "summary": "x".repeat(MAX_STRING_FIELD_LEN + 1) });
        let err = validate_resume_json(&value).expect_err("expected string length error");
        assert!(err.error.contains("String field"));
    }

    #[test]
    fn accepts_minimal_resume_json() {
        validate_resume_json(&json!({ "basics": { "name": "Ada Lovelace" } }))
            .expect("minimal resume should pass");
    }

    #[test]
    fn accepts_json_at_max_depth() {
        let mut value = json!(1);
        for _ in 0..(MAX_JSON_DEPTH - 1) {
            value = json!({ "nested": value });
        }

        validate_resume_json(&value).expect("depth at MAX_JSON_DEPTH should pass");
    }

    #[test]
    fn accepts_oversized_data_image_url() {
        let value = json!({
            "basics": {
                "name": "Ada",
                "picture": {
                    "url": format!("data:image/jpeg;base64,{}", "A".repeat(MAX_STRING_FIELD_LEN + 100))
                }
            }
        });
        validate_resume_json(&value)
            .expect("profile photo data URLs should bypass string-field cap");
    }

    #[test]
    fn still_rejects_oversized_non_image_strings() {
        let value = json!({
            "basics": {
                "summary": "x".repeat(MAX_STRING_FIELD_LEN + 1)
            }
        });
        let err = validate_resume_json(&value).expect_err("expected string length error");
        assert!(err.error.contains("String field"));
    }

    #[test]
    fn counting_writer_matches_to_vec_len() {
        let value = json!({
            "basics": { "name": "Ada", "summary": "x".repeat(1024) },
            "items": [1, 2, 3],
        });
        let expected = serde_json::to_vec(&value).unwrap().len();
        assert_eq!(serialized_json_size(&value).unwrap(), expected);
    }

    #[test]
    fn rejects_oversized_serialized_payload() {
        // Use a photo data URL so the per-field string cap does not fire first;
        // overall compact serialization still exceeds MAX_RESUME_JSON_BYTES.
        let value = json!({
            "basics": {
                "picture": {
                    "url": format!(
                        "data:image/jpeg;base64,{}",
                        "A".repeat(MAX_RESUME_JSON_BYTES)
                    )
                }
            }
        });
        let err = validate_resume_json(&value).expect_err("expected size error");
        assert!(
            err.error.contains("maximum size"),
            "unexpected error: {}",
            err.error
        );
    }
}
