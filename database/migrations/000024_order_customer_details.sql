-- Checkout customer snapshot on orders.
BEGIN;

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS customer_details JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN public.customer_orders.customer_details IS
  'Checkout snapshot: name, email, phone, shipping address at order time';

COMMIT;
