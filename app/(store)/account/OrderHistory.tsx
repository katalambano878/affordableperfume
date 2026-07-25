'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { resolveStorageUrl } from '@/lib/storage-url';
import { useCart } from '@/context/CartContext';

interface OrderItem {
  id: string;
  productId?: string | null;
  name: string;
  image: string;
  quantity: number;
  price: number;
  variant?: string;
  slug?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  date: string;
  status: string;
  paymentStatus?: string;
  email?: string;
  total: number;
  items: OrderItem[];
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const { addToCart, setIsCartOpen } = useCart();
  const router = useRouter();

  useEffect(() => {
    async function fetchOrders() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const email = session.user.email?.toLowerCase() || '';
        setUserEmail(email);

        const { data: byUserId, error: userIdError } = await supabase
          .from('orders')
          .select(`*, order_items (*)`)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (userIdError) throw userIdError;

        let merged = byUserId || [];

        if (email) {
          const { data: byEmail, error: emailError } = await supabase
            .from('orders')
            .select(`*, order_items (*)`)
            .ilike('email', email)
            .order('created_at', { ascending: false });

          if (emailError) throw emailError;

          const seen = new Set(merged.map((o: any) => o.id));
          for (const order of byEmail || []) {
            if (!seen.has(order.id)) merged.push(order);
          }
          merged.sort(
            (a: any, b: any) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }

        if (merged.length > 0) {
          const formattedOrders = merged.map((order: any) => ({
            id: order.id,
            orderNumber: order.order_number,
            date: order.created_at,
            status: order.status,
            paymentStatus: order.payment_status,
            email: order.email || email,
            total: order.total,
            items: (order.order_items || []).map((item: any) => ({
              id: item.id,
              productId: item.product_id,
              name: item.product_name,
              image: resolveStorageUrl(item.metadata?.image),
              quantity: item.quantity,
              price: item.unit_price,
              variant: item.variant_name || undefined,
              slug: item.metadata?.slug || undefined,
            })),
          }));
          setOrders(formattedOrders);
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'shipped':
        return 'bg-blue-100 text-blue-700';
      case 'processing':
        return 'bg-yellow-100 text-yellow-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const trackHref = (order: Order) => {
    const email = encodeURIComponent(order.email || userEmail || '');
    const base = `/order-tracking?order=${encodeURIComponent(order.orderNumber)}`;
    return email ? `${base}&email=${email}` : base;
  };

  const helpHref = (order: Order) =>
    `/contact?order=${encodeURIComponent(order.orderNumber)}&subject=${encodeURIComponent(
      `Help with order ${order.orderNumber}`
    )}`;

  const handleReorder = async (order: Order) => {
    if (!order.items.length) {
      alert('This order has no items to reorder.');
      return;
    }

    setReorderingId(order.id);
    try {
      const productIds = order.items
        .map((item) => item.productId)
        .filter((id): id is string => !!id);

      const productMap = new Map<string, any>();
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, slug, name, price, quantity, status, product_images(url, position)')
          .in('id', productIds);

        for (const p of products || []) {
          productMap.set(p.id, p);
        }
      }

      let added = 0;
      const unavailable: string[] = [];

      for (const item of order.items) {
        const product = item.productId ? productMap.get(item.productId) : null;

        if (product && product.status !== 'active') {
          unavailable.push(item.name);
          continue;
        }

        const stock = product?.quantity ?? 9999;
        if (product && stock <= 0) {
          unavailable.push(item.name);
          continue;
        }

        const images = [...(product?.product_images || [])].sort(
          (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
        );
        const image =
          images[0]?.url ||
          item.image ||
          '/images/product-placeholder.svg';

        const productId = product?.id || item.productId;
        if (!productId) {
          unavailable.push(item.name);
          continue;
        }

        const qty = Math.min(item.quantity || 1, stock > 0 ? stock : item.quantity || 1);

        addToCart({
          id: productId,
          name: product?.name || item.name,
          price: Number(product?.price ?? item.price),
          image: resolveStorageUrl(image),
          quantity: qty,
          variant: item.variant,
          slug: product?.slug || item.slug || productId,
          maxStock: stock > 0 ? stock : 9999,
          moq: 1,
        });
        added += 1;
      }

      if (added === 0) {
        alert(
          unavailable.length
            ? `Could not reorder: ${unavailable.join(', ')} ${unavailable.length === 1 ? 'is' : 'are'} unavailable.`
            : 'Could not add items to your cart.'
        );
        return;
      }

      setIsCartOpen(true);
      if (unavailable.length) {
        alert(
          `Added ${added} item(s) to your cart. Unavailable: ${unavailable.join(', ')}.`
        );
      }
      router.push('/cart');
    } catch (err) {
      console.error('Reorder failed:', err);
      alert('Could not reorder. Please try again.');
    } finally {
      setReorderingId(null);
    }
  };

  const handleDownloadInvoice = (orderId: string) => {
    window.open(`/account/invoice/${orderId}?print=true`, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <i className="ri-loader-4-line animate-spin text-3xl text-blue-700"></i>
        <p className="mt-2 text-gray-500">Loading orders...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-12 text-center bg-white rounded-lg border border-gray-200">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-shopping-bag-line text-3xl text-gray-400"></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No orders yet</h3>
        <p className="text-gray-500 mb-6">Start shopping to see your orders here.</p>
        <Link href="/shop" className="inline-block bg-blue-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-800 transition-colors">
          Go to Shop
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Order History</h2>
        <div className="text-sm text-gray-600">
          Total Orders: <span className="font-bold text-gray-900">{orders.length}</span>
        </div>
      </div>

      <div className="space-y-6">
        {orders.map((order) => (
          <div key={order.id} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
              <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
                  <div className="w-full sm:w-auto">
                    <p className="text-xs text-gray-600 mb-1">Order Number</p>
                    <p className="font-bold text-gray-900">{order.orderNumber}</p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <p className="text-xs text-gray-600 mb-1">Date</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(order.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <p className="text-xs text-gray-600 mb-1">Total</p>
                    <p className="font-bold text-blue-700">GH₵{order.total.toFixed(2)}</p>
                  </div>
                </div>
                <div className="w-full sm:w-auto flex flex-col items-start sm:items-end gap-1">
                  <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${getStatusColor(order.status)}`}>
                    {order.status === 'shipped' ? 'Packaged' : order.status.replace('_', ' ').replace(/^\w/, (c: string) => c.toUpperCase())}
                  </span>
                  {order.paymentStatus && order.paymentStatus !== 'paid' && (
                    <span className="text-xs font-medium text-amber-700">
                      Payment {order.paymentStatus === 'failed' ? 'failed' : 'pending'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4 mb-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex space-x-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover object-center"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 mb-1">{item.name}</h4>
                      {item.variant && (
                        <p className="text-sm text-gray-500">{item.variant}</p>
                      )}
                      <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                      <p className="text-sm font-bold text-gray-900 mt-1">GH₵{item.price.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-4 border-t border-gray-200">
                <Link
                  href={trackHref(order)}
                  className="flex-1 sm:flex-none text-center px-4 py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap"
                >
                  <i className="ri-map-pin-line mr-2"></i>
                  Track Order
                </Link>
                <button
                  type="button"
                  onClick={() => handleReorder(order)}
                  disabled={reorderingId === order.id}
                  className="flex-1 sm:flex-none px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  <i className={`${reorderingId === order.id ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} mr-2`}></i>
                  {reorderingId === order.id ? 'Adding…' : 'Reorder'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadInvoice(order.id)}
                  className="flex-1 sm:flex-none px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <i className="ri-download-line mr-2"></i>
                  Invoice
                </button>
                <Link
                  href={helpHref(order)}
                  className="flex-1 sm:flex-none text-center px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <i className="ri-customer-service-line mr-2"></i>
                  Get Help
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
