-- Enforce email uniqueness at the database level.
-- WorkOS guarantees one email per user but a DB-side guard prevents
-- duplicates if the upsert path ever changes. The index also speeds
-- up any future lookup-by-email queries.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email);
