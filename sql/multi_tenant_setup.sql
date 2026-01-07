-- =====================================================
-- MULTI-TENANT SETUP FOR TEA PLANTATION DASHBOARD
-- =====================================================
-- Run this migration to enable multi-tenant support
-- Each user will have their own organization (dashboard)
-- Users can invite others to their organization
-- =====================================================

-- 1. CREATE ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- 2. CREATE ORGANIZATION MEMBERS TABLE
-- =====================================================
-- Roles: 'owner', 'admin', 'manager', 'viewer'
-- owner - full access, can delete organization
-- admin - can manage members, edit all data
-- manager - can add/edit data, cannot manage members
-- viewer - read-only access
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id),
  CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'manager', 'viewer'))
);

-- Enable RLS on organization_members
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INVITATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_invite_role CHECK (role IN ('admin', 'manager', 'viewer'))
);

-- Enable RLS on invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- 4. ADD organization_id TO EXISTING TABLES
-- =====================================================

-- Plantations
ALTER TABLE plantations 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Workers
ALTER TABLE workers 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Daily Plucking
ALTER TABLE daily_plucking 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Worker Bonuses
ALTER TABLE worker_bonuses 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Salary Payments
ALTER TABLE salary_payments 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Tea Sales
ALTER TABLE tea_sales 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Factory Rates
ALTER TABLE factory_rates 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Rate History
ALTER TABLE rate_history 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Schedule Events
ALTER TABLE schedule_events 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Harvest Records (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'harvest_records') THEN
    ALTER TABLE harvest_records ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Quality Control (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quality_control') THEN
    ALTER TABLE quality_control ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Inventory (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
    ALTER TABLE inventory ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Equipment (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'equipment') THEN
    ALTER TABLE equipment ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Weather Data (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'weather_data') THEN
    ALTER TABLE weather_data ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Sales Records (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_records') THEN
    ALTER TABLE sales_records ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

CREATE INDEX IF NOT EXISTS idx_plantations_org_id ON plantations(organization_id);
CREATE INDEX IF NOT EXISTS idx_workers_org_id ON workers(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_plucking_org_id ON daily_plucking(organization_id);
CREATE INDEX IF NOT EXISTS idx_worker_bonuses_org_id ON worker_bonuses(organization_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_org_id ON salary_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_tea_sales_org_id ON tea_sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_factory_rates_org_id ON factory_rates(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_org_id ON schedule_events(organization_id);

-- 6. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to get user's organizations
CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id UUID)
RETURNS TABLE (
  organization_id UUID,
  organization_name VARCHAR(255),
  organization_slug VARCHAR(100),
  user_role VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.slug,
    om.role
  FROM organizations o
  JOIN organization_members om ON o.id = om.organization_id
  WHERE om.user_id = p_user_id AND om.accepted_at IS NOT NULL
  ORDER BY o.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is member of organization
CREATE OR REPLACE FUNCTION is_org_member(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = p_user_id 
    AND organization_id = p_org_id 
    AND accepted_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's role in organization
CREATE OR REPLACE FUNCTION get_user_org_role(p_user_id UUID, p_org_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_role VARCHAR(50);
BEGIN
  SELECT role INTO v_role
  FROM organization_members 
  WHERE user_id = p_user_id 
  AND organization_id = p_org_id 
  AND accepted_at IS NOT NULL;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create organization (called from app)
CREATE OR REPLACE FUNCTION create_organization(
  p_name VARCHAR(255),
  p_owner_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_slug VARCHAR(100);
BEGIN
  -- Generate slug from name
  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  
  -- Ensure unique slug
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) LOOP
    v_slug := v_slug || '-' || floor(random() * 1000)::text;
  END LOOP;
  
  -- Create organization
  INSERT INTO organizations (name, slug, owner_id)
  VALUES (p_name, v_slug, p_owner_id)
  RETURNING id INTO v_org_id;
  
  -- Add owner as member
  INSERT INTO organization_members (organization_id, user_id, role, accepted_at)
  VALUES (v_org_id, p_owner_id, 'owner', NOW());
  
  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RLS POLICIES FOR ORGANIZATIONS
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;

-- Organizations - view
CREATE POLICY "Users can view their organizations" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Organizations - insert (anyone authenticated can create)
CREATE POLICY "Users can create organizations" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Organizations - update (only owner/admin)
CREATE POLICY "Owners can update their organizations" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
  );

-- Organizations - delete (only owner)
CREATE POLICY "Owners can delete their organizations" ON organizations
  FOR DELETE USING (
    owner_id = auth.uid()
  );

-- 8. RLS POLICIES FOR ORGANIZATION MEMBERS
-- =====================================================

DROP POLICY IF EXISTS "Members can view org members" ON organization_members;
DROP POLICY IF EXISTS "Admins can insert members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organization_members;

-- View members of your organizations
CREATE POLICY "Members can view org members" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Insert members (owner/admin only)
CREATE POLICY "Admins can insert members" ON organization_members
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
  );

-- Update members (owner/admin only, can't change owner)
CREATE POLICY "Admins can update members" ON organization_members
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
    AND role != 'owner' -- Can't modify owner
  );

-- Delete members (owner/admin only, can't delete owner)
CREATE POLICY "Admins can delete members" ON organization_members
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
    AND role != 'owner' -- Can't delete owner
  );

-- 9. RLS POLICIES FOR INVITATIONS
-- =====================================================

DROP POLICY IF EXISTS "Members can view invitations" ON invitations;
DROP POLICY IF EXISTS "Admins can create invitations" ON invitations;
DROP POLICY IF EXISTS "Anyone can view their invitation" ON invitations;
DROP POLICY IF EXISTS "Admins can delete invitations" ON invitations;

-- View invitations for your organizations
CREATE POLICY "Members can view invitations" ON invitations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Anyone can view invitation by token (for accepting)
CREATE POLICY "Anyone can view their invitation by token" ON invitations
  FOR SELECT USING (true); -- Token-based lookup handled in app

-- Create invitations (owner/admin only)
CREATE POLICY "Admins can create invitations" ON invitations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
  );

-- Delete invitations (owner/admin only)
CREATE POLICY "Admins can delete invitations" ON invitations
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
  );

-- 10. UPDATE RLS POLICIES FOR DATA TABLES
-- =====================================================

-- Helper: Check if user can access organization data
-- This function will be used in policies

-- PLANTATIONS
DROP POLICY IF EXISTS "Enable read for all users" ON plantations;
DROP POLICY IF EXISTS "Enable write for all users" ON plantations;
DROP POLICY IF EXISTS "Enable delete for all users" ON plantations;
DROP POLICY IF EXISTS "Users can view org plantations" ON plantations;
DROP POLICY IF EXISTS "Users can insert org plantations" ON plantations;
DROP POLICY IF EXISTS "Users can update org plantations" ON plantations;
DROP POLICY IF EXISTS "Users can delete org plantations" ON plantations;

CREATE POLICY "Users can view org plantations" ON plantations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can insert org plantations" ON plantations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can update org plantations" ON plantations
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can delete org plantations" ON plantations
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
  );

-- WORKERS
DROP POLICY IF EXISTS "Enable read access for all users" ON workers;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON workers;
DROP POLICY IF EXISTS "Users can view org workers" ON workers;
DROP POLICY IF EXISTS "Users can insert org workers" ON workers;
DROP POLICY IF EXISTS "Users can update org workers" ON workers;
DROP POLICY IF EXISTS "Users can delete org workers" ON workers;

CREATE POLICY "Users can view org workers" ON workers
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can insert org workers" ON workers
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can update org workers" ON workers
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can delete org workers" ON workers
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
  );

-- DAILY_PLUCKING
DROP POLICY IF EXISTS "Allow all operations" ON daily_plucking;
DROP POLICY IF EXISTS "Users can view org daily_plucking" ON daily_plucking;
DROP POLICY IF EXISTS "Users can insert org daily_plucking" ON daily_plucking;
DROP POLICY IF EXISTS "Users can update org daily_plucking" ON daily_plucking;
DROP POLICY IF EXISTS "Users can delete org daily_plucking" ON daily_plucking;

CREATE POLICY "Users can view org daily_plucking" ON daily_plucking
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can insert org daily_plucking" ON daily_plucking
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can update org daily_plucking" ON daily_plucking
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can delete org daily_plucking" ON daily_plucking
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
  );

-- WORKER_BONUSES
DROP POLICY IF EXISTS "Allow all operations" ON worker_bonuses;
DROP POLICY IF EXISTS "Users can view org worker_bonuses" ON worker_bonuses;
DROP POLICY IF EXISTS "Users can insert org worker_bonuses" ON worker_bonuses;
DROP POLICY IF EXISTS "Users can update org worker_bonuses" ON worker_bonuses;
DROP POLICY IF EXISTS "Users can delete org worker_bonuses" ON worker_bonuses;

CREATE POLICY "Users can view org worker_bonuses" ON worker_bonuses
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can insert org worker_bonuses" ON worker_bonuses
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can update org worker_bonuses" ON worker_bonuses
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can delete org worker_bonuses" ON worker_bonuses
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
  );

