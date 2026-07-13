# Rustume RFCs

This directory holds **Request for Comments** documents — architecture and design
proposals that must be agreed before significant product work begins. RFCs are
documentation only; implementation follows in separate issues and PRs.

## Numbering

RFCs are numbered sequentially with a four-digit prefix:

```text
docs/rfc/NNNN-short-slug.md
```

- `0001` is the first RFC in this directory.
- Numbers are never reused. A superseded RFC keeps its number; the replacement
  RFC gets the next available number.
- The slug is a lowercase, hyphenated summary of the topic.

> **Note:** An earlier E2E encryption proposal lives at
> `docs/rfcs/0001-e2e-encryption.md` (plural `rfcs/`). New RFCs use this
> `docs/rfc/` directory and numbering continues here.

## Statuses

| Status | Meaning |
| --- | --- |
| **Draft** | Under review; decisions may change. |
| **Accepted** | Maintainers have agreed; implementation issues may be opened. |
| **Superseded** | Replaced by a newer RFC; kept for history. |

Update the status field in the RFC front matter when the document moves between
states. Accepted RFCs should link to the implementation issues they spawned.

## Process

1. Open a tracking issue describing the problem and expected deliverable.
2. Author an RFC as a docs-only PR, taking a position on every decision point.
3. Review in the PR; revise until maintainers accept or reject.
4. On acceptance, change status to **Accepted** and open implementation
   sub-issues with explicit dependency order.
5. If the design changes materially later, write a new RFC that supersedes the
   old one rather than silently editing accepted decisions.
