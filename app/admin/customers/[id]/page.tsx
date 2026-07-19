'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function CustomerDetailsPage() {
    const params = useParams();
    const customerId = params.id as string;

    const [customer, setCustomer] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (customerId) fetchCustomerData();
    }, [customerId]);

    const fetchCustomerData = async () => {
        try {
            // List page links to customers.id — load from customers first
            const { data: row, error: customerError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .maybeSingle();

            if (customerError) throw customerError;

            let profile = row;
            if (!profile) {
                const { data: profileRow, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', customerId)
                    .maybeSingle();
                if (profileError) throw profileError;
                profile = profileRow;
            }

            if (!profile) {
                setCustomer(null);
                return;
            }

            const displayName =
                profile.full_name ||
                (profile.first_name && profile.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : profile.first_name) ||
                'No Name';

            setCustomer({
                ...profile,
                displayName,
                email: profile.email || '',
                phone: profile.phone || 'N/A',
            });

            // Orders: match registered user_id and/or guest email
            const orParts: string[] = [];
            const uid = profile.user_id || (!row ? profile.id : null);
            if (uid) orParts.push(`user_id.eq.${uid}`);
            if (profile.email) orParts.push(`email.eq.${profile.email}`);

            if (orParts.length === 0) {
                setOrders([]);
            } else {
                const { data: ordersData, error: ordersError } = await supabase
                    .from('orders')
                    .select('*')
                    .or(orParts.join(','))
                    .order('created_at', { ascending: false });
                if (ordersError) throw ordersError;
                setOrders(ordersData || []);
            }
        } catch (err) {
            console.error('Error fetching customer:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading customer details...</div>;
    if (!customer) return <div className="p-8 text-center text-red-500">Customer not found</div>;

    const paidOrders = orders.filter((o) => o.payment_status === 'paid' && o.status !== 'cancelled');
    const totalSpent = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <Link href="/admin/customers" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                        <i className="ri-arrow-left-line text-xl"></i>
                    </Link>
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-2xl font-bold">
                        {(customer.displayName || customer.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{customer.displayName}</h1>
                        <p className="text-gray-500">{customer.email}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Total Spent</p>
                    <p className="text-2xl font-bold text-gray-900">GH₵{totalSpent.toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Last Order</p>
                    <p className="text-xl font-bold text-gray-900">
                        {orders[0] ? new Date(orders[0].created_at).toLocaleDateString() : 'Never'}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Phone</p>
                    <p className="text-lg font-bold text-gray-900">{customer.phone || 'N/A'}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Order History</h2>
                </div>

                {orders.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No orders found.</div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Order</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Payment</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Total</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium text-blue-600">
                                        <Link href={`/admin/orders/${order.order_number || order.id}`}>
                                            {order.order_number || order.id.slice(0, 8)}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {new Date(order.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm capitalize text-gray-600">{order.payment_status || '—'}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-yellow-100 text-yellow-800">
                                            {order.status?.replace('_', ' ') || 'pending'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                                        GH₵{Number(order.total || 0).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            href={`/admin/orders/${order.order_number || order.id}`}
                                            className="text-gray-400 hover:text-blue-600"
                                        >
                                            <i className="ri-eye-line text-lg"></i>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
