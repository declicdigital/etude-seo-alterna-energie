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
  IF validation_changed AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Seul Geoffrey peut valider une demande FAQ.' USING ERRCODE = '42501';
  END IF;
  IF new_doc->>'validatedAt' IS NOT NULL AND (coalesce(trim(new_doc->>'question'), '') = '' OR coalesce(new_doc->>'link', '') !~* '^https?://[^[:space:]]+$' OR coalesce(new_doc->>'target', '') NOT IN ('Particulier', 'Professionnel')) THEN
    RAISE EXCEPTION 'Une question, un lien HTTP(S) et une cible sont obligatoires pour valider.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER faq_validation_guard BEFORE INSERT OR UPDATE ON public.editorial_kv FOR EACH ROW EXECUTE FUNCTION public.guard_faq_validation();