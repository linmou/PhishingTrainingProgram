-- Debug script to check RLS policies and user setup
-- Run this in your Supabase SQL Editor to debug the storage issue

-- 1. Check if the bucket exists
SELECT * FROM storage.buckets WHERE name = 'room-images';

-- 2. Check current RLS policies on storage.objects
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 3. Check current user authentication (run this when logged in)
SELECT auth.uid() as current_user_id, auth.role() as current_role;

-- 4. Check if current user exists in users table
SELECT * FROM users WHERE id = auth.uid();

-- 5. Create a temporary simplified policy for testing
DROP POLICY IF EXISTS "Allow authenticated uploads to room-images" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to room-images"
ON storage.objects FOR ALL
USING (bucket_id = 'room-images' AND auth.uid() IS NOT NULL);

-- 6. Alternative: Disable RLS temporarily for testing (WARNING: Only for debugging)
-- ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
-- Remember to re-enable it: ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;