-- Validate the constraints added NOT VALID in migration 007.
-- VALIDATE CONSTRAINT scans with SHARE UPDATE EXCLUSIVE, so concurrent
-- reads and writes are not blocked while existing rows are checked.

ALTER TABLE users VALIDATE CONSTRAINT users_plan_check;
ALTER TABLE resumes VALIDATE CONSTRAINT resumes_data_xor;
ALTER TABLE resume_versions VALIDATE CONSTRAINT resume_versions_data_xor;
