---
title: "Cloud Data Model"
description: 'PostgreSQL responsibilities for WorkOS-linked accounts, synced resumes, history, publishing, and hosted billing records.'
category: architecture
order: 30
---

Connected deployments use PostgreSQL for account-backed application state. Rustume Cloud operates
this data layer for hosted users; self-hosted operators own it for their deployments.

## Data responsibilities

| Record area | Used for |
| --- | --- |
| Users and sessions | Opaque WorkOS identity link and authenticated sessions |
| Resumes | Owned encrypted document state, title, timestamps, and publication settings |
| Resume versions | History snapshots and restoration workflows |
| Public-page metadata | Slugs and optional password-protection state |
| API credentials | Scoped automation access and revocation metadata |
| Subscriptions | Hosted-service billing lifecycle only |

Subscriptions describe access to the Rustume-operated deployment. They do not decide whether
features such as history, public pages, or API keys exist in the application.

## Sensitive data

A resume may contain names, contact details, employment history, and other personal information.
Database access, key management, logs, and backups must therefore be protected appropriately. Read
[Encryption](/docs/cloud/encryption/) and [Backups](/docs/operations/backups/).

## Deletion and retention

Account deletion and hosted cancellation must define how synchronized documents, versions, public
links, and backup retention are handled. Self-hosted operators choose equivalent retention and
recovery policies for their deployment.
