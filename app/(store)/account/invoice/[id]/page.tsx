'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCMS } from '@/context/CMSContext';
import { usePageTitle } from '@/hooks/usePageTitle';

function InvoiceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params?.id as string;
  const autoPrint = searchParams.get('print') === 'true';

  const { getSetting } = useCMS();
  const siteName = getSetting('site_name') || 'Affordable Perfumes GH';
  const siteEmail = getSetting('contact_email') || 'support@affordableperfumesgh.com';
  const sitePhone = getSetting('contact_phone') || '';

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  usePageTitle(order ? `Invoice ${order.order_number}` : 'Invoice');

  useEffect(() => {
    async function loadInvoice() {
      if (!orderId) return;
      setLoading(true);
      setError('');

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setError('Please sign in to view this invoice.');
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('orders')
          .select(`*, order_items (*)`)
          .eq('id', orderId)
          .single();

        if (fetchError || !data) {
          setError('Invoice not found.');
          return;
        }

        const email = session.user.email?.toLowerCase();
        const ownsOrder =
          data.user_id === session.user.id ||
          (email && String(data.email || '').toLowerCase() === email);

        if (!ownsOrder) {
          setError('You do not have access to this invoice.');
          return;
        }

        setOrder(data);
      } catch (err) {
        console.error(err);
        setError('Could not load invoice.');
      } finally {
        setLoading(false);
      }
    }

    loadInvoice();
  }, [orderId]);

  useEffect(() => {
    if (!autoPrint || !order || loading) return;
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [autoPrint, order, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <i className="ri-loader-4-line animate-spin text-3xl text-blue-700" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4 text-center">
        <p className="text-gray-700 mb-4">{error || 'Invoice not found.'}</p>
        <Link href="/account" className="text-blue-700 font-semibold hover:underline">
          Back to account
        </Link>
      </div>
    );
  }

  const shipping = order.shipping_address || {};
  const customerName =
    [shipping.firstName || shipping.first_name, shipping.lastName || shipping.last_name]
      .filter(Boolean)
      .join(' ') ||
    shipping.name ||
    order.email;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="no-print max-w-3xl mx-auto px-4 py-6 flex flex-wrap gap-3 justify-between items-center">
        <Link href="/account" className="text-sm text-blue-700 font-semibold hover:underline">
          ← Back to orders
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800"
        >
          <i className="ri-printer-line mr-2" />
          Print / Save PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white shadow-sm border border-gray-200 m-4 p-6 sm:p-10 print:shadow-none print:border-0 print:m-0 print:p-8">
        <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{siteName}</h1>
            <p className="text-sm text-gray-600 mt-1">Tax Invoice / Receipt</p>
            {siteEmail && <p className="text-xs text-gray-500 mt-2">{siteEmail}</p>}
            {sitePhone && <p className="text-xs text-gray-500">{sitePhone}</p>}
          </div>
          <div className="text-right">
            <p className="font-bold text-lg text-gray-900">{order.order_number}</p>
            <p className="text-sm text-gray-600">
              {new Date(order.created_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            <p className="text-xs mt-2 capitalize text-gray-600">
              Status: {order.status} · Payment: {order.payment_status || 'pending'}
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Bill to</h2>
            <p className="font-semibold text-gray-900">{customerName}</p>
            <p className="text-sm text-gray-700">{order.email}</p>
            {(shipping.phone || order.phone) && (
              <p className="text-sm text-gray-700">{shipping.phone || order.phone}</p>
            )}
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Ship to</h2>
            <p className="text-sm text-gray-700">
              {shipping.address || shipping.address_line1 || '—'}
            </p>
            <p className="text-sm text-gray-700">
              {[shipping.city, shipping.region || shipping.state].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>

        <table className="w-full mb-8 text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300 text-left">
              <th className="py-2 pr-2">Item</th>
              <th className="py-2 px-2 text-center">Qty</th>
              <th className="py-2 px-2 text-right">Unit</th>
              <th className="py-2 pl-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(order.order_items || []).map((item: any) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-3 pr-2">
                  <p className="font-medium text-gray-900">{item.product_name}</p>
                  {item.variant_name && (
                    <p className="text-xs text-gray-500">{item.variant_name}</p>
                  )}
                </td>
                <td className="py-3 px-2 text-center">{item.quantity}</td>
                <td className="py-3 px-2 text-right">GH₵{Number(item.unit_price).toFixed(2)}</td>
                <td className="py-3 pl-2 text-right font-medium">
                  GH₵{Number(item.total_price ?? item.unit_price * item.quantity).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>GH₵{Number(order.subtotal ?? order.total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Shipping</span>
              <span>GH₵{Number(order.shipping_total ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2 mt-2">
              <span>Total</span>
              <span>GH₵{Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4 text-center text-xs text-gray-500">
          <p>Thank you for shopping with {siteName}.</p>
          <p className="mt-1">Questions? Contact us at {siteEmail}</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-blue-700" />
        </div>
      }
    >
      <InvoiceContent />
    </Suspense>
  );
}
