ALTER TABLE public.org_cards
  ADD COLUMN IF NOT EXISTS brand text;

ALTER TABLE public.org_cards
  DROP CONSTRAINT IF EXISTS org_cards_brand_check;

ALTER TABLE public.org_cards
  ADD CONSTRAINT org_cards_brand_check
  CHECK (brand IS NULL OR brand IN ('AE', 'PP'));