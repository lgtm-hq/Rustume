---
title: "API Keys"
description: 'Scoped credentials for programmatic connected Rustume access in hosted Cloud or a self-hosted deployment.'
category: api
order: 40
---

API keys let users integrate connected Rustume workflows with automation without sharing a browser
session cookie. They are available in the hosted service and in self-hosted connected deployments;
they are not a paid-only feature.

## Capabilities

- Create a key for a named automation or integration
- Assign only the required scopes, such as resume read/write or render access
- Display the secret once and store only a protected representation server-side
- Revoke unused or compromised keys
- Review usage metadata and apply deployment-level rate limits

Treat an API key like a password and rotate it if it is exposed. Read [Core
Endpoints](/docs/api/core-endpoints/) and [Cloud Endpoints](/docs/api/cloud-endpoints/) for the
operations a key can authorize.
