'use client';

import { useState } from 'react';
import Link from 'next/link';
import LazyImage from './LazyImage';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

// Map common color names to hex values
const COLOR_MAP: Record<string, string> = {
  black: '#000000', white: '#FFFFFF', red: '#EF4444', blue: '#3B82F6',
  navy: '#1E3A5F', green: '#22C55E', yellow: '#EAB308', orange: '#F97316',
  pink: '#EC4899', purple: '#A855F7', brown: '#92400E', beige: '#D4C5A9',
  grey: '#6B7280', gray: '#6B7280', cream: '#FFFDD0', teal: '#14B8A6',
  maroon: '#800000', coral: '#FF7F50', burgundy: '#800020', olive: '#808000',
  tan: '#D2B48C', khaki: '#C3B091', charcoal: '#36454F', ivory: '#FFFFF0',
  gold: '#FFD700', silver: '#C0C0C0', rose: '#FF007F', lavender: '#E6E6FA',
  mint: '#98FB98', peach: '#FFDAB9', wine: '#722F37', denim: '#1560BD',
  nude: '#E3BC9A', camel: '#C19A6B', sage: '#BCB88A', rust: '#B7410E',
  mustard: '#FFDB58', plum: '#8E4585', lilac: '#C8A2C8', stone: '#928E85',
  sand: '#C2B280', taupe: '#483C32', mauve: '#E0B0FF', sky: '#87CEEB',
  forest: '#228B22', cobalt: '#0047AB', emerald: '#50C878', scarlet: '#FF2400',
  aqua: '#00FFFF', turquoise: '#40E0D0', indigo: '#4B0082', crimson: '#DC143C',
  magenta: '#FF00FF', cyan: '#00FFFF', chocolate: '#7B3F00', coffee: '#6F4E37',
};

export function getColorHex(colorName: string): string | null {
  const lower = colorName.toLowerCase().trim();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

export interface ColorVariant {
  name: string;
  hex: string;
}

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  inStock?: boolean;
  maxStock?: number;
  moq?: number;
  hasVariants?: boolean;
  minVariantPrice?: number;
  colorVariants?: ColorVariant[];
  // New props for Glassmorphism design
  notes?: string;
  origin?: string;
  /** Tighter layout for shop / dense grids */
  compact?: boolean;
}

