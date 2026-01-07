-- =====================================================
-- FIX RLS POLICIES V2 - SIMPLER APPROACH
-- =====================================================
-- This script uses simpler policies that don't cause recursion
-- and properly handle the owner_id field for organizations
-- =====================================================

-- 1. DROP ALL EXISTING POLICIES
-- =====================================================

-- Organization policies
DROP POLICY IF EXISTS "org_select_policy" ON organizations;
DROP POLICY IF EXISTS "org_insert_policy" ON organizations;
DROP POLICY IF EXISTS "org_update_policy" ON organizations;
DROP POLICY IF EXISTS "org_delete_policy" ON organizations;
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can delete their organizations" ON organizations;
DROP POLICY IF EXISTS "org_select" ON organizations;
DROP POLICY IF EXISTS "org_insert" ON organizations;
DROP POLICY IF EXISTS "org_update" ON organizations;
DROP POLICY IF EXISTS "org_delete" ON organizations;

-- Organization members policies
DROP POLICY IF EXISTS "org_members_select_policy" ON organization_members;
DROP POLICY IF EXISTS "org_members_insert_policy" ON organization_members;
DROP POLICY IF EXISTS "org_members_update_policy" ON organization_members;
DROP POLICY IF EXISTS "org_members_delete_policy" ON organization_members;
DROP POLICY IF EXISTS "Members can view org members" ON organization_members;
DROP POLICY IF EXISTS "Admins can insert members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organization_members;
DROP POLICY IF EXISTS "members_select" ON organization_members;
DROP POLICY IF EXISTS "members_insert" ON organization_members;
DROP POLICY IF EXISTS "members_update" ON organization_members;
DROP POLICY IF EXISTS "members_delete" ON organization_members;

-- Invitations policies
DROP POLICY IF EXISTS "invitations_select_policy" ON invitations;
DROP POLICY IF EXISTS "invitations_insert_policy" ON invitations;
DROP POLICY IF EXISTS "invitations_update_policy" ON invitations;
DROP POLICY IF EXISTS "invitations_delete_policy" ON invitations;
DROP POLICY IF EXISTS "Members can view invitations" ON invitations;
DROP POLICY IF EXISTS "Admins can create invitations" ON invitations;
DROP POLICY IF EXISTS "Anyone can view their invitation by token" ON invitations;
DROP POLICY IF EXISTS "Admins can delete invitations" ON invitations;
DROP POLICY IF EXISTS "invitations_select" ON invitations;
DROP POLICY IF EXISTS "invitations_insert" ON invitations;
DROP POLICY IF EXISTS "invitations_update" ON invitations;
DROP POLICY IF EXISTS "invitations_delete" ON invitations;

-- 2. CREATE/REPLACE HELPER FUNCTIONS
-- =====================================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS is_org_admin(UUID);
DROP FUNCTION IF EXISTS get_my_org_ids();
DROP FUNCTION IF EXISTS get_my_admin_org_ids();

