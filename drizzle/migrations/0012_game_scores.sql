-- Mini-jeu « Bug Buster » : une ligne par partie terminée. Chaque compte validé enregistre ses
-- propres parties ; le nom affiché vient de son profil (pas du navigateur) ; tout compte validé
-- lit les classements (records du jour, de la semaine, du mois). Idempotent.

CREATE TABLE IF NOT EXISTS public.game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  player_name text NOT NULL DEFAULT '' CHECK (char_length(player_name) <= 120),
  avatar text NOT NULL CHECK (avatar IN ('digi', 'sola', 'eole', 'volt')),
  map text NOT NULL CHECK (map IN ('bureau', 'solaire', 'eolien', 'nuit')),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 2000000),
  duration_s integer NOT NULL DEFAULT 0 CHECK (duration_s BETWEEN 0 AND 7200)
);

CREATE INDEX IF NOT EXISTS game_scores_created_idx ON public.game_scores (created_at DESC);

-- Auteur, nom et date fixés côté base : impossible de jouer sous le nom d'un autre.
CREATE OR REPLACE FUNCTION public.game_scores_fill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  NEW.user_id := auth.uid();
  NEW.created_at := now();
  SELECT coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1))
    INTO _name
    FROM public.profiles p
    WHERE p.id = auth.uid();
  NEW.player_name := left(coalesce(nullif(_name, ''), 'Joueur mystère'), 120);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_scores_fill ON public.game_scores;
CREATE TRIGGER game_scores_fill
  BEFORE INSERT ON public.game_scores
  FOR EACH ROW EXECUTE FUNCTION public.game_scores_fill();

ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved users save their game scores" ON public.game_scores;
CREATE POLICY "Approved users save their game scores" ON public.game_scores
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS "Approved users read game scores" ON public.game_scores;
CREATE POLICY "Approved users read game scores" ON public.game_scores
  FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete game scores" ON public.game_scores;
CREATE POLICY "Admins delete game scores" ON public.game_scores
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON FUNCTION public.game_scores_fill() FROM public, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.game_scores TO authenticated;
