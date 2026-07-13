-- Replace first/last name with a unique, user-editable username.
ALTER TABLE users ADD COLUMN username TEXT;

UPDATE users
SET username = 'user-' || substr(md5(id::text), 1, 8)
WHERE username IS NULL;

CREATE UNIQUE INDEX idx_users_username_unique ON users (username);

ALTER TABLE users ALTER COLUMN username SET NOT NULL;

ALTER TABLE users
DROP COLUMN first_name,
DROP COLUMN last_name;
