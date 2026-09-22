-- ===================================================================
-- CORRECTED Storage Setup - Fix Bucket Creation
-- The previous script may have failed to create the bucket properly
-- ===================================================================

-- First, check if bucket exists and create if not
DO $$
BEGIN
    -- Insert bucket if it doesn't exist
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'room-images', 
        'room-images', 
        false, 
        52428800, -- 50MB limit
        ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE SET
        file_size_limit = 52428800,
        allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    RAISE NOTICE 'Bucket room-images created or updated successfully';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating bucket: %', SQLERRM;
END $$;

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies for room-images
DO $$
DECLARE
    pol_name text;
BEGIN
    FOR pol_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname LIKE '%room-images%'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol_name || '" ON storage.objects';
        RAISE NOTICE 'Dropped policy: %', pol_name;
    END LOOP;
END $$;

-- Create a very permissive policy for testing
CREATE POLICY "Allow all authenticated users to manage room-images"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'room-images')
WITH CHECK (bucket_id = 'room-images');

-- Also create a policy for public access to read
CREATE POLICY "Allow public read access to room-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'room-images');

-- Verify the setup
SELECT 'Bucket verification:' as info, id, name, public, file_size_limit 
FROM storage.buckets 
WHERE name = 'room-images';

SELECT 'Policy verification:' as info, policyname, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects' 
AND policyname LIKE '%room-images%';