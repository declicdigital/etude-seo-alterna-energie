
CREATE TABLE public.sheet_meta (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sheet_meta TO anon, authenticated;
GRANT ALL ON public.sheet_meta TO service_role;
ALTER TABLE public.sheet_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sheet_meta" ON public.sheet_meta FOR SELECT USING (true);
CREATE POLICY "Public write sheet_meta" ON public.sheet_meta FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.sheet_meta;
