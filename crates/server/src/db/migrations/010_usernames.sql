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

UPDATE users
SET username = replace(id::text, '-', '')
WHERE username IS NULL;

CREATE UNIQUE INDEX idx_users_username_unique ON users (username);
