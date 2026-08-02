import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-compat";
import { isPlainPostgres } from "@/lib/db/mode";
import { verifyAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PG_IDENT = /^[a-z_][a-z0-9_]*$/i;

/** RPCs callable without admin (guest checkout / customer upsert). */
const PUBLIC_RPC_ALLOWLIST = new Set([
  "upsert_customer_from_order",
  "update_customer_stats",
]);

/** RPCs that require an authenticated admin/staff session. */
const ADMIN_RPC_ALLOWLIST = new Set(["mark_order_paid"]);

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    },
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ fn: string }> }
) {
  if (!isPlainPostgres()) {
    return NextResponse.json({ message: "DATABASE_URL not set" }, { status: 503 });
  }
  const { fn } = await ctx.params;
  if (!PG_IDENT.test(fn)) {
    return NextResponse.json({ message: "Invalid function name" }, { status: 400 });
  }

  if (ADMIN_RPC_ALLOWLIST.has(fn)) {
    const auth = await verifyAuth(req, { requireAdmin: true });
    if (!auth.authenticated) {
      return NextResponse.json(
        { message: auth.error || "Admin authorization required", code: "PGRST301" },
        { status: 401 }
      );
    }
  } else if (!PUBLIC_RPC_ALLOWLIST.has(fn)) {
    return NextResponse.json(
      { message: `RPC '${fn}' is not allowed`, code: "PGRST202" },
      { status: 403 }
    );
  }

  const args = (await req.json().catch(() => ({}))) as Record<string, any>;
  const client = createClient();
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    return NextResponse.json(
      { message: error.message, code: "PGRST202" },
      { status: 400 }
    );
  }
  return NextResponse.json(data);
}
