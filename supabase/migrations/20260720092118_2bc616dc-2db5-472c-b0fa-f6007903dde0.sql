
CREATE TABLE public.sheet_cells (
  sheet text NOT NULL,
  row_id integer NOT NULL,
  col integer NOT NULL,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sheet, row_id, col)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sheet_cells TO anon, authenticated;
GRANT ALL ON public.sheet_cells TO service_role;

ALTER TABLE public.sheet_cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read edits" ON public.sheet_cells FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert edits" ON public.sheet_cells FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update edits" ON public.sheet_cells FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete edits" ON public.sheet_cells FOR DELETE TO anon, authenticated USING (true);
