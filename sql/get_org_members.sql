-- =====================================================
-- GET ORGANIZATION MEMBERS WITH EMAIL
-- =====================================================
-- This function fetches organization members with their
-- email addresses from auth.users table
-- =====================================================

-- Function to get organization members with emails
CREATE OR REPLACE FUNCTION get_organization_members(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Check if user is a member of this org OR is the owner
  IF NOT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = p_org_id 
    AND om.user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = p_org_id
    AND o.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You are not a member of this organization';
  END IF;

  RETURN QUERY
  SELECT 
    om.id,
    om.user_id,
    COALESCE(au.email, om.user_id::TEXT) AS email,
    COALESCE(au.raw_user_meta_data->>'full_name', '') AS full_name,
    om.role::TEXT,
    om.accepted_at,
    om.created_at
  FROM organization_members om
  LEFT JOIN auth.users au ON au.id = om.user_id
  WHERE om.organization_id = p_org_id
  ORDER BY 
    CASE om.role 
      WHEN 'owner' THEN 1 
      WHEN 'admin' THEN 2 
      WHEN 'manager' THEN 3 
      ELSE 4 
    END,
    om.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_organization_members(UUID) TO authenticated;

-- Function to check if email is already a member of organization
CREATE OR REPLACE FUNCTION check_member_exists(p_org_id UUID, p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members om
    JOIN auth.users au ON au.id = om.user_id
    WHERE om.organization_id = p_org_id
    AND LOWER(au.email) = LOWER(p_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_member_exists(UUID, TEXT) TO authenticated;
