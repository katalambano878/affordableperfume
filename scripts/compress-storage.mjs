/**
 * Batch-compress files under STORAGE_ROOT (product/category uploads on VPS).
 * Usage: STORAGE_ROOT=/var/www/.../uploads node scripts/compress-storage.mjs
 */
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');

const ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), '.storage');
const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 78;

async function walk(dir, files = []) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full, files);
      else if (/\.(jpe?g|png|webp)$/i.test(e.name) && !e.name.endsWith('.meta.json')) files.push(full);
    }
  } catch {
    /* missing root */
  }
  return files;
}

async function compressFile(filePath) {
  const before = await fs.stat(filePath);
  if (before.size < 40 * 1024) return null;

  const input = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  let pipeline = sharp(input, { failOn: 'none' }).rotate();
  const meta = await pipeline.metadata();
  if (!meta.width) return null;

  if (meta.width > MAX_DIMENSION || (meta.height && meta.height > MAX_DIMENSION)) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  let out;
  if (ext === '.png') {
    out = await pipeline.png({ compressionLevel: 9, effort: 7, palette: !meta.hasAlpha }).toBuffer();
  } else if (ext === '.webp') {
    out = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
  } else {
    out = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  }

  if (out.length >= before.size * 0.95) return null;
  await fs.writeFile(filePath, out);
  return { rel: path.relative(ROOT, filePath), before: before.size, after: out.length };
}

const files = await walk(ROOT);
let saved = 0;
for (const f of files) {
  const r = await compressFile(f);
  if (r) {
    saved += r.before - r.after;
    console.log(`${r.rel}: ${Math.round(r.before / 1024)}KB -> ${Math.round(r.after / 1024)}KB`);
  }
}
console.log(`\nStorage compress complete. Saved ~${Math.round(saved / 1024)}KB under ${ROOT}`);
