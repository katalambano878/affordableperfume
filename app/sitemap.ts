import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://affordableperfumesgh.com').replace(/\/$/, '');

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date('2026-01-01'), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/shop`, lastModified: new Date('2026-01-01'), changeFrequency: 'daily', priority: 0.95 },
    { url: `${baseUrl}/categories`, lastModified: new Date('2026-01-01'), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: new Date('2026-01-01'), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: new Date('2026-01-01'), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/faqs`, lastModified: new Date('2026-01-01'), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/blog`, lastModified: new Date('2026-01-01'), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/terms`, lastModified: new Date('2026-01-01'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: new Date('2026-01-01'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/shipping`, lastModified: new Date('2026-01-01'), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/returns`, lastModified: new Date('2026-01-01'), changeFrequency: 'monthly', priority: 0.5 },
  ];

  let productPages: MetadataRoute.Sitemap = [];
  let categoryPages: MetadataRoute.Sitemap = [];
  let blogPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active products (exclude wholesale-only)
    const { data: products } = await supabase
      .from('products')
      .select('slug, updated_at, name')
      .eq('status', 'active')
      .or('is_wholesale.is.null,is_wholesale.eq.false');

    if (products) {
      productPages = products.map((p) => ({
        url: `${baseUrl}/product/${p.slug}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
    }

    // Category pages
    const { data: categories } = await supabase
      .from('categories')
      .select('slug, updated_at')
      .eq('status', 'active');

    if (categories) {
      categoryPages = categories.map((c) => ({
        url: `${baseUrl}/shop?category=${c.slug}`,
        lastModified: new Date(c.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }

    // Blog posts (try slug first, fall back to id)
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('id, slug, updated_at')
      .eq('status', 'published');

    if (posts) {
      blogPages = posts.map((p) => ({
        url: `${baseUrl}/blog/${p.slug || p.id}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }));
    }
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }

  return [...staticPages, ...productPages, ...categoryPages, ...blogPages];
}
