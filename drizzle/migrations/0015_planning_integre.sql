-- Rubrique « Planning intégré » : le planning commercial (ex-outil « Planning intégré BDP »)
-- intégré à Digicom (page public/planning-integre.html). Un seul état partagé (planning_state,
-- id = 1), un journal des actions et un historique des versions (50 dernières par année).
-- Lecture : admins et comptes validés à qui la rubrique est ouverte (allowed_sections).
-- Modification : admins + les administrateurs de l'ancien outil (même liste que
-- PLANNING_EDITOR_EMAILS dans src/lib/planning.ts). Idempotent.

CREATE OR REPLACE FUNCTION public.can_view_planning(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.status = 'approved'
      AND (p.allowed_sections IS NULL OR 'Planning intégré' = ANY (p.allowed_sections))
  )
$$;
REVOKE ALL ON FUNCTION public.can_view_planning(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_planning(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_edit_planning(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR (
    public.can_view_planning(_user_id) AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _user_id
        AND lower(u.email) IN (
          'manon.babin@soregies.fr',
          'matthieu.roux@alterna-energie.fr',
          'sandrine.delval@soregies.fr'
        )
    )
  )
$$;
REVOKE ALL ON FUNCTION public.can_edit_planning(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_planning(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.planning_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.planning_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.planning_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_by_name text,
  trigger_action text
);
CREATE INDEX IF NOT EXISTS planning_history_year_idx ON public.planning_history (year, created_at DESC);

CREATE TABLE IF NOT EXISTS public.planning_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid(),
  user_email text,
  action_type text NOT NULL CHECK (char_length(action_type) <= 80),
  target text CHECK (target IS NULL OR char_length(target) <= 240),
  year integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planning_audit_log_created_idx ON public.planning_audit_log (created_at DESC);

-- Chaque enregistrement du planning garde une version (50 par année).
CREATE OR REPLACE FUNCTION public.planning_state_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _year int := coalesce((NEW.data->>'currentYear')::int, extract(year FROM now())::int);
BEGIN
  IF NEW.data IS NOT DISTINCT FROM OLD.data THEN RETURN NEW; END IF;
  INSERT INTO public.planning_history (year, snapshot, created_by, created_by_name, trigger_action)
  VALUES (
    _year, NEW.data, NEW.updated_by,
    (SELECT coalesce(nullif(btrim(p.full_name), ''), p.email) FROM public.profiles p WHERE p.id = NEW.updated_by),
    coalesce(NEW.data->>'__lastAction', 'Mise à jour du planning')
  );
  DELETE FROM public.planning_history
  WHERE year = _year AND id NOT IN (
    SELECT id FROM public.planning_history WHERE year = _year ORDER BY created_at DESC LIMIT 50
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.planning_state_history() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS planning_state_history ON public.planning_state;
CREATE TRIGGER planning_state_history
  AFTER UPDATE ON public.planning_state
  FOR EACH ROW EXECUTE FUNCTION public.planning_state_history();

ALTER TABLE public.planning_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Planning readers" ON public.planning_state;
CREATE POLICY "Planning readers" ON public.planning_state
  FOR SELECT TO authenticated USING (public.can_view_planning(auth.uid()));
DROP POLICY IF EXISTS "Planning editors" ON public.planning_state;
CREATE POLICY "Planning editors" ON public.planning_state
  FOR UPDATE TO authenticated
  USING (public.can_edit_planning(auth.uid()))
  WITH CHECK (public.can_edit_planning(auth.uid()) AND updated_by = auth.uid());

DROP POLICY IF EXISTS "Planning history editors" ON public.planning_history;
CREATE POLICY "Planning history editors" ON public.planning_history
  FOR SELECT TO authenticated USING (public.can_edit_planning(auth.uid()));

DROP POLICY IF EXISTS "Planning audit insert" ON public.planning_audit_log;
CREATE POLICY "Planning audit insert" ON public.planning_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_planning(auth.uid()));
DROP POLICY IF EXISTS "Planning audit read" ON public.planning_audit_log;
CREATE POLICY "Planning audit read" ON public.planning_audit_log
  FOR SELECT TO authenticated USING (public.can_edit_planning(auth.uid()));

GRANT SELECT, UPDATE ON public.planning_state TO authenticated;
GRANT SELECT ON public.planning_history TO authenticated;
GRANT SELECT, INSERT ON public.planning_audit_log TO authenticated;

-- Mises à jour en direct entre les personnes qui ont le planning ouvert.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'planning_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.planning_state;
  END IF;
END $$;

-- Images des actions du planning (privées, liens signés).
INSERT INTO storage.buckets (id, name, public)
VALUES ('planning-images', 'planning-images', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Planning images read" ON storage.objects;
CREATE POLICY "Planning images read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'planning-images' AND public.can_view_planning(auth.uid()));
DROP POLICY IF EXISTS "Planning images upload" ON storage.objects;
CREATE POLICY "Planning images upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'planning-images' AND public.can_edit_planning(auth.uid()));
