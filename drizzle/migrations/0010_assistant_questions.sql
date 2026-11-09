-- D.I.G.I.P.O.T.E : questions auxquelles le robot n'a pas su répondre.
-- Chaque personne connectée enregistre ses propres questions (user_id = auth.uid()),
-- seuls les administrateurs (Geoffrey) peuvent les lire, les marquer traitées ou les
-- supprimer, pour enrichir ensuite le mode d'emploi du robot. Idempotent.

CREATE TABLE IF NOT EXISTS public.assistant_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  user_name text,
  question text NOT NULL CHECK (char_length(question) BETWEEN 1 AND 2000),
  reply text CHECK (reply IS NULL OR char_length(reply) <= 4000),
  page text CHECK (page IS NULL OR char_length(page) <= 200),
  source text NOT NULL DEFAULT 'ia' CHECK (source IN ('ia', 'local')),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS assistant_questions_open_idx
  ON public.assistant_questions (created_at DESC) WHERE resolved_at IS NULL;

ALTER TABLE public.assistant_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users log their own assistant questions" ON public.assistant_questions;
CREATE POLICY "Users log their own assistant questions" ON public.assistant_questions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND resolved_at IS NULL);

DROP POLICY IF EXISTS "Admins read assistant questions" ON public.assistant_questions;
CREATE POLICY "Admins read assistant questions" ON public.assistant_questions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update assistant questions" ON public.assistant_questions;
CREATE POLICY "Admins update assistant questions" ON public.assistant_questions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete assistant questions" ON public.assistant_questions;
CREATE POLICY "Admins delete assistant questions" ON public.assistant_questions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_questions TO authenticated;
