-- Resolve duplicate paddle_customer_id links before enforcing uniqueness.
-- Prefer the user with the latest subscription for that customer; if none
-- exists, clear every duplicate link so webhooks can re-link safely.
WITH duplicate_customer_ids AS (
    SELECT paddle_customer_id
    FROM users
    WHERE paddle_customer_id IS NOT NULL
    GROUP BY paddle_customer_id
    HAVING COUNT(*) > 1
),

subscription_owners AS (
    SELECT
        u.paddle_customer_id,
        u.id AS user_id,
        MAX(s.updated_at) AS latest_subscription_at
    FROM users AS u
    INNER JOIN duplicate_customer_ids AS d
        ON d.paddle_customer_id = u.paddle_customer_id
    INNER JOIN subscriptions AS s
        ON s.user_id = u.id
    GROUP BY u.paddle_customer_id, u.id
),

canonical_owner AS (
    SELECT DISTINCT ON (paddle_customer_id)
        paddle_customer_id,
        user_id
    FROM subscription_owners
    ORDER BY paddle_customer_id ASC, latest_subscription_at DESC, user_id ASC
)

UPDATE users AS u
SET
    paddle_customer_id = NULL,
    updated_at = now()
FROM duplicate_customer_ids AS d
LEFT JOIN canonical_owner AS c
    ON c.paddle_customer_id = d.paddle_customer_id
WHERE
    u.paddle_customer_id = d.paddle_customer_id
    AND (c.user_id IS NULL OR u.id <> c.user_id);

CREATE UNIQUE INDEX IF NOT EXISTS users_paddle_customer_id_unique
ON users (paddle_customer_id)
WHERE paddle_customer_id IS NOT NULL;
