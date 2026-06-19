//! Request payload validation helpers.

pub mod json_limits;

pub use json_limits::{validate_resume_json, validate_title};
