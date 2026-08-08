-- ============================================
-- Fix RLS Policies for approved_users and admins
-- ============================================
-- This allows admins to manage both tables properly

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Only approver can update" ON approved_users;
DROP POLICY IF EXISTS "Only approver can delete" ON approved_users;
DROP POLICY IF EXISTS "Only adder can update" ON admins;
DROP POLICY IF EXISTS "Only adder can delete" ON admins;

-- Better policies for approved_users
-- Allow admins to update/delete any entry
CREATE POLICY "Admins can update approved users"
    ON approved_users
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM admins
            WHERE admins.email = auth.jwt()->>'email'
        )
    );

CREATE POLICY "Admins can delete approved users"
    ON approved_users
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM admins
            WHERE admins.email = auth.jwt()->>'email'
        )
    );

-- Better policies for admins table
CREATE POLICY "Admins can update other admins"
    ON admins
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM admins
            WHERE admins.email = auth.jwt()->>'email'
        )
    );

CREATE POLICY "Admins can delete other admins"
    ON admins
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM admins
            WHERE admins.email = auth.jwt()->>'email'
        )
    );

-- Grant explicit permissions to anon role for reading
GRANT SELECT ON approved_users TO anon;
GRANT SELECT ON admins TO anon;
