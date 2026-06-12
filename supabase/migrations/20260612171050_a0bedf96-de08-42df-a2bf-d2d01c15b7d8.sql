ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS donations_gateway_id_unique
  ON public.donations(gateway_id)
  WHERE gateway_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_donations_cost_center ON public.donations(cost_center_id);