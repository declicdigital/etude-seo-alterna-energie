-- Demandes FAQ : Matthieu et Marick valident et renseignent les liens, en plus des
-- administrateurs (Geoffrey). Même liste que FAQ_VALIDATOR_EMAILS (src/lib/faq.ts). Idempotent.

CREATE OR REPLACE FUNCTION public.can_validate_faq(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
    OR (
      public.is_approved(_user_id)
      AND EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = _user_id
          AND lower(u.email) IN (
            'matthieu.roux@alterna-energie.fr',
            'marick.navarro@soregies.fr',
            'marick.navarro.ext@soregies.fr'
          )
      )
    )
$$;

REVOKE ALL ON FUNCTION public.can_validate_faq(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_validate_faq(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_faq_validation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE old_doc jsonb := '{}'::jsonb; new_doc jsonb; validation_changed boolean;
BEGIN
  IF NEW.key NOT LIKE 'faq:%' THEN RETURN NEW; END IF;
  new_doc := NEW.value::jsonb;
  IF TG_OP = 'UPDATE' THEN old_doc := OLD.value::jsonb; END IF;
  validation_changed := (new_doc->'validatedAt' IS DISTINCT FROM old_doc->'validatedAt') OR (new_doc->'validatedBy' IS DISTINCT FROM old_doc->'validatedBy') OR (new_doc->'link' IS DISTINCT FROM old_doc->'link');
  IF old_doc->>'validatedAt' IS NOT NULL THEN
    validation_changed := validation_changed OR (new_doc->'question' IS DISTINCT FROM old_doc->'question') OR (new_doc->'target' IS DISTINCT FROM old_doc->'target');
  END IF;
  IF validation_changed AND NOT public.can_validate_faq(auth.uid()) THEN
    RAISE EXCEPTION 'Seuls Geoffrey, Matthieu et Marick peuvent valider une demande FAQ ou en modifier le lien.' USING ERRCODE = '42501';
  END IF;
  IF new_doc->>'validatedAt' IS NOT NULL AND (coalesce(trim(new_doc->>'question'), '') = '' OR coalesce(new_doc->>'link', '') !~* '^https?://[^[:space:]]+$' OR coalesce(new_doc->>'target', '') NOT IN ('Particulier', 'Professionnel')) THEN
    RAISE EXCEPTION 'Une question, un lien HTTP(S) et une cible sont obligatoires pour valider.';
  END IF;
  RETURN NEW;
END;
$$;
