import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://affordableperfumesgh.com';

async function getProduct(slug: string) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  const query = supabase
    .from('products')
    .select('id, name, slug, description, short_description, price, compare_at_price, status, seo_title, seo_description, metadata, rating_avg, product_images(url, position), categories(name, slug)')
    .or('is_wholesale.is.null,is_wholesale.eq.false');

  const { data } = isUUID
    ? await query.or(`id.eq.${slug},slug.eq.${slug}`).single()
    : await query.eq('slug', slug).single();

  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: 'Product Not Found' };

  const baseUrl = siteUrl.replace(/\/$/, '');
  const title = product.seo_title || product.name;
  const description = (product.seo_description || product.short_description || product.description || `Buy ${product.name} - Quality product from Ghana.`)
    .replace(/<[^>]*>/g, '')
    .slice(0, 160);
  const images = (product.product_images as { url: string; position?: number }[] | null) || [];
  const sortedImages = [...images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const firstImage = sortedImages[0]?.url;
  const ogImage = firstImage
    ? (firstImage.startsWith('http') ? firstImage : `${baseUrl}${firstImage.startsWith('/') ? '' : '/'}${firstImage}`)
    : `${baseUrl}/og-default`;
  const productUrl = `${baseUrl}/product/${product.slug}`;
  const category = (product as any).categories?.name;

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      url: productUrl,
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: product.name }],
      locale: 'en_GH',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: productUrl,
    },
    robots: { index: true, follow: true },
    other: {
      'product:price:amount': String(product.price),
      'product:price:currency': 'GHS',
      'product:availability': 'in stock',
      'product:condition': 'new',
      ...(category && { 'product:category': category }),
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const baseUrl = siteUrl.replace(/\/$/, '');
  const images = (product.product_images as { url: string; position?: number }[] | null) || [];
  const sortedImages = [...images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const firstImage = sortedImages[0]?.url;
  const productImage = firstImage
    ? (firstImage.startsWith('http') ? firstImage : `${baseUrl}${firstImage.startsWith('/') ? '' : '/'}${firstImage}`)
    : `${baseUrl}/og-default`;
  const productUrl = `${baseUrl}/product/${product.slug}`;
  const category = (product as any).categories?.name;

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: (product.description || product.short_description || '').replace(/<[^>]*>/g, '').slice(0, 500),
    image: sortedImages.map(img => img.url.startsWith('http') ? img.url : `${baseUrl}${img.url.startsWith('/') ? '' : '/'}${img.url}`),
    sku: product.id,
    url: productUrl,
    brand: {
      '@type': 'Brand',
      name: product.metadata?.brand || 'Affordable Perfumes GH'
    },
    ...(category && { category }),
    offers: {
      '@type': 'Offer',
      url: productUrl,
      price: product.price,
      priceCurrency: 'GHS',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: 'Affordable Perfumes GH'
      },
      priceValidUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ...(product.compare_at_price && { 'highPrice': product.compare_at_price })
    },
    ...(product.rating_avg && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating_avg,
        bestRating: 5,
        worstRating: 1,
        ratingCount: 1
      }
    })
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: `${baseUrl}/shop` },
      ...(category ? [{ '@type': 'ListItem', position: 3, name: category, item: `${baseUrl}/shop?category=${(product as any).categories?.slug || ''}` }] : []),
      { '@type': 'ListItem', position: category ? 4 : 3, name: product.name, item: productUrl }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <ProductDetailClient slug={slug} />
    </>
  );
}
