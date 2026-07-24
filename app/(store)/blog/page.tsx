'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import { supabase } from '@/lib/supabase';

type BlogCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  category: string;
  date: string;
  author: string;
  readTime: string;
};

function estimateReadTime(content: string) {
  const words = (content || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All Posts');

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('id, title, slug, excerpt, content, featured_image, tags, published_at, created_at')
          .eq('status', 'published')
          .order('published_at', { ascending: false });

        if (error) throw error;

        setPosts(
          (data || []).map((p: any) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt || '',
            image: p.featured_image || '/heroes/hero-support.webp',
            category: Array.isArray(p.tags) && p.tags[0] ? p.tags[0] : 'General',
            date: new Date(p.published_at || p.created_at).toLocaleDateString('en-GH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            author: 'Affordable Perfumes GH',
            readTime: estimateReadTime(p.content || p.excerpt || ''),
          }))
        );
      } catch (err) {
        console.error('Error loading blog posts:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      counts.set(post.category, (counts.get(post.category) || 0) + 1);
    }
    return [
      { name: 'All Posts', count: posts.length, icon: 'ri-article-line' },
      ...Array.from(counts.entries()).map(([name, count]) => ({
        name,
        count,
        icon: 'ri-price-tag-3-line',
      })),
    ];
  }, [posts]);

  const filtered =
    activeCategory === 'All Posts'
      ? posts
      : posts.filter((p) => p.category === activeCategory);

  const featuredPost = filtered[0] || posts[0];
  const remaining = featuredPost
    ? filtered.filter((p) => p.id !== featuredPost.id)
    : filtered;

  return (
    <div className="min-h-screen bg-white">
      <PageHero
        title="Our Blog"
        subtitle="Fragrance tips, perfume guides, and scent trends to help you choose your next signature bottle."
        image="support"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading articles…</div>
        ) : !featuredPost ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-article-line text-3xl text-gray-400"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No posts published yet</h2>
            <p className="text-gray-600 mb-8">Check back soon for fragrance tips and buying guides.</p>
            <Link href="/shop" className="inline-flex bg-blue-700 text-white px-6 py-3 rounded-full font-medium hover:bg-blue-800">
              Shop Perfumes
            </Link>
          </div>
        ) : (
          <>
            <Link href={`/blog/${featuredPost.slug}`} className="block mb-16 hover:opacity-90 transition-opacity">
              <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow">
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="relative h-96 md:h-auto min-h-[280px]">
                    <img
                      src={featuredPost.image}
                      alt={featuredPost.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-6 left-6">
                      <span className="bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium">
                        Featured
                      </span>
                    </div>
                  </div>
                  <div className="p-12 flex flex-col justify-center">
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">
                        {featuredPost.category}
                      </span>
                      <span>{featuredPost.date}</span>
                    </div>
                    <h2 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
                      {featuredPost.title}
                    </h2>
                    <p className="text-gray-600 text-lg leading-relaxed mb-6">
                      {featuredPost.excerpt || 'Read the full article'}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <i className="ri-user-line text-blue-700"></i>
                      </div>
                      <span className="text-gray-900 font-medium">{featuredPost.author}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            <div className="grid lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3">
                <h2 className="text-3xl font-bold text-gray-900 mb-8">Latest Articles</h2>
                {remaining.length === 0 ? (
                  <p className="text-gray-500">More articles coming soon.</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-8">
                    {remaining.map((post) => (
                      <Link
                        key={post.id}
                        href={`/blog/${post.slug}`}
                        className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all"
                      >
                        <div className="relative h-64">
                          <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-6">
                          <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium text-xs">
                              {post.category}
                            </span>
                            <span className="text-xs">{post.date}</span>
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight">{post.title}</h3>
                          <p className="text-gray-600 mb-4 leading-relaxed text-sm">
                            {post.excerpt || 'Read the full article'}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="bg-gray-50 rounded-2xl p-6 sticky top-24">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Categories</h3>
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <button
                        key={category.name}
                        type="button"
                        onClick={() => setActiveCategory(category.name)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                          activeCategory === category.name ? 'bg-white shadow-sm' : 'hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <i className={`${category.icon} text-blue-700`}></i>
                          <span className="text-gray-900 font-medium">{category.name}</span>
                        </div>
                        <span className="text-sm text-gray-500">{category.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-700 to-blue-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Start Shopping?</h2>
          <p className="text-xl text-blue-100 mb-8 leading-relaxed">
            Browse our latest perfumes and fragrance collections
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-white text-blue-700 px-8 py-4 rounded-full font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
          >
            Explore Perfumes
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
