import { NextRequest, NextResponse } from "next/server";
import { createStorageClient } from "@/lib/db/storage";
import { isPlainPostgres } from "@/lib/db/mode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Supabase Storage bulk delete:
 *   DELETE /storage/v1/object/{bucket}  body = { prefixes: string[] }
 * (this is what supabase-js .remove([paths]) actually sends)
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ bucket: string }> }
) {
  if (!isPlainPostgres()) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 503 });
  }
  const { bucket } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { prefixes?: string[] };
  const prefixes = Array.isArray(body.prefixes) ? body.prefixes : [];
  if (prefixes.length === 0) {
    return NextResponse.json({ error: "No prefixes provided" }, { status: 400 });
  }
  const storage = createStorageClient();
  const { error } = await storage.from(bucket).remove(prefixes);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(
    prefixes.map((name) => ({ name, bucket_id: bucket }))
  );
}