-- SALARY_PAYMENTS
DROP POLICY IF EXISTS "Allow all operations" ON salary_payments;
DROP POLICY IF EXISTS "Users can view org salary_payments" ON salary_payments;
DROP POLICY IF EXISTS "Users can insert org salary_payments" ON salary_payments;
DROP POLICY IF EXISTS "Users can update org salary_payments" ON salary_payments;
DROP POLICY IF EXISTS "Users can delete org salary_payments" ON salary_payments;

CREATE POLICY "Users can view org salary_payments" ON salary_payments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can insert org salary_payments" ON salary_payments
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can update org salary_payments" ON salary_payments
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can delete org salary_payments" ON salary_payments
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
  );

-- TEA_SALES
DROP POLICY IF EXISTS "Allow all operations" ON tea_sales;
DROP POLICY IF EXISTS "Users can view org tea_sales" ON tea_sales;
DROP POLICY IF EXISTS "Users can insert org tea_sales" ON tea_sales;
DROP POLICY IF EXISTS "Users can update org tea_sales" ON tea_sales;
DROP POLICY IF EXISTS "Users can delete org tea_sales" ON tea_sales;

CREATE POLICY "Users can view org tea_sales" ON tea_sales
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can insert org tea_sales" ON tea_sales
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can update org tea_sales" ON tea_sales
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can delete org tea_sales" ON tea_sales
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
  );

