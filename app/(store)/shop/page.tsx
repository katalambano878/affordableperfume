'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePageTitle } from '@/hooks/usePageTitle';
import ProductCard, { type ColorVariant } from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import { getColorHex } from '@/components/ProductCard';
import { supabase } from '@/lib/supabase';
import { cachedQuery } from '@/lib/query-cache';
import {
  getProductCommerce,
  PRODUCT_IMAGE_PLACEHOLDER,
  sortProductImages,
} from '@/lib/product-display';
import PageHero from '@/components/PageHero';

function formatShopProduct(p: any) {
  const variants = Array.isArray(p?.product_variants) ? p.product_variants : [];
  const colorVariants: ColorVariant[] = [];
  const seenColors = new Set<string>();
  for (const v of variants) {
    const colorName = typeof v?.option2 === 'string' ? v.option2 : '';
    if (colorName && !seenColors.has(colorName.toLowerCase().trim())) {
      const hex = getColorHex(colorName);
      if (hex) {
        seenColors.add(colorName.toLowerCase().trim());
        colorVariants.push({ name: colorName.trim(), hex });
      }
    }
  }

  const images = sortProductImages(Array.isArray(p?.product_images) ? p.product_images : []);
  const price = Number(p?.price);
  const compareAt = Number(p?.compare_at_price);
  const commerce = getProductCommerce(
    Number.isFinite(price) ? price : 0,
    Number(p?.quantity) || 0,
    variants
  );

  return {
    id: p.id,
    slug: p.slug || p.id,
    name: p.name || 'Product',
    price: Number.isFinite(price) ? price : 0,
    originalPrice: Number.isFinite(compareAt) && compareAt > 0 ? compareAt : undefined,
    image: images[0] || PRODUCT_IMAGE_PLACEHOLDER,
    rating: Number(p.rating_avg) || 0,
    reviewCount: 0,
    badge: Number.isFinite(compareAt) && compareAt > price ? 'Sale' : undefined,
    inStock: commerce.inStock,
    maxStock: commerce.effectiveStock || 50,
    moq: p.moq || 1,
    category: p.categories?.name,
    hasVariants: commerce.hasVariants,
    minVariantPrice: commerce.minVariantPrice,
    colorVariants,
    notes: p.metadata?.scent_notes,
    origin: p.metadata?.origin,
  };
}

