-- Expand step: add a unique, user-editable username alongside the legacy
-- first_name/last_name columns.
--
-- `init_cloud` runs migrations before an instance serves, so during a rolling
-- deploy a pre-username binary can still be reading first_name/last_name and
-- inserting users WITHOUT a username while the new binary has already
-- migrated the database. This step therefore:
--
--   * keeps first_name/last_name (old replicas still SELECT them);
--   * leaves username NULLABLE (old replicas still INSERT without it; the
--     unique index permits multiple NULLs, and the new binary coalesces a
--     NULL username to the same hyphen-stripped id the backfill below uses).
--
-- The contract step ships in a later release once no pre-username binaries can
-- be running: backfill any remaining NULL usernames, SET NOT NULL, and DROP the
-- legacy name columns. The new code never reads or writes those columns.
ALTER TABLE users ADD COLUMN username TEXT;

-- Backfill expression. CONTRACT: the same expression is used by the new
-- binary to read a NULL username (auth/session.rs, auth/workos.rs) and will be
-- used again by the contract migration; change all of them together.
UPDATE users
SET username = replace(id::text, '-', '')
WHERE username IS NULL;

-- Uniqueness is enforced over the EFFECTIVE handle, not just stored values, so
-- a user cannot PATCH their username to the fallback handle of a row that an
-- older replica inserted with a NULL username during the rollout.
-- CONTRACT: the index name is matched by USERNAME_UNIQUE_INDEX in
-- auth/workos.rs to decide whether a unique violation is a retryable handle
-- collision; renaming it silently disables sign-up retries.
CREATE UNIQUE INDEX idx_users_username_unique
    ON users ((COALESCE(username, replace(id::text, '-', ''))));
