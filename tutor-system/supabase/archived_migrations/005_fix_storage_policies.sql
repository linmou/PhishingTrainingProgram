-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Tutors can upload room images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view room images" ON storage.objects;
DROP POLICY IF EXISTS "Tutors can update their room images" ON storage.objects;
DROP POLICY IF EXISTS "Tutors can delete their room images" ON storage.objects;

-- Create simpler policies that work with the current auth setup
CREATE POLICY "Authenticated users can upload room images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'room-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Public read access for room images"
ON storage.objects FOR SELECT
USING (bucket_id = 'room-images');

CREATE POLICY "Authenticated users can update room images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'room-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete room images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'room-images' 
  AND auth.role() = 'authenticated'
);