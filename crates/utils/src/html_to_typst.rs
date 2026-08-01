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
/// Lists nest to arbitrary depth: a `<ul>` or `<ol>` inside an `<li>` is
/// emitted as an indented sublist, and each level takes its marker from its
/// own tag, so `<ol>` inside `<ul>` (and the reverse) renders correctly.
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
    // Run through clean_output so newline normalization matches the HTML path.
    if !trimmed.contains('<') {
        return clean_output(&escape_typst(trimmed));
    }

    let document = Html::parse_fragment(trimmed);
    let mut output = String::new();

    for child in document.root_element().children() {
        process_node(&child, &mut output, 0);
    }

    clean_output(&output)
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
///
/// `list_depth` is how many `<li>` ancestors the node sits inside: `0` outside
/// any list, `1` inside a top-level item, and so on. A list encountered at
/// depth `d` indents its markers by `d` levels, which is how Typst expresses
/// list nesting.
fn process_node(node: &ego_tree::NodeRef<'_, Node>, output: &mut String, list_depth: usize) {
    let in_list = list_depth > 0;
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
                        process_node(&child, &mut inner, 0);
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
                        process_node(&child, &mut inner, list_depth);
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
                        process_node(&child, &mut inner, list_depth);
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
                        process_node(&child, &mut inner, list_depth);
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
                        process_node(&child, &mut inner, list_depth);
                    }
                    if !inner.is_empty() {
                        // Only emit links with safe schemes.
                        let lower = href.trim().to_lowercase();
                        let safe = lower.starts_with("http://")
                            || lower.starts_with("https://")
                            || lower.starts_with("mailto:")
                            || lower.starts_with("tel:");
                        if safe {
                            output.push_str("#link(\"");
                            // Escape quotes in the URL for Typst string literal.
                            output.push_str(&href.replace('\\', "\\\\").replace('"', "\\\""));
                            output.push_str("\")[");
                            output.push_str(&inner);
                            output.push(']');
                        } else {
                            // Unsafe or unknown scheme — render inner text only.
                            output.push_str(&inner);
                        }
                    }
                }
                "ul" | "ol" => {
                    let marker = if tag == "ul" { '-' } else { '+' };
                    process_list(node, output, marker, list_depth);
                }
                "br" => {
                    output.push_str("#linebreak()\n");
                }
                // Unknown tags: process children, strip the tag itself.
                _ => {
                    for child in node.children() {
                        process_node(&child, output, list_depth);
                    }
                }
            }
        }
        // Skip comments, doctypes, processing instructions, etc.
        _ => {}
    }
}

/// Render a `<ul>`/`<ol>` element as Typst list lines.
///
/// `marker` is the bullet character for this list only (`-` for `ul`, `+` for
/// `ol`), so mixed nesting keeps each level's own marker. `depth` is the
/// nesting level: `0` for a top-level list, `1` for a list inside a top-level
/// item, and so on. Each level indents by two spaces, which is how Typst
/// distinguishes a sublist from a sibling item.
fn process_list(
    node: &ego_tree::NodeRef<'_, Node>,
    output: &mut String,
    marker: char,
    depth: usize,
) {
    let indent = "  ".repeat(depth);
    let mut emitted_any = false;

    for child in node.children() {
        let Node::Element(child_el) = child.value() else {
            continue;
        };
        if child_el.name.local.as_ref() != "li" {
            continue;
        }

        let mut inner = String::new();
        for li_child in child.children() {
            // Children of this item sit one level deeper, so a list among
            // them renders as a sublist rather than more sibling bullets.
            process_node(&li_child, &mut inner, depth + 1);
        }
        let trimmed = inner.trim();
        if !trimmed.is_empty() {
            if !emitted_any && depth > 0 {
                // A nested list starts on its own line, directly under its
                // parent item: a blank line in between would close the list
                // in Typst. Trim all trailing whitespace, not just newlines
                // — indented source HTML leaves spaces after the item's
                // text, and a line of only spaces is still a paragraph break
                // to Typst. Deferred until an item is known to be emitted so
                // that a nested list which renders nothing leaves the parent
                // item's text untouched.
                output.truncate(output.trim_end().len());
                if !output.is_empty() {
                    output.push('\n');
                }
            }
            output.push_str(&indent);
            output.push(marker);
            output.push(' ');
            output.push_str(trimmed);
            output.push('\n');
            emitted_any = true;
        }
    }

    // Only a top-level list is followed by a paragraph break; a blank line
    // after a sublist would end the enclosing list too.
    if emitted_any && depth == 0 {
        output.push('\n');
    }
}

