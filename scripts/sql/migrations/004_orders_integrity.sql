-- Unique order_number already exists on prod (orders_order_number_key).
-- Add non-negative money checks only when no violating rows exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_nonneg'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.orders WHERE total < 0
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_total_nonneg CHECK (total >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_subtotal_nonneg'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.orders WHERE subtotal < 0
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_subtotal_nonneg CHECK (subtotal >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_payment_transaction_id
  ON public.orders (payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;
