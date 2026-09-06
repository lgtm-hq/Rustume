"""Tests for scripts/ci/site/fix-markdown-docs.py."""

from __future__ import annotations

from pathlib import Path

from _script_loader import load_script_module

fix_markdown_docs = load_script_module(
    "fix_markdown_docs",
    Path(__file__).resolve().parents[3] / "scripts" / "ci" / "site" / "fix-markdown-docs.py",
)


def test_wrap_line_preserves_markdown_link() -> None:
    """Markdown links must not be split across wrapped lines."""
    line = "See the [documentation page](https://example.com/path) for details."
    wrapped = fix_markdown_docs.wrap_line(line, 40)
    joined = "\n".join(wrapped)

    assert "[documentation page](https://example.com/path)" in joined
    assert "[documentation\npage]" not in joined


def test_wrap_line_keeps_punctuation_adjacent() -> None:
    """Wrapping must not insert a space before trailing punctuation."""
    line = "See [link](/docs), then continue."
    joined = "\n".join(fix_markdown_docs.wrap_line(line, 30))

    assert "[link](/docs)," in joined
    assert "[link](/docs) ," not in joined


def test_is_standalone_bold_line_rejects_horizontal_rule() -> None:
    """Four asterisks are a horizontal rule, not a bold line."""
    assert not fix_markdown_docs.is_standalone_bold_line("****")


def test_is_standalone_bold_line_rejects_bold_italic() -> None:
    """Triple-asterisk emphasis must not become a heading."""
    assert not fix_markdown_docs.is_standalone_bold_line("***bold italic***")


def test_is_standalone_bold_line_accepts_bold() -> None:
    """Standalone **text** lines are valid heading candidates."""
    assert fix_markdown_docs.is_standalone_bold_line("**Section title**")
