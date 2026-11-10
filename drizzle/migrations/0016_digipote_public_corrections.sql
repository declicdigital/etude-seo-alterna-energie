-- D.I.G.I.P.O.T.E : une correction peut être marquée « réponse générale » (définition, question
-- sur l'entreprise) : elle est alors donnée à tout compte validé, même si elle contient un mot
-- qui désigne une rubrique. Les autres corrections restent filtrées par rubrique côté serveur
-- (correctionsFor dans src/lib/assistant-knowledge.ts). Idempotent.

ALTER TABLE public.assistant_questions
  ADD COLUMN IF NOT EXISTS correction_public boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.assistant_corrections();
CREATE FUNCTION public.assistant_corrections()
RETURNS TABLE (question text, correction text, is_public boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.question, q.correction, q.correction_public
  FROM public.assistant_questions q
  WHERE q.correction IS NOT NULL
    AND btrim(q.correction) <> ''
    AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  ORDER BY q.corrected_at DESC NULLS LAST
  LIMIT 120
$$;

REVOKE ALL ON FUNCTION public.assistant_corrections() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.assistant_corrections() TO authenticated;
