CREATE TABLE IF NOT EXISTS public.editorial_kv (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_kv TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_kv TO authenticated;
GRANT ALL ON public.editorial_kv TO service_role;

ALTER TABLE public.editorial_kv ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editorial tracker is open to the tool"
ON public.editorial_kv FOR ALL
USING (true) WITH CHECK (true);