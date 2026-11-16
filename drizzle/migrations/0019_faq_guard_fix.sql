-- Correctif du garde-fou FAQ (0017/0018) :
-- - l'adresse de la personne vient du jeton (auth.jwt()), un compte normal ne pouvant pas lire
--   auth.users depuis ce déclencheur (toute modification d'une demande échouait) ;
-- - un « upsert » passe d'abord par le déclencheur en INSERT : on compare alors à la ligne
--   existante (sinon commenter une FAQ réalisée était refusé aux comptes non validateurs).
-- Idempotent.

CREATE OR REPLACE FUNCTION public.guard_faq_validation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  old_doc jsonb := '{}'::jsonb;
  new_doc jsonb;
  existing text;
  validation_changed boolean;
  me text := lower(coalesce(auth.jwt()->>'email', ''));
  moderator boolean;
  item jsonb;
  kept jsonb;
BEGIN
  IF NEW.key NOT LIKE 'faq:%' THEN RETURN NEW; END IF;
  new_doc := NEW.value::jsonb;
  IF TG_OP = 'UPDATE' THEN
    old_doc := OLD.value::jsonb;
  ELSE
    -- Un « upsert » passe d'abord par ce déclencheur en INSERT : on compare alors à la ligne
    -- existante, sinon toute la demande paraît nouvelle.
    SELECT k.value INTO existing FROM public.editorial_kv k WHERE k.key = NEW.key;
    IF existing IS NOT NULL THEN old_doc := existing::jsonb; END IF;
  END IF;

  validation_changed := (new_doc->'validatedAt' IS DISTINCT FROM old_doc->'validatedAt')
    OR (new_doc->'validatedBy' IS DISTINCT FROM old_doc->'validatedBy')
    OR (new_doc->'link' IS DISTINCT FROM old_doc->'link')
    OR (new_doc->'approvedAt' IS DISTINCT FROM old_doc->'approvedAt')
    OR (new_doc->'approvedBy' IS DISTINCT FROM old_doc->'approvedBy');
  IF old_doc->>'validatedAt' IS NOT NULL THEN
    validation_changed := validation_changed OR (new_doc->'question' IS DISTINCT FROM old_doc->'question') OR (new_doc->'target' IS DISTINCT FROM old_doc->'target');
  END IF;
  IF validation_changed AND auth.uid() IS NOT NULL AND NOT public.can_validate_faq(auth.uid()) THEN
    RAISE EXCEPTION 'Seuls Geoffrey, Matthieu et Marick peuvent valider une demande FAQ, la marquer réalisée ou en modifier le lien.' USING ERRCODE = '42501';
  END IF;
  IF new_doc->>'validatedAt' IS NOT NULL AND (coalesce(trim(new_doc->>'question'), '') = '' OR coalesce(new_doc->>'link', '') !~* '^https?://[^[:space:]]+$' OR coalesce(new_doc->>'target', '') NOT IN ('Particulier', 'Professionnel')) THEN
    RAISE EXCEPTION 'Une question, un lien HTTP(S) et une cible sont obligatoires pour marquer la FAQ réalisée.';
  END IF;

  -- Nouvelle catégorie gardée pour la suite : seulement Geoffrey (admin) ou Matthieu.
  IF (new_doc->'categoryAcceptedAt' IS DISTINCT FROM old_doc->'categoryAcceptedAt')
     AND auth.uid() IS NOT NULL AND NOT public.can_moderate_faq(auth.uid()) THEN
    RAISE EXCEPTION 'Seuls Geoffrey et Matthieu peuvent garder une nouvelle catégorie FAQ.' USING ERRCODE = '42501';
  END IF;

  -- Commentaires / pièces jointes retirés ou modifiés : leur auteur, ou un modérateur.
  IF auth.uid() IS NOT NULL AND old_doc <> '{}'::jsonb THEN
    moderator := public.can_moderate_faq(auth.uid());
    IF NOT moderator THEN
      FOR item IN SELECT * FROM jsonb_array_elements(coalesce(old_doc->'comments', '[]'::jsonb)) LOOP
        kept := NULL;
        SELECT c INTO kept FROM jsonb_array_elements(coalesce(new_doc->'comments', '[]'::jsonb)) c WHERE c->>'id' = item->>'id' LIMIT 1;
        IF (kept IS NULL OR kept IS DISTINCT FROM item) AND lower(coalesce(item->>'authorEmail', '')) <> me THEN
          RAISE EXCEPTION 'Vous ne pouvez supprimer ou modifier que vos propres commentaires.' USING ERRCODE = '42501';
        END IF;
      END LOOP;
      FOR item IN SELECT * FROM jsonb_array_elements(coalesce(old_doc->'files', '[]'::jsonb)) LOOP
        kept := NULL;
        SELECT f INTO kept FROM jsonb_array_elements(coalesce(new_doc->'files', '[]'::jsonb)) f WHERE f->>'id' = item->>'id' LIMIT 1;
        IF (kept IS NULL OR kept IS DISTINCT FROM item) AND lower(coalesce(item->>'addedByEmail', '')) <> me THEN
          RAISE EXCEPTION 'Vous ne pouvez supprimer que les pièces jointes que vous avez ajoutées.' USING ERRCODE = '42501';
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
