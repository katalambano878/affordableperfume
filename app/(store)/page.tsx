'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import ProductCard, { type ColorVariant, getColorHex } from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import AnimatedSection, { AnimatedGrid } from '@/components/AnimatedSection';
import NewsletterSection from '@/components/NewsletterSection';
import { useCMS } from '@/context/CMSContext';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function Home() {
  usePageTitle('');
  const { getSetting } = useCMS();
  const siteLogo = getSetting('site_logo') || '';
  const siteName = getSetting('site_name') || '';

  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroBanners, setHeroBanners] = useState<any[]>([]);

  // Config State - Managed in Code
  const [currentSlide, setCurrentSlide] = useState(0);
  const defaultHeroSlides = [
    {
      image: '/hero-areej.webp',
      tag: 'Luxury Fragrances',
      heading: 'Areej Perfumes',
      subtext: 'Luxurious scents you can afford. Premium perfumes at unbeatable prices, delivered across Ghana.',
      cta: { text: 'Shop Perfumes', href: '/shop' },
      cta2: { text: 'View All', href: '/shop' }
    },
    {
      image: '/hero-armaf.webp',
      tag: 'Designer Perfumes',
      heading: 'Club de Nuit Intense Man',
      subtext: 'Discover Armaf and more designer fragrances. Authentic perfumes, nationwide delivery.',
      cta: { text: 'Shop Perfumes', href: '/shop' },
      cta2: { text: 'View All', href: '/shop' }
    }
  ];

  const isPerfumeCopy = (value: string) =>
    /perfume|fragrance|scent|cologne|eau|attar|oud|niche|aroma/i.test(value);

  const hasNonPerfumeCopy = (value: string) =>
    /electron|fashion|dress|clothing|apparel|shoe|bag|gadget|phone|laptop|furniture|home\s*decor|china\s*import/i.test(value);

  const sanitizeField = (dbValue: string | undefined, fallbackValue: string) => {
    if (!dbValue) return fallbackValue;
    if (hasNonPerfumeCopy(dbValue)) return fallbackValue;
    return dbValue;
  };

  const sanitizeHeroBanner = (banner: any, index: number) => {
    const fallback = defaultHeroSlides[index % defaultHeroSlides.length];

    return {
      image: banner?.image_url || fallback.image,
      media_type: banner?.media_type,
      tag: sanitizeField(banner?.name, fallback.tag),
      heading: sanitizeField(banner?.title, fallback.heading),
      subtext: sanitizeField(banner?.subtitle, fallback.subtext),
      cta: {
        text: sanitizeField(banner?.button_text, fallback.cta.text),
        href: banner?.button_url || '/shop'
      },
      cta2: { text: 'View All', href: '/shop' }
    };
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 2);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const config: {
    hero: {
      headline: string;
      subheadline: string;
      primaryButtonText: string;
      primaryButtonLink: string;
      secondaryButtonText: string;
      secondaryButtonLink: string;
      backgroundImage?: string;
    };
    banners?: Array<{ text: string; active: boolean }>;
  } = {
    hero: {
      headline: 'Premium Fragrances & Luxury Perfumes',
      subheadline: 'From signature scents to everyday essentials — authentic perfumes at unbeatable prices. Delivered across Ghana.',
      primaryButtonText: 'Shop Perfumes',
      primaryButtonLink: '/shop',
      secondaryButtonText: 'View All',
      secondaryButtonLink: '/shop',
      // backgroundImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop' // Optional override
    },
    banners: [
      { text: '🚚 Free delivery on perfume orders over GH₵ 500 within Accra!', active: false },
      { text: '✨ New fragrances arriving — pre-order now!', active: false },
      { text: '💳 Secure payments via Mobile Money & Card', active: false }
    ]
  };

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch Banners
        const { data: bannersData } = await supabase
          .from('banners')
          .select('*')
          .eq('position', 'hero')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (bannersData) {
          setHeroBanners(bannersData.map((b, index) => sanitizeHeroBanner(b, index)));
        }

        // Fetch featured products (exclude wholesale-only)
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*, product_variants(*), product_images(*)')
          .eq('status', 'active')
          .eq('featured', true)
          .or('is_wholesale.is.null,is_wholesale.eq.false')
          .order('created_at', { ascending: false })
          .limit(8);

        if (productsError) throw productsError;
        setFeaturedProducts(productsData || []);

        // Fetch featured categories (featured is stored in metadata JSONB)
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('id, name, slug, image_url, metadata')
          .eq('status', 'active')
          .order('name');

        if (categoriesError) throw categoriesError;

        // Filter by metadata.featured = true on client side
        const featuredCategories = (categoriesData || []).filter(
          (cat: any) => cat.metadata?.featured === true
        );
        setCategories(featuredCategories);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const getHeroImage = () => {
    if (config.hero.backgroundImage) return config.hero.backgroundImage;
    return siteLogo;
  };

  const renderBanners = () => {
    const activeBanners = config.banners?.filter(b => b.active) || [];
    if (activeBanners.length === 0) return null;

    return (
      <div className="bg-blue-900 text-white py-2 overflow-hidden relative">
        <div className="flex animate-marquee whitespace-nowrap">
          {activeBanners.concat(activeBanners).map((banner, index) => (
            <span key={index} className="mx-8 text-sm font-medium tracking-wide flex items-center">
              {banner.text}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="flex-col items-center justify-between min-h-screen">
      {renderBanners()}

      {/* Hero Section */}
      <section className="relative w-full h-[75vh] md:h-[85vh] overflow-hidden bg-stone-900">
        {heroBanners.length > 0 ? (
          heroBanners.map((slide, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            >
              {/* Background Media */}
              {slide.media_type === 'video' ? (
                <video
                  src={slide.image}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <div className={`absolute inset-0 w-full h-full transform transition-transform duration-[8000ms] ease-out ${index === currentSlide ? 'scale-110' : 'scale-100'}`}>
                  <Image
                    src={slide.image || '/hero-areej.webp'}
                    alt={`Hero Banner ${index + 1}`}
                    fill
                    className="object-cover"
                    priority={index === 0}
                    quality={72}
                    sizes="100vw"
                  />
                </div>
              )}

              {/* Gradient Overlay for Text Readability - Darker on the left for left-aligned text */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent z-[5]"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-[5] md:hidden"></div>

              {/* Slide Content - Left Aligned for Luxury Editorial Feel */}
              <div className="absolute inset-0 z-10 flex flex-col justify-center px-6 sm:px-12 md:px-20 lg:px-32 max-w-7xl mx-auto">
                <div className="max-w-2xl mt-12 md:mt-0">
                  <p
                    key={`tag-${currentSlide}`}
                    className="text-amber-300 text-xs sm:text-sm md:text-sm tracking-[0.3em] uppercase font-semibold mb-4 sm:mb-6 animate-fade-in-up"
                  >
                    {slide.tag}
                  </p>

                  <h1
                    key={`heading-${currentSlide}`}
                    className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif text-white mb-6 leading-[1.15] drop-shadow-sm animate-fade-in-up"
                    style={{ animationDelay: '0.1s' }}
                  >
                    {slide.heading}
                  </h1>

                  <p
                    key={`sub-${currentSlide}`}
                    className="text-base md:text-lg lg:text-xl text-white/90 mb-10 font-light tracking-wide leading-relaxed max-w-xl animate-fade-in-up"
                    style={{ animationDelay: '0.2s' }}
                  >
                    {slide.subtext}
                  </p>

                  <div
                    key={`cta-${currentSlide}`}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-fade-in-up w-full sm:w-auto"
                    style={{ animationDelay: '0.3s' }}
                  >
                    <Link
                      href={slide.cta.href || '/shop'}
                      className="w-full sm:w-auto inline-flex items-center justify-center bg-white text-black px-10 py-4 text-sm font-bold tracking-widest uppercase hover:bg-amber-50 hover:text-black transition-colors duration-300 min-w-[180px]"
                    >
                      {slide.cta.text}
                    </Link>
                    <Link
                      href={slide.cta2.href}
                      className="w-full sm:w-auto inline-flex items-center justify-center bg-transparent border border-white/70 text-white px-10 py-4 text-sm font-bold tracking-widest uppercase hover:bg-white hover:text-black transition-all duration-300 min-w-[180px]"
                    >
                      {slide.cta2.text}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          // Default hero slides when no banners in DB (perfume shop only)
          defaultHeroSlides.map((slide, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            >
              <div className={`absolute inset-0 w-full h-full transform transition-transform duration-[8000ms] ease-out ${index === currentSlide ? 'scale-110' : 'scale-100'}`}>
                <Image
                  src={slide.image}
                  alt={`Hero ${index + 1}`}
                  fill
                  className="object-cover"
                  priority={index === 0}
                  quality={72}
                  sizes="100vw"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent z-[5]"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-[5] md:hidden"></div>
              <div className="absolute inset-0 z-10 flex flex-col justify-center px-6 sm:px-12 md:px-20 lg:px-32 max-w-7xl mx-auto">
                <div className="max-w-2xl mt-12 md:mt-0">
                  <p className="text-amber-300 text-xs sm:text-sm md:text-sm tracking-[0.3em] uppercase font-semibold mb-4 sm:mb-6 animate-fade-in-up">{slide.tag}</p>
                  <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif text-white mb-6 leading-[1.15] drop-shadow-sm animate-fade-in-up">{slide.heading}</h1>
                  <p className="text-base md:text-lg lg:text-xl text-white/90 mb-10 font-light tracking-wide leading-relaxed max-w-xl animate-fade-in-up">{slide.subtext}</p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-fade-in-up w-full sm:w-auto">
                    <Link href={slide.cta.href} className="w-full sm:w-auto inline-flex items-center justify-center bg-white text-black px-10 py-4 text-sm font-bold tracking-widest uppercase hover:bg-amber-50 hover:text-black transition-colors duration-300 min-w-[180px]">
                      {slide.cta.text}
                    </Link>
                    <Link href={slide.cta2.href} className="w-full sm:w-auto inline-flex items-center justify-center bg-transparent border border-white/70 text-white px-10 py-4 text-sm font-bold tracking-widest uppercase hover:bg-white hover:text-black transition-all duration-300 min-w-[180px]">
                      {slide.cta2.text}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Bottom Features (Desktop) - Refined glassmorphism bar */}
        <div className="absolute bottom-0 left-0 right-0 z-20 hidden md:block bg-black/30 backdrop-blur-md border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 lg:px-32 py-5 flex justify-between items-center text-white">
            <div className="flex items-center gap-4 group cursor-pointer">
              <i className="ri-truck-line text-2xl text-amber-300 group-hover:scale-110 transition-transform"></i>
              <div>
                <p className="text-sm font-medium tracking-wide">Fast Delivery</p>
                <p className="text-[10px] text-white/60 tracking-widest uppercase mt-0.5">24 - 48 Hours Nationwide</p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="flex items-center gap-4 group cursor-pointer">
              <i className="ri-global-line text-2xl text-amber-300 group-hover:scale-110 transition-transform"></i>
              <div>
                <p className="text-sm font-medium tracking-wide">Authentic Sourcing</p>
                <p className="text-[10px] text-white/60 tracking-widest uppercase mt-0.5">Trusted Fragrance Supply</p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="flex items-center gap-4 group cursor-pointer">
              <i className="ri-verified-badge-line text-2xl text-amber-300 group-hover:scale-110 transition-transform"></i>
              <div>
                <p className="text-sm font-medium tracking-wide">Verified Quality</p>
                <p className="text-[10px] text-white/60 tracking-widest uppercase mt-0.5">Every Item Checked</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <AnimatedSection className="flex items-end justify-between mb-12">
            <div>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-gray-900 mb-4">Shop by Category</h2>
              <p className="text-gray-600 text-lg max-w-md">Explore perfumes by fragrance families and signature scent profiles</p>
            </div>
            <Link href="/categories" className="hidden md:flex items-center text-blue-800 font-medium hover:text-blue-900 transition-colors">
              View All <i className="ri-arrow-right-line ml-2"></i>
            </Link>
          </AnimatedSection>

          <AnimatedGrid className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 max-w-5xl lg:max-w-6xl mx-auto">
            {categories.map((category) => (
              <Link href={`/shop?category=${encodeURIComponent(category.slug)}`} key={category.id} className="group cursor-pointer block relative">
                <div className="aspect-[4/5] sm:aspect-[5/6] rounded-xl overflow-hidden relative shadow-md group-hover:shadow-lg transition-all duration-300">
                  <Image
                    src={category.image || category.image_url || 'https://via.placeholder.com/600x800?text=' + encodeURIComponent(category.name)}
                    alt={category.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    quality={75}
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>

                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 flex flex-col justify-end h-full">
                    <h3 className="font-serif font-bold text-white text-base sm:text-lg md:text-xl mb-0.5 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">{category.name}</h3>
                    <div className="flex items-center text-white/90 text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 delay-75">
                      <span className="uppercase tracking-wider text-xs">Shop Now</span>
                      <i className="ri-arrow-right-line ml-2 transition-transform group-hover:translate-x-1"></i>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </AnimatedGrid>

          <div className="mt-8 text-center md:hidden">
            <Link href="/categories" className="inline-flex items-center text-blue-800 font-medium hover:text-blue-900 transition-colors">
              View All <i className="ri-arrow-right-line ml-2"></i>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 md:py-24 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-gray-900 mb-4">Featured Perfumes</h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">Top picks from our latest fragrance arrivals</p>
          </AnimatedSection>

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-5xl mx-auto">
              {[...Array(4)].map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <AnimatedGrid className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-5xl mx-auto">
              {featuredProducts.map((product) => {
                const variants = product.product_variants || [];
                const hasVariants = variants.length > 0;
                const minVariantPrice = hasVariants ? Math.min(...variants.map((v: any) => v.price || product.price)) : undefined;
                const totalVariantStock = hasVariants ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) : 0;
                const effectiveStock = hasVariants ? totalVariantStock : product.quantity;

                // Extract unique colors from option2
                const colorVariants: ColorVariant[] = [];
                const seenColors = new Set<string>();
                for (const v of variants) {
                  const colorName = (v as any).option2;
                  if (colorName && !seenColors.has(colorName.toLowerCase().trim())) {
                    const hex = getColorHex(colorName);
                    if (hex) {
                      seenColors.add(colorName.toLowerCase().trim());
                      colorVariants.push({ name: colorName.trim(), hex });
                    }
                  }
                }

                return (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={product.slug}
                    name={product.name}
                    price={product.price}
                    originalPrice={product.compare_at_price}
                    image={product.product_images?.[0]?.url || 'https://via.placeholder.com/400x500'}
                    rating={product.rating_avg || 5}
                    reviewCount={product.review_count || 0}
                    badge={product.featured ? 'Featured' : undefined}
                    inStock={effectiveStock > 0}
                    maxStock={effectiveStock || 50}
                    moq={product.moq || 1}
                    hasVariants={hasVariants}
                    minVariantPrice={minVariantPrice}
                    colorVariants={colorVariants}
                    notes={product.metadata?.scent_notes}
                    origin={product.metadata?.origin}
                  />
                );
              })}
            </AnimatedGrid>
          )}

          <div className="text-center mt-16">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center bg-gray-900 text-white px-10 py-4 rounded-full font-medium hover:bg-blue-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 btn-animate"
            >
              View All Perfumes
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter - Homepage Only */}
      <NewsletterSection />

    </main>
  );
}
