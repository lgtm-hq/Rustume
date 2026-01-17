//! Date handling utilities.

/// Format a date range string.
pub fn format_date_range(start: Option<&str>, end: Option<&str>) -> String {
    match (start, end) {
        (Some(s), Some(e)) if !e.is_empty() => format!("{} - {}", s, e),
        (Some(s), _) => format!("{} - Present", s),
        (None, Some(e)) if !e.is_empty() => format!(" - {}", e),
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_date_range() {
        assert_eq!(format_date_range(Some("2020"), Some("2023")), "2020 - 2023");
        assert_eq!(format_date_range(Some("2020"), None), "2020 - Present");
        assert_eq!(format_date_range(Some("2020"), Some("")), "2020 - Present");
        assert_eq!(format_date_range(None, None), "");
    }
}
