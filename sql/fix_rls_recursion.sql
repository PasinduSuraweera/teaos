-- =====================================================
-- FIX RLS INFINITE RECURSION
-- =====================================================
-- This script fixes the infinite recursion error in organization_members
-- The issue: policies on organization_members query organization_members itself
-- The fix: Use SECURITY DEFINER functions that bypass RLS
-- =====================================================

-- 1. DROP EXISTING PROBLEMATIC POLICIES
-- =====================================================

-- Organization members policies (these cause recursion)
DROP POLICY IF EXISTS "Members can view org members" ON organization_members;
DROP POLICY IF EXISTS "Admins can insert members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organization_members;
DROP POLICY IF EXISTS "org_members_select_policy" ON organization_members;
DROP POLICY IF EXISTS "org_members_insert_policy" ON organization_members;
DROP POLICY IF EXISTS "org_members_update_policy" ON organization_members;
DROP POLICY IF EXISTS "org_members_delete_policy" ON organization_members;

-- Organizations policies (also reference organization_members)
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can delete their organizations" ON organizations;
DROP POLICY IF EXISTS "org_select_policy" ON organizations;
DROP POLICY IF EXISTS "org_insert_policy" ON organizations;
DROP POLICY IF EXISTS "org_update_policy" ON organizations;
DROP POLICY IF EXISTS "org_delete_policy" ON organizations;

-- Invitations policies
DROP POLICY IF EXISTS "Members can view invitations" ON invitations;
DROP POLICY IF EXISTS "Admins can create invitations" ON invitations;
DROP POLICY IF EXISTS "Anyone can view their invitation by token" ON invitations;
DROP POLICY IF EXISTS "Admins can delete invitations" ON invitations;
DROP POLICY IF EXISTS "invitations_select_policy" ON invitations;
DROP POLICY IF EXISTS "invitations_insert_policy" ON invitations;
DROP POLICY IF EXISTS "invitations_update_policy" ON invitations;
DROP POLICY IF EXISTS "invitations_delete_policy" ON invitations;

-- 2. CREATE SECURITY DEFINER HELPER FUNCTIONS
-- These bypass RLS to avoid recursion
-- =====================================================

-- Check if user is a member of any organization (no org specified)
CREATE OR REPLACE FUNCTION auth_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = auth.uid() 
  AND accepted_at IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user has admin role in any org
CREATE OR REPLACE FUNCTION auth_user_admin_org_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = auth.uid() 
  AND role IN ('owner', 'admin')
  AND accepted_at IS NOT NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is owner of a specific org
CREATE OR REPLACE FUNCTION auth_is_org_owner(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = auth.uid() 
    AND organization_id = org_id
    AND role = 'owner'
    AND accepted_at IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user can edit in an org (owner, admin, manager)
CREATE OR REPLACE FUNCTION auth_can_edit_org(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = auth.uid() 
    AND organization_id = org_id
    AND role IN ('owner', 'admin', 'manager')
    AND accepted_at IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. RECREATE ORGANIZATION POLICIES (using helper functions)
-- =====================================================

-- Organizations - view (using function to avoid recursion)
CREATE POLICY "org_select_policy" ON organizations
  FOR SELECT USING (
    id IN (SELECT auth_user_org_ids())
  );

-- Organizations - insert (anyone authenticated can create)
CREATE POLICY "org_insert_policy" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Organizations - update (only owner/admin)
CREATE POLICY "org_update_policy" ON organizations
  FOR UPDATE USING (
    id IN (SELECT auth_user_admin_org_ids())
  );

-- Organizations - delete (only owner)
CREATE POLICY "org_delete_policy" ON organizations
  FOR DELETE USING (
    owner_id = auth.uid()
  );

-- 4. RECREATE ORGANIZATION_MEMBERS POLICIES (using helper functions)
-- =====================================================

-- CRITICAL: For organization_members, we need special handling
-- Users should see their own membership + memberships in orgs they belong to

-- View: Users can see members of orgs they're in
CREATE POLICY "org_members_select_policy" ON organization_members
  FOR SELECT USING (
    -- User can see their own membership records
    user_id = auth.uid()
    OR
    -- User can see other members in orgs they belong to
    organization_id IN (SELECT auth_user_org_ids())
  );

-- Insert: Only owner/admin can add members
CREATE POLICY "org_members_insert_policy" ON organization_members
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT auth_user_admin_org_ids())
  );

-- Update: Only owner/admin can update, but can't modify owner
CREATE POLICY "org_members_update_policy" ON organization_members
  FOR UPDATE USING (
    organization_id IN (SELECT auth_user_admin_org_ids())
    AND role != 'owner'
  );

-- Delete: Only owner/admin can delete, but can't delete owner
CREATE POLICY "org_members_delete_policy" ON organization_members
  FOR DELETE USING (
    organization_id IN (SELECT auth_user_admin_org_ids())
    AND role != 'owner'
  );

