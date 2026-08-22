//! Convert markdown to Typst markup.
//!
//! The document editor stores rich text as markdown. Rendering reuses the
//! existing HTML pipeline: markdown is parsed to HTML with raw HTML escaped
//! (never passed through), then sanitized and converted to Typst markup from
//! a **single** HTML parse tree via [`crate::html_to_typst::sanitize_html_to_typst_without_markdown_subset`].

use comrak::{markdown_to_html, Options};
use once_cell::sync::Lazy;

use crate::html_to_typst::sanitize_html_to_typst_without_markdown_subset;

/// Comrak options: CommonMark only, raw HTML escaped rather than emitted.
static MARKDOWN_OPTIONS: Lazy<Options<'static>> = Lazy::new(|| {
    let mut options = Options::default();
    // Render raw HTML as visible, escaped text. `unsafe` stays false so no
    // author-supplied markup can ever reach the sanitizer or Typst `eval()`.
    options.render.escape = true;
    options.render.r#unsafe = false;
    // Keep typed punctuation as typed.
    options.parse.smart = false;
    options
});

/// Convert a markdown string to Typst markup.
///
/// Supported constructs (CommonMark subset shared with the editor toolbar):
/// - `**bold**` — `#text(weight: "bold")[…]`
/// - `*italic*` — `#emph[…]`
/// - `[text](url)` — `#link("url")[…]`
/// - `- item` / `1. item` — `- item` / `+ item`
/// - blank-line separated paragraphs, and two-space hard breaks
///
/// Raw HTML is never interpreted: it is escaped by the markdown renderer and
/// ends up as literal, Typst-escaped text.
///
/// # Examples
///
/// ```
/// use rustume_utils::markdown_to_typst;
///
/// assert_eq!(markdown_to_typst("**bold**"), "#text(weight: \"bold\")[bold]");
/// assert_eq!(markdown_to_typst(""), "");
/// ```
#[must_use]
pub fn markdown_to_typst(md: &str) -> String {
    let trimmed = md.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let html = markdown_to_html(trimmed, &MARKDOWN_OPTIONS);
    // Comrak writes a source newline after a hard break (`<br />\n`). Left in
    // place it survives conversion as a blank line, which Typst reads as a
    // paragraph break on top of the `#linebreak()`.
    let html = html.replace("<br />\n", "<br />");
    // Wrap before converting: escaped raw HTML can leave the tree with no
    // element at all (`&lt;script&gt;…`), and `html_to_typst`'s tag-free fast
    // path would then emit those entities literally instead of as text.
    // Sanitizer allow-list + Typst conversion share one scraper parse.
    // Skip the HTML-path markdown subset: comrak already interpreted markdown,
    // and leftover `*` from `\*escaped\*` must stay literal.
    sanitize_html_to_typst_without_markdown_subset(&format!("<div>{html}</div>"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_input() {
        assert_eq!(markdown_to_typst(""), "");
        assert_eq!(markdown_to_typst("   \n  "), "");
    }

    #[test]
    fn plain_text_passthrough() {
        assert_eq!(markdown_to_typst("Hello world"), "Hello world");
    }

    #[test]
    fn bold() {
        assert_eq!(
            markdown_to_typst("**bold**"),
            "#text(weight: \"bold\")[bold]"
        );
    }

    #[test]
    fn bold_underscores() {
        assert_eq!(
            markdown_to_typst("__bold__"),
            "#text(weight: \"bold\")[bold]"
        );
    }

    #[test]
    fn italic() {
        assert_eq!(markdown_to_typst("*italic*"), "#emph[italic]");
        assert_eq!(markdown_to_typst("_italic_"), "#emph[italic]");
    }

    #[test]
    fn bold_inside_italic() {
        assert_eq!(
            markdown_to_typst("*italic **and bold***"),
            "#emph[italic #text(weight: \"bold\")[and bold]]"
        );
    }

    #[test]
    fn link() {
        assert_eq!(
            markdown_to_typst("[Example](https://example.com)"),
            "#link(\"https://example.com\")[Example]"
        );
    }

    #[test]
    fn link_with_unsafe_scheme_renders_as_text() {
        assert_eq!(markdown_to_typst("[Click](javascript:alert(1))"), "Click");
    }

    #[test]
    fn paragraphs() {
        assert_eq!(markdown_to_typst("First\n\nSecond"), "First\n\nSecond");
    }

    #[test]
    fn fenced_code_block() {
        assert_eq!(
            markdown_to_typst("```\nlet x = a * b;\n```"),
            "#raw(block: true, \"let x = a * b;\")"
        );
    }

    #[test]
    fn wider_fence_keeps_inner_fence_as_body() {
        // Comrak is CommonMark-conformant: the closer must be at least as
        // wide as the opener, so the inner ``` is body. Pins parity with the
        // web dialect parser.
        assert_eq!(
            markdown_to_typst("````\na\n```\nb\n````"),
            "#raw(block: true, \"a\\n```\\nb\")"
        );
    }

    #[test]
    fn fenced_code_block_between_paragraphs() {
        assert_eq!(
            markdown_to_typst("Before\n\n```\ncode\n```\n\nAfter"),
            "Before\n\n#raw(block: true, \"code\")\n\nAfter"
        );
    }

    #[test]
    fn hard_break() {
        assert_eq!(
            markdown_to_typst("Line 1  \nLine 2"),
            "Line 1#linebreak()\nLine 2"
        );
    }

    #[test]
    fn soft_break_stays_one_paragraph() {
        assert_eq!(markdown_to_typst("Line 1\nLine 2"), "Line 1\nLine 2");
    }

    #[test]
    fn bullet_list() {
        let result = markdown_to_typst("- Item 1\n- Item 2");
        assert_eq!(result, "- Item 1\n- Item 2");
    }

    #[test]
    fn bullet_list_asterisk_marker() {
        assert_eq!(
            markdown_to_typst("* Item 1\n* Item 2"),
            "- Item 1\n- Item 2"
        );
    }

    #[test]
    fn ordered_list() {
        assert_eq!(
            markdown_to_typst("1. First\n2. Second"),
            "+ First\n+ Second"
        );
    }

    #[test]
    fn list_item_with_formatting() {
        let result = markdown_to_typst("- **Bold** item\n- Normal item");
        assert_eq!(
            result,
            "- #text(weight: \"bold\")[Bold] item\n- Normal item"
        );
    }

    #[test]
    fn nested_bullet_list() {
        assert_eq!(
            markdown_to_typst("- a\n  - b\n- c"),
            "- a\n  - b\n- c",
            "an indented markdown sublist must stay nested through the HTML path"
        );
    }

    #[test]
    fn nested_ordered_list() {
        assert_eq!(markdown_to_typst("1. a\n   1. b\n2. c"), "+ a\n  + b\n+ c");
    }

    #[test]
    fn mixed_nested_list_keeps_per_level_markers() {
        assert_eq!(markdown_to_typst("- a\n  1. b"), "- a\n  + b");
    }

    #[test]
    fn three_level_nested_list() {
        assert_eq!(
            markdown_to_typst("- a\n  - b\n    - c"),
            "- a\n  - b\n    - c"
        );
    }

    #[test]
    fn paragraph_then_list() {
        let result = markdown_to_typst("Responsibilities:\n\n- Item A\n- Item B");
        assert_eq!(result, "Responsibilities:\n\n- Item A\n- Item B");
    }

    #[test]
    fn typst_special_chars_escaped() {
        assert_eq!(markdown_to_typst("#hashtag"), "\\#hashtag");
        assert_eq!(markdown_to_typst("Use @mention"), "Use \\@mention");
        assert_eq!(markdown_to_typst("100$ and 40%"), "100\\$ and 40\\%");
        assert_eq!(markdown_to_typst("a[b]c"), "a\\[b\\]c");
    }

    #[test]
    fn escaped_markdown_emphasis_stays_literal() {
        assert_eq!(markdown_to_typst(r"\*not italic\*"), "\\*not italic\\*");
    }

    #[test]
    fn raw_html_script_is_neutralized() {
        let result = markdown_to_typst("<script>alert('xss')</script>");
        assert!(
            !result.contains("#eval") && !result.contains("<script>"),
            "script tag must not survive: {result}"
        );
        assert!(
            result.contains("\\<script\\>"),
            "expected escaped text: {result}"
        );
    }

    #[test]
    fn raw_html_underline_is_neutralized() {
        let result = markdown_to_typst("<u>underlined</u>");
        assert!(
            !result.contains("#underline"),
            "raw HTML must not become Typst markup: {result}"
        );
        assert_eq!(result, "\\<u\\>underlined\\</u\\>");
    }

    #[test]
    fn raw_html_inside_paragraph_is_neutralized() {
        let result = markdown_to_typst("Before <b>bold?</b> after");
        assert_eq!(result, "Before \\<b\\>bold?\\</b\\> after");
    }

    #[test]
    fn typst_code_injection_is_escaped() {
        let result = markdown_to_typst("#eval(\"1+1\") and #import \"x\"");
        assert_eq!(result, "\\#eval(\"1+1\") and \\#import \"x\"");
    }

    #[test]
    fn strikethrough_extension_is_off() {
        // No GFM extensions: `~~` is literal text, not `<del>`.
        assert_eq!(markdown_to_typst("~~struck~~"), "\\~\\~struck\\~\\~");
    }

    #[test]
    fn smart_punctuation_is_off() {
        assert_eq!(
            markdown_to_typst(r#""quoted" -- dash"#),
            r#""quoted" -- dash"#
        );
    }
}
