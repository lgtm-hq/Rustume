#!/usr/bin/env python3
"""Apply consistent SmartLink, DocLink, and inline-code patterns to doc markdown."""

from __future__ import annotations

from doc_enrichment.descriptions import DESCRIPTIONS, DOCS
from doc_enrichment.frontmatter import set_description
from doc_enrichment.replacements import REPLACEMENTS


def main() -> None:
    updated = 0

    for rel_path, old, new in REPLACEMENTS:
        path = DOCS / rel_path
        if not path.exists():
            continue
        text = path.read_text()
        if old not in text:
            continue
        path.write_text(text.replace(old, new, 1))
        updated += 1

    for rel_path, new_desc in DESCRIPTIONS.items():
        path = DOCS / rel_path
        if not path.exists():
            continue
        text = path.read_text()
        new_text = set_description(text, rel_path, new_desc)
        if new_text != text:
            path.write_text(new_text)
            updated += 1

    print(f"Applied enrichments ({updated} file updates)")


if __name__ == "__main__":
    main()
