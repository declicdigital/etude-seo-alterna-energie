-- Suivis éditoriaux : les images des cartes quittent editorial_kv (où elles
-- étaient stockées en data URL, plusieurs Mo par article, rechargés à chaque
-- ouverture) pour le bucket privé « editorial-files ». Même règle d'accès que
-- le suivi : comptes approuvés. Idempotent.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('editorial-files', 'editorial-files', false, 26214400, ARRAY['image/*'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 26214400, allowed_mime_types = ARRAY['image/*'];

DROP POLICY IF EXISTS "Approved users read editorial files" ON storage.objects;
CREATE POLICY "Approved users read editorial files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'editorial-files' AND public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "Approved users add editorial files" ON storage.objects;
CREATE POLICY "Approved users add editorial files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'editorial-files' AND public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "Approved users replace editorial files" ON storage.objects;
CREATE POLICY "Approved users replace editorial files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'editorial-files' AND public.is_approved(auth.uid()))
  WITH CHECK (bucket_id = 'editorial-files' AND public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "Approved users remove editorial files" ON storage.objects;
CREATE POLICY "Approved users remove editorial files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'editorial-files' AND public.is_approved(auth.uid()));
