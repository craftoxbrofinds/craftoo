import { createClient } from '@supabase/supabase-js'

export type BrandSettings = {
  name: string
  tagline: string
  site_url: string
  favicon_url: string
}

export type ContactSettings = {
  phone: string
  whatsapp: string
  email: string
  address: string
  hours: string
}

export type SocialSettings = {
  instagram: string
  facebook: string
  youtube: string
}

export type AnnouncementSettings = {
  messages: string[]
  enabled: boolean
}

export type SeoSettings = {
  title: string
  description: string
  og_image: string
}

export type SettingsMap = {
  brand: BrandSettings
  contact: ContactSettings
  social: SocialSettings
  announcement: AnnouncementSettings
  seo: SeoSettings
}

export const SETTING_DEFAULTS: SettingsMap = {
  brand: {
    name: 'Craftoo',
    tagline: '',
    site_url: '',
    favicon_url: '/favicon.ico',
  },
  contact: {
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    hours: '',
  },
  social: {
    instagram: '',
    facebook: '',
    youtube: '',
  },
  announcement: {
    messages: [],
    enabled: true,
  },
  seo: {
    title: 'Craftoo',
    description: '',
    og_image: '',
  },
}

export async function getSiteSettingServer<K extends keyof SettingsMap>(
  key: K
): Promise<SettingsMap[K]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .single()
    if (data?.value) {
      return { ...SETTING_DEFAULTS[key], ...(data.value as SettingsMap[K]) }
    }
  } catch {}
  return SETTING_DEFAULTS[key]
}
