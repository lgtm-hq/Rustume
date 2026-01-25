//! Date handling utilities.

/// Format a date range string.
/// Normalizes empty/whitespace strings and handles end-only ranges cleanly.
pub fn format_date_range(start: Option<&str>, end: Option<&str>) -> String {
    let start = start.map(str::trim).filter(|s| !s.is_empty());
    let end = end.map(str::trim).filter(|e| !e.is_empty());

    match (start, end) {
        (Some(s), Some(e)) => format!("{} - {}", s, e),
        (Some(s), None) => format!("{} - Present", s),
        (None, Some(e)) => e.to_string(),
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
        // End date only returns just the end date (cleaner than " - 2021")
        assert_eq!(format_date_range(None, Some("2021")), "2021");
        // Whitespace-only strings treated as empty
        assert_eq!(format_date_range(Some("  "), Some("2023")), "2023");
        assert_eq!(
            format_date_range(Some("2020"), Some("   ")),
            "2020 - Present"
        );
    }
}
