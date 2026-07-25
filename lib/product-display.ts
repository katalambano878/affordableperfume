import { resolveStorageUrl } from '@/lib/storage-url';

/** Same-origin placeholder — avoids SW/third-party failures from via.placeholder.com */
export const PRODUCT_IMAGE_PLACEHOLDER = '/images/product-placeholder.svg';

export function resolveProductImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return PRODUCT_IMAGE_PLACEHOLDER;
  }
  return resolveStorageUrl(url);
}

export function sortProductImages(
  images: { url?: string | null; position?: number | null }[] | null | undefined
): string[] {
  if (!images?.length) return [];
  return [...images]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((img) => resolveProductImageUrl(img.url))
    .filter(Boolean);
}

type VariantLike = {
  price?: number | null;
  quantity?: number | null;
  stock?: number | null;
};

/** Match shop grid logic: variant stock sums and minimum variant price. */
export function getProductCommerce(
  basePrice: number | null | undefined,
  baseQuantity: number | null | undefined,
  variants: VariantLike[] | null | undefined,
  selectedVariant?: VariantLike | null
) {
  const list = variants || [];
  const hasVariants = list.length > 0;
  const totalVariantStock = hasVariants
    ? list.reduce((sum, v) => sum + (v.quantity ?? v.stock ?? 0), 0)
    : 0;
  const baseStock = baseQuantity ?? 0;
  const effectiveStock = hasVariants ? totalVariantStock : baseStock;

  const variantPrices = list
    .map((v) => v.price)
    .filter((p): p is number => typeof p === 'number' && p > 0);
  const minVariantPrice =
    hasVariants && variantPrices.length > 0 ? Math.min(...variantPrices) : undefined;

  const price = basePrice ?? 0;
  const activePrice = selectedVariant?.price ?? price;
  const displayPrice =
    selectedVariant != null
      ? activePrice
      : hasVariants && minVariantPrice != null
        ? minVariantPrice
        : price;

  const activeStock =
    selectedVariant != null
      ? selectedVariant.quantity ?? selectedVariant.stock ?? 0
      : effectiveStock;

  return {
    hasVariants,
    minVariantPrice,
    effectiveStock,
    displayPrice,
    activePrice,
    activeStock,
    inStock: activeStock > 0,
  };
}
