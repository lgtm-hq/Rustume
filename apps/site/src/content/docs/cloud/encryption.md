---
title: "Encryption"
description: 'Storage encryption and optional end-to-end protection for account-backed Rustume resume data.'
category: cloud
order: 50
---

Connected Rustume storage is designed for documents that may contain sensitive personal data.
Encryption is available whether you use hosted Rustume Cloud or operate the connected deployment
yourself.

## Protection choices

| Mode | Behavior | Trade-off |
| --- | --- | --- |
| Server-managed encryption | Resume content is encrypted at rest while the server can decrypt for rendering and connected features | Operators must protect keys and service access |
| Optional end-to-end encryption | The browser encrypts using a user-held secret before upload | The service cannot recover a lost secret or process readable content without user participation |

## Operator responsibility

Encryption does not remove the need to restrict database access, encrypt backups, protect key
material, and choose appropriate telemetry scrubbing. Self-hosted operators own these controls; the
hosted service operates them for its managed deployment.

Use [Cloud Storage](/docs/cloud/storage/) for persistence, [Backups](/docs/operations/backups/) for
recovery operations, and [Authentication](/docs/cloud/auth/) for the account boundary.
