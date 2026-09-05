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

-- Replay protection for Paddle webhooks: each event id is processed at most
-- once. Rows are claimed with INSERT ... ON CONFLICT DO NOTHING before the
-- event is handled and released again if handling fails, so Paddle retries
-- can reprocess failed deliveries.
CREATE TABLE billing_webhook_events (
    event_id TEXT PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ordering guard for out-of-order webhook deliveries: the Paddle event's
-- occurred_at timestamp of the most recent event applied to the row.
ALTER TABLE subscriptions
ADD COLUMN last_event_at TIMESTAMPTZ;
