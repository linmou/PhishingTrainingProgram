-- Simple storage policy that should work for authenticated users
-- Drop all existing policies first
DROP POLICY IF EXISTS "Authenticated users can upload room images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for room images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update room images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete room images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to room-images" ON storage.objects;

-- Create a single policy that allows all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users on room-images"
ON storage.objects FOR ALL
USING (bucket_id = 'room-images' AND auth.uid() IS NOT NULL)
WITH CHECK (bucket_id = 'room-images' AND auth.uid() IS NOT NULL);