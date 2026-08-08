-- ============================================
-- NexCore Labs — Projects Table RLS Policies
-- Enables AI and public access to published projects
-- ============================================

-- Step 1: Enable RLS on projects table (if not already enabled)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Public can view published projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users can view published projects" ON projects;
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can manage own projects" ON projects;

-- Step 3: Create policies for reading published projects

-- Policy 1: Allow anonymous users to read published projects
CREATE POLICY "Public can view published projects"
ON projects FOR SELECT
TO anon
USING (published = true);

-- Policy 2: Allow authenticated users to read published projects
CREATE POLICY "Authenticated users can view published projects"
ON projects FOR SELECT
TO authenticated
USING (published = true);

-- Policy 3: Allow users to view their own projects (published or not)
-- Uses owner_user_id column that matches auth.uid()
CREATE POLICY "Users can view own projects"
ON projects FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

-- Policy 4: Allow users to manage (INSERT, UPDATE, DELETE) their own projects
CREATE POLICY "Users can manage own projects"
ON projects FOR ALL
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- ============================================
-- Verification Query
-- Run this to check if policies are active:
-- ============================================
-- SELECT * FROM pg_policies WHERE tablename = 'projects';

-- ============================================
-- Test Query
-- Run this as an authenticated user to verify:
-- ============================================
-- SELECT name, slug, category, published
-- FROM projects
-- WHERE published = true
-- LIMIT 5;
