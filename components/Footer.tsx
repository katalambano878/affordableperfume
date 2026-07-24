"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useCMS } from '@/context/CMSContext';

function FooterSection({ title, children }: { title: string, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/5 lg:border-none last:border-0 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left lg:py-0 lg:cursor-default lg:mb-5 group"
      >
        <h4 className="font-serif text-lg font-bold text-white group-hover:text-blue-400 transition-colors duration-300">{title}</h4>
        <i className={`ri-arrow-down-s-line text-gray-500 text-xl transition-transform duration-500 lg:hidden ${isOpen ? 'rotate-180 text-blue-400' : ''}`}></i>
      </button>
      <div className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-96 pb-5' : 'max-h-0 lg:max-h-full lg:overflow-visible'}`}>
        {children}
      </div>
    </div>
  );
}

export default function Footer() {
  const { getSetting } = useCMS();
  const [email, setEmail] = useState('');

  const siteName = getSetting('site_name') || '';
  const siteLogo = getSetting('site_logo') || '';
  const siteTagline = getSetting('site_tagline') || '';
  const contactEmail = getSetting('contact_email') || '';
  const contactPhone = getSetting('contact_phone') || '+233 209 597 443';
  const socialFacebook = getSetting('social_facebook') || '';
  const socialInstagram = getSetting('social_instagram') || '';
  const socialTwitter = getSetting('social_twitter') || '';
  const socialTiktok = getSetting('social_tiktok') || '';
  const socialSnapchat = getSetting('social_snapchat') || '';
  const socialYoutube = getSetting('social_youtube') || '';

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Thank you for subscribing!');
    setEmail('');
  };

  return (
    <footer className="relative mt-16 z-0 bg-[#050505]">

      {/* Mesh Gradient Background */}
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-purple-900 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative text-white border-t border-white/5 pt-12 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">


          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 border-b border-white/5 pb-10">

            {/* Brand Information */}
            <div className="lg:col-span-4 space-y-5">
              <Link href="/" className="inline-block group transition-transform duration-500 hover:scale-105">
                {siteLogo ? (
                  <img src={siteLogo} alt={siteName} className="h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(37,99,235,0.3)]" />
                ) : (
                  <span className="text-3xl font-serif font-bold text-white tracking-tight">{siteName}</span>
                )}
              </Link>
              <div className="space-y-3">
                <p className="text-gray-400/80 leading-relaxed text-sm max-w-sm">
                  Curating authentic premium scents and fragrances. Excellence delivered across Ghana.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <i className="ri-truck-line text-blue-500"></i>
                    <span>24 - 48 Hours Nationwide Delivery</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <i className="ri-mail-line text-blue-500"></i>
                    <a href={`mailto:${contactEmail}`} className="hover:text-blue-400 transition-colors">{contactEmail || 'support@sasulabs.com'}</a>
                  </div>
                </div>
              </div>

              {/* Social Grid */}
              <div className="flex flex-wrap gap-3 pt-1">
                {[
                  { link: socialInstagram, icon: 'ri-instagram-line', label: 'Instagram' },
                  { link: socialTiktok, icon: 'ri-tiktok-fill', label: 'TikTok' },
                  { link: socialTwitter, icon: 'ri-twitter-x-fill', label: 'Twitter' },
                  { link: socialFacebook, icon: 'ri-facebook-fill', label: 'Facebook' },
                  { link: socialYoutube, icon: 'ri-youtube-fill', label: 'YouTube' }
                ].filter((social) => social.link && social.link !== '#')
                  .map((social) => (
                  <a
                    key={social.label}
                    href={social.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-blue-600 hover:text-white hover:border-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all transform hover:-translate-y-1.5 duration-300"
                  >
                    <i className={`${social.icon} text-lg`}></i>
                  </a>
                ))}
              </div>
            </div>

            {/* Navigation Sections */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6 md:pl-8">
              <FooterSection title="Collection">
                <ul className="space-y-2.5 text-gray-400 text-sm">
                  <li><Link href="/shop" className="hover:text-blue-400 hover:translate-x-1 inline-block transition-all duration-300">Shop</Link></li>
                  <li><Link href="/shop" className="hover:text-blue-400 hover:translate-x-1 inline-block transition-all duration-300">All Masterpieces</Link></li>
                  <li><Link href="/categories" className="hover:text-blue-400 hover:translate-x-1 inline-block transition-all duration-300">Signature Scent</Link></li>
                  <li><Link href="/shop?sort=new" className="hover:text-blue-400 hover:translate-x-1 inline-block transition-all duration-300">New arrivals</Link></li>
                  <li><Link href="/shop?featured=true" className="hover:text-blue-400 hover:translate-x-1 inline-block transition-all duration-300">Limited Editions</Link></li>
                </ul>
              </FooterSection>

              <FooterSection title="Assistance">
                <ul className="space-y-2.5 text-gray-400 text-sm">
                  <li><Link href="/contact" className="hover:text-blue-400 hover:translate-x-1 inline-block transition-all duration-300">Concierge Service</Link></li>
                  <li><Link href="/order-tracking" className="hover:text-blue-400 hover:translate-x-1 inline-block transition-all duration-300">Track Parcel</Link></li>
                  <li><Link href="/shipping" className="hover:text-blue-400 hover:translate-x-1 inline-block transition-all duration-300">Shipping Policy</Link></li>
                  <li><Link href="/returns" className="hover:text-blue-400 hover:translate-x-1 inline-block transition-all duration-300">Returns & Exchanges</Link></li>
                </ul>
              </FooterSection>

              <FooterSection title="Universe">
                <ul className="space-y-2.5 text-gray-400 text-sm">
                  <li><Link href="/about" className="hover:text-blue-400 hover:translate-x-1 inline-block transition-all duration-300">Philosophy</Link></li>
                  <li><Link href="/privacy" className="hover:text-blue-400 hover:translate-x-1 inline-block transition-all duration-300">Privacy & Data</Link></li>
                  <li><Link href="/terms" className="hover:text-blue-400 hover:translate-x-1 inline-block transition-all duration-300">Terms of Service</Link></li>
                </ul>
              </FooterSection>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-5">
            <div className="text-gray-500 text-xs font-medium tracking-wide">
              <Link
                href="/admin/login"
                className="hover:text-gray-400 transition-colors"
                aria-label="Admin sign in"
              >
                &copy;
              </Link>{' '}
              {new Date().getFullYear()} {siteName.toUpperCase()} — CRAFTED IN GHANA.
            </div>

            <div className="flex items-center gap-6">
              {/* Payment Partners */}
              <div className="flex gap-4 items-center opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500">
                <i className="ri-visa-line text-2xl"></i>
                <i className="ri-mastercard-line text-2xl"></i>
                <i className="ri-paypal-line text-2xl"></i>
                <img src="https://logowik.com/content/uploads/images/m-pesa2829.jpg" alt="MoMo" className="h-4 w-auto object-contain" />
              </div>

              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all duration-300"
              >
                <i className="ri-arrow-up-line"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

