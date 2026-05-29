---
title: "Version History"
description: 'Review and restore saved resume versions in hosted Cloud or a self-hosted connected deployment.'
category: cloud
order: 80
---

Connected Rustume records resume history so accidental edits and synchronization conflicts can be
recovered without maintaining manual exports for every change.

## History workflow

1. Saving a changed resume records a versioned snapshot.
2. The history view lists previous revisions and their timestamps.
3. A user can inspect and restore an earlier revision.
4. Restoration creates a new current revision rather than discarding audit history.

Version history is part of the application capability set for both hosted and self-hosted connected
deployments. Storage retention is an operational policy: hosted Rustume Cloud publishes its
retention behavior, while self-hosted operators select storage and pruning settings for their
deployment.

JSON export is still useful for portable backups outside the service. See
[Backups](/docs/operations/backups/) and [Sync](/docs/cloud/sync/).
