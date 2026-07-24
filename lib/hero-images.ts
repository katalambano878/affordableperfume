/** Storefront page hero background images (under /public/heroes). */
export const HERO_IMAGES = {
  perfumes: '/heroes/hero-perfumes.webp',
  shipping: '/heroes/hero-shipping.webp',
  about: '/heroes/hero-about.webp',
  support: '/heroes/hero-support.webp',
  tracking: '/heroes/hero-tracking.webp',
} as const;

export type HeroImageKey = keyof typeof HERO_IMAGES;

/** Prefer .webp for static paths under /public when PNG/JPEG was replaced by compress script. */
export function preferWebpStaticPath(src: string): string {
  if (!src.startsWith('/') || src.startsWith('//')) return src;
  if (/\.(webp|svg|gif|avif)$/i.test(src)) return src;
  if (/\.(png|jpe?g)$/i.test(src)) return src.replace(/\.(png|jpe?g)$/i, '.webp');
  return src;
}
