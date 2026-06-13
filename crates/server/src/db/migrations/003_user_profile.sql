-- Profile fields are populated from WorkOS on the user's next sign-in.
ALTER TABLE users
ADD COLUMN email TEXT,
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT;
