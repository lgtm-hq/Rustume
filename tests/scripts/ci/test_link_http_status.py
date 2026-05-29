"""Tests for apps/site/scripts/link-http-status.py."""

from __future__ import annotations

import importlib.util
from pathlib import Path

_MODULE_PATH = (
    Path(__file__).resolve().parents[3] / "apps" / "site" / "scripts" / "link-http-status.py"
)
_spec = importlib.util.spec_from_file_location("link_http_status", _MODULE_PATH)
if _spec is None:
    raise ImportError(f"Could not load module spec from {_MODULE_PATH}")
_loader = _spec.loader
if _loader is None:
    raise ImportError(f"Module spec for {_MODULE_PATH} has no loader")
link_http_status = importlib.util.module_from_spec(_spec)
_loader.exec_module(link_http_status)


def test_replace_backtick_status_skips_yaml_frontmatter() -> None:
    """description fields in frontmatter must keep inline code, not markdown links."""
    source = """---
title: Example
description: Returns `409 Conflict` when the resource already exists.
---

Body mentions `404` in prose.
"""
    result = link_http_status.replace_backtick_status(source)

    assert "description: Returns `409 Conflict`" in result
    assert "[409 Conflict]" not in result.split("---")[1]
    assert "[404](https://developer.mozilla.org" in result


def test_replace_backtick_status_still_replaces_in_fenced_blocks_guard() -> None:
    """Code fences remain unchanged; prose outside is still linked."""
    source = """---
title: Example
---

`500` in prose.

```text
`503 Service Unavailable`
```
"""
    result = link_http_status.replace_backtick_status(source)

    assert "[500](https://developer.mozilla.org" in result
    assert "`503 Service Unavailable`" in result
