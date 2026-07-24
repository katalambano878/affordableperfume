'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type CouponForm = {
  code: string;
  description: string;
  type: string;
  value: string;
  minimum_purchase: string;
  maximum_discount: string;
  usage_limit: string;
  per_user_limit: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

const emptyForm = (): CouponForm => ({
  code: '',
  description: '',
  type: 'percentage',
  value: '',
  minimum_purchase: '',
  maximum_discount: '',
  usage_limit: '',
  per_user_limit: '1',
  start_date: '',
  end_date: '',
  is_active: true,
});

function formatType(type: string) {
  if (type === 'percentage') return 'Percentage';
  if (type === 'fixed') return 'Fixed Amount';
  if (type === 'free_shipping') return 'Free Shipping';
  return type;
}

export default function AdminCouponsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm());
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCoupons(
        (data || []).map((c: any) => ({
          id: c.id,
          code: c.code,
          description: c.description,
          type: formatType(c.type),
          rawType: c.type,
          value: Number(c.value) || 0,
          minPurchase: Number(c.minimum_purchase) || 0,
          maxDiscount: c.maximum_discount != null ? Number(c.maximum_discount) : null,
          usageLimit: c.usage_limit,
          usedCount: c.usage_count || 0,
          perUserLimit: c.per_user_limit,
          startDate: c.start_date ? new Date(c.start_date).toLocaleDateString() : 'N/A',
          endDate: c.end_date ? new Date(c.end_date).toLocaleDateString() : null,
          rawStart: c.start_date,
          rawEnd: c.end_date,
          isActive: c.is_active,
          status: isCouponActive(c) ? 'Active' : c.is_active ? 'Expired' : 'Disabled',
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isCouponActive = (c: any) => {
    if (!c.is_active) return false;
    if (c.end_date && new Date(c.end_date) < new Date()) return false;
    if (c.usage_limit != null && (c.usage_count || 0) >= c.usage_limit) return false;
    return true;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (coupon: any) => {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description || '',
      type: coupon.rawType || 'percentage',
      value: String(coupon.value),
      minimum_purchase: coupon.minPurchase ? String(coupon.minPurchase) : '',
      maximum_discount: coupon.maxDiscount != null ? String(coupon.maxDiscount) : '',
      usage_limit: coupon.usageLimit != null ? String(coupon.usageLimit) : '',
      per_user_limit: coupon.perUserLimit != null ? String(coupon.perUserLimit) : '1',
      start_date: coupon.rawStart ? coupon.rawStart.slice(0, 10) : '',
      end_date: coupon.rawEnd ? coupon.rawEnd.slice(0, 10) : '',
      is_active: coupon.isActive !== false,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      alert('Coupon code is required');
      return;
    }
    if (form.type !== 'free_shipping' && (!form.value || Number(form.value) <= 0)) {
      alert('Enter a valid discount value');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null,
        type: form.type,
        value: Number(form.value),
        minimum_purchase: form.minimum_purchase ? Number(form.minimum_purchase) : 0,
        maximum_discount: form.maximum_discount ? Number(form.maximum_discount) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        per_user_limit: form.per_user_limit ? Number(form.per_user_limit) : 1,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from('coupons').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coupons').insert([{ ...payload, usage_count: 0 }]);
        if (error) throw error;
      }

      setShowModal(false);
      await fetchCoupons();
      alert(editingId ? 'Coupon updated' : 'Coupon created');
    } catch (err: any) {
      alert(err.message || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete coupon ${code}?`)) return;
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchCoupons();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Copied ${code}`);
  };

  const statusColors: Record<string, string> = {
    Active: 'bg-blue-100 text-blue-700',
    Expired: 'bg-gray-100 text-gray-700',
    Disabled: 'bg-red-100 text-red-700',
  };

  const activeCoupons = coupons.filter((c) => c.status === 'Active');
  const totalUses = coupons.reduce((sum, c) => sum + c.usedCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coupons & Promotions</h1>
          <p className="text-gray-600 mt-1">Create and manage discount codes</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line mr-2"></i>
          Create Coupon
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Coupons</p>
          <p className="text-2xl font-bold text-gray-900">{coupons.length}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-blue-700">{activeCoupons.length}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Uses</p>
          <p className="text-2xl font-bold text-gray-900">{totalUses}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Discount</p>
          <p className="text-2xl font-bold text-purple-700">—</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Code</th>
              <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Type</th>
              <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Value</th>
              <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Usage</th>
              <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Valid Period</th>
              <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
              <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading coupons...</td></tr>
            ) : coupons.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">No coupons yet. Create your first coupon.</td></tr>
            ) : (
              coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded">{coupon.code}</span>
                      <button
                        type="button"
                        onClick={() => copyCode(coupon.code)}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-700 rounded cursor-pointer"
                      >
                        <i className="ri-file-copy-line"></i>
                      </button>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-700">{coupon.type}</td>
                  <td className="py-4 px-4 font-semibold text-gray-900">
                    {coupon.rawType === 'percentage' ? `${coupon.value}%` : coupon.rawType === 'fixed' ? `GH₵ ${coupon.value}` : 'Free'}
                  </td>
                  <td className="py-4 px-4 text-gray-700">
                    {coupon.usedCount} / {coupon.usageLimit ?? '∞'}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-700">
                    <div>{coupon.startDate}</div>
                    <div className="text-gray-500">{coupon.endDate || 'No expiry'}</div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[coupon.status] || 'bg-gray-100'}`}>
                      {coupon.status}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2">
                      <button type="button" onClick={() => openEdit(coupon)} className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer">
                        <i className="ri-edit-line text-lg"></i>
                      </button>
                      <button type="button" onClick={() => handleDelete(coupon.id, coupon.code)} className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer">
                        <i className="ri-delete-bin-line text-lg"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Coupon' : 'Create Coupon'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 uppercase"
                  placeholder="SAVE10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min purchase (GH₵)</label>
                  <input type="number" min="0" value={form.minimum_purchase} onChange={(e) => setForm({ ...form, minimum_purchase: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usage limit</label>
                  <input type="number" min="0" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2.5" placeholder="Unlimited" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2.5" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50">
                {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
