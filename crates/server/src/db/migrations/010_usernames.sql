-- Expand step: add a unique, user-editable username alongside the legacy
-- first_name/last_name columns.
--
-- The legacy columns are deliberately NOT dropped here. `init_cloud` runs
-- migrations before an instance serves, so during a rolling deploy a
-- pre-username binary can still be selecting first_name/last_name while the
-- new binary has already migrated the database. Dropping them in the same
-- release would break every old replica until it is replaced. The contract
-- step (DROP COLUMN first_name, last_name) ships in a later release once no
-- pre-username binaries can be running; the new code never reads or writes
-- these columns.
ALTER TABLE users ADD COLUMN username TEXT;

UPDATE users
SET username = replace(id::text, '-', '')
WHERE username IS NULL;

CREATE UNIQUE INDEX idx_users_username_unique ON users (username);

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
