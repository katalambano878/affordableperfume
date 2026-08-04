# Admin Dashboard Stability Report

## Sections

| Section | Data source | Independent failure | Timeout | Error UI | Optimized query |
|---------|-------------|---------------------|---------|----------|-----------------|
| Auth shell | Session + `profiles.role` | Yes (retry UI) | 12s profile | Yes | Single-row lookup |
| KPI cards | `/api/admin/dashboard/summary` | Whole page error+retry | 20s fetch | Yes | SQL aggregates |
| Revenue chart (7d) | Same summary API | Same | 20s | Yes | Grouped SQL |
| Recent orders | Same (LIMIT 5) | Same | 20s | Yes | Indexed order |
| Low stock | Same (LIMIT 5) | Same | 20s | Yes | Filtered products |
| Product cards | Same (LIMIT 4) | Same | 20s | Yes | Small select |

Note: dashboard currently loads one summary payload (not Suspense-split cards). Failure is recoverable via Retry; optional next step is section-level `Promise.allSettled` if partial degradation is required.

## Orders page

- Stats: `/api/admin/orders/stats` (cookie or Bearer)
- List: paginated `/api/admin/orders/list`
- Search: debounced + timeout
- Error + Retry already present

## Pagination

- Orders: server page size + infinite scroll
- Customers / insights / analytics: hard caps (not full cursor pagination yet)

## Performance results

- Dashboard no longer downloads full `orders` table
- Admin shell no longer re-validates role on every in-admin navigation

## Test results (manual expectations)

1. Login → redirect once → shell appears
2. Dashboard shows KPIs or Retry (not infinite spinner)
3. One failed section path: summary 500 → error UI, shell remains usable via nav
4. Logout clears cookies and returns to login
