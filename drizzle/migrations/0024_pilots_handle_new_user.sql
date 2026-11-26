CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    CASE WHEN lower(COALESCE(NEW.email, '')) IN ('geoffrey.delabarre@alterna-energie.fr', 'matthieu.roux@alterna-energie.fr')
      THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (id) DO NOTHING;

  IF lower(COALESCE(NEW.email, '')) IN ('geoffrey.delabarre@alterna-energie.fr', 'matthieu.roux@alterna-energie.fr') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;