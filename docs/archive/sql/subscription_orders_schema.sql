-- ============================================================
-- NexCore Labs — Subscription Orders Table
-- Run this in the Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_orders (
    id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_id          TEXT          UNIQUE NOT NULL,
    user_name        TEXT          NOT NULL,
    user_email       TEXT          NOT NULL,
    whatsapp_number  TEXT,
    selected_features JSONB        NOT NULL DEFAULT '[]'::jsonb,
    total_omr        DECIMAL(10,3) NOT NULL DEFAULT 0,
    total_usd        DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_method   TEXT          NOT NULL CHECK (payment_method IN ('whatsapp', 'paypal')),
    status           TEXT          NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'active', 'rejected', 'cancelled')),
    admin_notes      TEXT,
    paypal_order_id  TEXT,
    notes            TEXT,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    activated_at     TIMESTAMPTZ
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_sub_orders_email      ON subscription_orders (user_email);
CREATE INDEX IF NOT EXISTS idx_sub_orders_status     ON subscription_orders (status);
CREATE INDEX IF NOT EXISTS idx_sub_orders_bill_id    ON subscription_orders (bill_id);
CREATE INDEX IF NOT EXISTS idx_sub_orders_created_at ON subscription_orders (created_at DESC);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE subscription_orders ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can INSERT a new order
CREATE POLICY "anyone_can_insert_orders"
    ON subscription_orders
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Authenticated users can read their own orders
CREATE POLICY "users_can_read_own_orders"
    ON subscription_orders
    FOR SELECT
    TO authenticated
    USING (user_email = (auth.jwt() ->> 'email'));

-- NOTE: Full admin SELECT / UPDATE access is handled via the
--       service role key used in the serverless API functions.
--       No additional RLS policy is needed for service-role reads.

-- Admins can read ALL orders (admin panel uses authenticated client)
CREATE POLICY "admins_can_read_all_orders"
    ON subscription_orders
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admins
            WHERE email = (auth.jwt() ->> 'email')
        )
    );

-- Admins can update orders (status changes via admin panel direct client)
CREATE POLICY "admins_can_update_orders"
    ON subscription_orders
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admins
            WHERE email = (auth.jwt() ->> 'email')
        )
    )
    WITH CHECK (true);
