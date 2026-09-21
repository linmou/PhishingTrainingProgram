-- Grant permissions for database functions to anon role
-- This allows browser clients to execute RPC functions

-- Grant execute permission on initialize_checklist_from_template function to anon role
GRANT EXECUTE ON FUNCTION initialize_checklist_from_template(UUID, TEXT) TO anon;

-- Grant execute permission to authenticated role as well (for future use)
GRANT EXECUTE ON FUNCTION initialize_checklist_from_template(UUID, TEXT) TO authenticated;

-- Ensure anon role can access the function
-- This is required for browser clients using the anon key
COMMENT ON FUNCTION initialize_checklist_from_template(UUID, TEXT) IS 
'Initializes checklist from template. Accessible to anon role for browser clients.';

-- Verify the function is accessible by checking grants
-- (This is just for documentation - the actual grant above does the work)
-- SELECT routine_name, grantee, privilege_type 
-- FROM information_schema.routine_privileges 
-- WHERE routine_name = 'initialize_checklist_from_template';