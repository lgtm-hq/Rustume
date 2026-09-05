# Rustume RFCs

This directory holds **Request for Comments** documents — architecture and design
proposals that must be agreed before significant product work begins. RFCs are
documentation only; implementation follows in separate issues and PRs.

## Numbering

RFCs are numbered sequentially with a four-digit prefix:

```text
docs/rfc/NNNN-short-slug.md
```

- Numbers are never reused. A superseded RFC keeps its number; the replacement
  RFC gets the next available number.
- The slug is a lowercase, hyphenated summary of the topic.

## Statuses

| Status         | Meaning                                                       |
| -------------- | ------------------------------------------------------------- |
| **Draft**      | Under review; decisions may change.                           |
| **Accepted**   | Maintainers have agreed; implementation issues may be opened. |
| **Superseded** | Replaced by a newer RFC; kept for history.                    |

Update the status field in the RFC metadata table when the document moves between
states. Accepted RFCs should link to the implementation issues they spawned.

## Process

1. Open a tracking issue describing the problem and expected deliverable.
2. Author an RFC as a docs-only PR, taking a position on every decision point.
3. Review in the PR; revise until maintainers accept or reject.
4. On acceptance, open implementation issues linked from the RFC.
5. Mark the RFC **Accepted** and keep it updated if design decisions change during
   implementation.

## Index

| RFC                                             | Title                                          | Status |
| ----------------------------------------------- | ---------------------------------------------- | ------ |
| [0001](./0001-e2e-encryption.md)                | End-to-End Encryption for Cloud Resume Storage | Draft  |
| [0002](./0002-local-cloud-linking.md)           | Local↔Cloud Instance Linking                   | Draft  |
| [0003](./0003-local-first-encrypted-storage.md) | Local-First Encrypted Storage                  | Draft  |
