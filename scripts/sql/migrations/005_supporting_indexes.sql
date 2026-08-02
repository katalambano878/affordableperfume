-- Supporting indexes (IF NOT EXISTS — safe on prod)
CREATE INDEX IF NOT EXISTS idx_orders_email_lower
  ON public.orders (lower(email));

CREATE INDEX IF NOT EXISTS idx_orders_tracking_number
  ON public.orders ((metadata->>'tracking_number'));

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created
  ON public.orders (payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_email_lower
  ON public.customers (lower(email));
