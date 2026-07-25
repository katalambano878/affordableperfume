const PLACEHOLDER = '/images/product-placeholder.svg';

/** Normalize product/storage paths saved at checkout into browser-loadable URLs. */
export function resolveStorageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return PLACEHOLDER;

  const trimmed = url.trim();
  if (!trimmed) return PLACEHOLDER;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;

  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (path.startsWith('/storage/')) return path;

  // Bare object keys from legacy uploads
  if (!path.includes('/')) {
    return `/storage/v1/object/public/products/${encodeURI(path.replace(/^\//, ''))}`;
  }

  return path;
}
