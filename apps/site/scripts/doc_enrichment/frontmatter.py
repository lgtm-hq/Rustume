"""Frontmatter parsing and description injection."""

import re

from .descriptions import DESCRIPTIONS


def yaml_single_quote(value: str) -> str:
    """Wrap a string in YAML single quotes (escape embedded apostrophes)."""
    return "'" + value.replace("'", "''") + "'"


# Hosted vendor names that must not appear in public operations doc frontmatter.
_STALE_OPS_DESCRIPTION = re.compile(
    r"\b(?:Neon|Cloudflare\s+R2|Grafana\s+Cloud|Railway)\b",
    re.IGNORECASE,
)
_FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)


def _split_frontmatter(content: str) -> tuple[str | None, str]:
    """Return frontmatter body and remainder, or (None, full content) when absent."""
    match = _FRONTMATTER.match(content)
    if not match:
        return None, content
    return match.group(1), content[match.end() :]


def _current_description(content: str) -> str | None:
    frontmatter, _ = _split_frontmatter(content)
    if frontmatter is None:
        return None
    match = re.search(r"^description:\s*(.+)$", frontmatter, flags=re.MULTILINE)
    return match.group(1) if match else None


def _operations_description_is_compliant(content: str) -> bool:
    """True when an operations page already has a policy-level description."""
    current = _current_description(content)
    if not current:
        return False
    return _STALE_OPS_DESCRIPTION.search(current) is None


def set_description(content: str, rel_path: str, new_desc: str) -> str:
    if rel_path not in DESCRIPTIONS:
        return content
    if rel_path.startswith("operations/") and _operations_description_is_compliant(content):
        return content
    frontmatter, body = _split_frontmatter(content)
    if frontmatter is None:
        return content
    pattern = re.compile(r"^description:.*$", re.MULTILINE)
    replacement = f"description: {yaml_single_quote(new_desc)}"
    if not pattern.search(frontmatter):
        return content
    new_frontmatter = pattern.sub(replacement, frontmatter, count=1)
    return f"---\n{new_frontmatter}\n---\n{body}"