-- 5. RECREATE INVITATIONS POLICIES
-- =====================================================

-- View invitations for orgs user belongs to
CREATE POLICY "invitations_select_policy" ON invitations
  FOR SELECT USING (
    organization_id IN (SELECT auth_user_org_ids())
    OR
    -- Also allow viewing by token (for acceptance flow)
    true
  );

-- Create invitations (owner/admin only)
CREATE POLICY "invitations_insert_policy" ON invitations
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT auth_user_admin_org_ids())
  );

-- Update invitations (for accepting)
CREATE POLICY "invitations_update_policy" ON invitations
  FOR UPDATE USING (true); -- App handles token validation

-- Delete invitations (owner/admin only)
CREATE POLICY "invitations_delete_policy" ON invitations
  FOR DELETE USING (
    organization_id IN (SELECT auth_user_admin_org_ids())
  );

-- 6. UPDATE DATA TABLE POLICIES TO USE FUNCTIONS
-- =====================================================

-- PLANTATIONS
DROP POLICY IF EXISTS "Users can view org plantations" ON plantations;
DROP POLICY IF EXISTS "Users can insert org plantations" ON plantations;
DROP POLICY IF EXISTS "Users can update org plantations" ON plantations;
DROP POLICY IF EXISTS "Users can delete org plantations" ON plantations;

CREATE POLICY "plantations_select_policy" ON plantations
  FOR SELECT USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_org_ids())
  );

CREATE POLICY "plantations_insert_policy" ON plantations
  FOR INSERT WITH CHECK (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "plantations_update_policy" ON plantations
  FOR UPDATE USING (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "plantations_delete_policy" ON plantations
  FOR DELETE USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_admin_org_ids())
  );

-- WORKERS
DROP POLICY IF EXISTS "Users can view org workers" ON workers;
DROP POLICY IF EXISTS "Users can insert org workers" ON workers;
DROP POLICY IF EXISTS "Users can update org workers" ON workers;
DROP POLICY IF EXISTS "Users can delete org workers" ON workers;

CREATE POLICY "workers_select_policy" ON workers
  FOR SELECT USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_org_ids())
  );

CREATE POLICY "workers_insert_policy" ON workers
  FOR INSERT WITH CHECK (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "workers_update_policy" ON workers
  FOR UPDATE USING (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "workers_delete_policy" ON workers
  FOR DELETE USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_admin_org_ids())
  );

-- DAILY_PLUCKING
DROP POLICY IF EXISTS "Users can view org daily_plucking" ON daily_plucking;
DROP POLICY IF EXISTS "Users can insert org daily_plucking" ON daily_plucking;
DROP POLICY IF EXISTS "Users can update org daily_plucking" ON daily_plucking;
DROP POLICY IF EXISTS "Users can delete org daily_plucking" ON daily_plucking;

CREATE POLICY "daily_plucking_select_policy" ON daily_plucking
  FOR SELECT USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_org_ids())
  );

CREATE POLICY "daily_plucking_insert_policy" ON daily_plucking
  FOR INSERT WITH CHECK (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "daily_plucking_update_policy" ON daily_plucking
  FOR UPDATE USING (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "daily_plucking_delete_policy" ON daily_plucking
  FOR DELETE USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_admin_org_ids())
  );

-- WORKER_BONUSES
DROP POLICY IF EXISTS "Users can view org worker_bonuses" ON worker_bonuses;
DROP POLICY IF EXISTS "Users can insert org worker_bonuses" ON worker_bonuses;
DROP POLICY IF EXISTS "Users can update org worker_bonuses" ON worker_bonuses;
DROP POLICY IF EXISTS "Users can delete org worker_bonuses" ON worker_bonuses;

CREATE POLICY "worker_bonuses_select_policy" ON worker_bonuses
  FOR SELECT USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_org_ids())
  );

CREATE POLICY "worker_bonuses_insert_policy" ON worker_bonuses
  FOR INSERT WITH CHECK (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "worker_bonuses_update_policy" ON worker_bonuses
  FOR UPDATE USING (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "worker_bonuses_delete_policy" ON worker_bonuses
  FOR DELETE USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_admin_org_ids())
  );

-- TEA_SALES
DROP POLICY IF EXISTS "Users can view org tea_sales" ON tea_sales;
DROP POLICY IF EXISTS "Users can insert org tea_sales" ON tea_sales;
DROP POLICY IF EXISTS "Users can update org tea_sales" ON tea_sales;
DROP POLICY IF EXISTS "Users can delete org tea_sales" ON tea_sales;

CREATE POLICY "tea_sales_select_policy" ON tea_sales
  FOR SELECT USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_org_ids())
  );

