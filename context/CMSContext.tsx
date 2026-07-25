'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizePublicOrigin } from '@/lib/site-url';

interface SiteSettings {
    site_name: string;
    site_tagline: string;
    site_description: string;
    site_url: string;
    site_logo: string;
    og_image: string;
    contact_email: string;
    contact_phone: string;
    contact_address: string;
    social_facebook: string;
    social_instagram: string;
    social_twitter: string;
    social_tiktok: string;
    social_snapchat: string;
    social_youtube: string;
    primary_color: string;
    secondary_color: string;
    currency: string;
    currency_symbol: string;
    [key: string]: string;
}

interface CMSContent {
    id: string;
    section: string;
    block_key: string;
    title: string | null;
    subtitle: string | null;
    content: string | null;
    image_url: string | null;
    button_text: string | null;
    button_url: string | null;
    metadata: Record<string, any>;
    is_active: boolean;
}

interface Banner {
    id: string;
    name: string;
    type: string;
    title: string | null;
    subtitle: string | null;
    image_url: string | null;
    background_color: string;
    text_color: string;
    button_text: string | null;
    button_url: string | null;
    is_active: boolean;
    position: string;
    start_date: string | null;
    end_date: string | null;
}

interface CMSContextType {
    settings: SiteSettings;
    content: CMSContent[];
    banners: Banner[];
    loading: boolean;
    getContent: (section: string, blockKey: string) => CMSContent | undefined;
    getSetting: (key: string) => string;
    getActiveBanners: (position?: string) => Banner[];
    refreshCMS: () => Promise<void>;
}

const defaultSettings: SiteSettings = {
    site_name: '',
    site_tagline: '',
    site_description: '',
    site_url: '',
    site_logo: '',
    og_image: '',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    social_facebook: '',
    social_instagram: '',
    social_twitter: '',
    social_tiktok: '',
    social_snapchat: '',
    social_youtube: '',
    primary_color: '#2563eb',
    secondary_color: '#FBF6F2',
    currency: 'GHS',
    currency_symbol: 'GH₵',
};

const CMSContext = createContext<CMSContextType>({
    settings: defaultSettings,
    content: [],
    banners: [],
    loading: true,
    getContent: () => undefined,
    getSetting: () => '',
    getActiveBanners: () => [],
    refreshCMS: async () => { },
});

export function CMSProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
    const [content, setContent] = useState<CMSContent[]>([]);
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchCMSData = async () => {
        try {
            setLoading(true);
            const [settingsRes, contentRes, bannersRes] = await Promise.all([
                supabase.from('site_settings').select('key, value'),
                supabase.from('cms_content').select('*').eq('is_active', true),
                supabase.from('banners').select('*').eq('is_active', true)
            ]);

            if (settingsRes.data) {
                const newSettings: any = { ...defaultSettings };
                settingsRes.data.forEach((item: any) => {
                    // Handle potential JSON string wrapping if value is a JSON string
                    let val = item.value;
                    // Supabase might return it already parsed if it's JSONB, 
                    // but if stored as valid JSON string inside text it might be double quoted?
                    // My insert was: ' "foo" ' -> stored as JSON string "foo". 
                    // Supabase JS client for JSONB column returns usage JS value. 
                    // So if stored "foo" (json string), it returns 'foo' (string). Correct.
                    // But let's be safe.
                    newSettings[item.key] = val;
                });
                if (newSettings.site_url) {
                    newSettings.site_url = normalizePublicOrigin(newSettings.site_url);
                }
                setSettings(newSettings);
            }

            if (contentRes.data) setContent(contentRes.data);
            if (bannersRes.data) setBanners(bannersRes.data);

        } catch (error) {
            console.error('Error fetching CMS data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCMSData();
    }, []);

    const getContent = (section: string, blockKey: string): CMSContent | undefined => {
        return content.find(c => c.section === section && c.block_key === blockKey);
    };

    const getSetting = (key: string): string => {
        return settings[key] || defaultSettings[key] || '';
    };

    const getActiveBanners = (position?: string): Banner[] => {
        const now = new Date();
        return banners.filter(b => {
            if (position && b.position !== position) return false;
            // Handle potentially null dates properly
            if (b.start_date && new Date(b.start_date) > now) return false;
            if (b.end_date && new Date(b.end_date) < now) return false;
            return b.is_active;
        });
    };

    return (
        <CMSContext.Provider
            value={{
                settings,
                content,
                banners,
                loading,
                getContent,
                getSetting,
                getActiveBanners,
                refreshCMS: fetchCMSData,
            }}
        >
            {children}
        </CMSContext.Provider>
    );
}

export function useCMS() {
    // Never throw — a missing provider must not white-screen the storefront
    return useContext(CMSContext);
}

export default CMSContext;