-- This function checks if user is admin/owner WITHOUT causing recursion
-- by using SECURITY DEFINER which bypasses RLS
CREATE OR REPLACE FUNCTION is_org_admin(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is the org owner directly (most common case)
  IF EXISTS (
    SELECT 1 FROM organizations 
    WHERE id = check_org_id 
    AND owner_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check organization_members for admin role
  RETURN EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_id = check_org_id 
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND accepted_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get all org IDs user belongs to
CREATE OR REPLACE FUNCTION get_my_org_ids()
RETURNS SETOF UUID AS $$
BEGIN
  -- Return orgs where user is owner
  RETURN QUERY
  SELECT id FROM organizations WHERE owner_id = auth.uid();
  
  -- Return orgs where user is a member
  RETURN QUERY
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid() AND accepted_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get org IDs where user is admin
CREATE OR REPLACE FUNCTION get_my_admin_org_ids()
RETURNS SETOF UUID AS $$
BEGIN
  -- Return orgs where user is owner
  RETURN QUERY
  SELECT id FROM organizations WHERE owner_id = auth.uid();
  
  -- Return orgs where user is admin
  RETURN QUERY
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid() 
  AND role IN ('owner', 'admin')
  AND accepted_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is owner of an organization
CREATE OR REPLACE FUNCTION is_org_owner(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organizations 
    WHERE id = check_org_id 
    AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. ORGANIZATIONS POLICIES
-- =====================================================

-- SELECT: Allow reading all organizations (public info)
-- Only mutations are restricted to owners
CREATE POLICY "org_select" ON organizations
  FOR SELECT USING (true);

-- INSERT: Any authenticated user can create an org
CREATE POLICY "org_insert" ON organizations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- UPDATE: Only the owner can update (using owner_id directly)
CREATE POLICY "org_update" ON organizations
  FOR UPDATE USING (
    owner_id = auth.uid()
  ) WITH CHECK (
    owner_id = auth.uid()
  );

-- DELETE: Only the owner can delete
CREATE POLICY "org_delete" ON organizations
  FOR DELETE USING (
    owner_id = auth.uid()
  );

-- 4. ORGANIZATION_MEMBERS POLICIES
-- =====================================================

-- SELECT: Users can see their own membership OR members of orgs they belong to
CREATE POLICY "members_select" ON organization_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR organization_id IN (SELECT get_my_org_ids())
  );

-- INSERT: Admins can add members, OR user is accepting their own invite
CREATE POLICY "members_insert" ON organization_members
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_my_admin_org_ids())
    OR user_id = auth.uid() -- Allow self-insert when accepting invite
  );

-- UPDATE: Admins can update (but not owner role)
CREATE POLICY "members_update" ON organization_members
  FOR UPDATE USING (
    organization_id IN (SELECT get_my_admin_org_ids())
    AND role != 'owner'
  );

-- DELETE: Admins can delete (but not owner)
CREATE POLICY "members_delete" ON organization_members
  FOR DELETE USING (
    organization_id IN (SELECT get_my_admin_org_ids())
    AND role != 'owner'
  );

-- 5. INVITATIONS POLICIES
-- =====================================================

-- SELECT: Anyone can view (needed for token-based lookup)
CREATE POLICY "invitations_select" ON invitations
  FOR SELECT USING (true);

-- INSERT: Owners of the org can create invitations
-- Using direct subquery instead of function to avoid any issues
CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- UPDATE: Allow updates (for marking as accepted)
CREATE POLICY "invitations_update" ON invitations
  FOR UPDATE USING (true);

-- DELETE: Owners can delete invitations
CREATE POLICY "invitations_delete" ON invitations
  FOR DELETE USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- 6. DATA TABLES - SIMPLE POLICIES
-- =====================================================
-- For data tables, we use a simple approach:
-- - If organization_id is NULL, allow access (legacy data)
-- - If organization_id is set, check membership

