import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQs | Affordable Perfumes GH',
  description: 'Frequently asked questions about ordering perfumes online in Ghana. Shipping, returns, payment methods, authenticity guarantees, and more.',
  keywords: ['perfume delivery ghana faq', 'buy perfume online ghana questions', 'affordable perfumes shipping'],
  openGraph: {
    title: 'FAQs | Affordable Perfumes GH',
    description: 'Find answers about ordering, shipping, returns, and authenticity for perfumes in Ghana.',
    type: 'website',
  },
};

export default function FAQsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
