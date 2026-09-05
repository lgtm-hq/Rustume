-- Expand step: add a unique, user-editable username alongside the legacy
-- first_name/last_name columns.
--
-- `init_cloud` runs migrations before an instance serves, so during a rolling
-- deploy a pre-username binary can still be reading first_name/last_name and
-- inserting users WITHOUT a username while the new binary has already
-- migrated the database. This step therefore:
--
--   * keeps first_name/last_name (old replicas still SELECT them);
--   * leaves username NULLABLE (old replicas still INSERT without it). The
--     unique index below is over the COALESCEd effective handle, so a NULL
--     username is indexed as the row's hyphen-stripped id, which is unique per
--     row; the new binary reads such rows with the same expression.
--
-- The contract step ships in a later release once no pre-username binaries can
-- be running: backfill any remaining NULL usernames, SET NOT NULL, and DROP the
-- legacy name columns. The new code never reads or writes those columns.
ALTER TABLE users ADD COLUMN username TEXT;

-- Backfill expression. CONTRACT: this is USERNAME_FALLBACK_SQL in
-- crates/server/src/auth/username.rs, used by every `users` read in the new
-- binary; `username_contract_matches_migration` fails if they drift.
UPDATE users
SET username = replace(id::text, '-', '')
WHERE username IS NULL;

-- Uniqueness is enforced over the EFFECTIVE handle, not just stored values, so
-- a user cannot PATCH their username to the fallback handle of a row that an
-- older replica inserted with a NULL username during the rollout.
-- CONTRACT: the index name is USERNAME_UNIQUE_INDEX in
-- crates/server/src/auth/username.rs, matched by sign-up to decide whether a
-- unique violation is a retryable handle collision; the same test guards it.
CREATE UNIQUE INDEX idx_users_username_unique
    ON users ((COALESCE(username, replace(id::text, '-', ''))));
