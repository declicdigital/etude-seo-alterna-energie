CREATE OR REPLACE FUNCTION public.pipeline_config_emails(_v text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE r text;
BEGIN
  IF _v IS NULL THEN RETURN ''; END IF;
  SELECT coalesce(string_agg(lower(trim(m)), ',' ORDER BY lower(trim(m))), '') INTO r
  FROM jsonb_array_elements(_v::jsonb) c,
       jsonb_each_text(coalesce(c->'emails','{}'::jsonb)) e,
       regexp_split_to_table(e.value, '[,;\s]+') m
  WHERE trim(m) <> '';
  RETURN r;
EXCEPTION WHEN others THEN RETURN '!invalid';
END $$;

CREATE OR REPLACE FUNCTION public.guard_pipeline_config()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_v text;
BEGIN
  IF NEW.key NOT LIKE '%pipeline-config' THEN RETURN NEW; END IF;
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF private.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  SELECT value INTO old_v FROM public.editorial_kv WHERE key = NEW.key;
  IF public.pipeline_config_emails(old_v) IS DISTINCT FROM public.pipeline_config_emails(NEW.value) THEN
    RAISE EXCEPTION 'Only admins can change notification addresses';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS editorial_kv_pipeline_config_guard ON public.editorial_kv;
CREATE TRIGGER editorial_kv_pipeline_config_guard BEFORE INSERT OR UPDATE ON public.editorial_kv
FOR EACH ROW EXECUTE FUNCTION public.guard_pipeline_config();