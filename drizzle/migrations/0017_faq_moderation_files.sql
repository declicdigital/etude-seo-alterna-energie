-- Demandes FAQ :
-- 1. « Validée » (approvedAt / approvedBy) avant « Réalisée » (validatedAt + lien) : seuls
--    Geoffrey, Matthieu et Marick (can_validate_faq) changent ces champs.
-- 2. Commentaires et pièces jointes de la demande : chacun supprime les siens ; Geoffrey
--    (admin) et Matthieu (can_moderate_faq) suppriment ceux de n'importe qui. Personne ne
--    modifie le commentaire d'un autre.
-- 3. Bucket privé « faq-files » pour les nouvelles pièces jointes (lecture : comptes validés ;
--    suppression : la personne qui l'a ajoutée, Geoffrey ou Matthieu). Idempotent.

CREATE OR REPLACE FUNCTION public.can_moderate_faq(_user_id uuid)
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
        WHERE u.id = _user_id AND lower(u.email) = 'matthieu.roux@alterna-energie.fr'
      )
    )
$$;
REVOKE ALL ON FUNCTION public.can_moderate_faq(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_moderate_faq(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_faq_validation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  old_doc jsonb := '{}'::jsonb;
  new_doc jsonb;
  validation_changed boolean;
  me text := lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), ''));
  moderator boolean;
  item jsonb;
  kept jsonb;
BEGIN
  IF NEW.key NOT LIKE 'faq:%' THEN RETURN NEW; END IF;
  new_doc := NEW.value::jsonb;
  IF TG_OP = 'UPDATE' THEN old_doc := OLD.value::jsonb; END IF;

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

  -- Commentaires / pièces jointes retirés ou modifiés : leur auteur, ou un modérateur.
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL THEN
    moderator := public.can_moderate_faq(auth.uid());
    IF NOT moderator THEN
      FOR item IN SELECT * FROM jsonb_array_elements(coalesce(old_doc->'comments', '[]'::jsonb)) LOOP
        SELECT c INTO kept FROM jsonb_array_elements(coalesce(new_doc->'comments', '[]'::jsonb)) c WHERE c->>'id' = item->>'id' LIMIT 1;
        IF (kept IS NULL OR kept IS DISTINCT FROM item) AND lower(coalesce(item->>'authorEmail', '')) <> me THEN
          RAISE EXCEPTION 'Vous ne pouvez supprimer ou modifier que vos propres commentaires.' USING ERRCODE = '42501';
        END IF;
      END LOOP;
      FOR item IN SELECT * FROM jsonb_array_elements(coalesce(old_doc->'files', '[]'::jsonb)) LOOP
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

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('faq-files', 'faq-files', false, 26214400)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "FAQ files read" ON storage.objects;
CREATE POLICY "FAQ files read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'faq-files' AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));
DROP POLICY IF EXISTS "FAQ files upload" ON storage.objects;
CREATE POLICY "FAQ files upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'faq-files' AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));
DROP POLICY IF EXISTS "FAQ files delete" ON storage.objects;
CREATE POLICY "FAQ files delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'faq-files' AND (owner = auth.uid() OR public.can_moderate_faq(auth.uid())));
