-- ============================================
-- Fix: Update auth hook to use correct table name
-- The hook was referencing "allowed_users" but
-- the actual table is "approved_users"
-- ============================================

-- Replace the broken hook function with the correct one
CREATE OR REPLACE FUNCTION public.hook_allow_only_squ_domains(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  is_allowed BOOLEAN := FALSE;
BEGIN
  -- Extract email from the hook event payload
  user_email := LOWER(TRIM(event->>'email'));

  -- Check if email is from allowed SQU domains
  IF user_email LIKE '%@squ.edu.om' OR user_email LIKE '%@student.squ.edu.om' THEN
    is_allowed := TRUE;
  END IF;

  -- If not from SQU domain, check approved_users table
  IF NOT is_allowed THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.approved_users
      WHERE LOWER(email) = user_email
    ) INTO is_allowed;
  END IF;

  -- Allow or deny
  IF is_allowed THEN
    RETURN jsonb_build_object('decision', 'continue');
  ELSE
    RETURN jsonb_build_object(
      'decision', 'reject',
      'message', 'Access restricted. Only SQU emails or pre-approved users can sign in.'
    );
  END IF;

END;
$$;

-- Grant execution permission to supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.hook_allow_only_squ_domains(jsonb) TO supabase_auth_admin;
