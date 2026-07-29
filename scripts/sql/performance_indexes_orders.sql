-- Safe performance indexes for Affordable orders (plain Postgres).
-- Prefer running each CREATE INDEX CONCURRENTLY separately (not inside a transaction).
-- Review with EXPLAIN ANALYZE before/after on staging when possible.

-- Order number lookups (payment, track, admin)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_order_number
  ON orders (order_number);

-- Tracking number in metadata (SLI-*)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tracking_number
  ON orders ((metadata->>'tracking_number'));

-- Line items by order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
  ON order_items (order_id);

-- Admin email search (case-insensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_email_lower
  ON orders (lower(email));

-- Pending payment browse
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status_created
  ON orders (payment_status, created_at DESC);
