-- Initial rollout: mark every existing catalogue bead as ACTIVE.
-- Run after 000041_bead_availability_lifecycle.sql.

UPDATE public.bead_libraries
SET availability_status_code = 'ACTIVE'
WHERE availability_status_code IS DISTINCT FROM 'ACTIVE';

-- Belt-and-suspenders: align is_active with ACTIVE status (trigger should also do this).
UPDATE public.bead_libraries bl
SET is_active = true
FROM public.bead_availability_statuses s
WHERE s.code = 'ACTIVE'
  AND bl.availability_status_code = 'ACTIVE';
