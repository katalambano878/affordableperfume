import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us | Affordable Perfumes GH',
  description: 'Get in touch with Affordable Perfumes GH. Order support, fragrance inquiries, and wholesale questions. Fast response guaranteed.',
  keywords: ['contact affordable perfumes ghana', 'perfume store accra contact', 'buy perfume ghana help'],
  openGraph: {
    title: 'Contact Us | Affordable Perfumes GH',
    description: 'Reach out to our team for order support, fragrance inquiries, and more.',
    type: 'website',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
