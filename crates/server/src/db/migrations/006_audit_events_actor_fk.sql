-- Retain audit history when a user is hard-deleted.
-- actor_user_id remains as a historical UUID without a live FK.
ALTER TABLE audit_events
    DROP CONSTRAINT IF EXISTS audit_events_actor_user_id_fkey;
