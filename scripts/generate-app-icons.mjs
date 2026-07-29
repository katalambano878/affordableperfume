import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function makeIcon(size, outRel, radius) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <text x="${size / 2}" y="${size * 0.62}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${Math.round(size * 0.42)}" font-weight="700" fill="white">AP</text>
</svg>`;
  const out = join(root, outRel);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log('Wrote', out);
}

await makeIcon(32, 'app/icon.png', 8);
await makeIcon(180, 'app/apple-icon.png', 36);
