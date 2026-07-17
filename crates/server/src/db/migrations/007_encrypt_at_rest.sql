-- Application-level encryption at rest (#254).
-- Resume payloads are stored in exactly one of:
--   data           JSONB  — plaintext (cloud default)
--   data_encrypted BYTEA  — AES-256-GCM nonce || ciphertext (self-hosted default)
--
-- Check constraints are added NOT VALID so populated tables are not scanned
-- under this migration's locks; migration 008 validates them with the less
-- restrictive SHARE UPDATE EXCLUSIVE lock.

-- Allow the implicit self-hosted user plan alongside cloud billing plans.
ALTER TABLE users DROP CONSTRAINT users_plan_check;
ALTER TABLE users
ADD CONSTRAINT users_plan_check
CHECK (plan IN ('free', 'pro', 'team', 'self-hosted')) NOT VALID;

ALTER TABLE resumes ADD COLUMN data_encrypted BYTEA;
ALTER TABLE resumes ALTER COLUMN data DROP NOT NULL;

ALTER TABLE resume_versions ADD COLUMN data_encrypted BYTEA;
ALTER TABLE resume_versions ALTER COLUMN data DROP NOT NULL;

-- Enforce exactly one of data / data_encrypted is set.
ALTER TABLE resumes ADD CONSTRAINT resumes_data_xor CHECK (
    (data IS NOT NULL AND data_encrypted IS NULL)
    OR (data IS NULL AND data_encrypted IS NOT NULL)
) NOT VALID;
ALTER TABLE resume_versions ADD CONSTRAINT resume_versions_data_xor CHECK (
    (data IS NOT NULL AND data_encrypted IS NULL)
    OR (data IS NULL AND data_encrypted IS NOT NULL)
) NOT VALID;
