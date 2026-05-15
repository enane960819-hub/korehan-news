-- Schema inspection RPC — returns the columns of a given table so the
-- admin "Schema Health" page can diff actual prod schema vs the
-- columns the frontend expects to write. Owner-reported root cause
-- of recurring "saves silently fail": migrations not applied to prod,
-- code expects columns that don't exist, upsert errors get swallowed
-- by try{}catch{}. With this RPC the owner can see at a glance which
-- migrations are missing.
--
-- SECURITY DEFINER + admin-only check inside the function so we don't
-- need a separate RLS policy on information_schema (which Postgres
-- doesn't allow anyway).

CREATE OR REPLACE FUNCTION public.inspect_table_columns(p_table text)
RETURNS TABLE (
  column_name      text,
  data_type        text,
  is_nullable      text,
  column_default   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin-only. Reuses the app_settings.admin_emails list the rest of
  -- the admin RPCs use; falls back to a hard-coded check if that
  -- setting doesn't exist yet.
  IF NOT (
    auth.jwt() ->> 'email' IN (
      SELECT jsonb_array_elements_text(coalesce(
        (SELECT value FROM public.app_settings WHERE key = 'admin_emails'),
        '["enane960819@gmail.com"]'::jsonb
      ))
    )
  ) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name   = p_table
  ORDER BY c.ordinal_position;
END;
$$;

GRANT EXECUTE ON FUNCTION public.inspect_table_columns(text) TO authenticated;

-- List all public tables (so the admin page can also catch
-- "the table doesn't exist at all" — same class of bug as missing
-- columns but worse).
CREATE OR REPLACE FUNCTION public.inspect_public_tables()
RETURNS TABLE (table_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    auth.jwt() ->> 'email' IN (
      SELECT jsonb_array_elements_text(coalesce(
        (SELECT value FROM public.app_settings WHERE key = 'admin_emails'),
        '["enane960819@gmail.com"]'::jsonb
      ))
    )
  ) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type   = 'BASE TABLE'
  ORDER BY t.table_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.inspect_public_tables() TO authenticated;

NOTIFY pgrst, 'reload schema';
