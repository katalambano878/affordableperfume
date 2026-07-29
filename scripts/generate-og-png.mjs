import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'og.png');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="50%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="540" y="180" width="120" height="120" rx="24" fill="rgba(255,255,255,0.2)"/>
  <text x="600" y="255" text-anchor="middle" font-family="Arial,sans-serif" font-size="48" font-weight="700" fill="white">AP</text>
  <text x="600" y="370" text-anchor="middle" font-family="Arial,sans-serif" font-size="56" font-weight="700" fill="white">Affordable Perfumes</text>
  <text x="600" y="420" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="rgba(255,255,255,0.9)">Authentic fragrances delivered across Ghana</text>
</svg>
`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log('Wrote', out);
