import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  applyPostgrestParams,
} from "@/lib/db/supabase-compat";
import { isPlainPostgres } from "@/lib/db/mode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PG_IDENT = /^[a-z_][a-z0-9_]*$/i;

/** Tables that must never be mutated via the public REST shim */
const WRITE_DENY_TABLES = new Set([
  "auth_users",
  "schema_migrations",
  "spatial_ref_sys",
]);

/** On INSERT: never allow clients to create already-paid / privileged rows */
const ORDERS_INSERT_PROTECTED = new Set(["payment_status"]);

/** On PATCH: money/payment fields only via server APIs / mark_order_paid */
const ORDERS_UPDATE_PROTECTED = new Set([
  "payment_status",
  "payment_method",
  "total",
  "subtotal",
  "discount_total",
  "tax_total",
]);

const PROFILES_PROTECTED_FIELDS = new Set(["role"]);

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, prefer, x-client-info, accept-profile, content-profile",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
}

function assertWritableTable(table: string): NextResponse | null {
  if (WRITE_DENY_TABLES.has(table)) {
    return jsonError(`Writes to table '${table}' are not allowed`, 403);
  }
  return null;
}

function stripProtectedFields(
  table: string,
  body: unknown,
  mode: "insert" | "update"
): unknown {
  if (body == null || typeof body !== "object") return body;

  const stripOne = (row: Record<string, unknown>) => {
    const next = { ...row };
    if (table === "orders") {
      const keys = mode === "insert" ? ORDERS_INSERT_PROTECTED : ORDERS_UPDATE_PROTECTED;
      for (const key of keys) delete next[key];
    }
    if (table === "profiles") {
      for (const key of PROFILES_PROTECTED_FIELDS) delete next[key];
    }
    return next;
  };

  if (Array.isArray(body)) {
    return body.map((row) =>
      row && typeof row === "object" ? stripOne(row as Record<string, unknown>) : row
    );
  }
  return stripOne(body as Record<string, unknown>);
}

function preferSingle(req: NextRequest): boolean {
  const accept = req.headers.get("accept") || "";
  return accept.includes("application/vnd.pgrst.object+json");
}

function preferReturn(req: NextRequest): boolean {
  const prefer = req.headers.get("prefer") || "";
  return prefer.includes("return=representation") || prefer.includes("resolution=");
}

function preferCount(req: NextRequest): boolean {
  const prefer = req.headers.get("prefer") || "";
  return prefer.includes("count=exact");
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { message, code: "PGRST", details: null, hint: null },
    { status, headers: corsHeaders() }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");

  const client = createClient();
  const qb = client.from(table);
  const select = req.nextUrl.searchParams.get("select") || "*";
  if (preferCount(req)) {
    qb.select(select, {
      count: "exact",
      head: req.headers.get("prefer")?.includes("head=true"),
    });
  } else {
    qb.select(select);
  }
  // Apply filters/order/limit without re-applying select
  const params = new URLSearchParams(req.nextUrl.searchParams);
  params.delete("select");
  applyPostgrestParams(qb as any, params, {
    preferSingle: preferSingle(req),
  });

  const result = await qb;
  if (result.error) {
    return jsonError(result.error.message || "Query failed", 400);
  }

  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", "application/json");
  if (result.count != null) {
    const isHead = req.headers.get("prefer")?.includes("head=true");
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    // PostgREST uses */N for empty/head count responses — supabase-js parses the total from this.
    if (isHead || rows.length === 0) {
      headers.set("Content-Range", `*/${result.count}`);
    } else {
      headers.set("Content-Range", `0-${rows.length - 1}/${result.count}`);
    }
  }

  if (preferSingle(req)) {
    return NextResponse.json(result.data, { status: 200, headers });
  }
  return NextResponse.json(result.data ?? [], { status: 200, headers });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");
  const denied = assertWritableTable(table);
  if (denied) return denied;

  const rawBody = await req.json().catch(() => null);
  if (rawBody == null) return jsonError("Invalid JSON body");
  const body = stripProtectedFields(table, rawBody, "insert") as Record<string, unknown> | Record<string, unknown>[];

  const client = createClient();
  // supabase-js upsert => Prefer: resolution=merge-duplicates (+ ?on_conflict=col)
  const prefer = req.headers.get("prefer") || "";
  const isUpsert = prefer.includes("resolution=merge-duplicates");
  const onConflict = req.nextUrl.searchParams.get("on_conflict") || undefined;
  let qb = isUpsert
    ? client.from(table).upsert(body as any, onConflict ? { onConflict } : undefined)
    : client.from(table).insert(body as any);
  if (preferReturn(req) || preferSingle(req)) {
    qb = qb.select("*") as typeof qb;
  }
  if (preferSingle(req)) qb = qb.single() as typeof qb;

  const result = await qb;
  if (result.error) return jsonError(result.error.message || "Insert failed", 400);

  return NextResponse.json(result.data, {
    status: 201,
    headers: corsHeaders(),
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");
  const denied = assertWritableTable(table);
  if (denied) return denied;

  const rawBody = await req.json().catch(() => null);
  if (rawBody == null || typeof rawBody !== "object") return jsonError("Invalid JSON body");
  const body = stripProtectedFields(table, rawBody, "update") as Record<string, unknown>;

  const client = createClient();
  let qb = client.from(table).update(body as any);
  applyPostgrestParams(qb as any, req.nextUrl.searchParams);
  if (preferReturn(req) || preferSingle(req)) {
    qb = qb.select("*") as typeof qb;
  }
  if (preferSingle(req)) qb = qb.single() as typeof qb;

  const result = await qb;
  if (result.error) return jsonError(result.error.message || "Update failed", 400);

  return NextResponse.json(result.data, { status: 200, headers: corsHeaders() });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");
  const denied = assertWritableTable(table);
  if (denied) return denied;
  if (table === "orders" || table === "order_items") {
    return jsonError(`DELETE on '${table}' via REST is not allowed`, 403);
  }

  const client = createClient();
  let qb = client.from(table).delete();
  applyPostgrestParams(qb as any, req.nextUrl.searchParams);
  if (preferReturn(req)) {
    qb = qb.select("*") as typeof qb;
  }

  const result = await qb;
  if (result.error) return jsonError(result.error.message || "Delete failed", 400);

  return NextResponse.json(result.data ?? null, { status: 200, headers: corsHeaders() });
}
