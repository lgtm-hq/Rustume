-- Enforce uniqueness without guessing owners or wiping valid links.
-- If pre-existing duplicates are found, fail loudly so an operator can
-- remediate before the unique index is created.
DO $$
DECLARE
    duplicate_count integer;
BEGIN
    SELECT COUNT(*)
    INTO duplicate_count
    FROM (
        SELECT paddle_customer_id
        FROM users
        WHERE paddle_customer_id IS NOT NULL
        GROUP BY paddle_customer_id
        HAVING COUNT(*) > 1
    ) AS duplicates;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION
            'Found % duplicate paddle_customer_id value(s). Keep one users row per customer id (clear the others), then re-run migrations.',
            duplicate_count;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_paddle_customer_id_unique
ON users (paddle_customer_id)
WHERE paddle_customer_id IS NOT NULL;

-- Replay protection for Paddle webhooks: each event id is applied at most
-- once. A row is inserted when a delivery is first seen and processed_at is
-- set only after the handler succeeds. A retry of an event whose row has no
-- processed_at is reprocessed (the handlers are idempotent); a retry of a
-- processed event is acknowledged and skipped.
CREATE TABLE billing_webhook_events (
    event_id TEXT PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- Ordering guard for out-of-order webhook deliveries: the Paddle event's
-- occurred_at timestamp of the most recent event applied to the row.
ALTER TABLE subscriptions
ADD COLUMN last_event_at TIMESTAMPTZ;
