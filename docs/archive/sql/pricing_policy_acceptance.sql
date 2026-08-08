-- NexCore Labs - Pricing policy acceptance metadata
-- Existing orders remain valid because both columns are nullable.

ALTER TABLE subscription_orders
    ADD COLUMN IF NOT EXISTS pricing_policy_version TEXT,
    ADD COLUMN IF NOT EXISTS pricing_policy_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN subscription_orders.pricing_policy_version IS
    'Version of the Pricing & Billing Policy accepted when the order was placed.';

COMMENT ON COLUMN subscription_orders.pricing_policy_accepted_at IS
    'Server timestamp recording when the customer accepted the pricing policy.';
