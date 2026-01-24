//! Color conversion utilities.

/// Convert hex color to RGB tuple.
pub fn hex_to_rgb(hex: &str) -> Option<(u8, u8, u8)> {
    let hex = hex.trim_start_matches('#');

    // Guard against non-ASCII input to prevent UTF-8 slicing panic
    if !hex.is_ascii() {
        return None;
    }

    if hex.len() != 6 {
        return None;
    }

    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;

    Some((r, g, b))
}

/// Convert hex color to RGB(A) string.
pub fn hex_to_rgb_string(hex: &str, alpha: Option<f32>) -> String {
    match hex_to_rgb(hex) {
        Some((r, g, b)) => match alpha {
            Some(a) => format!("rgba({}, {}, {}, {})", r, g, b, a),
            None => format!("rgb({}, {}, {})", r, g, b),
        },
        None => hex.to_string(),
    }
}

/// Linear interpolation between two values.
pub fn linear_transform(value: f64, in_min: f64, in_max: f64, out_min: f64, out_max: f64) -> f64 {
    if (in_max - in_min).abs() < f64::EPSILON {
        return f64::NAN;
    }

    ((value - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hex_to_rgb() {
        assert_eq!(hex_to_rgb("#ffffff"), Some((255, 255, 255)));
        assert_eq!(hex_to_rgb("#000000"), Some((0, 0, 0)));
        assert_eq!(hex_to_rgb("#dc2626"), Some((220, 38, 38)));
        assert_eq!(hex_to_rgb("invalid"), None);
    }

    #[test]
    fn test_hex_to_rgb_string() {
        assert_eq!(hex_to_rgb_string("#ffffff", None), "rgb(255, 255, 255)");
        assert_eq!(
            hex_to_rgb_string("#000000", Some(0.5)),
            "rgba(0, 0, 0, 0.5)"
        );
    }

    #[test]
    fn test_hex_to_rgb_non_ascii() {
        assert_eq!(hex_to_rgb("🔴abcde"), None);
        assert_eq!(hex_to_rgb("café12"), None);
    }

    #[test]
    fn test_linear_transform() {
        assert!((linear_transform(5.0, 0.0, 10.0, 0.0, 100.0) - 50.0).abs() < f64::EPSILON);
        assert!(linear_transform(5.0, 10.0, 10.0, 0.0, 100.0).is_nan());
    }
}