/// Clean up the final output: collapse excessive blank lines and trim.
fn clean_output(s: &str) -> String {
    // Single-pass: collapse runs of 3+ newlines into exactly 2.
    let mut result = String::with_capacity(s.len());
    let mut newline_count: u32 = 0;
    for ch in s.chars() {
        if ch == '\n' {
            newline_count += 1;
            if newline_count <= 2 {
                result.push(ch);
            }
        } else {
            newline_count = 0;
            result.push(ch);
        }
    }
    result.trim().to_string()
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
    fn link_unsafe_scheme_stripped() {
        assert_eq!(
            html_to_typst(r#"<a href="javascript:alert(1)">Click</a>"#),
            "Click"
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
    fn nested_bullet_list() {
        let html = "<ul><li>A<ul><li>B</li></ul></li></ul>";
        assert_eq!(html_to_typst(html), "- A\n  - B");
    }

    #[test]
    fn nested_ordered_list() {
        let html = "<ol><li>A<ol><li>B</li></ol></li></ol>";
        assert_eq!(html_to_typst(html), "+ A\n  + B");
    }

    #[test]
    fn ordered_list_nested_in_bullet_list() {
        let html = "<ul><li>A<ol><li>B</li></ol></li></ul>";
        assert_eq!(html_to_typst(html), "- A\n  + B");
    }

    #[test]
    fn bullet_list_nested_in_ordered_list() {
        let html = "<ol><li>A<ul><li>B</li></ul></li></ol>";
        assert_eq!(html_to_typst(html), "+ A\n  - B");
    }

    #[test]
    fn three_level_nesting() {
        let html = "<ul><li>A<ul><li>B<ul><li>C</li></ul></li></ul></li></ul>";
        assert_eq!(html_to_typst(html), "- A\n  - B\n    - C");
    }

    #[test]
    fn parent_list_continues_after_nested_block() {
        let html = "<ul><li>A</li><li>B<ul><li>B1</li><li>B2</li></ul></li><li>C</li></ul>";
        assert_eq!(
            html_to_typst(html),
            "- A\n- B\n  - B1\n  - B2\n- C",
            "items after a sublist must return to the parent level"
        );
    }

    #[test]
    fn nested_list_inside_paragraph_wrapped_item() {
        // Loose-list markup: the item's text is wrapped in a <p>, which must
        // not open a blank line between the item and its sublist.
        let html = "<ul><li><p>A</p><ul><li>B</li></ul></li><li><p>C</p></li></ul>";
        assert_eq!(html_to_typst(html), "- A\n  - B\n- C");
    }

    #[test]
    fn nested_list_survives_indented_source_html() {
        // Pretty-printed HTML leaves the item's text ending in spaces rather
        // than a newline; a blank line there would close the list in Typst.
        let html = "<ul>\n  <li>a\n  <ul>\n    <li>b</li>\n  </ul>\n  </li>\n</ul>";
        assert_eq!(html_to_typst(html), "- a\n  - b");
    }

    #[test]
    fn empty_nested_list_leaves_parent_list_intact() {
        let html = "<ul><li>A<ul></ul></li><li>C</li></ul>";
        assert_eq!(html_to_typst(html), "- A\n- C");
    }

    #[test]
    fn empty_nested_list_does_not_split_the_item_text() {
        // A nested list that renders nothing must not inject a line break
        // between the text before it and the text after it.
        assert_eq!(
            html_to_typst("<ul><li>A<ul></ul>B</li><li>C</li></ul>"),
            "- AB\n- C"
        );
        assert_eq!(
            html_to_typst("<ul><li>A<ul><li></li></ul>B</li><li>C</li></ul>"),
            "- AB\n- C"
        );
    }

    #[test]
    fn nested_list_items_keep_inline_formatting() {
        let html = "<ul><li>A<ul><li><strong>B</strong> deep</li></ul></li></ul>";
        assert_eq!(
            html_to_typst(html),
            "- A\n  - #text(weight: \"bold\")[B] deep"
        );
    }

    #[test]
    fn tiptap_empty_patterns() {
        // TipTap produces these for empty editors.
        assert_eq!(html_to_typst("<p></p>"), "");
        assert_eq!(html_to_typst("<p><br></p>"), "");
    }
}
