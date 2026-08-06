-- Order management: immutable snapshot, expanded status workflow, admin notes.
BEGIN;

ALTER TABLE public.customer_orders
  DROP CONSTRAINT IF EXISTS customer_orders_status_check;

ALTER TABLE public.customer_orders
  ADD CONSTRAINT customer_orders_status_check
  CHECK (
    status IN (
      'pending',
      'confirmed',
      'paid',
      'processing',
      'shipped',
      'delivered',
      'cancelled'
    )
  );

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS order_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.customer_orders.order_snapshot IS
  'Immutable fulfilment snapshot frozen at order time (design, beads/frame, prep, pricing)';

COMMENT ON COLUMN public.customer_orders.internal_notes IS
  'Admin-only fulfilment notes';

COMMENT ON COLUMN public.customer_orders.status_updated_at IS
  'When status last changed (manual admin updates)';

CREATE INDEX IF NOT EXISTS idx_customer_orders_status_created
  ON public.customer_orders (status, created_at DESC);

COMMIT;
