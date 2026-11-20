CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION private.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND status = 'approved')
$$;
CREATE OR REPLACE FUNCTION private.can_use_organisation(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.status = 'approved'
      AND (p.allowed_sections IS NULL OR 'Organisation' = ANY (p.allowed_sections)))
$$;
CREATE OR REPLACE FUNCTION private.may_inspect(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id = auth.uid()
      OR coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      OR private.has_role(auth.uid(), 'admin')
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.may_inspect(_user_id) AND private.has_role(_user_id, _role)
$$;
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.may_inspect(_user_id) AND private.is_approved(_user_id)
$$;
CREATE OR REPLACE FUNCTION public.can_use_organisation(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.may_inspect(_user_id) AND private.can_use_organisation(_user_id)
$$;
CREATE OR REPLACE FUNCTION public.approved_users()
RETURNS TABLE(id uuid, full_name text, email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email FROM public.profiles p
  WHERE p.status = 'approved'
    AND (coalesce(auth.jwt() ->> 'role', '') = 'service_role'
         OR private.is_approved(auth.uid()) OR private.has_role(auth.uid(), 'admin'))
  ORDER BY p.full_name NULLS LAST, p.email;
$$;
CREATE OR REPLACE FUNCTION public.organisation_members()
RETURNS TABLE(id uuid, full_name text, email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email FROM public.profiles p
  WHERE private.can_use_organisation(auth.uid()) AND p.status = 'approved'
    AND private.can_use_organisation(p.id)
  ORDER BY p.full_name NULLS LAST, p.email
$$;

CREATE OR REPLACE FUNCTION public.org_cards_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE added uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid(); NEW.created_at := now(); added := NEW.tagged_ids;
    IF NEW.assignee_id IS NOT NULL AND NOT private.can_use_organisation(NEW.assignee_id) THEN
      RAISE EXCEPTION 'assignee_without_access';
    END IF;
  ELSE
    NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
    added := ARRAY(SELECT unnest(NEW.tagged_ids) EXCEPT SELECT unnest(OLD.tagged_ids));
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id AND NEW.assignee_id IS NOT NULL
       AND NOT private.can_use_organisation(NEW.assignee_id) THEN
      RAISE EXCEPTION 'assignee_without_access';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(added) u WHERE NOT private.can_use_organisation(u)) THEN
    RAISE EXCEPTION 'tagged_without_access';
  END IF;
  NEW.tagged_ids := ARRAY(SELECT DISTINCT u FROM unnest(NEW.tagged_ids) u);
  NEW.updated_by := auth.uid(); NEW.updated_at := now();
  RETURN NEW;
END; $$;

-- Server-timed game sessions: the score cap derives from real elapsed time.
CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  started_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.game_sessions TO authenticated;
GRANT ALL ON public.game_sessions TO service_role;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users start their own game sessions" ON public.game_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users read their own game sessions" ON public.game_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.game_sessions_fill()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.user_id := auth.uid(); NEW.started_at := now(); RETURN NEW; END; $$;
CREATE TRIGGER game_sessions_fill BEFORE INSERT ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION public.game_sessions_fill();

ALTER TABLE public.game_scores ADD COLUMN session_id uuid;

CREATE OR REPLACE FUNCTION public.game_scores_fill()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text; _started timestamptz; _dur integer;
BEGIN
  NEW.user_id := auth.uid();
  NEW.created_at := now();
  DELETE FROM public.game_sessions
    WHERE id = NEW.session_id AND user_id = auth.uid()
    RETURNING started_at INTO _started;
  IF _started IS NULL OR now() - _started > interval '2 hours' THEN
    RAISE EXCEPTION 'Partie inconnue ou expirée.' USING ERRCODE = '22023';
  END IF;
  _dur := greatest(0, floor(extract(epoch FROM now() - _started)))::integer;
  NEW.duration_s := _dur;
  IF NEW.score < 0 OR NEW.score > (3000 + _dur * 600) * (CASE WHEN NEW.mode = 'duo' THEN 2 ELSE 1 END) THEN
    RAISE EXCEPTION 'Score invraisemblable.' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)) INTO _name
    FROM public.profiles p WHERE p.id = auth.uid();
  NEW.player_name := left(coalesce(nullif(_name, ''), 'Joueur mystère'), 120);
  IF NEW.mode = 'duo' THEN
    IF NEW.partner_id IS NULL OR NEW.partner_id = auth.uid()
       OR NOT (private.is_approved(NEW.partner_id) OR private.has_role(NEW.partner_id, 'admin')) THEN
      RAISE EXCEPTION 'Partenaire de duo invalide.' USING ERRCODE = '22023';
    END IF;
    _name := NULL;
    SELECT coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)) INTO _name
      FROM public.profiles p WHERE p.id = NEW.partner_id;
    NEW.partner_name := left(coalesce(nullif(_name, ''), 'Partenaire'), 120);
  ELSE
    NEW.partner_id := NULL; NEW.partner_name := ''; NEW.partner_avatar := NULL;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.game_scores_fill() FROM public, anon, authenticated;