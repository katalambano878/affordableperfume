-- Dry-run integrity report (SELECT only). Do not DELETE from this script.
\echo === Orphan order_items ===
SELECT COUNT(*) AS orphan_order_items
FROM order_items oi LEFT JOIN orders o ON o.id = oi.order_id WHERE o.id IS NULL;

\echo === Duplicate order_number ===
SELECT order_number, COUNT(*) FROM orders GROUP BY 1 HAVING COUNT(*) > 1;

\echo === Paid without payment_transaction_id ===
SELECT COUNT(*) AS paid_missing_txn
FROM orders
WHERE payment_status::text = 'paid'
  AND (payment_transaction_id IS NULL OR payment_transaction_id = '');

\echo === Profiles without auth.users ===
SELECT COUNT(*) AS orphan_profiles
FROM profiles p LEFT JOIN auth.users u ON u.id = p.id WHERE u.id IS NULL;

\echo === Auth users without profiles ===
SELECT COUNT(*) AS users_missing_profile
FROM auth.users u LEFT JOIN profiles p ON p.id = u.id WHERE p.id IS NULL;

\echo === Negative money ===
SELECT COUNT(*) AS negative_totals FROM orders WHERE total < 0 OR subtotal < 0;
