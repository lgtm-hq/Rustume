#!/usr/bin/env python3
"""Link bare Rustume product mentions to the site homepage in doc markdown."""

# pylint: disable=invalid-name  # CLI script; hyphenated filename is the invocation contract

from __future__ import annotations

import re
from pathlib import Path

DOCS = Path(__file__).resolve().parents[1] / "src/content/docs"
HOME = "[Rustume](/)"
CLOUD = "[Rustume Cloud](/docs/cloud/overview/)"

# Skip Rustume inside URLs, markdown links, and reference-style link targets.
RUSTUME = re.compile(
    r"(?<![/\[=?&#])(?<!\])Rustume(?!\]\(|\]\[)",
)
RUSTUME_CLOUD = re.compile(
    r"(?<![/\[=?&#])(?<!\])Rustume Cloud(?!\]\(|\]\[)",
)
INLINE_CODE = re.compile(r"(`[^`\n]+`)")
MARKDOWN_LINK = re.compile(
    r"(\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\[[^\]]*\])",
)


def split_frontmatter(text: str) -> tuple[str, str, str]:
    """Split markdown into its frontmatter block and body.

    Args:
        text: Full markdown file contents.

    Returns:
        ``(frontmatter, body, text)``. ``frontmatter`` is empty when the
        file has no frontmatter block.
    """
    match = re.match(r"^(---\r?\n[\s\S]*?\r?\n---\r?\n?)", text)
    if not match:
        return "", text, text
    front = match.group(1)
    body = text[len(front) :]
    return front, body, text


def link_rustume_in_text(text: str) -> str:
    """Link bare product mentions, leaving existing markdown links alone.

    Args:
        text: Markdown fragment without code fences.

    Returns:
        The fragment with bare mentions replaced by links.
    """
    parts = MARKDOWN_LINK.split(text)
    linked: list[str] = []
    for index, part in enumerate(parts):
        if index % 2 == 1:
            linked.append(part)
            continue
        part = RUSTUME_CLOUD.sub(CLOUD, part)
        linked.append(RUSTUME.sub(HOME, part))
    return "".join(linked)


def link_rustume_segment(segment: str) -> str:
    """Link mentions line-by-line, skipping headings and inline code.

    Args:
        segment: Markdown fragment without fenced code blocks.

    Returns:
        The fragment with eligible mentions replaced by links.
    """
    lines: list[str] = []
    for line in segment.splitlines(keepends=True):
        stripped = line.lstrip()
        if stripped.startswith("#"):
            lines.append(line)
            continue

        parts = INLINE_CODE.split(line)
        linked_parts: list[str] = []
        for index, part in enumerate(parts):
            if index % 2 == 1:
                linked_parts.append(part)
                continue
            linked_parts.append(link_rustume_in_text(part))
        lines.append("".join(linked_parts))
    return "".join(lines)


def link_rustume_body(body: str) -> str:
    """Link mentions in a markdown body while preserving fenced code blocks.

    Args:
        body: Markdown body without its frontmatter block.

    Returns:
        The body with mentions linked outside of code fences.
    """
    parts = re.split(r"(```[\s\S]*?```)", body)
    linked: list[str] = []
    for index, part in enumerate(parts):
        if index % 2 == 1:
            linked.append(part)
            continue
        linked.append(link_rustume_segment(part))
    return "".join(linked)


def main() -> None:
    """Link product mentions in every docs markdown file in place."""
    updated = 0
    for path in sorted(DOCS.rglob("*.md")):
        original = path.read_text()
        front, body, _ = split_frontmatter(original)
        new_body = link_rustume_body(body)
        if new_body == body:
            continue
        path.write_text(front + new_body)
        updated += 1
    print(f"Linked Rustume mentions in {updated} files")


if __name__ == "__main__":
    main()
