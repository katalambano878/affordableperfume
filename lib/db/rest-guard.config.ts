// Which tables the browser may read and write through /rest/v1 for this shop.
// Everything not listed here is staff-only. See rest-guard.ts for the rules.

export interface GuardConfig {
  /** profiles.role values (lower case) with full access. */
  staffRoles: string[];
  /** SQL returning one row with a `role` column for the user id in $1. */
  staffRoleSql: string;
  /** Catalogue / CMS tables anyone may read. */
  publicRead: string[];
  /** Column names removed (at any depth) from every non-staff read, e.g. cost prices. */
  hiddenColumnNames: string[];
  /** Rows removed from non-staff reads, e.g. site_settings key admin_pin. */
  hiddenRows: Record<string, { column: string; values: string[] }>;
  /** Rows a signed-in customer owns: reads and own-mode writes are pinned to them. */
  ownRows: Record<string, { userColumn: string; emailColumn?: string }>;
  /** Tables readable through a parent row the caller may read (order_items under orders). */
  ownChildren: Record<string, { parent: string; fk: string }>;
  /** One row readable by anyone with its exact value in one of these columns. */
  guestLookup: Record<string, { columns: string[]; patterns: Record<string, RegExp> }>;
  /** "parent>child": columns of a staff-only table that may be embedded under a public one. */
  publicEmbeds: Record<string, string[]>;
  /**
   * Browser writes allowed for non-staff callers.
   *   insert: "anyone" | "user" (signed in) | "own" (owner column forced) |
   *           "childOfNewOrder" (only into the caller's own new unpaid order)
   *   update / delete: "own" (pinned to the caller's rows)
   *   upsertOn: conflict columns that make an own-mode upsert safe
   *   ownerColumn: the user-id column of a table not listed in ownRows
   *     (e.g. reviews.user_id), so rows cannot be written for someone else
   */
  write: Record<
    string,
    {
      insert?: "anyone" | "user" | "own" | "childOfNewOrder";
      update?: "own";
      delete?: "own";
      upsertOn?: string[];
      ownerColumn?: string;
    }
  >;
  /** Columns dropped from non-staff inserts and updates. */
  protectedColumns: Record<string, string[]>;
  /** For childOfNewOrder: how new the order must be, and SQL that is true while it is unpaid. */
  childWrite?: { maxAgeMinutes: number; unpaidSql: string };
  /** RPCs non-staff may call. */
  rpc: Record<string, "anyone" | "user">;
  /** Storage buckets signed-in customers may upload to. */
  userUploadBuckets: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** ORD-<13-digit ms timestamp>-<random suffix> */
const ORDER_NUMBER = /^[A-Z]{2,6}-\d{13}-\d{1,4}$/;

export const REST_GUARD: GuardConfig = {
  staffRoles: ["admin", "staff"],
  staffRoleSql: "SELECT role::text AS role FROM public.profiles WHERE id = $1",
  publicRead: [
    "banners",
    "blog_posts",
    "categories",
    "cms_content",
    "product_images",
    "product_variants",
    "products",
    "reviews",
    "site_settings",
    "store_modules",
  ],
  hiddenColumnNames: ["cost_per_item"],
  hiddenRows: { site_settings: { column: "key", values: ["admin_pin"] } },
  ownRows: {
    addresses: { userColumn: "user_id" },
    customers: { userColumn: "user_id", emailColumn: "email" },
    orders: { userColumn: "user_id", emailColumn: "email" },
    profiles: { userColumn: "id" },
    wholesale_applications: { userColumn: "user_id" },
  },
  ownChildren: {
    order_items: { parent: "orders", fk: "order_id" },
  },
  guestLookup: {
    orders: { columns: ["id", "order_number"], patterns: { id: UUID, order_number: ORDER_NUMBER } },
  },
  publicEmbeds: {},
  write: {
    addresses: { insert: "own", update: "own", delete: "own" },
    contact_submissions: { insert: "anyone" },
    order_items: { insert: "childOfNewOrder" },
    orders: { insert: "anyone" },
    reviews: { insert: "user", ownerColumn: "user_id" },
    wholesale_applications: { insert: "own" },
  },
  protectedColumns: {
    orders: ["payment_status", "payment_transaction_id", "payment_reminder_sent", "payment_reminder_sent_at"],
    reviews: ["verified_purchase", "helpful_votes"],
    wholesale_applications: ["status", "admin_notes", "reviewed_at", "reviewed_by"],
  },
  childWrite: { maxAgeMinutes: 120, unpaidSql: "COALESCE(payment_status::text, 'pending') <> 'paid'" },
  rpc: { upsert_customer_from_order: "anyone" },
  userUploadBuckets: [],
};
