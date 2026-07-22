'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Address {
  id: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

interface AddressForm {
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

const emptyForm = (): AddressForm => ({
  name: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'Ghana',
  isDefault: false,
});

function mapRow(row: any): Address {
  return {
    id: row.id,
    name: row.full_name || '',
    phone: row.phone || '',
    street: row.address_line1 || '',
    city: row.city || '',
    state: row.state || '',
    zipCode: row.postal_code || '',
    country: row.country || 'Ghana',
    isDefault: !!row.is_default,
  };
}

export default function AddressBook() {
  const [userId, setUserId] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm());

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setError('Please sign in to manage addresses.');
        return;
      }
      setUserId(session.user.id);

      const { data, error: fetchError } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', session.user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAddresses((data || []).map(mapRow));
    } catch (err: any) {
      console.error('Address fetch error:', err);
      setError(err.message || 'Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
    setError('');
  };

  const openEdit = (address: Address) => {
    setEditingId(address.id);
    setForm({
      name: address.name,
      phone: address.phone,
      street: address.street,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country,
      isDefault: address.isDefault,
    });
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    if (!form.name.trim() || !form.phone.trim() || !form.street.trim() || !form.city.trim()) {
      setError('Name, phone, street, and city are required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        user_id: userId,
        type: 'shipping',
        label: 'Home',
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        address_line1: form.street.trim(),
        address_line2: null,
        city: form.city.trim(),
        state: form.state.trim() || null,
        postal_code: form.zipCode.trim() || null,
        country: form.country.trim() || 'Ghana',
        is_default: form.isDefault || addresses.length === 0,
        updated_at: new Date().toISOString(),
      };

      if (form.isDefault || addresses.length === 0) {
        await supabase
          .from('addresses')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from('addresses')
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', userId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('addresses')
          .insert([{ ...payload, created_at: new Date().toISOString() }]);
        if (insertError) throw insertError;
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
      await loadAddresses();
    } catch (err: any) {
      console.error('Address save error:', err);
      setError(err.message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const deleteAddress = async (id: string) => {
    if (!userId || !confirm('Delete this address?')) return;
    const { error: deleteError } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (deleteError) {
      alert(deleteError.message);
      return;
    }
    await loadAddresses();
  };

  const setDefault = async (id: string) => {
    if (!userId) return;
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
    const { error: updateError } = await supabase
      .from('addresses')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    if (updateError) alert(updateError.message);
    else await loadAddresses();
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500">
        <i className="ri-loader-4-line animate-spin text-2xl"></i>
        <p className="mt-2">Loading addresses…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Address Book</h2>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap"
        >
          <i className="ri-add-line mr-2"></i>
          Add New Address
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white border-2 border-blue-700 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {editingId ? 'Edit Address' : 'New Address'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                placeholder="+233 24 123 4567"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Street Address</label>
              <input
                type="text"
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                placeholder="123 Oxford Street"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                placeholder="Accra"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">State / Region</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                placeholder="Greater Accra"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Zip Code</label>
              <input
                type="text"
                value={form.zipCode}
                onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                placeholder="00233"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Country</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-700 focus:border-transparent"
                placeholder="Ghana"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-700"
                />
                <span className="ml-2 text-sm text-gray-700">Set as default address</span>
              </label>
            </div>
            <div className="md:col-span-2 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Address'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm(emptyForm());
                }}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <i className="ri-map-pin-line text-4xl text-gray-400 mb-3"></i>
          <p className="text-gray-600 mb-4">No saved addresses yet.</p>
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800"
          >
            Add your first address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`bg-white border-2 rounded-lg p-6 relative ${address.isDefault ? 'border-blue-700' : 'border-gray-200'}`}
            >
              {address.isDefault && (
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 bg-blue-700 text-white text-xs font-semibold rounded-full whitespace-nowrap">
                    Default
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">{address.name}</h3>
                <p className="text-gray-600">{address.phone}</p>
              </div>

              <div className="text-gray-700 space-y-1 mb-6">
                <p>{address.street}</p>
                <p>{address.city}{address.state ? `, ${address.state}` : ''} {address.zipCode}</p>
                <p>{address.country}</p>
              </div>

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <button
                  type="button"
                  onClick={() => openEdit(address)}
                  className="flex-1 py-2 border border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Edit
                </button>
                {!address.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefault(address.id)}
                    className="flex-1 py-2 border border-blue-700 text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
                  >
                    Set Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteAddress(address.id)}
                  className="px-4 py-2 border border-red-600 text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
