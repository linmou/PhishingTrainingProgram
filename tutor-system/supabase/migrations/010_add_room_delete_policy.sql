-- Add DELETE policy for rooms
-- Only tutors can delete their own rooms
CREATE POLICY "Tutors can delete their own rooms" ON rooms FOR
DELETE USING (auth.uid () = tutor_id);