function ShopContent() {
  usePageTitle('Shop All Perfumes');
  const searchParams = useSearchParams();

  // State
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([{ id: 'all', name: 'All Perfumes', count: 0 }]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState([0, 5000]);
  const [selectedRating, setSelectedRating] = useState(0);
  const [sortBy, setSortBy] = useState('popular');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const productsPerPage = 12;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef(categories);
  const productsLenRef = useRef(0);
  const search = searchParams.get('search') || '';
  const filterSignature = `${selectedCategory}|${priceRange.join('-')}|${selectedRating}|${sortBy}|${search}|${featuredOnly}`;

  categoriesRef.current = categories;
  productsLenRef.current = products.length;

  // Initialize from URL params
  useEffect(() => {
    const category = searchParams.get('category');
    const sort = searchParams.get('sort');
    const featured = searchParams.get('featured');

    try {
      if (category) setSelectedCategory(decodeURIComponent(category));
    } catch {
      if (category) setSelectedCategory(category);
    }
    if (sort) setSortBy(sort);
    setFeaturedOnly(featured === 'true' || featured === '1');
  }, [searchParams]);

  // Fetch Categories from cached API (does not remount product grid)
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/storefront/categories');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) setCategories(data);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    }
    fetchCategories();
  }, []);

  const prevFilterRef = useRef(filterSignature);

  // Fetch Products (initial + infinite scroll pages)
  useEffect(() => {
    const filterChanged = prevFilterRef.current !== filterSignature;
    if (filterChanged) {
      prevFilterRef.current = filterSignature;
      if (offset !== 0) {
        setOffset(0);
        setProducts([]);
        setTotalProducts(0);
        return;
      }
      setProducts([]);
      setTotalProducts(0);
    }

    let cancelled = false;

    async function fetchProducts() {
      const isInitial = offset === 0;
      // Only skeleton the grid when we have nothing to show (avoids scroll jump)
      if (isInitial) {
        if (filterChanged || productsLenRef.current === 0) setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const cats = categoriesRef.current;
        const applyShopFilters = (query: any, forCount = false) => {
          query = query
            .eq('status', 'active')
            .or('is_wholesale.is.null,is_wholesale.eq.false');

          if (search) {
            query = query.ilike('name', `%${search}%`);
          }

          if (selectedCategory !== 'all') {
            const categoryObj = cats.find((c) => c.slug === selectedCategory);
            if (categoryObj) {
              const childIds = cats
                .filter((c) => c.parent_id === categoryObj.id)
                .map((c) => c.id);
              const targetSlugs = [
                selectedCategory,
                ...cats.filter((c) => c.parent_id === categoryObj.id).map((c) => c.slug),
              ];
              query = forCount
                ? query.in('category_id', [categoryObj.id, ...childIds])
                : query.in('categories.slug', targetSlugs);
            } else if (!forCount) {
              query = query.eq('categories.slug', selectedCategory);
            }
          }

          if (priceRange[1] < 5000) {
            query = query.gte('price', priceRange[0]).lte('price', priceRange[1]);
          }

          if (selectedRating > 0) {
            query = query.gte('rating_avg', selectedRating);
          }

          if (featuredOnly) {
            query = query.eq('featured', true);
          }

          return query;
        };

        const cacheKey = `shop:v3:${filterSignature}:${offset}`;

        const { data, error } = await cachedQuery<{ data: any; error: any }>(
          cacheKey,
          async () => {
            let query = supabase
              .from('products')
              .select(`
                *,
                categories(name, slug),
                product_images(url, position),
                product_variants(id, name, price, quantity, option1, option2, image_url)
              `);

            query = applyShopFilters(query, false);

            switch (sortBy) {
              case 'price-low':
                query = query.order('price', { ascending: true }).order('id', { ascending: true });
                break;
              case 'price-high':
                query = query.order('price', { ascending: false }).order('id', { ascending: true });
                break;
              case 'rating':
                query = query.order('rating_avg', { ascending: false }).order('id', { ascending: true });
                break;
              case 'new':
                query = query.order('created_at', { ascending: false }).order('id', { ascending: true });
                break;
              case 'popular':
              default:
                query = query.order('created_at', { ascending: false }).order('id', { ascending: true });
                break;
            }

            const from = offset;
            const to = from + productsPerPage - 1;
            query = query.range(from, to);

            return query as any;
          },
          2 * 60 * 1000
        );

        if (cancelled) return;
        if (error) throw error;

        let total: number | null = null;
        if (isInitial) {
          let countQuery = supabase.from('products').select('id', { count: 'exact' }).limit(1);
          countQuery = applyShopFilters(countQuery, true);
          const { count, error: countError } = await countQuery;
          if (countError) console.warn('Shop count error:', countError);
          if (typeof count === 'number' && count >= 0) total = count;
        }

        if (cancelled) return;

        if (Array.isArray(data)) {
          const formattedProducts = data.map(formatShopProduct);
          setProducts((prev) => {
            if (isInitial) return formattedProducts;
            const ids = new Set(prev.map((p) => p.id));
            const next = formattedProducts.filter((p: { id: string }) => !ids.has(p.id));
            return [...prev, ...next];
          });

          if (total != null) {
            setTotalProducts(total);
          } else if (!isInitial) {
            setTotalProducts((prev) => {
              const loaded = offset + formattedProducts.length;
              if (formattedProducts.length >= productsPerPage) {
                return Math.max(loaded + 1, prev);
              }
              return Math.max(loaded, prev);
            });
          } else {
            setTotalProducts(
              formattedProducts.length >= productsPerPage
                ? formattedProducts.length + 1
                : formattedProducts.length
            );
          }
        }
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    fetchProducts();
    return () => {
      cancelled = true;
    };
    // categories intentionally omitted — read via ref so sidebar load doesn't jump the grid
    // eslint-disable-next-line react-hooks/exhaustive-deps -- products.length only gates skeleton; filterSignature covers filters
  }, [offset, filterSignature]);

  const displayedTotal = Math.max(totalProducts, products.length);
  const hasMore = products.length > 0 && products.length < displayedTotal;

  const clearAllFilters = () => {
    setSelectedCategory('all');
    setPriceRange([0, 5000]);
    setSelectedRating(0);
    setFeaturedOnly(false);
    setSortBy('popular');
    setOffset(0);
    setIsFilterOpen(false);
  };

  const loadNextPage = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setOffset((prev) => prev + productsPerPage);
  }, [loading, loadingMore, hasMore, productsPerPage]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadNextPage();
      },
      { root: null, rootMargin: '120px 0px', threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadNextPage]);

  return (
    <main className="min-h-screen bg-white">
      <PageHero
        title="Shop All Perfumes"
        subtitle="Browse designer, niche, and everyday fragrances with fast delivery across Ghana"
      />

      {/* Mobile Filter Toggle */}
      <div className="lg:hidden bg-white border-b border-gray-200 py-4 px-4 sticky top-[72px] z-20">
        <div className="flex justify-between items-center">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center space-x-2 text-gray-900 font-medium"
          >
            <i className="ri-filter-3-line text-xl"></i>
            <span>Filters & Sort</span>
          </button>
          <span className="text-sm text-gray-500">{displayedTotal} Products</span>
        </div>
      </div>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row gap-8">
            <aside className={`${isFilterOpen ? 'fixed inset-0 z-50 bg-white overflow-y-auto' : 'hidden'} lg:block lg:w-64 lg:flex-shrink-0 lg:self-start`}>
              <div className="lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:overscroll-contain">
                <div className="bg-white lg:bg-transparent p-6 lg:p-0">
                  <div className="flex items-center justify-between mb-6 lg:hidden">
                    <h2 className="text-xl font-bold text-gray-900">Filters</h2>
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="w-10 h-10 flex items-center justify-center text-gray-700"
                    >
                      <i className="ri-close-line text-2xl"></i>
                    </button>
                  </div>

                  <div className="space-y-8">
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="w-full border-2 border-gray-300 text-gray-800 py-2.5 rounded-lg font-semibold hover:bg-gray-50"
                    >
                      Clear all filters
                    </button>

                    {/* Categories */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-4">Categories</h3>
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory('all');
                            setFeaturedOnly(false);
                            setIsFilterOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${selectedCategory === 'all' && !featuredOnly
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                          All Perfumes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory('all');
                            setFeaturedOnly(false);
                            setSelectedRating(0);
                            setPriceRange([0, 5000]);
                            setIsFilterOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 rounded-lg transition-colors text-gray-700 hover:bg-gray-100"
                        >
                          None (reset filters)
                        </button>

                        {/* Parent Categories */}
                        {categories.filter(c => !c.parent_id && c.id !== 'all').map(parent => {
                          const subcategories = categories.filter(c => c.parent_id === parent.id);
                          const isSelected = selectedCategory === parent.slug;
                          const isChildSelected = subcategories.some(sub => sub.slug === selectedCategory);
                          const isOpen = isSelected || isChildSelected; // Auto-expand if selected

                          return (
                            <div key={parent.id} className="space-y-1">
                              <button
                                onClick={() => {
                                  setSelectedCategory(parent.slug);
                                }}
                                className={`w-full text-left px-4 py-2 rounded-lg transition-colors flex justify-between items-center ${isSelected
                                  ? 'bg-blue-50 text-blue-700 font-medium'
                                  : 'text-gray-700 hover:bg-gray-100'
                                  }`}
                              >
                                <span>{parent.name}</span>
                              </button>

                              {/* Subcategories */}
                              {subcategories.length > 0 && (
                                <div className="ml-4 border-l-2 border-gray-100 pl-2 space-y-1">
                                  {subcategories.map(child => (
                                    <button
                                      key={child.id}
                                      onClick={() => {
                                        setSelectedCategory(child.slug);
                                        setIsFilterOpen(false);
                                      }}
                                      className={`w-full text-left px-4 py-1.5 rounded-lg text-sm transition-colors ${selectedCategory === child.slug
                                        ? 'text-blue-700 font-medium bg-blue-50'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                      {child.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Price Range */}
                    <div className="border-t border-gray-200 pt-8">
                      <h3 className="font-semibold text-gray-900 mb-4">Max Price: GH₵{priceRange[1]}</h3>
                      <div className="space-y-4">
                        <input
                          type="range"
                          min="0"
                          max="5000"
                          step="50"
                          value={priceRange[1]}
                          onChange={(e) => {
                            setPriceRange([0, parseInt(e.target.value)]);
                          }}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-700"
                        />
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>GH₵0</span>
                          <span>GH₵5000+</span>
                        </div>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="border-t border-gray-200 pt-8">
                      <h3 className="font-semibold text-gray-900 mb-4">Rating</h3>
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRating(0)}
                          className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                            selectedRating === 0
                              ? 'bg-blue-100 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          Any rating
                        </button>
                        {[4, 3, 2, 1].map(rating => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => {
                              setSelectedRating(rating === selectedRating ? 0 : rating);
                            }}
                            className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${selectedRating === rating
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-100'
                              }`}
                          >
                            <div className="flex items-center space-x-2">
                              {[1, 2, 3, 4, 5].map(star => (
                                <i
                                  key={star}
                                  className={`${star <= rating ? 'ri-star-fill text-amber-400' : 'ri-star-line text-gray-300'} text-sm`}
                                ></i>
                              ))}
                              <span className="text-sm">& Up</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      className="w-full bg-gray-900 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors whitespace-nowrap"
                    >
                      Show Results
                    </button>
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex-1">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <p className="text-gray-600">
                  Showing <span className="font-semibold text-gray-900">{products.length}</span> of{' '}
                  <span className="font-semibold text-gray-900">{displayedTotal}</span> products
                  {featuredOnly ? (
                    <span className="ml-2 text-blue-700 text-sm font-medium">· Featured</span>
                  ) : null}
                  {selectedCategory !== 'all' ? (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="ml-2 text-blue-700 text-sm font-medium underline"
                    >
                      Clear filters
                    </button>
                  ) : null}
                </p>

                <div className="flex items-center space-x-3">
                  <label className="text-sm text-gray-600 whitespace-nowrap">Sort by:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                    }}
                    className="px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white cursor-pointer"
                  >
                    <option value="popular">All (default)</option>
                    <option value="new">Newest</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="rating">Highest Rated</option>
                  </select>
                </div>
              </div>

              {loading && products.length === 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                  {[...Array(8)].map((_, i) => (
                    <ProductCardSkeleton key={i} compact />
                  ))}
                </div>
              ) : (
                <>
                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 items-stretch"
                    data-product-shop
                  >
                    {products.map((product) => (
                      <div key={product.id} className="min-w-0 h-full">
                        <ProductCard {...product} compact />
                      </div>
                    ))}
                  </div>

                  {!loading && products.length === 0 && (
                    <div className="text-center py-20">
                      <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 bg-gray-100 rounded-full">
                        <i className="ri-inbox-line text-4xl text-gray-400"></i>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">No Products Found</h3>
                      <p className="text-gray-600 mb-8">Try adjusting your filters to find what you&apos;re looking for</p>
                      <button
                        onClick={() => {
                          setSelectedCategory('all');
                          setPriceRange([0, 5000]);
                          setSelectedRating(0);
                        }}
                        className="inline-flex items-center bg-gray-900 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  )}

                  {hasMore && (
                    <div ref={loadMoreRef} className="mt-8 flex justify-center py-6 min-h-[56px]" aria-hidden="true">
                      {loadingMore && (
                        <div className="w-10 h-10 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                  )}

                  {!loading && !loadingMore && !hasMore && products.length > 0 && (
                    <p className="mt-12 text-center text-sm text-gray-500">You&apos;ve seen all {displayedTotal} products</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full animate-spin"></div></div>}>
      <ShopContent />
    </Suspense>
  );
}