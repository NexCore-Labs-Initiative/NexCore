-- ============================================================
-- NexCore Labs — Bank Transfer Support Migration
-- Run this in the Supabase SQL Editor (one-time migration)
-- ============================================================

-- ── 1. Add bank-transfer columns to subscription_orders ───────────────────────

ALTER TABLE subscription_orders
    ADD COLUMN IF NOT EXISTS receipt_url          TEXT,
    ADD COLUMN IF NOT EXISTS bank_transaction_ref TEXT,
    ADD COLUMN IF NOT EXISTS transfer_date        DATE;

-- ── 2. Expand CHECK constraints ───────────────────────────────────────────────
-- Drop old constraints first (Postgres doesn't support ADD OR REPLACE for CHECKs)

ALTER TABLE subscription_orders
    DROP CONSTRAINT IF EXISTS subscription_orders_payment_method_check;

ALTER TABLE subscription_orders
    ADD CONSTRAINT subscription_orders_payment_method_check
    CHECK (payment_method IN ('whatsapp', 'paypal', 'bank_transfer'));

ALTER TABLE subscription_orders
    DROP CONSTRAINT IF EXISTS subscription_orders_status_check;

ALTER TABLE subscription_orders
    ADD CONSTRAINT subscription_orders_status_check
    CHECK (status IN ('pending', 'active', 'rejected', 'cancelled', 'pending_verification'));

-- ── 3. Index for payment method (admin filtering) ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sub_orders_payment_method
    ON subscription_orders (payment_method);

-- ── 4. Supabase Storage Bucket Setup ─────────────────────────────────────────
--
-- Create manually in Supabase Dashboard → Storage:
--
--   Bucket name : payment-receipts
--   Public      : NO (private — never expose receipts publicly)
--   File size   : 2MB limit (set in bucket settings)
--
-- Then run the RLS policies below so anonymous users can INSERT (upload)
-- but CANNOT read or delete files. Only the service role key (used in
-- serverless API functions) can read/delete via signed URLs later.
--
-- Storage RLS Policies (run in SQL Editor):

-- Allow authenticated/anon INSERT (upload) into the bucket
-- (Supabase Storage uses a separate schema — run this after creating bucket)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'payment-receipts',
    'payment-receipts',
    false,               -- private bucket
    2097152,             -- 2 MB file size limit
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone (anon / authenticated) to upload receipts
CREATE POLICY "allow_receipt_upload"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'payment-receipts');

-- Deny public reads (admin accesses files via service role or signed URLs)
-- No SELECT policy is needed — without one, only service role can read.

-- ── 5. Notes for future maintenance ──────────────────────────────────────────
--
-- Storage paths are structured as: YYYY/MM/timestamp_hex.ext
--   e.g.  2026/05/1746787200000_a3f9c2.jpg
--
-- This allows easy cleanup by date:
--   DELETE FROM storage.objects
--   WHERE bucket_id = 'payment-receipts'
--   AND name LIKE '2025/%';
--
-- Or bulk-list by month in the Supabase Storage dashboard.
-- ─────────────────────────────────────────────────────────────────────────────
