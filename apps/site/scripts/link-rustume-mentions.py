#!/usr/bin/env python3
"""Link bare Rustume product mentions to the site homepage in doc markdown."""

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
    match = re.match(r"^(---\r?\n[\s\S]*?\r?\n---\r?\n?)", text)
    if not match:
        return "", text, text
    front = match.group(1)
    body = text[len(front) :]
    return front, body, text


def link_rustume_in_text(text: str) -> str:
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
    parts = re.split(r"(```[\s\S]*?```)", body)
    linked: list[str] = []
    for index, part in enumerate(parts):
        if index % 2 == 1:
            linked.append(part)
            continue
        linked.append(link_rustume_segment(part))
    return "".join(linked)


def main() -> None:
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
