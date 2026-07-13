-- Clear all duplicate paddle_customer_id links before enforcing uniqueness.
-- Prefer leaving ambiguous rows unlinked so later webhooks can re-attach via
-- custom_data.user_id rather than keeping a potentially wrong owner.
UPDATE users AS u
SET
    paddle_customer_id = NULL,
    updated_at = now()
FROM (
    SELECT paddle_customer_id
    FROM users
    WHERE paddle_customer_id IS NOT NULL
    GROUP BY paddle_customer_id
    HAVING COUNT(*) > 1
) AS duplicates
WHERE u.paddle_customer_id = duplicates.paddle_customer_id;

CREATE UNIQUE INDEX IF NOT EXISTS users_paddle_customer_id_unique
ON users (paddle_customer_id)
WHERE paddle_customer_id IS NOT NULL;
