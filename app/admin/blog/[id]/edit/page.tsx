'use client';

import { use } from 'react';
import BlogPostForm from '@/components/admin/BlogPostForm';

export default function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <BlogPostForm postId={id} />;
}
