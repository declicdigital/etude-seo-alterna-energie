CREATE TABLE public.benchmark_months (
  month_key text PRIMARY KEY,
  label text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.benchmark_months TO service_role;

ALTER TABLE public.benchmark_months ENABLE ROW LEVEL SECURITY;

-- No client policies: reads and writes go through the benchmark-months API
-- route, which verifies the caller (approved profile for reads, admin
-- Geoffrey for writes) before using the service role.