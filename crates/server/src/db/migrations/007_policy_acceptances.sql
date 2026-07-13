-- Record user acceptance of versioned Terms of Service and Privacy Policy.
-- Used at sign-up (browsewrap) and later at checkout (#332).

CREATE TABLE policy_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    policy TEXT NOT NULL,
    version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address INET
);

CREATE INDEX policy_acceptances_user_id_idx ON policy_acceptances (user_id);

CREATE UNIQUE INDEX policy_acceptances_user_policy_version_uidx
    ON policy_acceptances (user_id, policy, version);
