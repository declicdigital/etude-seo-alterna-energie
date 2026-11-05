-- Rubrique « Organisation » : tableau de fiches (façon Trello).
-- Réservé aux admins et aux comptes validés à qui la rubrique a été
-- explicitement ouverte dans « Demandes d'accès » (allowed_sections
-- contient 'Organisation', ou liste vide = tout autorisé).
-- Idempotent : peut être rejoué sans erreur.

CREATE OR REPLACE FUNCTION public.can_use_organisation(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.status = 'approved'
      AND (p.allowed_sections IS NULL OR 'Organisation' = ANY (p.allowed_sections))
  )
$$;
REVOKE ALL ON FUNCTION public.can_use_organisation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_organisation(uuid) TO authenticated, service_role;

-- People who can be assigned or tagged; empty for callers without access.
CREATE OR REPLACE FUNCTION public.organisation_members()
RETURNS TABLE (id uuid, full_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.email
  FROM public.profiles p
  WHERE public.can_use_organisation(auth.uid())
    AND p.status = 'approved'
    AND public.can_use_organisation(p.id)
  ORDER BY p.full_name NULLS LAST, p.email
$$;
REVOKE ALL ON FUNCTION public.organisation_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.organisation_members() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.org_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  position double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: a column must be emptied before it can be deleted.
  column_id uuid NOT NULL REFERENCES public.org_columns(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  content text NOT NULL DEFAULT '',
  position double precision NOT NULL DEFAULT 0,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  tagged_ids uuid[] NOT NULL DEFAULT '{}',
  due_date date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_cards_column_idx ON public.org_cards (column_id, position);

-- Authorship comes from the session, never from the client; assignees and
-- newly tagged people must have access to Organisation.
CREATE OR REPLACE FUNCTION public.org_cards_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  added uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
    added := NEW.tagged_ids;
    IF NEW.assignee_id IS NOT NULL AND NOT public.can_use_organisation(NEW.assignee_id) THEN
      RAISE EXCEPTION 'assignee_without_access';
    END IF;
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    added := ARRAY(SELECT unnest(NEW.tagged_ids) EXCEPT SELECT unnest(OLD.tagged_ids));
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id AND NEW.assignee_id IS NOT NULL
       AND NOT public.can_use_organisation(NEW.assignee_id) THEN
      RAISE EXCEPTION 'assignee_without_access';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(added) u WHERE NOT public.can_use_organisation(u)) THEN
    RAISE EXCEPTION 'tagged_without_access';
  END IF;
  NEW.tagged_ids := ARRAY(SELECT DISTINCT u FROM unnest(NEW.tagged_ids) u);
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_cards_guard ON public.org_cards;
CREATE TRIGGER org_cards_guard BEFORE INSERT OR UPDATE ON public.org_cards
  FOR EACH ROW EXECUTE FUNCTION public.org_cards_guard();

ALTER TABLE public.org_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_cards ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.org_columns, public.org_cards FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_columns, public.org_cards TO authenticated;
GRANT ALL ON public.org_columns, public.org_cards TO service_role;

DROP POLICY IF EXISTS "Organisation members use columns" ON public.org_columns;
CREATE POLICY "Organisation members use columns" ON public.org_columns FOR ALL TO authenticated
  USING (public.can_use_organisation(auth.uid())) WITH CHECK (public.can_use_organisation(auth.uid()));

DROP POLICY IF EXISTS "Organisation members use cards" ON public.org_cards;
CREATE POLICY "Organisation members use cards" ON public.org_cards FOR ALL TO authenticated
  USING (public.can_use_organisation(auth.uid())) WITH CHECK (public.can_use_organisation(auth.uid()));

-- Live updates between people working on the board.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'org_columns') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.org_columns;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'org_cards') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.org_cards;
  END IF;
END $$;

-- Starting columns, only on an empty board.
INSERT INTO public.org_columns (title, position)
SELECT t.title, t.position
FROM (VALUES ('À faire', 1000), ('En cours', 2000), ('Terminé', 3000)) AS t(title, position)
WHERE NOT EXISTS (SELECT 1 FROM public.org_columns);
