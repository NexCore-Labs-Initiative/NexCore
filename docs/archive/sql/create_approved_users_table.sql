-- ============================================================
-- Create approved_users table for non-SQU user whitelist
-- ============================================================

-- Table to store approved email addresses
CREATE TABLE IF NOT EXISTS approved_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    approved_by TEXT,
    reason TEXT,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_approved_users_email ON approved_users(email);

-- Enable Row Level Security (RLS)
ALTER TABLE approved_users ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read approved users (needed for auth check)
CREATE POLICY "Anyone can read approved users"
    ON approved_users
    FOR SELECT
    USING (true);

-- Policy: Only authenticated users can insert (you can make this more restrictive)
CREATE POLICY "Authenticated users can insert approved users"
    ON approved_users
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Policy: Only the user who approved can update/delete
CREATE POLICY "Only approver can update"
    ON approved_users
    FOR UPDATE
    USING (approved_by = auth.jwt()->>'email');

CREATE POLICY "Only approver can delete"
    ON approved_users
    FOR DELETE
    USING (approved_by = auth.jwt()->>'email');

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_approved_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_approved_users_timestamp
    BEFORE UPDATE ON approved_users
    FOR EACH ROW
    EXECUTE FUNCTION update_approved_users_updated_at();

COMMENT ON TABLE approved_users IS 'Whitelist of approved non-SQU email addresses for platform access';

-- ============================================================
-- Create admins table for platform administrators
-- ============================================================

CREATE TABLE IF NOT EXISTS admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    added_by TEXT,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- Enable Row Level Security (RLS)
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read admins (needed for auth check)
CREATE POLICY "Anyone can read admins"
    ON admins
    FOR SELECT
    USING (true);

-- Policy: Only existing admins can insert new admins
CREATE POLICY "Only admins can insert admins"
    ON admins
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admins
            WHERE email = auth.jwt()->>'email'
        )
    );

-- Policy: Only existing admins can update
CREATE POLICY "Only admins can update"
    ON admins
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM admins
            WHERE email = auth.jwt()->>'email'
        )
    );

-- Policy: Only existing admins can delete
CREATE POLICY "Only admins can delete"
    ON admins
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM admins
            WHERE email = auth.jwt()->>'email'
        )
    );

COMMENT ON TABLE admins IS 'Platform administrators who can manage approved users';

-- ============================================================
-- Add your admin emails here (IMPORTANT: Edit these!)
-- ============================================================

-- STEP 1: Add yourself as the first admin
-- Replace 'your-email@squ.edu.om' with YOUR actual email address:
INSERT INTO admins (email, added_by, notes) VALUES
('your-email@squ.edu.om', 'system', 'Initial admin')
ON CONFLICT (email) DO NOTHING;

-- STEP 2: Add other admins (optional)
-- Uncomment and add more admins as needed:
-- INSERT INTO admins (email, added_by, notes) VALUES
-- ('admin2@squ.edu.om', 'your-email@squ.edu.om', 'Co-administrator'),
-- ('admin3@student.squ.edu.om', 'your-email@squ.edu.om', 'Student admin')
-- ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- Optional: Add some example approved users
-- ============================================================

-- Uncomment to add example approved users:
-- INSERT INTO approved_users (email, approved_by, reason) VALUES
-- ('johndoe@example.com', 'your-email@squ.edu.om', 'External collaborator'),
-- ('partner@company.com', 'your-email@squ.edu.om', 'Industry partner')
-- ON CONFLICT (email) DO NOTHING;
