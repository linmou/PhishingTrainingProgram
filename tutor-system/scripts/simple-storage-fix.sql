-- Simple fix: Make the bucket public and remove complex policies
UPDATE storage.buckets 
SET public = true 
WHERE id = 'room-images';

-- Remove all existing policies
DROP POLICY IF EXISTS "Tutors can upload room images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view room images" ON storage.objects;
DROP POLICY IF EXISTS "Tutors can update their room images" ON storage.objects;
DROP POLICY IF EXISTS "Tutors can delete their room images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload room images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for room images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update room images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete room images" ON storage.objects;

-- Create simple policies for public bucket
CREATE POLICY "Allow authenticated uploads to room-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'room-images' AND auth.role() = 'authenticated');

CREATE POLICY "Allow public access to room-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'room-images');