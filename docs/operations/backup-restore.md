# Database backup and restore

Scheduled logical backups of the Rustume Cloud Neon PostgreSQL database are created by
`.github/workflows/db-backup.yml` and stored in a dedicated Cloudflare R2 bucket via
`scripts/ci/backup/backup-db.sh`. Retention pruning runs immediately after each backup via
`scripts/ci/backup/prune-backups.sh`.

Provider-side setup (Neon PITR, R2 bucket creation, scoped access token, repository
secrets, and a live restore rehearsal) is tracked in GitHub issue #334. This document
covers the restore procedure operators should follow once backups exist.

## Prerequisites

- Access to the Neon project hosting Rustume Cloud PostgreSQL
- Access to the R2 backups bucket (read-only token is sufficient for restore)
- `postgresql-client` (`pg_restore`, `psql`) and AWS CLI v2 installed locally or in a
  throwaway environment
- The latest backup object key from R2 (pattern:
  `rustume-<environment>-<UTC-timestamp>.dump.gz`)

## RPO / RTO (fill after rehearsal)

| Metric | Target | Measured (rehearsal date) | Notes |
| --- | --- | --- | --- |
| RPO (max data loss) | _TBD_ | _TBD_ | Depends on backup schedule and Neon PITR window |
| RTO (time to restore service) | _TBD_ | _TBD_ | Includes branch creation, restore, verification, cutover |

## Restore procedure

### 1. Create a throwaway Neon branch

1. Open the Neon console for the Rustume Cloud project.
2. Create a new branch from the current production timeline (or from a specific point in
   time if using PITR).
3. Note the connection string for the new branch. Do **not** point production at this
   branch yet.

### 2. Download the latest backup

```bash
export R2_ACCOUNT_ID="<account-id>"
export R2_ACCESS_KEY_ID="<read-scoped-key>"
export R2_SECRET_ACCESS_KEY="<read-scoped-secret>"
export R2_BACKUP_BUCKET="<backups-bucket>"
export BACKUP_ENV="production"

endpoint="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
latest="$(aws s3 ls "s3://${R2_BACKUP_BUCKET}/" --endpoint-url "${endpoint}" \
  | awk '{print $4}' \
  | grep -E "^rustume-${BACKUP_ENV}-[0-9]{8}T[0-9]{6}Z\\.dump\\.gz$" \
  | sort \
  | tail -1)"

aws s3 cp "s3://${R2_BACKUP_BUCKET}/${latest}" "./${latest}" \
  --endpoint-url "${endpoint}"
gunzip -c "./${latest}" > restore.dump
```

### 3. Restore with pg_restore

Use a clean database on the throwaway branch (drop/recreate the `public` schema or use an
empty database created for the rehearsal):

```bash
export RESTORE_DATABASE_URL="postgresql://...throwaway-branch..."
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname="${RESTORE_DATABASE_URL}" restore.dump
```

Review `pg_restore` warnings. Failures on extensions or roles may be expected depending on
Neon permissions; data-bearing tables must restore without error.

### 4. Integrity verification

Run row-count and referential sanity checks against the throwaway branch:

```sql
-- Core table row counts (adjust if schema evolves)
SELECT 'users' AS table_name, COUNT(*) FROM users
UNION ALL
SELECT 'resumes', COUNT(*) FROM resumes
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions;

-- Foreign-key orphan checks (examples)
SELECT COUNT(*) AS orphan_resumes
FROM resumes r
LEFT JOIN users u ON u.id = r.user_id
WHERE u.id IS NULL;

SELECT COUNT(*) AS orphan_subscriptions
FROM subscriptions s
LEFT JOIN users u ON u.id = s.user_id
WHERE u.id IS NULL;
```

Compare counts to production (or to the last known-good snapshot). Investigate any large
unexpected deltas before promoting.

Optional application-level smoke test: point a local or staging Rustume Cloud instance at
the throwaway branch and verify login, resume load, and export flows.

### 5. Promote or cut over

Only after verification:

1. Update the production `DATABASE_URL` (Railway service variable or a secret
   managed by the `rustume-ops` Terraform) to the restored branch connection
   string, **or** merge the restored data back into production using Neon’s
   promote/swap workflow if applicable.
2. Redeploy or restart Rustume Cloud so connection pools pick up the new URL.
3. Monitor error rates and Sentry/Grafana dashboards (#333 / #335).
4. Document measured RPO/RTO in the table above.

## Manual backup / prune (operators)

Trigger from **Actions → Maintenance - Database Backup**. Use `dry_run: true` to validate
connectivity without uploading or deleting objects.

Local invocation (requires secrets):

```bash
BACKUP_DATABASE_URL=... \
R2_ACCOUNT_ID=... \
R2_ACCESS_KEY_ID=... \
R2_SECRET_ACCESS_KEY=... \
R2_BACKUP_BUCKET=... \
  scripts/ci/backup/backup-db.sh

R2_ACCOUNT_ID=... \
R2_ACCESS_KEY_ID=... \
R2_SECRET_ACCESS_KEY=... \
R2_BACKUP_BUCKET=... \
  scripts/ci/backup/prune-backups.sh --dry-run
```

## Alerting

A failed scheduled backup surfaces as a failed GitHub Actions workflow run. Longer-term
Grafana/Sentry alerting hooks for backup failures are tracked in #333 and #335.

## Security notes

- Backup credentials must be scoped to the backups bucket only.
- Never commit or log connection strings, R2 keys, or dump contents.
- Treat restored throwaway branches like production data; restrict access and delete when
  the rehearsal completes.
