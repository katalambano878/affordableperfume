'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type PendingOrder = {
  id: string;
  order_number: string;
  email: string | null;
  total: number | string;
  payment_status: string;
  status: string;
  created_at: string;
  moolre_payment_ref: string | null;
};

type ReconcileResult = {
  orderNumber: string;
  email?: string | null;
  total?: number | string | null;
  verdict: string;
  message: string;
  moolreRef?: string;
  usedRef?: string;
  moolre?: {
    code?: string;
    message?: string;
    txstatus?: number | string;
  };
};

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not signed in');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export default function MoolreReconcilePage() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [results, setResults] = useState<ReconcileResult[]>([]);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/payment/moolre/reconcile?limit=60', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to load pending orders');
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const reconcileOne = async (target: string) => {
    setRowBusy(target);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/payment/moolre/reconcile', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderNumber: target }),
      });
      const data = await res.json();
      if (!res.ok && !data.result) {
        throw new Error(data.error || data.message || 'Reconcile failed');
      }
      const result: ReconcileResult = data.result;
      setResults((prev) => [result, ...prev.filter((r) => r.orderNumber !== result.orderNumber)]);
      if (result.verdict === 'marked_paid' || result.verdict === 'already_paid') {
        setOrders((prev) => prev.filter((o) => o.order_number !== target));
      }
      return result;
    } catch (err: any) {
      setError(err.message || 'Reconcile failed');
      return null;
    } finally {
      setRowBusy(null);
    }
  };

  const reconcilePending = async () => {
    setBusy(true);
    setError('');
    setSummary(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/payment/moolre/reconcile', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode: 'pending', limit: 40 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Bulk reconcile failed');
      setSummary(data.summary || null);
      setResults(data.results || []);
      await loadPending();
    } catch (err: any) {
      setError(err.message || 'Bulk reconcile failed');
    } finally {
      setBusy(false);
    }
  };

  const verdictClass = (verdict: string) => {
    if (verdict === 'marked_paid' || verdict === 'already_paid') return 'bg-green-100 text-green-800';
    if (verdict === 'amount_mismatch' || verdict === 'error') return 'bg-red-100 text-red-800';
    return 'bg-amber-100 text-amber-800';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Moolre Payment Reconcile</h1>
          <p className="text-sm text-gray-600 mt-1">
            Check pending orders against Moolre and mark paid when the provider confirms payment.
          </p>
        </div>
        <button
          onClick={reconcilePending}
          disabled={busy || loading}
          className={`px-4 py-2 rounded-md text-white font-medium ${
            busy || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800'
          }`}
        >
          {busy ? 'Reconciling…' : 'Reconcile recent pending (40)'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-lg font-semibold mb-3">Check one order</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.trim())}
            placeholder="ORD-..."
            className="flex-1 border rounded-md px-3 py-2 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => orderNumber && reconcileOne(orderNumber)}
            disabled={!orderNumber || !!rowBusy}
            className="px-4 py-2 rounded-md bg-blue-700 text-white font-medium hover:bg-blue-800 disabled:bg-gray-400"
          >
            {rowBusy === orderNumber ? 'Checking…' : 'Check with Moolre'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(summary).map(([key, value]) => (
            <div key={key} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-500">{key.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pending Moolre orders</h2>
          <button onClick={loadPending} className="text-sm text-blue-700 hover:underline" disabled={loading}>
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No pending Moolre orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="text-blue-700 hover:underline font-medium">
                        {order.order_number}
                      </Link>
                      {order.moolre_payment_ref && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">
                          {order.moolre_payment_ref}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{order.email || '—'}</td>
                    <td className="px-4 py-3 font-medium">GH₵{Number(order.total).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(order.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => reconcileOne(order.order_number)}
                        disabled={rowBusy === order.order_number || busy}
                        className="px-3 py-1.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      >
                        {rowBusy === order.order_number ? 'Checking…' : 'Check'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-lg font-semibold mb-3">Latest results</h2>
          <div className="space-y-2">
            {results.map((result) => (
              <div
                key={`${result.orderNumber}-${result.verdict}-${result.moolreRef || ''}`}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-gray-100 rounded-lg px-3 py-2"
              >
                <div>
                  <p className="font-medium text-gray-900">{result.orderNumber}</p>
                  <p className="text-xs text-gray-600">
                    {result.email || '—'} · GH₵{Number(result.total || 0).toFixed(2)}
                    {result.moolreRef ? ` · Moolre #${result.moolreRef}` : ''}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{result.message}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full w-fit ${verdictClass(result.verdict)}`}>
                  {result.verdict.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
