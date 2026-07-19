'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCMS } from '@/context/CMSContext';

export default function SiteSettings() {
    const { refreshCMS } = useCMS();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [settings, setSettings] = useState({
        site_name: '',
        contact_email: '',
        contact_phone: '',
        contact_address: '',
        site_logo: '',
        site_tagline: '',
        site_description: '',
        site_url: '',
        og_image: '',
        social_instagram: '',
        social_tiktok: '',
        announcement_text: '',
        announcement_bg_color: '#1e40af'
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase.from('site_settings').select('*');
            if (error) throw error;

            if (data) {
                const newSettings: any = { ...settings };
                data.forEach((item: any) => {
                    if (Object.keys(newSettings).includes(item.key)) {
                        newSettings[item.key] = item.value;
                    }
                });
                setSettings(newSettings);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = Object.entries(settings).map(([key, value]) => ({
                key,
                value, // Stored as JSONB, so string is fine (it becomes JSON string)
                updated_at: new Date().toISOString()
            }));

            const { error } = await supabase.from('site_settings').upsert(updates, { onConflict: 'key' });

            if (error) throw error;

            await refreshCMS(); // Refresh global context
            alert('Settings saved successfully!');
            // Optional: Reload page or context if needed, but simple alert is fine
        } catch (error: any) {
            console.error('Error saving settings:', error);
            alert('Failed to save settings: ' + (error.message || error.error_description || JSON.stringify(error)));
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        try {
            setSaving(true);
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `logo-${Date.now()}.${fileExt}`;
            const filePath = `site-assets/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('media') // reusing media bucket
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('media').getPublicUrl(filePath);

            handleChange('site_logo', data.publicUrl);
        } catch (error) {
            console.error('Error uploading logo:', error);
            alert('Failed to upload logo');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

    return (
        <div className="max-w-4xl mx-auto p-4 lg:p-8">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
                <h1 className="text-3xl font-bold text-gray-900">Site Settings</h1>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`bg-blue-700 hover:bg-blue-800 text-white font-medium py-2 px-6 rounded-lg transition-colors shadow-sm flex items-center ${saving ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                    {saving ? (
                        <>
                            <i className="ri-loader-4-line animate-spin mr-2"></i>
                            Saving...
                        </>
                    ) : (
                        'Save Changes'
                    )}
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 md:p-8 space-y-8">

                    {/* General Info */}
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="col-span-1">
                            <h3 className="text-lg font-semibold text-gray-900">General Information</h3>
                            <p className="text-sm text-gray-500 mt-1">Basic details about your online store.</p>
                        </div>
                        <div className="col-span-2 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
                                <input
                                    type="text"
                                    value={settings.site_name}
                                    onChange={(e) => handleChange('site_name', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                                <input
                                    type="text"
                                    value={settings.site_tagline}
                                    onChange={(e) => handleChange('site_tagline', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Contact Info */}
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="col-span-1">
                            <h3 className="text-lg font-semibold text-gray-900">Contact Details</h3>
                            <p className="text-sm text-gray-500 mt-1">Public contact information for customers.</p>
                        </div>
                        <div className="col-span-2 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
                                <input
                                    type="email"
                                    value={settings.contact_email}
                                    onChange={(e) => handleChange('contact_email', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Support Phone</label>
                                <input
                                    type="tel"
                                    value={settings.contact_phone}
                                    onChange={(e) => handleChange('contact_phone', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                <textarea
                                    value={settings.contact_address}
                                    onChange={(e) => handleChange('contact_address', e.target.value)}
                                    rows={3}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* SEO & Social Sharing */}
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="col-span-1">
                            <h3 className="text-lg font-semibold text-gray-900">SEO & Social Sharing</h3>
                            <p className="text-sm text-gray-500 mt-1">Meta tags, Open Graph, and social preview.</p>
                        </div>
                        <div className="col-span-2 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Site URL</label>
                                <input
                                    type="url"
                                    value={settings.site_url}
                                    onChange={(e) => handleChange('site_url', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="https://yoursite.com"
                                />
                                <p className="text-xs text-gray-500 mt-1">Canonical URL for sitemap, OG tags, and structured data.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                                <textarea
                                    value={settings.site_description}
                                    onChange={(e) => handleChange('site_description', e.target.value)}
                                    rows={2}
                                    maxLength={160}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Quality perfumes and products delivered across Ghana..."
                                />
                                <p className="text-xs text-gray-500 mt-1">160 chars max. Used in search results and social shares.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">OG Image (Social Share)</label>
                                <input
                                    type="text"
                                    value={settings.og_image}
                                    onChange={(e) => handleChange('og_image', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="https://... or /og-default.png"
                                />
                                <p className="text-xs text-gray-500 mt-1">1200×630px recommended. Falls back to logo if empty.</p>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Branding */}
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="col-span-1">
                            <h3 className="text-lg font-semibold text-gray-900">Branding & Social</h3>
                            <p className="text-sm text-gray-500 mt-1">Logo URL and Social Media Links.</p>
                        </div>
                        <div className="col-span-2 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Store Logo</label>
                                <div className="space-y-3">
                                    {settings.site_logo ? (
                                        <div className="flex items-center space-x-4">
                                            <div className="w-24 h-24 border border-gray-200 rounded-lg p-2 flex items-center justify-center bg-gray-50 relative group">
                                                <img
                                                    src={settings.site_logo}
                                                    alt="Store Logo"
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleChange('site_logo', '')}
                                                className="text-red-600 text-sm font-medium hover:text-red-700 hover:underline"
                                            >
                                                Remove Logo
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center w-full">
                                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <i className="ri-upload-cloud-2-line text-3xl text-gray-400 mb-2"></i>
                                                    <p className="text-sm text-gray-500"><span className="font-semibold">Click to upload</span> logo</p>
                                                    <p className="text-xs text-gray-400">PNG, JPG or SVG</p>
                                                </div>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={handleLogoUpload}
                                                />
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Instagram URL</label>
                                <input
                                    type="text"
                                    value={settings.social_instagram}
                                    onChange={(e) => handleChange('social_instagram', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="https://instagram.com/..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">TikTok URL</label>
                                <input
                                    type="text"
                                    value={settings.social_tiktok}
                                    onChange={(e) => handleChange('social_tiktok', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="https://www.tiktok.com/@..."
                                />
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Announcement Bar */}
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="col-span-1">
                            <h3 className="text-lg font-semibold text-gray-900">Announcement Bar</h3>
                            <p className="text-sm text-gray-500 mt-1">Configure the top bar notification.</p>
                        </div>
                        <div className="col-span-2 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Announcement Text</label>
                                <input
                                    type="text"
                                    value={settings.announcement_text}
                                    onChange={(e) => handleChange('announcement_text', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Free Store Pickup Available..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={settings.announcement_bg_color}
                                        onChange={(e) => handleChange('announcement_bg_color', e.target.value)}
                                        className="h-10 w-20 p-1 border border-gray-300 rounded cursor-pointer"
                                    />
                                    <span className="text-sm font-mono text-gray-600 uppercase">{settings.announcement_bg_color}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
                <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-700 hover:bg-blue-800 text-white font-medium py-2 px-6 rounded-lg transition-colors shadow-sm"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
