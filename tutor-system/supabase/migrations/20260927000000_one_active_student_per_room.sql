-- Purpose: enforce one active student session per room while leaving observer sessions unaffected.
DO $$
DECLARE
    duplicate_rooms TEXT;
BEGIN
    SELECT string_agg(
        format('%s (%s active student sessions)', room_id, active_count),
        ', ' ORDER BY room_id
    )
    INTO duplicate_rooms
    FROM (
        SELECT room_id, count(*) AS active_count
        FROM public.sessions
        WHERE status = 'active'
          AND student_id IS NOT NULL
        GROUP BY room_id
        HAVING count(*) > 1
    ) AS duplicate_occupancy;

    IF duplicate_rooms IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23505',
            MESSAGE = 'Cannot enforce one active student per room; duplicate room occupancy exists',
            DETAIL = duplicate_rooms,
            HINT = 'Resolve the listed active student sessions, then rerun this migration. No rows were modified.';
    END IF;
END;
$$;

CREATE UNIQUE INDEX sessions_one_active_student_per_room_idx
    ON public.sessions (room_id)
    WHERE status = 'active'
      AND student_id IS NOT NULL;
