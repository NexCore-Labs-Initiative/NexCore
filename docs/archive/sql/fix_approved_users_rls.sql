-- Fix: Allow any admin (row in `admins` table) to update or delete approved_users
-- Run this once in the Supabase SQL Editor

-- Drop the old restrictive policies
DROP POLICY IF EXISTS "Only approver can update" ON approved_users;
DROP POLICY IF EXISTS "Only approver can delete" ON approved_users;

-- New: any authenticated admin can update or delete
CREATE POLICY "Admins can update approved users"
    ON approved_users
    FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admins WHERE email = auth.jwt()->>'email'));

CREATE POLICY "Admins can delete approved users"
    ON approved_users
    FOR DELETE
    USING (EXISTS (SELECT 1 FROM admins WHERE email = auth.jwt()->>'email'));
