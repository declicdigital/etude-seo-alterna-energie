-- « Digipote » : historique complet des échanges avec D.I.G.I.P.O.T.E (question, date, personne,
-- réponse du robot) et corrections de Geoffrey, réutilisées par le robot pour ses réponses.
-- Idempotent.

ALTER TABLE public.assistant_questions
  ADD COLUMN IF NOT EXISTS unanswered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS correction text CHECK (correction IS NULL OR char_length(correction) <= 4000),
  ADD COLUMN IF NOT EXISTS corrected_at timestamptz;

-- Les questions enregistrées jusqu'ici étaient toutes des questions sans réponse.
UPDATE public.assistant_questions SET unanswered = true WHERE unanswered = false AND correction IS NULL AND created_at < now();

CREATE INDEX IF NOT EXISTS assistant_questions_created_idx ON public.assistant_questions (created_at DESC);

-- Les réponses corrigées servent de référence au robot pour tout compte validé, sans exposer
-- le reste de l'historique (auteurs, réponses d'origine).
CREATE OR REPLACE FUNCTION public.assistant_corrections()
RETURNS TABLE (question text, correction text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.question, q.correction
  FROM public.assistant_questions q
  WHERE q.correction IS NOT NULL
    AND btrim(q.correction) <> ''
    AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  ORDER BY q.corrected_at DESC NULLS LAST
  LIMIT 120
$$;

REVOKE ALL ON FUNCTION public.assistant_corrections() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.assistant_corrections() TO authenticated;
