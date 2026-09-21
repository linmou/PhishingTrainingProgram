-- Create storage bucket for room images
INSERT INTO storage.buckets (id, name, public)
VALUES ('room-images', 'room-images', false);

-- Create storage policies for room images
CREATE POLICY "Tutors can upload room images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'room-images' 
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND current_role = 'tutor'
  )
);

CREATE POLICY "Anyone can view room images"
ON storage.objects FOR SELECT
USING (bucket_id = 'room-images');

CREATE POLICY "Tutors can update their room images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'room-images' 
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND current_role = 'tutor'
  )
);

CREATE POLICY "Tutors can delete their room images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'room-images' 
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND current_role = 'tutor'
  )
);