-- Create storage bucket for plantation images
-- Run this in Supabase SQL Editor or set up via Dashboard > Storage

-- ============================================
-- STEP 1: Create the bucket via Dashboard
-- ============================================
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Click "New Bucket"
-- 3. Name it: plantation-images
-- 4. Make it PUBLIC (toggle on)
-- 5. Click "Create bucket"

-- ============================================
-- STEP 2: Run these SQL commands in SQL Editor
-- ============================================

-- Add image_url column to plantations table if it doesn't exist
ALTER TABLE plantations
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ============================================
-- STEP 3: Set up Storage Policies via Dashboard
-- ============================================
-- Go to Storage > plantation-images bucket > Policies tab
-- Click "New Policy" and add these policies:

-- POLICY 1: Allow anyone to upload (for simplicity with family use)
-- Policy Name: Allow public uploads
-- Allowed operation: INSERT
-- Target roles: Select "anon" and "authenticated"
-- Policy definition: true

-- POLICY 2: Allow anyone to view images
-- Policy Name: Allow public viewing
-- Allowed operation: SELECT  
-- Target roles: Select "anon" and "authenticated"
-- Policy definition: true

-- POLICY 3: Allow anyone to delete
-- Policy Name: Allow deletes
-- Allowed operation: DELETE
-- Target roles: Select "anon" and "authenticated"
-- Policy definition: true

-- ============================================
-- ALTERNATIVE: Run SQL commands directly
-- ============================================
-- If the above doesn't work, run these commands:

-- First, check if bucket exists and create policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('plantation-images', 'plantation-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public viewing" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;

-- Create permissive policies for family use
CREATE POLICY "Allow public uploads"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'plantation-images');

CREATE POLICY "Allow public viewing"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'plantation-images');

CREATE POLICY "Allow public deletes"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'plantation-images');

CREATE POLICY "Allow public updates"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'plantation-images');
