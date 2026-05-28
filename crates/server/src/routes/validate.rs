use axum::Json;
use rustume_schema::ResumeData;
use validator::Validate;

use crate::dto::ValidationResponse;

/// Validate resume data
///
/// Checks if the provided resume data conforms to the Rustume schema.
/// Returns validation errors if the data is invalid.
#[utoipa::path(
    post,
    path = "/api/validate",
    tag = "Validate",
    request_body = ResumeData,
    responses(
        (status = 200, description = "Validation result", body = ValidationResponse)
    )
)]
pub async fn validate(Json(resume): Json<ResumeData>) -> Json<ValidationResponse> {
    match resume.validate() {
        Ok(_) => Json(ValidationResponse {
            valid: true,
            errors: None,
        }),
        Err(e) => Json(ValidationResponse {
            valid: false,
            errors: Some(validation_errors(&e)),
        }),
    }
}

/// Extract validation errors as strings (including nested struct and list errors)
pub fn validation_errors(errors: &validator::ValidationErrors) -> Vec<String> {
    fn collect_errors(
        errors: &validator::ValidationErrors,
        prefix: &str,
        result: &mut Vec<String>,
    ) {
        // Collect field errors
        for (field, errs) in errors.field_errors() {
            let field_path = if prefix.is_empty() {
                field.to_string()
            } else {
                format!("{}.{}", prefix, field)
            };
            for e in errs {
                result.push(format!(
                    "{}: {}",
                    field_path,
                    e.message
                        .as_ref()
                        .map(|m| m.to_string())
                        .unwrap_or_else(|| e.code.to_string())
                ));
            }
        }

        // Recursively collect nested struct and list errors
        for (field, nested) in errors.errors() {
            let field_path = if prefix.is_empty() {
                field.to_string()
            } else {
                format!("{}.{}", prefix, field)
            };
            match nested {
                validator::ValidationErrorsKind::Struct(nested_errors) => {
                    collect_errors(nested_errors.as_ref(), &field_path, result);
                }
                validator::ValidationErrorsKind::List(list_errors) => {
                    for (idx, nested_errors) in list_errors.iter() {
                        let indexed_path = format!("{}[{}]", field_path, idx);
                        collect_errors(nested_errors.as_ref(), &indexed_path, result);
                    }
                }
                validator::ValidationErrorsKind::Field(_) => {
                    // Already handled by field_errors() above
                }
            }
        }
    }

    let mut result = Vec::new();
    collect_errors(errors, "", &mut result);
    result
}
