-- =====================================================
-- CLEANUP DUPLICATE ORGANIZATIONS - RUN THIS FIRST!
-- =====================================================
-- Run this in Supabase SQL Editor BEFORE running fix_rls_v2.sql
-- =====================================================

-- STEP 1: See all your organizations (run this first to understand the problem)
SELECT id, name, slug, owner_id, created_at 
FROM organizations 
ORDER BY created_at ASC;

-- STEP 2: Delete ALL duplicate "My Organization" entries
-- This keeps only the FIRST (oldest) one for each owner
-- COPY AND RUN THIS:
WITH ranked_orgs AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC) as rn
  FROM organizations
  WHERE name = 'My Organization'
)
DELETE FROM organizations
WHERE id IN (SELECT id FROM ranked_orgs WHERE rn > 1);

-- STEP 3: Clean up orphaned members (their orgs were deleted)
DELETE FROM organization_members
WHERE organization_id NOT IN (SELECT id FROM organizations);

-- STEP 4: Clean up orphaned invitations (their orgs were deleted)  
DELETE FROM invitations
WHERE organization_id NOT IN (SELECT id FROM organizations);

-- STEP 5: Verify - you should now see only ONE organization per owner
SELECT id, name, slug, owner_id, created_at 
FROM organizations 
ORDER BY created_at ASC;

-- STEP 6: Now go run fix_rls_v2.sql again!
