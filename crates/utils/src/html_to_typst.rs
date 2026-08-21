//! Convert a subset of HTML to Typst markup.
//!
//! Handles the formatting tags produced by the TipTap rich text editor and the
//! markdown pipeline: bold, italic, underline, links, bullet/ordered lists,
//! paragraphs, line breaks, and inline/block code.
//!
//! Legacy resume fields are marked HTML (or have no `contentFormat`) but often
//! contain a markdown subset — `**bold**`, `__bold__`, `***bold italic***`,
//! `*italic*`, `_italic_`, and `- `/`* ` unordered lists, including mixed
//! `<p>**heading**</p>` plus markdown list lines. That subset is interpreted
//! **before** remaining text is Typst-escaped, so stars do not print. Ordered
//! markers (`1.`, `1988.`) are never inferred as lists.

use scraper::{Html, Node};

use crate::sanitize::is_allowed_tag;

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
/// - `<pre>` — `#raw(block: true, "…")`
/// - `<code>` (outside `<pre>`) — `#raw("…")`
///
/// Lists nest to arbitrary depth: a `<ul>` or `<ol>` inside an `<li>` is
/// emitted as an indented sublist, and each level takes its marker from its
/// own tag, so `<ol>` inside `<ul>` (and the reverse) renders correctly.
///
/// All other tags are stripped; their text content is preserved.
///
/// Plain text and text nodes are scanned for a markdown subset (`**`/`__`
/// bold, `***`/`___` bold+italic, `*`/`_` italic, `- `/`* ` lists) and then
/// escaped. Prefer
/// [`sanitize_html_to_typst`] when the input is untrusted HTML that still
/// needs the resume allow-list applied — that path sanitizes and converts
/// from a single parse tree.
pub fn html_to_typst(html: &str) -> String {
    html_to_typst_with(html, false, true)
}

/// Sanitize with the resume HTML allow-list and convert to Typst in one parse.
///
/// Applies the same tag policy as [`crate::sanitize_html`] (ammonia
/// `Builder::default()` semantics): `script`/`style` are dropped with their
/// descendants; any other disallowed tag is stripped but its children are
/// kept. Link schemes are enforced during conversion. This avoids ammonia
/// parse → serialize → scraper re-parse on the render path while keeping
/// typst output byte-compatible with the former two-pass pipeline.
pub fn sanitize_html_to_typst(html: &str) -> String {
    html_to_typst_with(html, true, true)
}

/// Sanitize and convert HTML that comrak already produced from markdown.
///
/// Skips the legacy markdown-subset pass: emphasis and lists were already
/// interpreted, and leftover `*` from escaped markdown must stay literal.
/// Used only by [`crate::markdown_to_typst`].
pub(crate) fn sanitize_html_to_typst_without_markdown_subset(html: &str) -> String {
    html_to_typst_with(html, true, false)
}

