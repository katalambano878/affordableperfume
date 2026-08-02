# Database Schema Reference — Affordable Perfumes GH

**DB:** `affordableperfume` · PostgreSQL 16 · Updated 2026-08-02

## Active public tables (34 after repair)

| Table | Purpose | PK | Key FKs / notes |
|-------|---------|----|-----------------|
| `profiles` | User profiles / roles | `id` → `auth.users` | `role`, `is_wholesaler` |
| `addresses` | Saved addresses | `id` | `user_id` → profiles |
| `categories` | Product categories | `id` | self `parent_id` |
| `products` | Catalog | `id` | `category_id` |
| `product_images` | Product media | `id` | `product_id` |
| `product_variants` | Variants | `id` | `product_id` |
| `orders` | Orders | `id` | `user_id`; unique `order_number`; enums `order_status` / `payment_status`; money `numeric`; `metadata` jsonb |
| `order_items` | Line items | `id` | `order_id`, `product_id`, `variant_id` |
| `order_status_history` | Status audit | `id` | `order_id` |
| `customers` | CRM / newsletter | `id` | `user_id`, email |
| `coupons` | Coupons (admin; store UI removed) | `id` | |
| `cart_items` / `wishlist_items` | Cart/wishlist | `id` | user/product |
| `reviews` / `review_images` | Reviews | `id` | |
| `blog_posts` | Blog | `id` | |
| `banners` | Homepage banners | `id` | |
| `cms_content` / `pages` / `site_settings` / `store_settings` / `store_modules` | CMS/settings | varies | |
| `navigation_menus` / `navigation_items` | Nav | `id` | |
| `support_tickets` / `support_messages` | Support | `id` | |
| `return_requests` / `return_items` | Returns | `id` | |
| `notifications` / `audit_logs` | System | `id` | |
| `wholesale_applications` | Wholesale applications | `id` | `user_id`, status |
| `contact_submissions` | Contact form (**new**) | `id` | name, email, message |
| `payment_attempts` | Payment attempts (**new**) | `id` | `order_id`; unique `internal_ref` |
| `payment_callback_events` | Callback dedupe (**new**) | `id` | unique `(gateway,payload_hash)` |
| `schema_migrations` | Migration tracker (**new**) | `id` | |

## Auth schema

| Table | Purpose |
|-------|---------|
| `auth.users` | Credentials / identities for plain-PG GoTrue shim |

## Critical RPCs

| Function | Caller | Notes |
|----------|--------|-------|
| `mark_order_paid(order_ref, moolre_ref)` | Server admin + admin-auth REST RPC (POS) | Marks paid, stock side-effects |
| `upsert_customer_from_order` | Checkout / POS | Public RPC allowlist |
| `update_customer_stats` | Payment success paths | Public RPC allowlist |

## Money / status

- Amounts: `numeric` (not float)
- `orders.payment_status` / `orders.status`: PostgreSQL enums
- Currency column default historically `USD` in dump; app charges **GHS** via Moolre (app sets currency in payment attempt rows)

## Related modules

- Storefront: products, categories, orders, order_items, addresses, customers, contact_submissions, wholesale_applications
- Admin: same + CMS/settings/coupons/POS
- Payments: orders + payment_attempts + payment_callback_events + `mark_order_paid`
