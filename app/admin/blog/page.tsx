'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminBlogPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPosts(
        (data || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          author: p.author_id ? 'Staff' : 'Admin',
          category: Array.isArray(p.tags) && p.tags[0] ? p.tags[0] : 'General',
          image: p.featured_image || '/placeholder-blog.jpg',
          excerpt: p.excerpt || '',
          status: p.status === 'published' ? 'Published' : p.status === 'draft' ? 'Draft' : p.status || 'Draft',
          views: 0,
          comments: 0,
          publishDate: p.published_at
            ? new Date(p.published_at).toLocaleDateString()
            : new Date(p.created_at).toLocaleDateString(),
          featured: p.status === 'published',
        }))
      );
    } catch (err) {
      console.error('Error fetching blog posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchPosts();
  };

  const statusColors: Record<string, string> = {
    Published: 'bg-blue-100 text-blue-700',
    Draft: 'bg-gray-100 text-gray-700',
    Scheduled: 'bg-blue-100 text-blue-700',
  };

  const handleSelectAll = () => {
    if (selectedPosts.length === posts.length) setSelectedPosts([]);
    else setSelectedPosts(posts.map((p) => p.id));
  };

  const handleSelectPost = (postId: string) => {
    setSelectedPosts((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  };

  const publishedCount = posts.filter((p) => p.status === 'Published').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Blog Posts</h1>
          <p className="text-gray-600 mt-1">Create and manage your blog content</p>
        </div>
        <Link
          href="/admin/blog/new"
          className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap inline-flex items-center"
        >
          <i className="ri-add-line mr-2"></i>
          New Post
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Posts</p>
          <p className="text-2xl font-bold text-gray-900">{posts.length}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Published</p>
          <p className="text-2xl font-bold text-blue-700">{publishedCount}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Drafts</p>
          <p className="text-2xl font-bold text-gray-900">{posts.length - publishedCount}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Comments</p>
          <p className="text-2xl font-bold text-blue-700">0</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading posts…</div>
        ) : posts.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-article-line text-3xl text-gray-400"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No blog posts yet</h3>
            <p className="text-gray-500 mb-6">Start sharing perfume tips, new arrivals, and brand stories.</p>
            <Link
              href="/admin/blog/new"
              className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold inline-flex items-center"
            >
              Create First Post
            </Link>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-6 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <div key={post.id} className="border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-video bg-gray-100 overflow-hidden">
                  {post.image && post.image !== '/placeholder-blog.jpg' ? (
                    <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <i className="ri-image-line text-4xl"></i>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-blue-700">{post.category}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[post.status] || 'bg-gray-100'}`}>
                      {post.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">{post.title}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{post.excerpt || 'No excerpt'}</p>
                  <p className="text-sm text-gray-500 mb-4">{post.publishDate}</p>
                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/admin/blog/${post.id}/edit`}
                      className="flex-1 text-center border-2 border-gray-200 text-gray-800 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(post.id)}
                      className="flex-1 border-2 border-red-200 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-4 px-6">
                    <input type="checkbox" checked={selectedPosts.length === posts.length && posts.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded" />
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Post</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <input type="checkbox" checked={selectedPosts.includes(post.id)} onChange={() => handleSelectPost(post.id)} className="w-4 h-4 rounded" />
                    </td>
                    <td className="py-4 px-4 font-semibold text-gray-900">{post.title}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[post.status] || 'bg-gray-100'}`}>{post.status}</span>
                    </td>
                    <td className="py-4 px-4 text-gray-700">{post.publishDate}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <Link href={`/admin/blog/${post.id}/edit`} className="text-blue-700 hover:text-blue-900 text-sm font-medium">
                          Edit
                        </Link>
                        <button type="button" onClick={() => handleDelete(post.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {posts.length > 0 && (
          <div className="p-6 border-t border-gray-200 flex items-center justify-between">
            <p className="text-gray-600">Showing {posts.length} post{posts.length !== 1 ? 's' : ''}</p>
            <div className="flex border-2 border-gray-300 rounded-lg overflow-hidden">
              <button type="button" onClick={() => setViewMode('grid')} className={`w-10 h-10 flex items-center justify-center ${viewMode === 'grid' ? 'bg-blue-700 text-white' : 'bg-white text-gray-700'}`}>
                <i className="ri-grid-line"></i>
              </button>
              <button type="button" onClick={() => setViewMode('list')} className={`w-10 h-10 flex items-center justify-center border-l-2 border-gray-300 ${viewMode === 'list' ? 'bg-blue-700 text-white' : 'bg-white text-gray-700'}`}>
                <i className="ri-list-check"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