fn html_to_typst_with(html: &str, sanitize: bool, markdown_subset: bool) -> String {
    let trimmed = html.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    // Fast path: no HTML tags. Templates eval() the result, so remaining text
    // still needs Typst escaping — but interpret the markdown subset first so
    // `**bold**` and `- ` lists are not printed as literal stars.
    // Nothing to sanitize when there are no tags.
    if !trimmed.contains('<') {
        let converted = if markdown_subset {
            apply_markdown_subset(trimmed)
        } else {
            escape_typst(trimmed)
        };
        return clean_output(&converted);
    }

    let document = Html::parse_fragment(trimmed);
    let mut output = String::new();

    for child in document.root_element().children() {
        process_node(&child, &mut output, 0, sanitize, markdown_subset);
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
///
/// When `sanitize` is true, ammonia `Builder::default()` semantics apply:
/// `script`/`style` drop the element and its descendants; every other
/// disallowed tag is stripped but keeps its children (including scraper's
/// `html`/`body` fragment chrome). When `sanitize` is false, unknown tags are
/// stripped but their text content is preserved (legacy `html_to_typst` behavior).
fn process_node(
    node: &ego_tree::NodeRef<'_, Node>,
    output: &mut String,
    list_depth: usize,
    sanitize: bool,
    markdown_subset: bool,
) {
    let in_list = list_depth > 0;
    match node.value() {
        Node::Text(text) => {
            let t = text.text.as_ref();
            // Inside list items, skip pure-whitespace text nodes that are just
            // formatting artifacts from the HTML parser.
            if in_list && t.chars().all(|c| c.is_whitespace()) {
                return;
            }
            if markdown_subset {
                // HTML <li> already emitted the Typst list marker. Line-based
                // markdown list parsing here would turn `* item` into a
                // second dash (`- - item`). Keep emphasis, skip list prefixes.
                if in_list {
                    output.push_str(&apply_inline_markdown(t, 0));
                } else {
                    output.push_str(&apply_markdown_subset(t));
                }
            } else {
                output.push_str(&escape_typst(t));
            }
        }
        Node::Element(el) => {
            let tag = el.name.local.as_ref();
            if sanitize && !is_allowed_tag(tag) {
                // Ammonia's `clean_content_tags` (script/style under
                // `Builder::default()`) drop the element AND its descendants;
                // every other disallowed tag is stripped but keeps its
                // children — including html5ever's html/body fragment chrome.
                if matches!(tag, "script" | "style") {
                    return;
                }
                for child in node.children() {
                    process_node(&child, output, list_depth, sanitize, markdown_subset);
                }
                return;
            }
            match tag {
                "p" => {
                    let mut inner = String::new();
                    for child in node.children() {
                        process_node(&child, &mut inner, list_depth, sanitize, markdown_subset);
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
                        process_node(&child, &mut inner, list_depth, sanitize, markdown_subset);
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
                        process_node(&child, &mut inner, list_depth, sanitize, markdown_subset);
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
                        process_node(&child, &mut inner, list_depth, sanitize, markdown_subset);
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
                        process_node(&child, &mut inner, list_depth, sanitize, markdown_subset);
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
                            output.push_str(&escape_typst_string_literal(href));
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
                    process_list(node, output, marker, list_depth, sanitize, markdown_subset);
                }
                "pre" => {
                    // A fenced code block (comrak emits `<pre><code>…</code></pre>`).
                    // Verbatim text goes into a Typst string literal, so it needs
                    // string escaping, not content-mode escaping.
                    let text = raw_text(node, sanitize);
                    // Comrak terminates the code content with exactly one
                    // newline; strip only that one so intentional trailing
                    // blank lines survive.
                    let trimmed = text.strip_suffix('\n').unwrap_or(&text);
                    if !trimmed.is_empty() {
                        output.push_str("#raw(block: true, \"");
                        output.push_str(&escape_typst_string(trimmed));
                        output.push_str("\")\n\n");
                    }
                }
                "code" => {
                    // Inline code (a `<code>` outside `<pre>`; the `pre` arm
                    // consumes its own children without recursing here).
                    let text = raw_text(node, sanitize);
                    if !text.is_empty() {
                        output.push_str("#raw(\"");
                        output.push_str(&escape_typst_string(&text));
                        output.push_str("\")");
                    }
                }
                "br" => {
                    output.push_str("#linebreak()\n");
                }
                // Allowed-but-unmapped (sanitize) or unknown (legacy): unwrap.
                _ => {
                    for child in node.children() {
                        process_node(&child, output, list_depth, sanitize, markdown_subset);
                    }
                }
            }
        }
        // Skip comments, doctypes, processing instructions, etc.
        _ => {}
    }
}

/// Concatenated text of every descendant text node, tags stripped.
///
/// When `sanitize` is true, `script`/`style` subtrees are skipped so fenced
/// and inline code match ammonia `Builder::default()` (`clean_content_tags`).
fn raw_text(node: &ego_tree::NodeRef<'_, Node>, sanitize: bool) -> String {
    let mut out = String::new();
    collect_text(node, &mut out, sanitize);
    out
}

fn collect_text(node: &ego_tree::NodeRef<'_, Node>, out: &mut String, sanitize: bool) {
    for child in node.children() {
        match child.value() {
            Node::Text(text) => out.push_str(text.text.as_ref()),
            Node::Element(el) => {
                let tag = el.name.local.as_ref();
                if sanitize && matches!(tag, "script" | "style") {
                    continue;
                }
                collect_text(&child, out, sanitize);
            }
            _ => {}
        }
    }
}

/// Escape `\` and `"` for a Typst double-quoted string literal (one pass).
///
/// Shared with the render engine's JSON/font-family embedding — keep the one
/// definition so future Typst literal escapes cannot drift between call sites.
pub fn escape_typst_string_literal(text: &str) -> String {
    let bytes = text.as_bytes();
    let extra = bytes.iter().filter(|&&b| b == b'\\' || b == b'"').count();
    let mut out = Vec::with_capacity(text.len() + extra);
    for &b in bytes {
        match b {
            b'\\' => out.extend_from_slice(b"\\\\"),
            b'"' => out.extend_from_slice(b"\\\""),
            _ => out.push(b),
        }
    }
    // Only ASCII escapes were inserted into valid UTF-8 input.
    String::from_utf8(out).expect("escaping ASCII into UTF-8 preserves validity")
}

/// Escape `text` for a Typst double-quoted string literal.
///
/// Newlines become the `\n` escape so the literal stays on one output line —
/// `clean_output` collapses runs of raw newlines and would otherwise mangle
/// code bodies with consecutive blank lines.
fn escape_typst_string(text: &str) -> String {
    let bytes = text.as_bytes();
    let extra = bytes
        .iter()
        .filter(|&&b| matches!(b, b'\\' | b'"' | b'\n'))
        .count();
    let mut out = Vec::with_capacity(text.len() + extra);
    for &b in bytes {
        match b {
            b'\\' => out.extend_from_slice(b"\\\\"),
            b'"' => out.extend_from_slice(b"\\\""),
            b'\n' => out.extend_from_slice(b"\\n"),
            _ => out.push(b),
        }
    }
    String::from_utf8(out).expect("escaping ASCII into UTF-8 preserves validity")
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
    sanitize: bool,
    markdown_subset: bool,
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
            process_node(&li_child, &mut inner, depth + 1, sanitize, markdown_subset);
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

/// Interpret a markdown subset, then Typst-escape remaining text.
///
/// Honours `**`/`__` bold, `***`/`___` bold+italic, `*`/`_` italic, and
/// `- `/`* ` unordered list
/// lines. Does **not** treat `1.` / `1988.` as ordered lists. Intra-word
/// markers (`4*5*6`, `foo_bar`) stay literal so arithmetic and identifiers
/// are not rewritten.
fn apply_markdown_subset(text: &str) -> String {
    if text.is_empty() {
        return String::new();
    }

    let mut out = String::with_capacity(text.len());
    let trailing_nl = text.ends_with('\n');
    let lines: Vec<&str> = text.split('\n').collect();

    for (idx, raw_line) in lines.iter().enumerate() {
        if idx == lines.len() - 1 && trailing_nl && raw_line.is_empty() {
            out.push('\n');
            break;
        }
        if idx > 0 {
            out.push('\n');
        }
        let line = raw_line.trim_end_matches('\r');
        if let Some((indent, item)) = parse_unordered_list_line(line) {
            out.push_str(&"  ".repeat(indent));
            out.push_str("- ");
            out.push_str(&apply_inline_markdown(item, 0));
        } else {
            out.push_str(&apply_inline_markdown(line, 0));
        }
    }
    out
}

/// A line is an unordered list item when it starts with `- ` or `* `
/// (optional indent). `*italic*` (no space after `*`) is not a list.
fn parse_unordered_list_line(line: &str) -> Option<(usize, &str)> {
    let leading_spaces = line.chars().take_while(|&c| c == ' ').count();
    let stripped = line.trim_start_matches([' ', '\t']);
    let rest = stripped
        .strip_prefix("- ")
        .or_else(|| stripped.strip_prefix("* "))?;
    if rest.trim().is_empty() {
        return None;
    }
    Some((leading_spaces / 2, rest))
}

const MAX_EMPHASIS_DEPTH: u8 = 8;

fn apply_inline_markdown(text: &str, depth: u8) -> String {
    if text.is_empty() {
        return String::new();
    }
    if depth >= MAX_EMPHASIS_DEPTH {
        return escape_typst(text);
    }

    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut literal = String::new();
    let mut i = 0;

    while i < chars.len() {
        if let Some((consumed, markup)) = match_emphasis(&chars, i, depth) {
            if !literal.is_empty() {
                out.push_str(&escape_typst(&literal));
                literal.clear();
            }
            out.push_str(&markup);
            i += consumed;
        } else {
            literal.push(chars[i]);
            i += 1;
        }
    }
    if !literal.is_empty() {
        out.push_str(&escape_typst(&literal));
    }
    out
}

fn match_emphasis(chars: &[char], i: usize, depth: u8) -> Option<(usize, String)> {
    // Longer delimiters first so `***both***` is bold+italic (not leftover
    // stars) and `**` is not consumed as italic.
    const CANDIDATES: [(&str, bool, bool); 6] = [
        ("***", true, true),
        ("___", true, true),
        ("**", true, false),
        ("__", true, false),
        ("*", false, true),
        ("_", false, true),
    ];

    for (delim, is_bold, is_italic) in CANDIDATES {
        let d: Vec<char> = delim.chars().collect();
        if !starts_with_delim(chars, i, &d) || !can_open_emphasis(chars, i, d[0]) {
            continue;
        }
        let content_start = i + d.len();
        if content_start >= chars.len() || chars[content_start].is_whitespace() {
            continue;
        }
        let Some(close) = find_closing_emphasis(chars, content_start, &d) else {
            continue;
        };
        let content: String = chars[content_start..close].iter().collect();
        let inner = apply_inline_markdown(&content, depth + 1);
        if inner.is_empty() {
            continue;
        }
        let markup = match (is_bold, is_italic) {
            (true, true) => format!("#text(weight: \"bold\")[#emph[{inner}]]"),
            (true, false) => format!("#text(weight: \"bold\")[{inner}]"),
            (false, true) => format!("#emph[{inner}]"),
            (false, false) => inner,
        };
        return Some((close + d.len() - i, markup));
    }
    None
}

fn starts_with_delim(chars: &[char], i: usize, delim: &[char]) -> bool {
    let end = i + delim.len();
    end <= chars.len() && &chars[i..end] == delim
}

fn is_word_char(c: char) -> bool {
    c.is_alphanumeric()
}

fn can_open_emphasis(chars: &[char], i: usize, marker: char) -> bool {
    // Mid-run retries (`foo**bar**` at the second star) must not open
    // italic and leave a stray marker. Underscores stay intra-word-safe.
    i == 0 || (!is_word_char(chars[i - 1]) && chars[i - 1] != marker)
}

fn can_close_emphasis(chars: &[char], close: usize, delim_len: usize) -> bool {
    let after = close + delim_len;
    after >= chars.len() || !is_word_char(chars[after])
}

fn find_closing_emphasis(chars: &[char], content_start: usize, delim: &[char]) -> Option<usize> {
    let dlen = delim.len();
    let mut j = content_start;
    while j + dlen <= chars.len() {
        if &chars[j..j + dlen] == delim
            && j > content_start
            && !chars[j - 1].is_whitespace()
            && can_close_emphasis(chars, j, dlen)
        {
            return Some(j);
        }
        j += 1;
    }
    None
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

    #[test]
    fn fenced_code_block() {
        // Comrak's shape for a ``` fence. Verbatim: no content-mode escaping.
        assert_eq!(
            html_to_typst("<pre><code>let x = a * b;\n</code></pre>"),
            "#raw(block: true, \"let x = a * b;\")"
        );
    }

    #[test]
    fn code_block_escapes_string_specials() {
        assert_eq!(
            html_to_typst("<pre><code>say \"hi\\\"\n</code></pre>"),
            "#raw(block: true, \"say \\\"hi\\\\\\\"\")"
        );
    }

    #[test]
    fn inline_code() {
        assert_eq!(
            html_to_typst("<p>run <code>cargo test</code> now</p>"),
            "run #raw(\"cargo test\") now"
        );
    }

    #[test]
    fn empty_code_block_emits_nothing() {
        assert_eq!(html_to_typst("<pre><code>\n</code></pre>"), "");
    }

    #[test]
    fn code_block_keeps_intentional_trailing_blank_line() {
        // Only the renderer's own terminal newline is stripped.
        assert_eq!(
            html_to_typst("<pre><code>a\n\n</code></pre>"),
            "#raw(block: true, \"a\\n\")"
        );
    }

    #[test]
    fn multi_line_code_block_encodes_newlines() {
        // Newlines ride as \n escapes so clean_output cannot collapse them.
        assert_eq!(
            html_to_typst("<pre><code>a\n\n\n\nb\n</code></pre>"),
            "#raw(block: true, \"a\\n\\n\\n\\nb\")"
        );
    }

    #[test]
    fn sanitize_html_to_typst_drops_script_with_contents() {
        assert_eq!(
            sanitize_html_to_typst("<p>Hello</p><script>alert('xss')</script>"),
            "Hello"
        );
    }

    #[test]
    fn sanitize_html_to_typst_matches_two_pass_for_safe_markup() {
        let samples = [
            "<p>Hello <strong>world</strong></p>",
            r#"<p><a href="https://example.com">Example</a></p>"#,
            r#"<a href="javascript:alert(1)">Click</a>"#,
            "<ul><li>A<ul><li>B</li></ul></li><li>C</li></ul>",
            "<p>Line 1<br>Line 2</p>",
            "<pre><code>let x = 1;\n</code></pre>",
            "<pre><code>keep<script>drop</script>me</code></pre>",
            "<pre><code>keep<style>p{}</style>me</code></pre>",
            "<p>Before <script>x</script> after</p>",
            // Disallowed non-clean-content tags: stripped, text kept (ammonia).
            "<p><font color=\"red\">Kept text</font></p>",
            "<p>Watch <video>fallback text</video> here</p>",
            "<p><button>Also kept</button></p>",
            "<p>Styled <style>p { color: red }</style>plain</p>",
        ];
        for html in samples {
            let two_pass = html_to_typst(&crate::sanitize_html(html));
            let one_pass = sanitize_html_to_typst(html);
            assert_eq!(one_pass, two_pass, "mismatch for {html:?}");
        }
    }

    #[test]
    fn sanitize_html_to_typst_keeps_text_of_stripped_tags() {
        // Regression guard for the ammonia parity rule: only script/style drop
        // their content; other disallowed tags unwrap to their children.
        assert_eq!(
            sanitize_html_to_typst("<font>Imported name</font>"),
            "Imported name"
        );
        assert_eq!(
            sanitize_html_to_typst("<p><center>Centered</center></p>"),
            "Centered"
        );
    }

    #[test]
    fn markdown_bold_asterisks_on_plain_text_fast_path() {
        assert_eq!(
            html_to_typst("**PwC Tax Technology**"),
            "#text(weight: \"bold\")[PwC Tax Technology]"
        );
        assert!(
            !html_to_typst("**PwC Tax Technology**").contains('*'),
            "stars must not print as literal text"
        );
    }

    #[test]
    fn markdown_bold_underscores() {
        assert_eq!(html_to_typst("__bold__"), "#text(weight: \"bold\")[bold]");
    }

    #[test]
    fn markdown_italic_asterisks_and_underscores() {
        assert_eq!(html_to_typst("*italic*"), "#emph[italic]");
        assert_eq!(html_to_typst("_italic_"), "#emph[italic]");
    }

    #[test]
    fn markdown_triple_emphasis_is_bold_and_italic() {
        assert_eq!(
            html_to_typst("***both***"),
            "#text(weight: \"bold\")[#emph[both]]"
        );
        assert_eq!(
            html_to_typst("___both___"),
            "#text(weight: \"bold\")[#emph[both]]"
        );
        assert_eq!(
            html_to_typst("<p>***both***</p>"),
            "#text(weight: \"bold\")[#emph[both]]"
        );
        for input in ["***both***", "___both___", "<p>***both***</p>"] {
            let result = html_to_typst(input);
            assert!(
                !result.contains('*') && !result.contains('_'),
                "triple emphasis must not print leftover markers: {result}"
            );
        }
    }

    #[test]
    fn markdown_dash_and_asterisk_lists() {
        assert_eq!(html_to_typst("- item"), "- item");
        assert_eq!(html_to_typst("* item"), "- item");
        assert_eq!(html_to_typst("- item 1\n- item 2"), "- item 1\n- item 2");
        assert_eq!(html_to_typst("* item 1\n* item 2"), "- item 1\n- item 2");
    }

    #[test]
    fn markdown_list_marker_does_not_open_italic() {
        // `* ` at the start of a line is a list, not emphasis.
        assert_eq!(
            html_to_typst("*italic*\n* list item"),
            "#emph[italic]\n- list item"
        );
    }

    #[test]
    fn markdown_bold_inside_list_item() {
        assert_eq!(
            html_to_typst("- **Bold** item"),
            "- #text(weight: \"bold\")[Bold] item"
        );
    }

    #[test]
    fn mixed_html_paragraph_and_markdown_list() {
        let input = "<p>**heading**</p>\n- item 1\n- item 2";
        let result = html_to_typst(input);
        assert_eq!(
            result,
            "#text(weight: \"bold\")[heading]\n\n- item 1\n- item 2"
        );
        assert!(
            !result.contains('*'),
            "mixed HTML+markdown must not print stars: {result}"
        );
    }

    #[test]
    fn mixed_html_paragraph_and_asterisk_markdown_list() {
        let result = html_to_typst("<p>**heading**</p>\n* item");
        assert_eq!(result, "#text(weight: \"bold\")[heading]\n\n- item");
    }

    #[test]
    fn lone_asterisk_in_prose_stays_literal() {
        let result = html_to_typst("rate is 3 * 4");
        assert_eq!(result, "rate is 3 \\* 4");
        assert!(!result.contains("#emph"));
    }

    #[test]
    fn intra_word_asterisks_stay_literal() {
        assert_eq!(html_to_typst("4*5*6"), "4\\*5\\*6");
        assert_eq!(html_to_typst("Rated 4*5 stars"), "Rated 4\\*5 stars");
        assert_eq!(html_to_typst("foo**bar**"), "foo\\*\\*bar\\*\\*");
        assert_eq!(html_to_typst("foo__bar__"), "foo\\_\\_bar\\_\\_");
        assert_eq!(html_to_typst("foo***bar***"), "foo\\*\\*\\*bar\\*\\*\\*");
        assert_eq!(html_to_typst("foo___bar___"), "foo\\_\\_\\_bar\\_\\_\\_");
        for input in ["foo**bar**", "foo__bar__", "foo***bar***", "foo___bar___"] {
            let result = html_to_typst(input);
            assert!(
                !result.contains("#emph") && !result.contains("weight: \"bold\""),
                "intra-word delimiter run must stay literal: {result}"
            );
        }
    }

    #[test]
    fn html_list_item_does_not_reparse_markdown_list_prefix() {
        assert_eq!(html_to_typst("<ul><li>* item</li></ul>"), "- \\* item");
        assert_eq!(
            html_to_typst("<ul><li><p>* item</p></li></ul>"),
            "- \\* item"
        );
        assert_eq!(
            html_to_typst("<ul><li>**Bold** item</li></ul>"),
            "- #text(weight: \"bold\")[Bold] item"
        );
    }

    #[test]
    fn year_period_is_not_an_ordered_list() {
        assert_eq!(html_to_typst("1988. A good year"), "1988. A good year");
        assert!(!html_to_typst("1988. A good year").contains('+'));
        assert_eq!(html_to_typst("1. First"), "1. First");
    }

    #[test]
    fn unclosed_emphasis_stays_literal() {
        assert_eq!(html_to_typst("**unclosed"), "\\*\\*unclosed");
        assert_eq!(html_to_typst("*unclosed"), "\\*unclosed");
    }

    #[test]
    fn sanitize_path_interprets_markdown_subset_and_drops_script() {
        assert_eq!(
            sanitize_html_to_typst("<p>**hi**</p><script>alert(1)</script>"),
            "#text(weight: \"bold\")[hi]"
        );
        assert_eq!(sanitize_html_to_typst("<script>**xss**</script>"), "");
        assert_eq!(
            sanitize_html_to_typst("**PwC Tax Technology**"),
            "#text(weight: \"bold\")[PwC Tax Technology]"
        );
    }

    #[test]
    fn html_strong_still_wins_over_plain_stars() {
        // Existing TipTap path must keep working.
        assert_eq!(
            html_to_typst("<p><strong>bold</strong></p>"),
            "#text(weight: \"bold\")[bold]"
        );
    }

    #[test]
    fn underscore_identifier_mid_word_stays_literal() {
        assert_eq!(html_to_typst("foo_bar_baz"), "foo\\_bar\\_baz");
    }
}

#[cfg(test)]
mod sanitizer_proptest {
    use super::{html_to_typst, sanitize_html_to_typst};
    use crate::sanitize_html;
    use proptest::prelude::*;

    fn arb_text() -> impl Strategy<Value = String> {
        prop_oneof![
            "[A-Za-z0-9 ]{0,12}",
            Just("&amp;".into()),
            Just("&lt;".into()),
            Just("&gt;".into()),
            Just("&#39;".into()),
            Just("&quot;".into()),
            Just("&nbsp;".into()),
            Just("hello &amp; world".into()),
        ]
    }

    fn arb_wrap_tag() -> impl Strategy<Value = &'static str> {
        prop::sample::select(vec![
            "p", "strong", "em", "b", "i", "u", "span", "div", "code", "center", "font", "article",
        ])
    }

    fn arb_html() -> impl Strategy<Value = String> {
        // Wrap in an allowed tag so ammonia's serialize still contains markup.
        // Tag-free ammonia output takes html_to_typst's no-`<` fast path, which
        // does not decode entities — a serialization artifact, not a sanitizer
        // policy split.
        arb_text()
            .prop_recursive(4, 48, 4, |inner| {
                let wrap = (arb_wrap_tag(), inner.clone())
                    .prop_map(|(tag, body)| format!("<{tag}>{body}</{tag}>"));
                let link = inner.clone().prop_map(|body| {
                    format!(r#"<a href="https://example.com" title="x">{body}</a>"#)
                });
                let js_link = inner
                    .clone()
                    .prop_map(|body| format!(r#"<a href="javascript:alert(1)">{body}</a>"#));
                let onclick = inner
                    .clone()
                    .prop_map(|body| format!(r#"<span onclick="alert(1)">{body}</span>"#));
                let script = arb_text().prop_map(|text| format!("<script>{text}</script>"));
                let style = arb_text().prop_map(|text| format!("<style>{text}</style>"));
                let font = inner
                    .clone()
                    .prop_map(|body| format!(r#"<font color="red">{body}</font>"#));
                let list = inner
                    .clone()
                    .prop_map(|body| format!("<ul><li>{body}</li></ul>"));
                let ordered = inner
                    .clone()
                    .prop_map(|body| format!("<ol><li>{body}</li></ol>"));
                let concat =
                    proptest::collection::vec(inner, 1..3).prop_map(|parts| parts.concat());
                prop_oneof![
                    wrap,
                    link,
                    js_link,
                    onclick,
                    script,
                    style,
                    font,
                    list,
                    ordered,
                    Just("<br>".to_string()),
                    concat
                ]
            })
            .prop_map(|body| format!("<p>{body}</p>"))
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(128))]
        #[test]
        fn sanitize_html_to_typst_matches_two_pass(html in arb_html()) {
            let one_pass = sanitize_html_to_typst(&html);
            let two_pass = html_to_typst(&sanitize_html(&html));
            prop_assert_eq!(one_pass, two_pass, "mismatch for {:?}", html);
        }
    }
}
