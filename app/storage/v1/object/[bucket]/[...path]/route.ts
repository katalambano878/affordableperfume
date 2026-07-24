import { NextRequest, NextResponse } from "next/server";
import { createStorageClient } from "@/lib/db/storage";
import { isPlainPostgres } from "@/lib/db/mode";
import { compressImageBuffer } from "@/lib/image-compress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Supabase Storage upload:
 *   POST /storage/v1/object/{bucket}/{path}
 *   body = raw file bytes
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ bucket: string; path: string[] }> }
) {
  if (!isPlainPostgres()) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 503 });
  }

  const { bucket, path } = await ctx.params;
  const objectPath = path.map(decodeURIComponent).join("/");
  const upsert = (req.headers.get("x-upsert") || "").toLowerCase() === "true";
  const reqContentType = req.headers.get("content-type") || "";

  // Browser supabase-js wraps File/Blob uploads in multipart FormData
  // (field name "" plus a cacheControl field); Node/server callers send
  // raw bytes. Handle both.
  let buf: Buffer;
  let contentType = reqContentType || "application/octet-stream";
  if (reqContentType.includes("multipart/form-data")) {
    const form = await req.formData();
    let file: File | null = null;
    for (const [, value] of form.entries()) {
      if (value instanceof File) {
        file = value;
        break;
      }
    }
    if (!file) {
      return NextResponse.json(
        { error: "No file found in multipart body" },
        { status: 400 }
      );
    }
    buf = Buffer.from(await file.arrayBuffer());
    contentType = file.type || "application/octet-stream";
  } else {
    buf = Buffer.from(await req.arrayBuffer());
  }

  const compressed = await compressImageBuffer(buf, contentType);
  buf = compressed.buffer;
  contentType = compressed.contentType;

  const storage = createStorageClient();
  const { data, error } = await storage.from(bucket).upload(objectPath, buf, {
    contentType,
    upsert,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: pub } = storage.from(bucket).getPublicUrl(objectPath);
  return NextResponse.json({
    Key: `${bucket}/${objectPath}`,
    Id: data?.path,
    ...data,
    publicUrl: pub.publicUrl,
  });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ bucket: string; path: string[] }> }
) {
  if (!isPlainPostgres()) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 503 });
  }
  const { bucket, path } = await ctx.params;
  const objectPath = path.map(decodeURIComponent).join("/");
  const storage = createStorageClient();
  const { error } = await storage.from(bucket).remove([objectPath]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({});
}
