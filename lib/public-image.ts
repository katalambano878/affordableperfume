import { preferWebpStaticPath } from '@/lib/hero-images';

/** Map legacy PNG/JPEG public URLs to WebP when available. */
export function optimizePublicImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return preferWebpStaticPath(trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
}

export { preferWebpStaticPath } from '@/lib/hero-images';
