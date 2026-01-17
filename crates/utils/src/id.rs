//! ID generation utilities.

/// Generate a CUID2 ID.
pub fn create_id() -> String {
    cuid2::create_id()
}

/// Validate a CUID2 ID format.
pub fn is_valid_id(id: &str) -> bool {
    cuid2::is_cuid2(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_id() {
        let id = create_id();
        assert!(!id.is_empty());
        assert!(is_valid_id(&id));
    }
}
