import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fragrance Blog | Perfume Tips & Guides',
  description: 'Expert perfume guides, fragrance tips, and scent reviews. Learn how to choose the right perfume, layering techniques, and trending fragrances in Ghana.',
  keywords: ['perfume blog ghana', 'fragrance tips', 'how to choose perfume', 'perfume reviews ghana', 'best perfumes for men ghana', 'best perfumes for women ghana'],
  openGraph: {
    title: 'Fragrance Blog | Perfume Tips & Guides',
    description: 'Expert perfume guides, reviews, and tips on choosing the right fragrance. From Ghana\'s perfume experts.',
    type: 'website',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
