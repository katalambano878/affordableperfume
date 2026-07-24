'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { sanitizeHtml } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
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

function mapPost(p: any): BlogPost {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content || '',
    image: p.featured_image || '/heroes/hero-support.webp',
    category: Array.isArray(p.tags) && p.tags[0] ? p.tags[0] : 'General',
    date: new Date(p.published_at || p.created_at).toLocaleDateString('en-GH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    author: 'Affordable Perfumes GH',
    readTime: estimateReadTime(p.content || ''),
  };
}

export default function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const bySlug = await supabase
          .from('blog_posts')
          .select('*')
          .eq('status', 'published')
          .eq('slug', id)
          .maybeSingle();

        let data = bySlug.data;
        if (!data) {
          const byId = await supabase
            .from('blog_posts')
            .select('*')
            .eq('status', 'published')
            .eq('id', id)
            .maybeSingle();
          data = byId.data;
        }

        if (!data) {
          setNotFound(true);
          setPost(null);
          return;
        }

        const mapped = mapPost(data);
        setPost(mapped);

        const { data: relatedData } = await supabase
          .from('blog_posts')
          .select('id, title, slug, excerpt, content, featured_image, tags, published_at, created_at')
          .eq('status', 'published')
          .neq('id', mapped.id)
          .order('published_at', { ascending: false })
          .limit(2);

        setRelated((relatedData || []).map(mapPost));
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading article…</div>;
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Post not found</h1>
        <p className="text-gray-600 mb-8">This article may have been unpublished or moved.</p>
        <Link href="/blog" className="bg-blue-700 text-white px-6 py-3 rounded-full font-medium hover:bg-blue-800">
          Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="relative h-96 bg-gray-900">
        <img src={post.image} alt={post.title} className="w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="inline-block bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
              {post.category}
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">{post.title}</h1>
            <div className="flex flex-wrap items-center justify-center gap-6 text-blue-100">
              <span className="flex items-center gap-2">
                <i className="ri-user-line"></i>
                {post.author}
              </span>
              <span className="flex items-center gap-2">
                <i className="ri-calendar-line"></i>
                {post.date}
              </span>
              <span className="flex items-center gap-2">
                <i className="ri-time-line"></i>
                {post.readTime}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <article className="prose prose-lg max-w-none">
          <div
            className="text-gray-600 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
            style={{ fontSize: '1.125rem', lineHeight: '1.8' }}
          />
        </article>

        {related.length > 0 && (
          <div className="mt-16 pt-12 border-t border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Related Articles</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/blog/${item.slug}`}
                  className="border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="h-44 bg-gray-100">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-5">
                    <span className="text-xs font-semibold text-blue-700">{item.category}</span>
                    <h3 className="font-bold text-gray-900 mt-2">{item.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12">
          <Link href="/blog" className="inline-flex items-center text-blue-700 font-medium hover:text-blue-900">
            <i className="ri-arrow-left-line mr-2"></i>
            Back to Blog
          </Link>
        </div>
      </div>
    </div>
  );
}
