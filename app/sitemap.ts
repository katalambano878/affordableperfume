import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://affordableperfumesgh.com';

function safeDate(value: any): Date {
  if (!value) return new Date('2026-01-01');
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date('2026-01-01') : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

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

  let dynamicPages: MetadataRoute.Sitemap = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return staticPages;
  }

  let supabase;
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch {
    return staticPages;
  }

  // Products
  try {
    const { data: products } = await supabase
      .from('products')
      .select('slug, updated_at')
      .eq('status', 'active')
      .or('is_wholesale.is.null,is_wholesale.eq.false');

    if (products && Array.isArray(products)) {
      for (const p of products) {
        if (p.slug) {
          dynamicPages.push({
            url: `${baseUrl}/product/${p.slug}`,
            lastModified: safeDate(p.updated_at),
            changeFrequency: 'weekly',
            priority: 0.8,
          });
        }
      }
    }
  } catch (e) {
    console.error('Sitemap: products query failed', e);
  }

  // Categories
  try {
    const { data: categories } = await supabase
      .from('categories')
      .select('slug, updated_at')
      .eq('status', 'active');

    if (categories && Array.isArray(categories)) {
      for (const c of categories) {
        if (c.slug) {
          dynamicPages.push({
            url: `${baseUrl}/shop?category=${c.slug}`,
            lastModified: safeDate(c.updated_at),
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }
      }
    }
  } catch (e) {
    console.error('Sitemap: categories query failed', e);
  }

  // Blog posts
  try {
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('id, updated_at')
      .eq('status', 'published');

    if (posts && Array.isArray(posts)) {
      for (const p of posts) {
        if (p.id) {
          dynamicPages.push({
            url: `${baseUrl}/blog/${p.id}`,
            lastModified: safeDate(p.updated_at),
            changeFrequency: 'monthly',
            priority: 0.6,
          });
        }
      }
    }
  } catch (e) {
    console.error('Sitemap: blog query failed', e);
  }

  return [...staticPages, ...dynamicPages];
}
