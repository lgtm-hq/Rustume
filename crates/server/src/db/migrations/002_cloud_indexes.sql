-- Hosted-service billing and public resume query helpers.

CREATE INDEX resumes_is_public_idx ON resumes (public_slug)
WHERE is_public = true;

CREATE INDEX subscriptions_active_user_idx ON subscriptions (user_id)
WHERE status = 'active';

ALTER TABLE users
ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'pro', 'team'));

ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'pro', 'team'));

ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_status_check CHECK (
    status IN ('active', 'canceled', 'past_due', 'paused', 'trialing')
);
