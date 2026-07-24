/**
 * Compress raster assets in /public (WebP + smaller originals).
 * Usage: node scripts/compress-public-images.mjs
 */
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const MAX_WIDTH = { hero: 1600, content: 1200, logo: 640, icon: 512 };
const WEBP_QUALITY = 78;
const JPEG_QUALITY = 82;

function profile(rel) {
  const p = rel.replace(/\\/g, '/').toLowerCase();
  if (p.includes('/icons/') || p.includes('favicon')) return 'icon';
  if (p.includes('logo')) return 'logo';
  if (p.includes('hero') || p.startsWith('heroes/')) return 'hero';
  return 'content';
}

async function walk(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, files);
    else files.push(full);
  }
  return files;
}

async function compressOne(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) return null;

  const rel = path.relative(PUBLIC, filePath);
  const prof = profile(rel);
  if (rel.replace(/\\/g, '/').includes('icons/')) return null;

  const maxW = MAX_WIDTH[prof];
  const stat = await fs.stat(filePath);
  if (stat.size < 20 * 1024 && prof === 'icon') return null;

  const input = await fs.readFile(filePath);
  let pipeline = sharp(input, { failOn: 'none' }).rotate();
  const meta = await pipeline.metadata();
  if (meta.width && meta.width > maxW) {
    pipeline = pipeline.resize(maxW, null, { withoutEnlargement: true });
  }

  const webpPath = filePath.replace(/\.(png|jpe?g)$/i, '.webp');
  const webpBuf = await pipeline.clone().webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer();
  await fs.writeFile(webpPath, webpBuf);

  let afterOriginal = stat.size;
  const dropOriginal = webpBuf.length < stat.size * 0.85 && prof !== 'logo';

  if (dropOriginal) {
    await fs.unlink(filePath);
    afterOriginal = 0;
  } else if (ext === '.png') {
    const pngBuf = await pipeline
      .png({ compressionLevel: 9, effort: 7, palette: !meta.hasAlpha })
      .toBuffer();
    if (pngBuf.length < stat.size) {
      await fs.writeFile(filePath, pngBuf);
      afterOriginal = pngBuf.length;
    }
  } else {
    const jpegBuf = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
    if (jpegBuf.length < stat.size) {
      await fs.writeFile(filePath, jpegBuf);
      afterOriginal = jpegBuf.length;
    }
  }

  const saved = stat.size + (dropOriginal ? 0 : 0) - webpBuf.length - (dropOriginal ? 0 : afterOriginal);
  return {
    rel,
    beforeKB: Math.round(stat.size / 1024),
    webpKB: Math.round(webpBuf.length / 1024),
    afterKB: dropOriginal ? 0 : Math.round(afterOriginal / 1024),
    dropped: dropOriginal,
  };
}

const files = await walk(PUBLIC);
let totalBefore = 0;
let totalAfter = 0;

for (const f of files) {
  const r = await compressOne(f);
  if (!r) continue;
  totalBefore += r.beforeKB;
  totalAfter += r.webpKB + r.afterKB;
  console.log(
    `${r.rel}: ${r.beforeKB}KB -> webp ${r.webpKB}KB${r.dropped ? ' (removed original)' : r.afterKB ? ` + orig ${r.afterKB}KB` : ''}`
  );
}

console.log(`\nDone. Approx total: ${totalBefore}KB -> ${totalAfter}KB`);
