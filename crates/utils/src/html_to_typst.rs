//! Convert a subset of HTML to Typst markup.
//!
//! Handles the formatting tags produced by the TipTap rich text editor:
//! bold, italic, underline, links, bullet/ordered lists, paragraphs, line breaks.

use scraper::{Html, Node};

/// Convert an HTML string to Typst markup.
///
/// Supported tags:
/// - `<p>` — paragraph break (double newline)
/// - `<strong>`, `<b>` — `#text(weight: "bold")[…]`
/// - `<em>`, `<i>` — `#emph[…]`
/// - `<u>` — `#underline[…]`
/// - `<a href="…">` — `#link("url")[…]`
/// - `<ul><li>` — `- item`
/// - `<ol><li>` — `+ item`
/// - `<br>` — `#linebreak()`
///
/// All other tags are stripped; their text content is preserved.
/// Plain text without any HTML tags passes through unchanged.
pub fn html_to_typst(html: &str) -> String {
    let trimmed = html.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    // Fast path: no HTML tags at all → escape Typst special chars and return.
    // Even plain text needs escaping because templates eval() the result.
    if !trimmed.contains('<') {
        return escape_typst(trimmed);
    }

    let document = Html::parse_fragment(trimmed);
    let mut output = String::new();

    for child in document.root_element().children() {
        process_node(&child, &mut output, false);
    }

    clean_output(output)
}

/// Escape characters that are special in Typst content mode.
fn escape_typst(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '#' => out.push_str("\\#"),
            '[' => out.push_str("\\["),
            ']' => out.push_str("\\]"),
            '$' => out.push_str("\\$"),
            '@' => out.push_str("\\@"),
            '*' => out.push_str("\\*"),
            '_' => out.push_str("\\_"),
            '`' => out.push_str("\\`"),
            '%' => out.push_str("\\%"),
            '~' => out.push_str("\\~"),
            '<' => out.push_str("\\<"),
            '>' => out.push_str("\\>"),
            _ => out.push(ch),
        }
    }
    out
}

/// Recursively process a DOM node and append Typst markup.
fn process_node(node: &ego_tree::NodeRef<'_, Node>, output: &mut String, in_list: bool) {
    match node.value() {
        Node::Text(text) => {
            let t = text.text.as_ref();
            // Inside list items, skip pure-whitespace text nodes that are just
            // formatting artifacts from the HTML parser.
            if in_list && t.chars().all(|c| c.is_whitespace()) {
                return;
            }
            output.push_str(&escape_typst(t));
        }
        Node::Element(el) => {
            let tag = el.name.local.as_ref();
            match tag {
                "p" => {
                    let mut inner = String::new();
                    for child in node.children() {
                        process_node(&child, &mut inner, false);
                    }
                    let trimmed = inner.trim();
                    // TipTap produces <p><br></p> for empty editors — treat as empty.
                    if !trimmed.is_empty() && trimmed != "#linebreak()" {
                        output.push_str(trimmed);
                        output.push_str("\n\n");
                    }
                }
                "strong" | "b" => {
                    let mut inner = String::new();
                    for child in node.children() {
                        process_node(&child, &mut inner, in_list);
                    }
                    if !inner.is_empty() {
                        output.push_str("#text(weight: \"bold\")[");
                        output.push_str(&inner);
                        output.push(']');
                    }
                }
                "em" | "i" => {
                    let mut inner = String::new();
                    for child in node.children() {
                        process_node(&child, &mut inner, in_list);
                    }
                    if !inner.is_empty() {
                        output.push_str("#emph[");
                        output.push_str(&inner);
                        output.push(']');
                    }
                }
                "u" => {
                    let mut inner = String::new();
                    for child in node.children() {
                        process_node(&child, &mut inner, in_list);
                    }
                    if !inner.is_empty() {
                        output.push_str("#underline[");
                        output.push_str(&inner);
                        output.push(']');
                    }
                }
                "a" => {
                    let href = el.attr("href").unwrap_or("");
                    let mut inner = String::new();
                    for child in node.children() {
                        process_node(&child, &mut inner, in_list);
                    }
                    if !inner.is_empty() {
                        output.push_str("#link(\"");
                        // Escape quotes in the URL for Typst string literal.
                        output.push_str(&href.replace('\\', "\\\\").replace('"', "\\\""));
                        output.push_str("\")[");
                        output.push_str(&inner);
                        output.push(']');
                    }
                }
                "ul" => {
                    let mut emitted_any = false;
                    for child in node.children() {
                        if let Node::Element(child_el) = child.value() {
                            if child_el.name.local.as_ref() == "li" {
                                let mut inner = String::new();
                                for li_child in child.children() {
                                    process_node(&li_child, &mut inner, true);
                                }
                                let trimmed = inner.trim();
                                if !trimmed.is_empty() {
                                    output.push_str("- ");
                                    output.push_str(trimmed);
                                    output.push('\n');
                                    emitted_any = true;
                                }
                            }
                        }
                    }
                    if emitted_any {
                        output.push('\n');
                    }
                }
                "ol" => {
                    let mut emitted_any = false;
                    for child in node.children() {
                        if let Node::Element(child_el) = child.value() {
                            if child_el.name.local.as_ref() == "li" {
                                let mut inner = String::new();
                                for li_child in child.children() {
                                    process_node(&li_child, &mut inner, true);
                                }
                                let trimmed = inner.trim();
                                if !trimmed.is_empty() {
                                    output.push_str("+ ");
                                    output.push_str(trimmed);
                                    output.push('\n');
                                    emitted_any = true;
                                }
                            }
                        }
                    }
                    if emitted_any {
                        output.push('\n');
                    }
                }
                "br" => {
                    output.push_str("#linebreak()\n");
                }
                // Unknown tags: process children, strip the tag itself.
                _ => {
                    for child in node.children() {
                        process_node(&child, output, in_list);
                    }
                }
            }
        }
        // Skip comments, doctypes, processing instructions, etc.
        _ => {}
    }
}