-- Helper function for data tables
CREATE OR REPLACE FUNCTION can_access_org_data(data_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF data_org_id IS NULL THEN
    RETURN TRUE;
  END IF;
  RETURN data_org_id IN (SELECT get_my_org_ids());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_edit_org_data(data_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF data_org_id IS NULL THEN
    RETURN TRUE;
  END IF;
  -- Check if user is owner or has edit role
  RETURN EXISTS (
    SELECT 1 FROM organizations WHERE id = data_org_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_id = data_org_id 
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin', 'manager')
    AND accepted_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- PLANTATIONS
DROP POLICY IF EXISTS "plantations_select_policy" ON plantations;
DROP POLICY IF EXISTS "plantations_insert_policy" ON plantations;
DROP POLICY IF EXISTS "plantations_update_policy" ON plantations;
DROP POLICY IF EXISTS "plantations_delete_policy" ON plantations;
DROP POLICY IF EXISTS "plantations_select" ON plantations;
DROP POLICY IF EXISTS "plantations_insert" ON plantations;
DROP POLICY IF EXISTS "plantations_update" ON plantations;
DROP POLICY IF EXISTS "plantations_delete" ON plantations;

CREATE POLICY "plantations_select" ON plantations FOR SELECT USING (can_access_org_data(organization_id));
CREATE POLICY "plantations_insert" ON plantations FOR INSERT WITH CHECK (can_edit_org_data(organization_id));
CREATE POLICY "plantations_update" ON plantations FOR UPDATE USING (can_edit_org_data(organization_id));
CREATE POLICY "plantations_delete" ON plantations FOR DELETE USING (can_edit_org_data(organization_id));

-- WORKERS
DROP POLICY IF EXISTS "workers_select_policy" ON workers;
DROP POLICY IF EXISTS "workers_insert_policy" ON workers;
DROP POLICY IF EXISTS "workers_update_policy" ON workers;
DROP POLICY IF EXISTS "workers_delete_policy" ON workers;
DROP POLICY IF EXISTS "workers_select" ON workers;
DROP POLICY IF EXISTS "workers_insert" ON workers;
DROP POLICY IF EXISTS "workers_update" ON workers;
DROP POLICY IF EXISTS "workers_delete" ON workers;

CREATE POLICY "workers_select" ON workers FOR SELECT USING (can_access_org_data(organization_id));
CREATE POLICY "workers_insert" ON workers FOR INSERT WITH CHECK (can_edit_org_data(organization_id));
CREATE POLICY "workers_update" ON workers FOR UPDATE USING (can_edit_org_data(organization_id));
CREATE POLICY "workers_delete" ON workers FOR DELETE USING (can_edit_org_data(organization_id));

-- DAILY_PLUCKING
DROP POLICY IF EXISTS "daily_plucking_select_policy" ON daily_plucking;
DROP POLICY IF EXISTS "daily_plucking_insert_policy" ON daily_plucking;
DROP POLICY IF EXISTS "daily_plucking_update_policy" ON daily_plucking;
DROP POLICY IF EXISTS "daily_plucking_delete_policy" ON daily_plucking;
DROP POLICY IF EXISTS "daily_plucking_select" ON daily_plucking;
DROP POLICY IF EXISTS "daily_plucking_insert" ON daily_plucking;
DROP POLICY IF EXISTS "daily_plucking_update" ON daily_plucking;
DROP POLICY IF EXISTS "daily_plucking_delete" ON daily_plucking;

CREATE POLICY "daily_plucking_select" ON daily_plucking FOR SELECT USING (can_access_org_data(organization_id));
CREATE POLICY "daily_plucking_insert" ON daily_plucking FOR INSERT WITH CHECK (can_edit_org_data(organization_id));
CREATE POLICY "daily_plucking_update" ON daily_plucking FOR UPDATE USING (can_edit_org_data(organization_id));
CREATE POLICY "daily_plucking_delete" ON daily_plucking FOR DELETE USING (can_edit_org_data(organization_id));

-- WORKER_BONUSES
DROP POLICY IF EXISTS "worker_bonuses_select_policy" ON worker_bonuses;
DROP POLICY IF EXISTS "worker_bonuses_insert_policy" ON worker_bonuses;
DROP POLICY IF EXISTS "worker_bonuses_update_policy" ON worker_bonuses;
DROP POLICY IF EXISTS "worker_bonuses_delete_policy" ON worker_bonuses;
DROP POLICY IF EXISTS "worker_bonuses_select" ON worker_bonuses;
DROP POLICY IF EXISTS "worker_bonuses_insert" ON worker_bonuses;
DROP POLICY IF EXISTS "worker_bonuses_update" ON worker_bonuses;
DROP POLICY IF EXISTS "worker_bonuses_delete" ON worker_bonuses;

CREATE POLICY "worker_bonuses_select" ON worker_bonuses FOR SELECT USING (can_access_org_data(organization_id));
CREATE POLICY "worker_bonuses_insert" ON worker_bonuses FOR INSERT WITH CHECK (can_edit_org_data(organization_id));
CREATE POLICY "worker_bonuses_update" ON worker_bonuses FOR UPDATE USING (can_edit_org_data(organization_id));
CREATE POLICY "worker_bonuses_delete" ON worker_bonuses FOR DELETE USING (can_edit_org_data(organization_id));

-- TEA_SALES
DROP POLICY IF EXISTS "tea_sales_select_policy" ON tea_sales;
DROP POLICY IF EXISTS "tea_sales_insert_policy" ON tea_sales;
DROP POLICY IF EXISTS "tea_sales_update_policy" ON tea_sales;
DROP POLICY IF EXISTS "tea_sales_delete_policy" ON tea_sales;
DROP POLICY IF EXISTS "tea_sales_select" ON tea_sales;
DROP POLICY IF EXISTS "tea_sales_insert" ON tea_sales;
DROP POLICY IF EXISTS "tea_sales_update" ON tea_sales;
DROP POLICY IF EXISTS "tea_sales_delete" ON tea_sales;

CREATE POLICY "tea_sales_select" ON tea_sales FOR SELECT USING (can_access_org_data(organization_id));
CREATE POLICY "tea_sales_insert" ON tea_sales FOR INSERT WITH CHECK (can_edit_org_data(organization_id));
CREATE POLICY "tea_sales_update" ON tea_sales FOR UPDATE USING (can_edit_org_data(organization_id));
CREATE POLICY "tea_sales_delete" ON tea_sales FOR DELETE USING (can_edit_org_data(organization_id));

-- FACTORY_RATES
DROP POLICY IF EXISTS "factory_rates_select_policy" ON factory_rates;
DROP POLICY IF EXISTS "factory_rates_insert_policy" ON factory_rates;
DROP POLICY IF EXISTS "factory_rates_update_policy" ON factory_rates;
DROP POLICY IF EXISTS "factory_rates_delete_policy" ON factory_rates;
DROP POLICY IF EXISTS "factory_rates_select" ON factory_rates;
DROP POLICY IF EXISTS "factory_rates_insert" ON factory_rates;
DROP POLICY IF EXISTS "factory_rates_update" ON factory_rates;
DROP POLICY IF EXISTS "factory_rates_delete" ON factory_rates;

CREATE POLICY "factory_rates_select" ON factory_rates FOR SELECT USING (can_access_org_data(organization_id));
CREATE POLICY "factory_rates_insert" ON factory_rates FOR INSERT WITH CHECK (can_edit_org_data(organization_id));
CREATE POLICY "factory_rates_update" ON factory_rates FOR UPDATE USING (can_edit_org_data(organization_id));
CREATE POLICY "factory_rates_delete" ON factory_rates FOR DELETE USING (can_edit_org_data(organization_id));

-- SCHEDULE_EVENTS
DROP POLICY IF EXISTS "schedule_events_select_policy" ON schedule_events;
DROP POLICY IF EXISTS "schedule_events_insert_policy" ON schedule_events;
DROP POLICY IF EXISTS "schedule_events_update_policy" ON schedule_events;
DROP POLICY IF EXISTS "schedule_events_delete_policy" ON schedule_events;
DROP POLICY IF EXISTS "schedule_events_select" ON schedule_events;
DROP POLICY IF EXISTS "schedule_events_insert" ON schedule_events;
DROP POLICY IF EXISTS "schedule_events_update" ON schedule_events;
DROP POLICY IF EXISTS "schedule_events_delete" ON schedule_events;

CREATE POLICY "schedule_events_select" ON schedule_events FOR SELECT USING (can_access_org_data(organization_id));
CREATE POLICY "schedule_events_insert" ON schedule_events FOR INSERT WITH CHECK (can_edit_org_data(organization_id));
CREATE POLICY "schedule_events_update" ON schedule_events FOR UPDATE USING (can_edit_org_data(organization_id));
CREATE POLICY "schedule_events_delete" ON schedule_events FOR DELETE USING (can_edit_org_data(organization_id));

-- 7. GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION is_org_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_admin_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_org_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_edit_org_data(UUID) TO authenticated;

-- 8. DEBUG: Run these queries to verify your setup
-- =====================================================
-- Check your organizations:
-- SELECT * FROM organizations WHERE owner_id = auth.uid();

-- Check if you're recognized as owner:
-- SELECT is_org_owner('your-org-id-here');

-- Check if you're recognized as admin:  
-- SELECT is_org_admin('your-org-id-here');

-- =====================================================
-- CLEANUP DUPLICATE ORGANIZATIONS (if needed)
-- =====================================================
-- Run this to delete duplicate "My Organization" entries:
/*
WITH ranked_orgs AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC) as rn
  FROM organizations
  WHERE name = 'My Organization'
)
DELETE FROM organizations
WHERE id IN (SELECT id FROM ranked_orgs WHERE rn > 1);
*/

-- =====================================================
-- DONE! Run this script in your Supabase SQL Editor
-- =====================================================
