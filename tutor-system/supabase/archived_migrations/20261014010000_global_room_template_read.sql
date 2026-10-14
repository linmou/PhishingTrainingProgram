-- Let ordinary application sessions select shared system-owned room templates.
BEGIN;

CREATE POLICY "Application users can read global room templates"
ON public.room_templates
FOR SELECT
TO anon, authenticated
USING (tutor_id = '00000000-0000-0000-0000-000000000000'::uuid);

COMMIT;
