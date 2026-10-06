CREATE TABLE public.article_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id text NOT NULL,
  step_key text,
  author_email text NOT NULL,
  author_name text,
  body text NOT NULL,
  mentions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.article_comments TO authenticated;
GRANT ALL ON public.article_comments TO service_role;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read comments" ON public.article_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can add comments" ON public.article_comments FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.approved_users()
RETURNS TABLE (id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email
  FROM public.profiles p
  WHERE p.status = 'approved'
  ORDER BY p.full_name NULLS LAST, p.email;
$$;
GRANT EXECUTE ON FUNCTION public.approved_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.approved_users() TO service_role;