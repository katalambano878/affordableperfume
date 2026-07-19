// Foreign-key map for PostgREST-style embeds in supabase-compat.
// Keyed by the table that OWNS the FK column.

export interface FkEdge {
  column: string;
  foreignTable: string;
  foreignColumn: string;
}

export const JSONB_COLUMNS: Record<string, Set<string>> = {
  profiles: new Set(["preferences"]),
  products: new Set(["options", "metadata"]),
  orders: new Set(["shipping_address", "billing_address", "metadata"]),
  customers: new Set(["default_address", "metadata"]),
  site_settings: new Set(["value"]),
  categories: new Set(["metadata"]),
  cms_content: new Set(["content", "metadata"]),
  wholesale_applications: new Set(["metadata"]),
  notifications: new Set(["data"]),
  banners: new Set(["metadata"]),
  order_items: new Set(["metadata"]),
};

export const FK_MAP: Record<string, FkEdge[]> = {
  addresses: [
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  audit_logs: [
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  blog_posts: [
    { column: "author_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  cart_items: [
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
    { column: "variant_id", foreignTable: "product_variants", foreignColumn: "id" },
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  categories: [
    { column: "parent_id", foreignTable: "categories", foreignColumn: "id" },
  ],
  customers: [
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  notifications: [
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  navigation_items: [
    { column: "menu_id", foreignTable: "navigation_menus", foreignColumn: "id" },
    { column: "parent_id", foreignTable: "navigation_items", foreignColumn: "id" },
  ],
  order_items: [
    { column: "order_id", foreignTable: "orders", foreignColumn: "id" },
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
    { column: "variant_id", foreignTable: "product_variants", foreignColumn: "id" },
  ],
  order_status_history: [
    { column: "order_id", foreignTable: "orders", foreignColumn: "id" },
  ],
  orders: [
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  product_images: [
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
  ],
  product_variants: [
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
  ],
  products: [
    { column: "category_id", foreignTable: "categories", foreignColumn: "id" },
  ],
  return_items: [
    { column: "order_item_id", foreignTable: "order_items", foreignColumn: "id" },
    { column: "return_request_id", foreignTable: "return_requests", foreignColumn: "id" },
  ],
  return_requests: [
    { column: "order_id", foreignTable: "orders", foreignColumn: "id" },
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  review_images: [
    { column: "review_id", foreignTable: "reviews", foreignColumn: "id" },
  ],
  reviews: [
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  support_messages: [
    { column: "ticket_id", foreignTable: "support_tickets", foreignColumn: "id" },
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  support_tickets: [
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
  wholesale_applications: [
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
    { column: "reviewed_by", foreignTable: "profiles", foreignColumn: "id" },
  ],
  wishlist_items: [
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
    { column: "user_id", foreignTable: "profiles", foreignColumn: "id" },
  ],
};
