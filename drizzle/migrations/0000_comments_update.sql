GRANT UPDATE ON public.article_comments TO authenticated;
CREATE POLICY "Authenticated can edit comments" ON public.article_comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);