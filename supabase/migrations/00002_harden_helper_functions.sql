-- Security hardening (Supabase advisor findings):
-- 1. Move helper + trigger functions out of the PostgREST-exposed `public`
--    schema so they are not callable via /rest/v1/rpc/*.
-- 2. Pin search_path on enforce_max_children.
-- Policies and triggers reference functions by OID, so they follow the move.

create schema if not exists app_private;

alter function public.my_family_id() set schema app_private;
alter function public.is_my_child(uuid) set schema app_private;
alter function public.on_attempt_insert() set schema app_private;
alter function public.enforce_max_children() set schema app_private;
alter function app_private.enforce_max_children() set search_path = public;

-- Lock down direct execution: nobody calls these over the API.
revoke all on schema app_private from public, anon, authenticated;
revoke execute on all functions in schema app_private from public, anon, authenticated;

-- RLS policy evaluation checks the invoker's EXECUTE privilege on functions
-- used in policies, so authenticated needs these two (and only these two).
grant usage on schema app_private to authenticated;
grant execute on function app_private.my_family_id() to authenticated;
grant execute on function app_private.is_my_child(uuid) to authenticated;
