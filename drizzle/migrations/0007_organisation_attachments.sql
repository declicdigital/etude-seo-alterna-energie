-- « Organisation » : liens et pièces jointes sur les fiches.
-- Les éléments sont listés dans org_cards.attachments (jsonb), ce qui profite
-- du temps réel et des règles d'accès déjà en place sur les fiches. Les
-- fichiers sont dans le bucket privé « org-files », sous <id de la fiche>/…,
-- lisibles et modifiables uniquement par les personnes qui ont accès à
-- Organisation (can_use_organisation). Idempotent.

ALTER TABLE public.org_cards
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_cards_attachments_array'
  ) THEN
    ALTER TABLE public.org_cards
      ADD CONSTRAINT org_cards_attachments_array
      CHECK (jsonb_typeof(attachments) = 'array' AND jsonb_array_length(attachments) <= 200);
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('org-files', 'org-files', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

DROP POLICY IF EXISTS "Organisation members read files" ON storage.objects;
CREATE POLICY "Organisation members read files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'org-files' AND public.can_use_organisation(auth.uid()));

DROP POLICY IF EXISTS "Organisation members add files" ON storage.objects;
CREATE POLICY "Organisation members add files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-files' AND public.can_use_organisation(auth.uid()));

DROP POLICY IF EXISTS "Organisation members remove files" ON storage.objects;
CREATE POLICY "Organisation members remove files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'org-files' AND public.can_use_organisation(auth.uid()));
