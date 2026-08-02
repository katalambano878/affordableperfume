CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number text,
  user_id uuid,
  gateway text NOT NULL DEFAULT 'moolre',
  internal_ref text NOT NULL,
  gateway_ref text,
  expected_amount numeric(12,2) NOT NULL,
  amount_paid numeric(12,2),
  currency text NOT NULL DEFAULT 'GHS',
  status text NOT NULL DEFAULT 'initiated',
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  CONSTRAINT payment_attempts_expected_amount_nonneg CHECK (expected_amount >= 0),
  CONSTRAINT payment_attempts_amount_paid_nonneg CHECK (amount_paid IS NULL OR amount_paid >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_attempts_internal_ref
  ON public.payment_attempts (internal_ref);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_order_id
  ON public.payment_attempts (order_id);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_gateway_status
  ON public.payment_attempts (gateway, status);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_gateway_ref
  ON public.payment_attempts (gateway_ref)
  WHERE gateway_ref IS NOT NULL;
