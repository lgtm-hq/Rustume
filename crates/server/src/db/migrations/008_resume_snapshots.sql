CREATE TABLE resume_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resumes (id) ON DELETE CASCADE,
    version INT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (resume_id, version)
);

CREATE INDEX resume_snapshots_resume_id_created_at_idx ON resume_snapshots (resume_id, created_at DESC);
