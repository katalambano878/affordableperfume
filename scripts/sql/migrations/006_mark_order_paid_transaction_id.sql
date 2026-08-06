-- Persist Moolre transaction id on paid orders + backfill from callbacks/metadata.

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.mark_order_paid(order_ref text, moolre_ref text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_order orders;
BEGIN
  UPDATE orders
  SET
    payment_status = 'paid',
    payment_transaction_id = COALESCE(
      NULLIF(BTRIM(moolre_ref), ''),
      payment_transaction_id
    ),
    status = CASE
        WHEN status::text = 'pending' THEN 'processing'::order_status
        WHEN status::text = 'awaiting_payment' THEN 'processing'::order_status
        ELSE status
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) ||
               jsonb_build_object(
                   'moolre_reference', moolre_ref,
                   'payment_verified_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
               )
  WHERE order_number = order_ref
  RETURNING * INTO updated_order;

  IF updated_order.id IS NOT NULL THEN
      IF (updated_order.metadata->>'stock_reduced') IS NULL THEN
          UPDATE products p
          SET quantity = GREATEST(0, p.quantity - oi.quantity)
          FROM order_items oi
          WHERE oi.order_id = updated_order.id
            AND oi.product_id = p.id;

          UPDATE product_variants pv
          SET quantity = GREATEST(0, pv.quantity - oi.quantity)
          FROM order_items oi
          WHERE oi.order_id = updated_order.id
            AND oi.product_id = pv.product_id
            AND oi.variant_name IS NOT NULL
            AND oi.variant_name = pv.name;

          UPDATE orders
          SET metadata = metadata || '{"stock_reduced": true}'::jsonb
          WHERE id = updated_order.id;

          SELECT * INTO updated_order FROM orders WHERE id = updated_order.id;
      END IF;
  ELSE
      SELECT * INTO updated_order FROM orders WHERE order_number = order_ref;
  END IF;

  RETURN to_jsonb(updated_order);
END;
$$;

-- Backfill transaction ids from callback gateway_ref / metadata
UPDATE orders o
SET payment_transaction_id = src.gateway_ref
FROM (
  SELECT DISTINCT ON (order_number)
    order_number,
    gateway_ref
  FROM payment_callback_events
  WHERE gateway_ref IS NOT NULL
    AND BTRIM(gateway_ref) <> ''
    AND processing_status IN ('processed', 'ignored_duplicate')
  ORDER BY order_number, received_at DESC
) src
WHERE o.order_number = src.order_number
  AND o.payment_status::text = 'paid'
  AND (o.payment_transaction_id IS NULL OR BTRIM(o.payment_transaction_id) = '');

UPDATE orders
SET payment_transaction_id = NULLIF(BTRIM(metadata->>'moolre_reference'), '')
WHERE payment_status::text = 'paid'
  AND (payment_transaction_id IS NULL OR BTRIM(payment_transaction_id) = '')
  AND metadata ? 'moolre_reference'
  AND NULLIF(BTRIM(metadata->>'moolre_reference'), '') IS NOT NULL;

INSERT INTO public.schema_migrations (id) VALUES ('006_mark_order_paid_transaction_id')
ON CONFLICT (id) DO NOTHING;
