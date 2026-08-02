CREATE TABLE IF NOT EXISTS public.payment_callback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL DEFAULT 'moolre',
  external_event_id text,
  event_type text,
  internal_payment_ref text,
  gateway_ref text,
  order_number text,
  payload_hash text NOT NULL,
  signature_valid boolean,
  processing_status text NOT NULL DEFAULT 'received',
  failure_reason text,
  attempt_count integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT payment_callback_events_attempt_count_nonneg CHECK (attempt_count >= 0)
);

-- Deduplicate by gateway + payload hash (stable for identical callbacks)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_callback_events_gateway_hash
  ON public.payment_callback_events (gateway, payload_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_callback_events_gateway_ext
  ON public.payment_callback_events (gateway, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_callback_events_status
  ON public.payment_callback_events (processing_status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_callback_events_order
  ON public.payment_callback_events (order_number)
  WHERE order_number IS NOT NULL;
