CREATE UNIQUE INDEX IF NOT EXISTS users_paddle_customer_id_unique
ON users (paddle_customer_id)
WHERE paddle_customer_id IS NOT NULL;