-- FACTORY_RATES
DROP POLICY IF EXISTS "Allow all operations" ON factory_rates;
DROP POLICY IF EXISTS "Users can view org factory_rates" ON factory_rates;
DROP POLICY IF EXISTS "Users can insert org factory_rates" ON factory_rates;
DROP POLICY IF EXISTS "Users can update org factory_rates" ON factory_rates;
DROP POLICY IF EXISTS "Users can delete org factory_rates" ON factory_rates;

CREATE POLICY "Users can view org factory_rates" ON factory_rates
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can insert org factory_rates" ON factory_rates
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can update org factory_rates" ON factory_rates
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can delete org factory_rates" ON factory_rates
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
  );

-- RATE_HISTORY
DROP POLICY IF EXISTS "Allow all operations" ON rate_history;
DROP POLICY IF EXISTS "Users can view org rate_history" ON rate_history;
DROP POLICY IF EXISTS "Users can insert org rate_history" ON rate_history;

CREATE POLICY "Users can view org rate_history" ON rate_history
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can insert org rate_history" ON rate_history
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

-- SCHEDULE_EVENTS
DROP POLICY IF EXISTS "Allow all operations" ON schedule_events;
DROP POLICY IF EXISTS "Users can view org schedule_events" ON schedule_events;
DROP POLICY IF EXISTS "Users can insert org schedule_events" ON schedule_events;
DROP POLICY IF EXISTS "Users can update org schedule_events" ON schedule_events;
DROP POLICY IF EXISTS "Users can delete org schedule_events" ON schedule_events;

CREATE POLICY "Users can view org schedule_events" ON schedule_events
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can insert org schedule_events" ON schedule_events
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can update org schedule_events" ON schedule_events
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager')
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can delete org schedule_events" ON schedule_events
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
    )
  );

-- 11. CREATE UPDATED_AT TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_members_updated_at ON organization_members;
CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- After running this migration:
-- 1. Update your TypeScript types (database.ts)
-- 2. Create organization context in your app
-- 3. Update auth flow to create organization on signup
-- 4. Update all queries to include organization_id
-- =====================================================