CREATE POLICY "tea_sales_insert_policy" ON tea_sales
  FOR INSERT WITH CHECK (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "tea_sales_update_policy" ON tea_sales
  FOR UPDATE USING (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "tea_sales_delete_policy" ON tea_sales
  FOR DELETE USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_admin_org_ids())
  );

-- FACTORY_RATES
DROP POLICY IF EXISTS "Users can view org factory_rates" ON factory_rates;
DROP POLICY IF EXISTS "Users can insert org factory_rates" ON factory_rates;
DROP POLICY IF EXISTS "Users can update org factory_rates" ON factory_rates;
DROP POLICY IF EXISTS "Users can delete org factory_rates" ON factory_rates;

CREATE POLICY "factory_rates_select_policy" ON factory_rates
  FOR SELECT USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_org_ids())
  );

CREATE POLICY "factory_rates_insert_policy" ON factory_rates
  FOR INSERT WITH CHECK (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "factory_rates_update_policy" ON factory_rates
  FOR UPDATE USING (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "factory_rates_delete_policy" ON factory_rates
  FOR DELETE USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_admin_org_ids())
  );

-- SCHEDULE_EVENTS
DROP POLICY IF EXISTS "Users can view org schedule_events" ON schedule_events;
DROP POLICY IF EXISTS "Users can insert org schedule_events" ON schedule_events;
DROP POLICY IF EXISTS "Users can update org schedule_events" ON schedule_events;
DROP POLICY IF EXISTS "Users can delete org schedule_events" ON schedule_events;

CREATE POLICY "schedule_events_select_policy" ON schedule_events
  FOR SELECT USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_org_ids())
  );

CREATE POLICY "schedule_events_insert_policy" ON schedule_events
  FOR INSERT WITH CHECK (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "schedule_events_update_policy" ON schedule_events
  FOR UPDATE USING (
    organization_id IS NULL OR auth_can_edit_org(organization_id)
  );

CREATE POLICY "schedule_events_delete_policy" ON schedule_events
  FOR DELETE USING (
    organization_id IS NULL OR organization_id IN (SELECT auth_user_admin_org_ids())
  );

-- SALARY_PAYMENTS (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'salary_payments') THEN
    DROP POLICY IF EXISTS "Users can view org salary_payments" ON salary_payments;
    DROP POLICY IF EXISTS "Users can insert org salary_payments" ON salary_payments;
    DROP POLICY IF EXISTS "Users can update org salary_payments" ON salary_payments;
    DROP POLICY IF EXISTS "Users can delete org salary_payments" ON salary_payments;
    
    EXECUTE 'CREATE POLICY "salary_payments_select_policy" ON salary_payments FOR SELECT USING (organization_id IS NULL OR organization_id IN (SELECT auth_user_org_ids()))';
    EXECUTE 'CREATE POLICY "salary_payments_insert_policy" ON salary_payments FOR INSERT WITH CHECK (organization_id IS NULL OR auth_can_edit_org(organization_id))';
    EXECUTE 'CREATE POLICY "salary_payments_update_policy" ON salary_payments FOR UPDATE USING (organization_id IS NULL OR auth_can_edit_org(organization_id))';
    EXECUTE 'CREATE POLICY "salary_payments_delete_policy" ON salary_payments FOR DELETE USING (organization_id IS NULL OR organization_id IN (SELECT auth_user_admin_org_ids()))';
  END IF;
END $$;

-- RATE_HISTORY (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_history') THEN
    DROP POLICY IF EXISTS "Users can view org rate_history" ON rate_history;
    DROP POLICY IF EXISTS "Users can insert org rate_history" ON rate_history;
    DROP POLICY IF EXISTS "Users can update org rate_history" ON rate_history;
    DROP POLICY IF EXISTS "Users can delete org rate_history" ON rate_history;
    
    EXECUTE 'CREATE POLICY "rate_history_select_policy" ON rate_history FOR SELECT USING (organization_id IS NULL OR organization_id IN (SELECT auth_user_org_ids()))';
    EXECUTE 'CREATE POLICY "rate_history_insert_policy" ON rate_history FOR INSERT WITH CHECK (organization_id IS NULL OR auth_can_edit_org(organization_id))';
    EXECUTE 'CREATE POLICY "rate_history_update_policy" ON rate_history FOR UPDATE USING (organization_id IS NULL OR auth_can_edit_org(organization_id))';
    EXECUTE 'CREATE POLICY "rate_history_delete_policy" ON rate_history FOR DELETE USING (organization_id IS NULL OR organization_id IN (SELECT auth_user_admin_org_ids()))';
  END IF;
END $$;

-- 7. GRANT EXECUTE PERMISSIONS ON FUNCTIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION auth_user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION auth_user_admin_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION auth_is_org_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_can_edit_org(UUID) TO authenticated;

-- =====================================================
-- DONE! Run this script in your Supabase SQL Editor
-- =====================================================
