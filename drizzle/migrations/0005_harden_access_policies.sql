CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (NEW.id, COALESCE(NEW.email, ''), NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), 'pending')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND status = 'approved')
$$;
REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Editorial tracker is open to the tool" ON public.editorial_kv;
REVOKE ALL ON public.editorial_kv FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_kv TO authenticated;
GRANT ALL ON public.editorial_kv TO service_role;
CREATE POLICY "Approved users use the editorial tracker" ON public.editorial_kv FOR ALL TO authenticated
  USING (public.is_approved(auth.uid()) AND key <> 'cron-token' AND key NOT LIKE 'access-notified:%' AND key NOT LIKE 'reminder%')
  WITH CHECK (public.is_approved(auth.uid()) AND key <> 'cron-token' AND key NOT LIKE 'access-notified:%' AND key NOT LIKE 'reminder%');

DROP POLICY IF EXISTS "Anyone can delete edits" ON public.sheet_cells;
DROP POLICY IF EXISTS "Anyone can insert edits" ON public.sheet_cells;
DROP POLICY IF EXISTS "Anyone can read edits" ON public.sheet_cells;
DROP POLICY IF EXISTS "Anyone can update edits" ON public.sheet_cells;
REVOKE ALL ON public.sheet_cells FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sheet_cells TO authenticated;
GRANT ALL ON public.sheet_cells TO service_role;
CREATE POLICY "Approved users edit cells" ON public.sheet_cells FOR ALL TO authenticated
  USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "Public read sheet_meta" ON public.sheet_meta;
DROP POLICY IF EXISTS "Public write sheet_meta" ON public.sheet_meta;
REVOKE ALL ON public.sheet_meta FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sheet_meta TO authenticated;
GRANT ALL ON public.sheet_meta TO service_role;
CREATE POLICY "Approved users edit meta" ON public.sheet_meta FOR ALL TO authenticated
  USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can delete comments" ON public.article_comments;
DROP POLICY IF EXISTS "Authenticated can edit comments" ON public.article_comments;
DROP POLICY IF EXISTS "Authenticated users can add comments" ON public.article_comments;
DROP POLICY IF EXISTS "Authenticated users can read comments" ON public.article_comments;
CREATE POLICY "Approved users read comments" ON public.article_comments FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));
CREATE POLICY "Approved users add own comments" ON public.article_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_approved(auth.uid()) AND lower(author_email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY "Authors or admins edit comments" ON public.article_comments FOR UPDATE TO authenticated
  USING (lower(author_email) = lower(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (lower(author_email) = lower(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authors or admins delete comments" ON public.article_comments FOR DELETE TO authenticated
  USING (lower(author_email) = lower(auth.jwt() ->> 'email') OR public.has_role(auth.uid(), 'admin'));