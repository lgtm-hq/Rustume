"""Tests for apps/site/scripts/link-rustume-mentions.py."""

from __future__ import annotations

from pathlib import Path

from _script_loader import load_script_module

link_rustume_mentions = load_script_module(
    "link_rustume_mentions",
    Path(__file__).resolve().parents[3] / "apps" / "site" / "scripts" / "link-rustume-mentions.py",
)


def test_link_rustume_in_text_skips_existing_markdown_link() -> None:
    """Rustume inside an existing link must not be double-linked."""
    text = "Read [Rustume Cloud](/docs/cloud/overview/) for details."
    output = link_rustume_mentions.link_rustume_in_text(text)

    assert output == text
    assert "[Rustume Cloud](/docs/cloud/overview/)" in output
    assert "[[Rustume" not in output


def test_link_rustume_in_text_links_bare_mention() -> None:
    """Bare Rustume mentions outside links become homepage links."""
    text = "Rustume is privacy-first."
    output = link_rustume_mentions.link_rustume_in_text(text)

    assert output == "[Rustume](/) is privacy-first."
