-- Suivis éditoriaux : seuls Geoffrey (admin) et Matthieu suppriment une image, une pièce jointe
-- (lien, note) ou un commentaire (discussion de l'article, commentaire sur une image). Les
-- autres peuvent ajouter, et modifier leurs propres messages, mais rien retirer. Idempotent.

CREATE OR REPLACE FUNCTION public.can_moderate_content(_user_id uuid)
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
REVOKE ALL ON FUNCTION public.can_moderate_content(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_moderate_content(uuid) TO authenticated, service_role;

-- Discussion des articles : suppression réservée à Geoffrey et Matthieu.
DROP POLICY IF EXISTS "Authors or admins delete comments" ON public.article_comments;
DROP POLICY IF EXISTS "Moderators delete comments" ON public.article_comments;
CREATE POLICY "Moderators delete comments" ON public.article_comments
  FOR DELETE TO authenticated USING (public.can_moderate_content(auth.uid()));

-- Articles : une pièce jointe (image, lien, note, fichier) ou un commentaire d'image ne peut
-- disparaître que par Geoffrey ou Matthieu : ni de l'article, ni d'une étape qui existe toujours
-- (une copie archivée dans reviewSteps ne compte pas). Un changement de type d'article qui retire
-- une étape entière (gardée dans les archives) reste permis.
CREATE OR REPLACE FUNCTION public.editorial_item_ids(doc jsonb)
RETURNS TABLE (id text, has_note boolean)
LANGUAGE sql IMMUTABLE AS $$
  WITH RECURSIVE walk(v) AS (
    SELECT coalesce(doc, 'null'::jsonb)
    UNION ALL
    SELECT c.value FROM walk w,
      LATERAL (
        SELECT value FROM jsonb_each(CASE WHEN jsonb_typeof(w.v) = 'object' THEN w.v ELSE '{}'::jsonb END)
        UNION ALL
        SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(w.v) = 'array' THEN w.v ELSE '[]'::jsonb END)
      ) c
  )
  SELECT v->>'id', bool_or(coalesce(btrim(v->>'note'), '') <> '')
  FROM walk
  WHERE jsonb_typeof(v) = 'object' AND v ? 'id' AND v->>'type' IN ('image', 'link', 'note', 'file')
  GROUP BY v->>'id'
$$;

CREATE OR REPLACE FUNCTION public.guard_editorial_items()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  old_doc jsonb;
  new_doc jsonb;
  existing text;
  removed int;
BEGIN
  IF NEW.key !~ '^([a-z]+:)?article:' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    old_doc := OLD.value::jsonb;
  ELSE
    SELECT k.value INTO existing FROM public.editorial_kv k WHERE k.key = NEW.key;
    IF existing IS NULL THEN RETURN NEW; END IF;
    old_doc := existing::jsonb;
  END IF;
  new_doc := NEW.value::jsonb;

  WITH
    old_all AS (SELECT * FROM public.editorial_item_ids(old_doc)),
    new_all AS (SELECT * FROM public.editorial_item_ids(new_doc))
  SELECT
    -- disparu complètement
    (SELECT count(*) FROM old_all o WHERE NOT EXISTS (SELECT 1 FROM new_all n WHERE n.id = o.id))
    -- retiré d'une étape qui existe toujours (un changement de type qui retire toute l'étape la
    -- garde dans les archives : permis)
    + (SELECT count(*)
         FROM jsonb_array_elements(coalesce(old_doc->'steps', '[]'::jsonb)) os
         JOIN jsonb_array_elements(coalesce(new_doc->'steps', '[]'::jsonb)) ns ON ns->>'key' = os->>'key'
         CROSS JOIN LATERAL public.editorial_item_ids(os) o
        WHERE NOT EXISTS (SELECT 1 FROM public.editorial_item_ids(ns) n WHERE n.id = o.id))
    -- commentaire d'image effacé
    + (SELECT count(*) FROM old_all o JOIN new_all n ON n.id = o.id WHERE o.has_note AND NOT n.has_note)
  INTO removed;

  IF removed > 0 AND NOT public.can_moderate_content(auth.uid()) THEN
    RAISE EXCEPTION 'Seule l''équipe Digicom peut supprimer une image, une pièce jointe ou un commentaire.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS editorial_items_guard ON public.editorial_kv;
CREATE TRIGGER editorial_items_guard
  BEFORE INSERT OR UPDATE ON public.editorial_kv
  FOR EACH ROW EXECUTE FUNCTION public.guard_editorial_items();
