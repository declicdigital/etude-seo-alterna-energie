-- Bug Buster, mode duo : la partie est enregistrée par l'hôte avec son ou sa partenaire
-- (nom et robot repris côté base), et les deux navigateurs échangent en direct sur des canaux
-- privés « bug-buster:… » réservés aux comptes validés. Idempotent.

ALTER TABLE public.game_scores
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partner_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS partner_avatar text;

ALTER TABLE public.game_scores DROP CONSTRAINT IF EXISTS game_scores_mode_check;
ALTER TABLE public.game_scores
  ADD CONSTRAINT game_scores_mode_check CHECK (mode IN ('solo', 'duo'));
ALTER TABLE public.game_scores DROP CONSTRAINT IF EXISTS game_scores_partner_avatar_check;
ALTER TABLE public.game_scores
  ADD CONSTRAINT game_scores_partner_avatar_check
  CHECK (partner_avatar IS NULL OR partner_avatar IN ('digi', 'sola', 'eole', 'volt'));
ALTER TABLE public.game_scores DROP CONSTRAINT IF EXISTS game_scores_score_check;
ALTER TABLE public.game_scores
  ADD CONSTRAINT game_scores_score_check CHECK (score BETWEEN 0 AND 4000000);

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
  IF NEW.mode = 'duo' THEN
    IF NEW.partner_id IS NULL OR NEW.partner_id = auth.uid()
       OR NOT (public.is_approved(NEW.partner_id) OR public.has_role(NEW.partner_id, 'admin')) THEN
      RAISE EXCEPTION 'Partenaire de duo invalide.' USING ERRCODE = '22023';
    END IF;
    _name := NULL;
    SELECT coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1))
      INTO _name
      FROM public.profiles p
      WHERE p.id = NEW.partner_id;
    NEW.partner_name := left(coalesce(nullif(_name, ''), 'Partenaire'), 120);
  ELSE
    NEW.partner_id := NULL;
    NEW.partner_name := '';
    NEW.partner_avatar := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.game_scores_fill() FROM public, anon, authenticated;

-- Canaux en direct du jeu (salle d'attente et parties en duo) : comptes validés uniquement.
DROP POLICY IF EXISTS "Bug Buster live: approved users receive" ON realtime.messages;
CREATE POLICY "Bug Buster live: approved users receive" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'bug-buster:%'
    AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS "Bug Buster live: approved users send" ON realtime.messages;
CREATE POLICY "Bug Buster live: approved users send" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    realtime.topic() LIKE 'bug-buster:%'
    AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  );
