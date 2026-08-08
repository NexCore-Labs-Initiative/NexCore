-- ============================================
-- NexCore Labs - Auth Hook for Email Validation
-- ============================================
-- This hook checks if a user's email is allowed before authentication completes
-- It validates against SQU domains OR the approved_users table

-- Create the auth hook function
CREATE OR REPLACE FUNCTION public.check_email_authorization()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_email TEXT;
  is_allowed BOOLEAN := FALSE;
BEGIN
  -- Get the email from the new user record
  user_email := LOWER(TRIM(NEW.email));

  -- Check if email is from allowed SQU domains
  IF user_email LIKE '%@squ.edu.om' OR user_email LIKE '%@student.squ.edu.om' THEN
    is_allowed := TRUE;
  END IF;

  -- If not from allowed domain, check if in approved_users table
  IF NOT is_allowed THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.approved_users
      WHERE LOWER(email) = user_email
    ) INTO is_allowed;
  END IF;

  -- If not allowed, prevent the user creation/sign-in
  IF NOT is_allowed THEN
    RAISE EXCEPTION 'Email domain not authorized. Only SQU emails or pre-approved users can sign in.'
      USING HINT = 'Contact an administrator for access.';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS validate_email_on_signup ON auth.users;

-- Create trigger that fires before user creation
CREATE TRIGGER validate_email_on_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_email_authorization();

-- ============================================
-- IMPORTANT: Grant necessary permissions
-- ============================================

-- Allow the trigger function to read from approved_users
GRANT SELECT ON public.approved_users TO postgres;
GRANT SELECT ON public.approved_users TO authenticated;
GRANT SELECT ON public.approved_users TO anon;

-- ============================================
-- Test the setup (optional)
-- ============================================

-- To test, try signing up with:
-- 1. An SQU email (should work)
-- 2. A non-SQU email that's in approved_users (should work)
-- 3. A non-SQU email that's NOT approved (should fail with error message)
