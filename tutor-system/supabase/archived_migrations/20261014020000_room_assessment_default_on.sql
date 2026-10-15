-- Enable in-room assessment when room creation omits an explicit preference.
BEGIN;

ALTER TABLE public.rooms
ALTER COLUMN transfer_learning_enabled SET DEFAULT true;

COMMIT;
