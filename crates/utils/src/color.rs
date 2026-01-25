//! Color conversion utilities.

/// Convert hex color to RGB tuple.
///
/// Only supports 6-digit hex colors (e.g., `#ffffff`). Does not support:
/// - 3-digit shorthand (e.g., `#fff`)
/// - 8-digit RGBA (e.g., `#ffffffaa`)
/// - Named colors (e.g., `red`)
///
/// # Arguments
/// * `hex` - A hex color string, optionally prefixed with a single `#`
///
/// # Returns
/// * `Some((r, g, b))` for valid 6-digit hex colors
/// * `None` for invalid input (non-hex chars, wrong length, multiple `#`, non-ASCII)
pub fn hex_to_rgb(hex: &str) -> Option<(u8, u8, u8)> {
    // Trim whitespace and strip at most one leading '#'
    let hex = hex.trim();
    let hex = hex.strip_prefix('#').unwrap_or(hex);

    // Reject if there's still a '#' (i.e., input had multiple '#')
    if hex.starts_with('#') {
        return None;
    }

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
///
/// Converts valid 6-digit hex colors to CSS `rgb()` or `rgba()` format.
/// **Pass-through behavior**: If the input is not a valid hex color (e.g., CSS
/// named colors like `red`, `blue`, or invalid values), the original input is
/// returned unchanged. This allows non-hex color values to be used directly.
///
/// # Arguments
/// * `hex` - A hex color string (e.g., `#ffffff`) or any other color value
/// * `alpha` - Optional alpha value for rgba() output
///
/// # Returns
/// * For valid hex: `"rgb(255, 255, 255)"` or `"rgba(255, 255, 255, 0.5)"`
/// * For invalid hex: the original input unchanged (pass-through)
///
/// # Examples
/// ```ignore
/// hex_to_rgb_string("#ffffff", None) // => "rgb(255, 255, 255)"
/// hex_to_rgb_string("#000000", Some(0.5)) // => "rgba(0, 0, 0, 0.5)"
/// hex_to_rgb_string("red", None) // => "red" (pass-through)
/// hex_to_rgb_string("invalid", None) // => "invalid" (pass-through)
/// ```
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
///
/// Maps a value from one range to another using linear interpolation.
/// Uses a relative tolerance check to handle edge cases with large magnitudes.
///
/// # Returns
/// * `f64::NAN` if the input range has zero (or near-zero) width
/// * The interpolated value otherwise
pub fn linear_transform(value: f64, in_min: f64, in_max: f64, out_min: f64, out_max: f64) -> f64 {
    let denom = in_max - in_min;
    // Use relative tolerance for better handling of large magnitudes
    let scale = in_max.abs().max(in_min.abs()).max(1.0);
    if denom.abs() <= f64::EPSILON * scale {
        return f64::NAN;
    }

    ((value - in_min) * (out_max - out_min)) / denom + out_min
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
    fn test_hex_to_rgb_without_hash() {
        assert_eq!(hex_to_rgb("ffffff"), Some((255, 255, 255)));
        assert_eq!(hex_to_rgb("dc2626"), Some((220, 38, 38)));
    }

    #[test]
    fn test_hex_to_rgb_with_whitespace() {
        assert_eq!(hex_to_rgb("  #ffffff  "), Some((255, 255, 255)));
        assert_eq!(hex_to_rgb("\t#000000\n"), Some((0, 0, 0)));
    }

    #[test]
    fn test_hex_to_rgb_rejects_multiple_hashes() {
        assert_eq!(hex_to_rgb("##ffffff"), None);
        assert_eq!(hex_to_rgb("###ffffff"), None);
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
    fn test_hex_to_rgb_string_passthrough() {
        // CSS named colors should pass through unchanged
        assert_eq!(hex_to_rgb_string("red", None), "red");
        assert_eq!(hex_to_rgb_string("blue", None), "blue");
        assert_eq!(hex_to_rgb_string("transparent", None), "transparent");

        // Invalid values should pass through unchanged
        assert_eq!(hex_to_rgb_string("invalid", None), "invalid");
        assert_eq!(hex_to_rgb_string("", None), "");
        assert_eq!(hex_to_rgb_string("#fff", None), "#fff"); // 3-digit not supported

        // Pass-through with alpha still returns original
        assert_eq!(hex_to_rgb_string("red", Some(0.5)), "red");
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

    #[test]
    fn test_linear_transform_large_magnitudes() {
        // With large values, a tiny denominator relative to scale should return NaN
        let large = 1e15;
        let tiny = 1e-16; // Much smaller than EPSILON * scale
        assert!(linear_transform(large, large, large + tiny, 0.0, 100.0).is_nan());

        // Normal case with large values should work
        assert!((linear_transform(5e10, 0.0, 10e10, 0.0, 100.0) - 50.0).abs() < 1e-10);
    }
}