export default function ProductCard({
  id,
  slug,
  name,
  price,
  originalPrice,
  image,
  rating = 5,
  reviewCount = 0,
  badge,
  inStock = true,
  maxStock = 50,
  moq = 1,
  hasVariants = false,
  minVariantPrice,
  colorVariants = [],
  notes,
  origin,
  compact = false,
}: ProductCardProps) {
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const isWishlisted = isInWishlist(id);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const safePrice = Number(price);
  const safeMinVariant = minVariantPrice != null ? Number(minVariantPrice) : NaN;
  const displayPrice =
    hasVariants && Number.isFinite(safeMinVariant) && safeMinVariant > 0
      ? safeMinVariant
      : Number.isFinite(safePrice)
        ? safePrice
        : 0;
  const safeOriginal = originalPrice != null ? Number(originalPrice) : NaN;
  const discount =
    Number.isFinite(safeOriginal) && safeOriginal > displayPrice
      ? Math.round((1 - displayPrice / safeOriginal) * 100)
      : 0;
  const MAX_SWATCHES = 4;

  const formatPrice = (val: number) =>
    `GH\u20B5${(Number.isFinite(Number(val)) ? Number(val) : 0).toFixed(2)}`;

  return (
    <div className="group relative w-full h-full">
      <div
        className={`relative flex flex-col h-full w-full bg-white border border-gray-100 rounded-xl overflow-hidden transition-shadow duration-300 hover:shadow-md ${compact ? '' : 'max-w-[280px] mx-auto'}`}
      >

        {/* Image Container with Overlay — fixed aspect ratio prevents scroll jump */}
        <Link
          href={`/product/${slug}`}
          className={`relative block shrink-0 overflow-hidden bg-gray-50 ${compact ? 'aspect-[4/5]' : 'aspect-square'}`}
        >
          <div className="absolute inset-0 p-2">
            <LazyImage
              src={image}
              alt={name}
              className="w-full h-full"
              imgClassName="object-contain"
            />
          </div>

          {/* Scent Notes Overlay (Hover) */}
          {notes && (
            <div className="absolute inset-0 bg-ebony/70 backdrop-blur-[3px] opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center text-center p-6 text-white translate-y-4 group-hover:translate-y-0 z-10">
              <h4 className="font-serif text-2xl text-champagne-gold mb-3 italic">Notes</h4>
              <p className="text-sm font-light leading-relaxed opacity-90">{notes}</p>
              <div className="w-8 h-px bg-champagne-gold/50 my-4"></div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">View Scent Profile</span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 z-20">
            {badge && (
              <span className="bg-white/90 backdrop-blur text-ebony text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full shadow-sm">
                {badge}
              </span>
            )}
            {discount > 0 && (
              <span className="bg-red-50 text-red-700 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full shadow-sm">
                -{discount}%
              </span>
            )}
            {!inStock && (
              <span className="bg-ebony text-white text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full shadow-sm">
                Out of Stock
              </span>
            )}
          </div>

          {/* Wishlist Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isWishlisted) {
                removeFromWishlist(id);
              } else {
                addToWishlist({
                  id,
                  name,
                  price,
                  originalPrice,
                  image,
                  rating,
                  inStock: inStock || false,
                  slug,
                  notes,
                  origin
                });
              }
            }}
            className={`absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full shadow-md transition-all duration-300 z-20 ${isWishlisted ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-500 hover:bg-white'
              } backdrop-blur-md border border-white/40 group/wishlist`}
          >
            <i className={`${isWishlisted ? 'ri-heart-fill' : 'ri-heart-line'} text-base group-hover/wishlist:scale-110 transition-transform`}></i>
          </button>
        </Link>

        {/* Content Body — reserved heights keep rows aligned while scrolling */}
        <div className={`flex flex-col flex-grow text-center ${compact ? 'px-2 pb-2 pt-1.5' : 'px-2.5 sm:px-3 pb-2.5 sm:pb-3 pt-1.5'}`}>
          <div className={`mb-1 flex items-center justify-center ${compact ? 'min-h-[1.1rem]' : 'min-h-[1.5rem] mb-2'}`}>
            {origin ? (
              <span className="inline-block text-[10px] uppercase tracking-[0.15em] text-gray-400 border border-gray-100 rounded-full px-2 py-0.5 bg-white/50 truncate max-w-full">
                {origin}
              </span>
            ) : null}
          </div>

          <Link href={`/product/${slug}`} className="group/title">
            <h3
              className={`font-serif text-ebony mb-1 group-hover/title:text-champagne-dark transition-colors leading-snug line-clamp-2 ${compact ? 'text-xs sm:text-sm min-h-[2.4rem]' : 'text-sm sm:text-base min-h-[2.75rem]'}`}
            >
              {name}
            </h3>
          </Link>

          <div className="flex items-center justify-center space-x-2 mb-1 min-h-[1.25rem]">
            <span className="text-ebony text-sm font-semibold">{formatPrice(displayPrice)}</span>
            {Number.isFinite(safeOriginal) && safeOriginal > displayPrice && (
              <span className="text-xs text-gray-400 line-through">{formatPrice(safeOriginal)}</span>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 mb-1 min-h-[0.85rem]">
            {colorVariants.length > 0 ? (
              <>
                {colorVariants.slice(0, MAX_SWATCHES).map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    title={color.name}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveColor(activeColor === color.name ? null : color.name);
                    }}
                    className={`w-3 h-3 rounded-full border ${activeColor === color.name
                      ? 'ring-1 ring-offset-1 ring-champagne-gold'
                      : ''
                      } ${color.hex === '#FFFFFF' ? 'border-gray-300' : 'border-transparent'}`}
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
                {colorVariants.length > MAX_SWATCHES && (
                  <span className="text-[10px] text-gray-400">+{colorVariants.length - MAX_SWATCHES}</span>
                )}
              </>
            ) : null}
          </div>

          <div className="mt-auto pt-1 min-h-[2rem] flex items-end justify-center">
            {inStock ? (
              hasVariants ? (
                <Link
                  href={`/product/${slug}`}
                  className="w-full inline-block text-[10px] sm:text-xs uppercase tracking-widest font-bold text-gray-500 hover:text-ebony py-1.5 border-b border-gray-100 hover:border-ebony transition-colors"
                >
                  Select Options
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    addToCart({ id, name, price, image, quantity: moq, slug, maxStock, moq });
                  }}
                  className="w-full inline-block text-[10px] sm:text-xs uppercase tracking-widest font-bold text-gray-500 hover:text-ebony py-1.5 border-b border-gray-100 hover:border-champagne-gold transition-colors"
                >
                  Add to Cart
                </button>
              )
            ) : (
              <span className="text-xs text-gray-300 font-medium cursor-not-allowed">Unavailable</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
