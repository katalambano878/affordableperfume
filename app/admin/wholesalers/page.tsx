'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Application = {
  id: string;
  user_id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  city: string;
  region: string;
  business_type: string;
  tax_id: string;
  notes: string;
  admin_notes: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string;
};

type Wholesaler = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  wholesale_approved_at: string;
};

export default function WholesalersPage() {
  const [activeTab, setActiveTab] = useState<'applications' | 'approved'>('applications');
  const [applications, setApplications] = useState<Application[]>([]);
  const [wholesalers, setWholesalers] = useState<Wholesaler[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch applications
      const { data: apps, error: appsError } = await supabase
        .from('wholesale_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (appsError) {
        console.warn('Wholesale applications unavailable:', appsError.message);
        setApplications([]);
      } else {
        setApplications(apps || []);
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, wholesale_approved_at')
        .eq('is_wholesaler', true)
        .order('wholesale_approved_at', { ascending: false });

      if (profilesError) {
        console.warn('Wholesale profiles query failed:', profilesError.message);
        setWholesalers([]);
      } else {
        setWholesalers(profiles || []);
      }
    } catch (err) {
      console.error('Error fetching wholesaler data:', err);
      setApplications([]);
      setWholesalers([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(application: Application) {
    setProcessingId(application.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // 1. Update application status
      const { error: appError } = await supabase
        .from('wholesale_applications')
        .update({
          status: 'approved',
          admin_notes: adminNotes[application.id] || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: session?.user?.id || null,
        })
        .eq('id', application.id);

      if (appError) throw appError;

      // 2. Update user profile to wholesaler
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_wholesaler: true,
          wholesale_approved_at: new Date().toISOString(),
        })
        .eq('id', application.user_id);

      if (profileError) throw profileError;

      alert(`${application.business_name} has been approved as a wholesaler!`);
      fetchData();
    } catch (err: any) {
      console.error('Approval error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(application: Application) {
    if (!confirm(`Reject application from ${application.business_name}?`)) return;

    setProcessingId(application.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { error } = await supabase
        .from('wholesale_applications')
        .update({
          status: 'rejected',
          admin_notes: adminNotes[application.id] || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: session?.user?.id || null,
        })
        .eq('id', application.id);

      if (error) throw error;

      alert(`Application from ${application.business_name} has been rejected.`);
      fetchData();
    } catch (err: any) {
      console.error('Rejection error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRevoke(wholesaler: Wholesaler) {
    if (!confirm(`Revoke wholesale access for ${wholesaler.email}?`)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_wholesaler: false,
          wholesale_approved_at: null,
        })
        .eq('id', wholesaler.id);

      if (error) throw error;

      alert(`Wholesale access revoked for ${wholesaler.email}`);
      fetchData();
    } catch (err: any) {
      console.error('Revoke error:', err);
      alert(`Error: ${err.message}`);
    }
  }

  const pendingCount = applications.filter(a => a.status === 'pending').length;
  const filteredApplications = statusFilter === 'pending'
    ? applications.filter(a => a.status === 'pending')
    : applications;

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading wholesaler data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Wholesalers</h1>
          <p className="text-gray-600 mt-1">Manage wholesale applications and approved wholesalers</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center space-x-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-lg">
            <i className="ri-notification-3-line text-lg"></i>
            <span className="font-semibold">{pendingCount} pending</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <i className="ri-time-line text-xl text-amber-600"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
              <p className="text-sm text-gray-600">Pending Applications</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="ri-user-star-line text-xl text-green-600"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{wholesalers.length}</p>
              <p className="text-sm text-gray-600">Approved Wholesalers</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <i className="ri-file-list-3-line text-xl text-gray-600"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
              <p className="text-sm text-gray-600">Total Applications</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('applications')}
              className={`flex items-center space-x-2 px-6 py-4 font-semibold whitespace-nowrap transition-colors border-b-2 cursor-pointer ${
                activeTab === 'applications'
                  ? 'border-amber-600 text-amber-700 bg-amber-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <i className="ri-file-list-3-line text-xl"></i>
              <span>Applications</span>
              {pendingCount > 0 && (
                <span className="bg-amber-500 text-white text-xs rounded-full px-2 py-0.5">{pendingCount}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`flex items-center space-x-2 px-6 py-4 font-semibold whitespace-nowrap transition-colors border-b-2 cursor-pointer ${
                activeTab === 'approved'
                  ? 'border-green-600 text-green-700 bg-green-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <i className="ri-user-star-line text-xl"></i>
              <span>Approved Wholesalers</span>
              <span className="bg-gray-200 text-gray-700 text-xs rounded-full px-2 py-0.5">{wholesalers.length}</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'applications' && (
            <div>
              {/* Filter */}
              <div className="flex items-center space-x-3 mb-6">
                <label className="text-sm font-medium text-gray-700">Show:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer"
                >
                  <option value="pending">Pending Only</option>
                  <option value="all">All Applications</option>
                </select>
              </div>

              {filteredApplications.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <i className="ri-inbox-line text-4xl mb-3 block"></i>
                  <p className="font-semibold">No {statusFilter === 'pending' ? 'pending ' : ''}applications</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredApplications.map(app => (
                    <div key={app.id} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Summary row */}
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <i className="ri-store-2-line text-amber-600"></i>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{app.business_name}</p>
                            <p className="text-sm text-gray-500">{app.contact_name} &middot; {app.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[app.status]}`}>
                            {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(app.created_at).toLocaleDateString()}
                          </span>
                          <i className={`ri-arrow-${expandedId === app.id ? 'up' : 'down'}-s-line text-gray-400`}></i>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {expandedId === app.id && (
                        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 font-medium">Phone</p>
                              <p className="text-gray-900">{app.phone || '—'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 font-medium">Location</p>
                              <p className="text-gray-900">{app.city ? `${app.city}, ${app.region}` : '—'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 font-medium">Business Type</p>
                              <p className="text-gray-900 capitalize">{app.business_type || '—'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 font-medium">Tax ID</p>
                              <p className="text-gray-900">{app.tax_id || '—'}</p>
                            </div>
                          </div>

                          {app.notes && (
                            <div className="bg-white p-3 rounded-lg border border-gray-200">
                              <p className="text-xs font-semibold text-gray-500 mb-1">Applicant Notes</p>
                              <p className="text-sm text-gray-800">{app.notes}</p>
                            </div>
                          )}

                          {app.status === 'pending' && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (optional)</label>
                                <textarea
                                  value={adminNotes[app.id] || ''}
                                  onChange={(e) => setAdminNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                                  rows={2}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                  placeholder="Internal notes about this application..."
                                />
                              </div>
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => handleApprove(app)}
                                  disabled={processingId === app.id}
                                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {processingId === app.id ? (
                                    <span className="flex items-center"><i className="ri-loader-4-line animate-spin mr-1"></i> Processing...</span>
                                  ) : (
                                    <><i className="ri-check-line mr-1"></i> Approve</>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleReject(app)}
                                  disabled={processingId === app.id}
                                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <i className="ri-close-line mr-1"></i> Reject
                                </button>
                              </div>
                            </div>
                          )}

                          {app.admin_notes && app.status !== 'pending' && (
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                              <p className="text-xs font-semibold text-blue-600 mb-1">Admin Notes</p>
                              <p className="text-sm text-blue-800">{app.admin_notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'approved' && (
            <div>
              {wholesalers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <i className="ri-user-star-line text-4xl mb-3 block"></i>
                  <p className="font-semibold">No approved wholesalers yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Wholesaler</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Email</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Phone</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-600">Approved</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wholesalers.map(w => (
                        <tr key={w.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <i className="ri-user-star-line text-green-600 text-sm"></i>
                              </div>
                              <span className="font-medium text-gray-900">{w.full_name || '—'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{w.email}</td>
                          <td className="py-3 px-4 text-gray-600">{w.phone || '—'}</td>
                          <td className="py-3 px-4 text-gray-600">
                            {w.wholesale_approved_at
                              ? new Date(w.wholesale_approved_at).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleRevoke(w)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium cursor-pointer"
                            >
                              Revoke Access
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
