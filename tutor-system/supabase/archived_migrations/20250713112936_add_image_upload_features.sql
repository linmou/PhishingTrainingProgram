-- Add avatar column to users table
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- Create tutor_images table
CREATE TABLE tutor_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Enable RLS on tutor_images
ALTER TABLE tutor_images ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for tutor_images table
CREATE POLICY "Tutors can manage their own images" ON tutor_images
FOR ALL USING (tutor_id = auth.uid());

CREATE POLICY "Users can view images in accessible rooms" ON tutor_images
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM rooms r 
    WHERE r.id = room_id 
    AND (r.tutor_id = auth.uid() OR 
         EXISTS (SELECT 1 FROM sessions s 
                WHERE s.room_id = r.id AND s.student_id = auth.uid()))
  )
);

-- Create storage buckets (only if they don't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('avatars', 'avatars', true),
  ('tutor-images', 'tutor-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket
CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Storage policies for tutor-images bucket
CREATE POLICY "Tutors can manage their images" ON storage.objects
FOR ALL USING (
  bucket_id = 'tutor-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view tutor images" ON storage.objects
FOR SELECT USING (bucket_id = 'tutor-images');