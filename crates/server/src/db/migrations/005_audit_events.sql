CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    actor_user_id UUID REFERENCES users (id) ON DELETE RESTRICT,
    resource_type TEXT,
    resource_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_created_at_idx ON audit_events (created_at);
CREATE INDEX audit_events_event_type_idx ON audit_events (event_type);
CREATE INDEX audit_events_actor_user_id_idx ON audit_events (actor_user_id);
CREATE INDEX audit_events_actor_user_id_created_at_idx
ON audit_events (actor_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION audit_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_events records are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION audit_events_immutable();

CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION audit_events_immutable();