/// Clean up the final output: collapse excessive blank lines and trim.
fn clean_output(mut s: String) -> String {
    // Collapse 3+ consecutive newlines into 2.
    while s.contains("\n\n\n") {
        s = s.replace("\n\n\n", "\n\n");
    }
    s.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_text_passthrough() {
        assert_eq!(html_to_typst("Hello world"), "Hello world");
    }

    #[test]
    fn empty_string() {
        assert_eq!(html_to_typst(""), "");
        assert_eq!(html_to_typst("   "), "");
    }

    #[test]
    fn empty_paragraph() {
        assert_eq!(html_to_typst("<p></p>"), "");
    }

    #[test]
    fn single_paragraph() {
        assert_eq!(html_to_typst("<p>Hello world</p>"), "Hello world");
    }

    #[test]
    fn multiple_paragraphs() {
        let result = html_to_typst("<p>First</p><p>Second</p>");
        assert_eq!(result, "First\n\nSecond");
    }

    #[test]
    fn bold() {
        assert_eq!(
            html_to_typst("<p><strong>bold</strong></p>"),
            "#text(weight: \"bold\")[bold]"
        );
    }

    #[test]
    fn bold_b_tag() {
        assert_eq!(
            html_to_typst("<p><b>bold</b></p>"),
            "#text(weight: \"bold\")[bold]"
        );
    }

    #[test]
    fn italic() {
        assert_eq!(html_to_typst("<p><em>italic</em></p>"), "#emph[italic]");
    }

    #[test]
    fn italic_i_tag() {
        assert_eq!(html_to_typst("<p><i>italic</i></p>"), "#emph[italic]");
    }

    #[test]
    fn underline() {
        assert_eq!(
            html_to_typst("<p><u>underlined</u></p>"),
            "#underline[underlined]"
        );
    }

    #[test]
    fn link() {
        assert_eq!(
            html_to_typst(r#"<p><a href="https://example.com">Example</a></p>"#),
            "#link(\"https://example.com\")[Example]"
        );
    }

    #[test]
    fn link_with_quotes_in_url() {
        assert_eq!(
            html_to_typst(r#"<p><a href="https://example.com?q=a&quot;b">Link</a></p>"#),
            "#link(\"https://example.com?q=a\\\"b\")[Link]"
        );
    }

    #[test]
    fn bullet_list() {
        let html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
        let result = html_to_typst(html);
        assert!(result.contains("- Item 1"));
        assert!(result.contains("- Item 2"));
    }

    #[test]
    fn ordered_list() {
        let html = "<ol><li>First</li><li>Second</li></ol>";
        let result = html_to_typst(html);
        assert!(result.contains("+ First"));
        assert!(result.contains("+ Second"));
    }

    #[test]
    fn line_break() {
        assert_eq!(
            html_to_typst("<p>Line 1<br>Line 2</p>"),
            "Line 1#linebreak()\nLine 2"
        );
    }

    #[test]
    fn nested_bold_in_italic() {
        let html = "<p><em>italic <strong>and bold</strong></em></p>";
        let result = html_to_typst(html);
        assert_eq!(result, "#emph[italic #text(weight: \"bold\")[and bold]]");
    }

    #[test]
    fn special_char_escaping() {
        assert_eq!(html_to_typst("<p>#hashtag</p>"), "\\#hashtag");
    }

    #[test]
    fn multiple_special_chars() {
        let result = html_to_typst("<p>Use @mention and $var</p>");
        assert!(result.contains("\\@mention"));
        assert!(result.contains("\\$var"));
    }

    #[test]
    fn mixed_content() {
        let html = "<p>Led development of <strong>core platform</strong>. Achieved <em>40% improvement</em>.</p>";
        let result = html_to_typst(html);
        assert!(result.contains("Led development of "));
        assert!(result.contains("#text(weight: \"bold\")[core platform]"));
        assert!(result.contains("#emph[40\\% improvement]"));
    }

    #[test]
    fn unknown_tags_stripped() {
        assert_eq!(html_to_typst("<p><span>text</span></p>"), "text");
    }

    #[test]
    fn list_with_formatting() {
        let html = "<ul><li><strong>Bold</strong> item</li><li>Normal item</li></ul>";
        let result = html_to_typst(html);
        assert!(result.contains("- #text(weight: \"bold\")[Bold] item"));
        assert!(result.contains("- Normal item"));
    }

    #[test]
    fn paragraph_then_list() {
        let html = "<p>Responsibilities:</p><ul><li>Item A</li><li>Item B</li></ul>";
        let result = html_to_typst(html);
        assert!(result.contains("Responsibilities:"));
        assert!(result.contains("- Item A"));
        assert!(result.contains("- Item B"));
    }

    #[test]
    fn tiptap_empty_patterns() {
        // TipTap produces these for empty editors.
        assert_eq!(html_to_typst("<p></p>"), "");
        assert_eq!(html_to_typst("<p><br></p>"), "");
    }
}
