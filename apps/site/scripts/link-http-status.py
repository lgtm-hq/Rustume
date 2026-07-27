#!/usr/bin/env python3
"""Replace inline-code HTTP error status codes with MDN markdown links."""

from __future__ import annotations

import re
from pathlib import Path

DOCS = Path(__file__).resolve().parents[1] / "src/content/docs"
MDN = "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/{code}"
ERROR_CODES = frozenset({"400", "401", "403", "404", "409", "413", "422", "500", "503"})
STATUS_PATTERN = re.compile(r"`(\d{3})(?:\s+([A-Za-z]+))?`")


def link_code(code: str, label: str) -> str:
    return f"[{label}]({MDN.format(code=code)})"


def replace_backtick_status(text: str) -> str:
    def repl_phrase(match: re.Match[str]) -> str:
        code, phrase = match.group(1), match.group(2)
        if code not in ERROR_CODES:
            return match.group(0)
        label = f"{code} {phrase}" if phrase else code
        return link_code(code, label)

    result_lines: list[str] = []
    in_fence = False
    in_frontmatter = False
    frontmatter_closed = False

    for line in text.splitlines(keepends=True):
        stripped = line.strip()
        if not frontmatter_closed and stripped == "---":
            in_frontmatter = not in_frontmatter
            if not in_frontmatter:
                frontmatter_closed = True
            result_lines.append(line)
            continue

        if in_frontmatter:
            result_lines.append(line)
            continue

        if stripped.startswith("```"):
            in_fence = not in_fence
            result_lines.append(line)
            continue

        if in_fence:
            result_lines.append(line)
            continue

        result_lines.append(STATUS_PATTERN.sub(repl_phrase, line))

    return "".join(result_lines)


def main() -> None:
    updated = 0
    for path in sorted(DOCS.rglob("*.md")):
        original = path.read_text()
        new = replace_backtick_status(original)
        if new != original:
            path.write_text(new)
            updated += 1
    print(f"Updated HTTP error links in {updated} files")


if __name__ == "__main__":
    main()
