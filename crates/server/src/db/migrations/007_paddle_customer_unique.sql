-- Clear duplicate paddle_customer_id values, keeping the earliest linked row.
UPDATE users AS u
SET
    paddle_customer_id = NULL,
    updated_at = now()
FROM (
    SELECT
        id,
        row_number() OVER (
            PARTITION BY paddle_customer_id
            ORDER BY updated_at, id
        ) AS row_num
    FROM users
    WHERE paddle_customer_id IS NOT NULL
) AS ranked
WHERE
    u.id = ranked.id
    AND ranked.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS users_paddle_customer_id_unique
ON users (paddle_customer_id)
WHERE paddle_customer_id IS NOT NULL;
