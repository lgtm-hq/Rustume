"""Tests for apps/site/scripts/link-rustume-mentions.py."""

from __future__ import annotations

import importlib.util
from pathlib import Path

_MODULE_PATH = (
    Path(__file__).resolve().parents[3] / "apps" / "site" / "scripts" / "link-rustume-mentions.py"
)
_spec = importlib.util.spec_from_file_location("link_rustume_mentions", _MODULE_PATH)
if _spec is None:
    raise ImportError(f"Could not load module spec from {_MODULE_PATH}")
_loader = _spec.loader
if _loader is None:
    raise ImportError(f"Module spec for {_MODULE_PATH} has no loader")
link_rustume_mentions = importlib.util.module_from_spec(_spec)
_loader.exec_module(link_rustume_mentions)


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
