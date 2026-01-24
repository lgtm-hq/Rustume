//! HTML sanitization utilities.

use ammonia::Builder;
use std::collections::{HashMap, HashSet};

/// Sanitize HTML content (for resume summaries, etc.).
pub fn sanitize_html(html: &str) -> String {
    let allowed_tags: HashSet<&str> = [
        "a", "abbr", "acronym", "address", "article", "aside", "b", "bdi", "bdo", "big",
        "blockquote", "br", "caption", "center", "cite", "code", "col", "colgroup", "data", "dd",
        "del", "details", "dfn", "div", "dl", "dt", "em", "figcaption", "figure", "footer", "h1",
        "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "ins", "kbd", "li", "main",
        "mark", "nav", "ol", "p", "pre", "q", "rp", "rt", "ruby", "s", "samp", "section", "small",
        "span", "strike", "strong", "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th",
        "thead", "time", "tr", "tt", "u", "ul", "var", "wbr",
    ]
    .iter()
    .copied()
    .collect();

    // Define allowed attributes per tag
    let mut tag_attributes: HashMap<&str, HashSet<&str>> = HashMap::new();
    tag_attributes.insert("a", ["href", "title", "target"].iter().copied().collect());
    tag_attributes.insert("img", ["src", "alt", "title"].iter().copied().collect());

    // Safe global attributes
    let generic_attributes: HashSet<&str> = ["class", "id"].iter().copied().collect();

    Builder::default()
        .tags(allowed_tags)
        .tag_attributes(tag_attributes)
        .generic_attributes(generic_attributes)
        .link_rel(Some("noopener noreferrer"))
        .url_relative(ammonia::UrlRelative::PassThrough)
        .clean(html)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_html_allows_safe_tags() {
        let input = "<p>Hello <strong>world</strong></p>";
        let output = sanitize_html(input);
        assert_eq!(output, "<p>Hello <strong>world</strong></p>");
    }

    #[test]
    fn test_sanitize_html_removes_script() {
        let input = "<p>Hello</p><script>alert('xss')</script>";
        let output = sanitize_html(input);
        assert!(!output.contains("script"));
    }

    #[test]
    fn test_sanitize_html_allows_link_attributes() {
        let input = r#"<a href="https://example.com" title="Example" target="_blank">Link</a>"#;
        let output = sanitize_html(input);
        assert!(output.contains("href"));
        assert!(output.contains("title"));
        assert!(output.contains("target"));
    }

    #[test]
    fn test_sanitize_html_allows_img_attributes() {
        let input = r#"<img src="photo.jpg" alt="Photo" title="My Photo">"#;
        let output = sanitize_html(input);
        assert!(output.contains("src"));
        assert!(output.contains("alt"));
        assert!(output.contains("title"));
    }

    #[test]
    fn test_sanitize_html_allows_class_and_id() {
        let input = r#"<div id="main" class="container">Content</div>"#;
        let output = sanitize_html(input);
        assert!(output.contains("id"));
        assert!(output.contains("class"));
    }
}
