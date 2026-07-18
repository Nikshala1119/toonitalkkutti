-- Anon queries on RLS-protected tables should return empty results, not
-- "permission denied for function" errors. The helpers are in app_private,
-- which PostgREST never exposes as RPC, so granting EXECUTE to anon does not
-- reopen the advisor finding; for anon these functions just return null/false.
grant usage on schema app_private to anon;
grant execute on function app_private.my_family_id() to anon;
grant execute on function app_private.is_my_child(uuid) to anon;
