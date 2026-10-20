CREATE OR REPLACE FUNCTION public.admin_access_activity()
RETURNS TABLE (user_id uuid, last_sign_in_at timestamptz, invited_at timestamptz, invitation_accepted boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id, u.last_sign_in_at, u.invited_at,
      (u.invited_at IS NOT NULL AND COALESCE(u.encrypted_password, '') <> '')
    FROM auth.users AS u
    INNER JOIN public.profiles AS p ON p.id = u.id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_access_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_access_activity() TO authenticated;
COMMENT ON FUNCTION public.admin_access_activity() IS 'Admin-only safe projection of last Auth sign-in and invitation completion; an invitation is completed only when a password exists, not merely when its link is opened. Never returns tokens or password hashes.';