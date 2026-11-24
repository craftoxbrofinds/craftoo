'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { bustSettingsCache } from '@/hooks/use-site-settings'
import {
  SETTING_DEFAULTS,
  type BrandSettings,
  type ContactSettings,
  type SocialSettings,
  type AnnouncementSettings,
  type SeoSettings,
} from '@/lib/site-settings'

type Tab = 'brand' | 'contact' | 'social' | 'announcement' | 'seo'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: 'brand',
    label: 'Brand',
    icon: (
      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    key: 'contact',
    label: 'Contact',
    icon: (
      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.49 6.49l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
  {
    key: 'social',
    label: 'Social',
    icon: (
      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
      </svg>
    ),
  },
  {
    key: 'announcement',
    label: 'Announcements',
    icon: (
      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    key: 'seo',
    label: 'SEO',
    icon: (
      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
]

function Input({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <div>
      <label className="block font-syndicatgrotesk text-[9px] tracking-[0.25em] uppercase text-white/40 mb-1.5">
        {label}
      </label>
      <input
        {...props}
        className="w-full px-3 py-2.5 bg-[#1A1A1A] border border-white/10 text-white/85 font-syndicatgrotesk text-sm focus:border-[#D4A017]/50 focus:outline-none focus:ring-1 focus:ring-[#D4A017]/20 transition-colors placeholder:text-white/20"
      />
      {hint && <p className="mt-1 font-syndicatgrotesk text-[9px] text-white/20 tracking-wider">{hint}</p>}
    </div>
  )
}

function Textarea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <div>
      <label className="block font-syndicatgrotesk text-[9px] tracking-[0.25em] uppercase text-white/40 mb-1.5">
        {label}
      </label>
      <textarea
        {...props}
        className="w-full px-3 py-2.5 bg-[#1A1A1A] border border-white/10 text-white/85 font-syndicatgrotesk text-sm focus:border-[#D4A017]/50 focus:outline-none focus:ring-1 focus:ring-[#D4A017]/20 transition-colors placeholder:text-white/20 resize-none"
      />
    </div>
  )
}

function SaveButton({
  saving,
  saved,
  onClick,
}: {
  saving: boolean
  saved: boolean
  onClick: () => void
}) {
  return (
    <div className="pt-4 border-t border-white/[0.06]">
      <button
        onClick={onClick}
        disabled={saving}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#D4A017] text-[#0D0D0D] font-brandon text-xs font-black tracking-[0.2em] uppercase hover:bg-[#F0C040] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? (
          <>
            <span className="w-3 h-3 border-2 border-[#0D0D0D]/40 border-t-[#0D0D0D] rounded-full animate-spin" />
            Saving…
          </>
        ) : saved ? (
          <>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Saved
          </>
        ) : (
          'Save Changes'
        )}
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('brand')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Tab | null>(null)

  const [brand, setBrand] = useState<BrandSettings>(SETTING_DEFAULTS.brand)
  const [contact, setContact] = useState<ContactSettings>(SETTING_DEFAULTS.contact)
  const [social, setSocial] = useState<SocialSettings>(SETTING_DEFAULTS.social)
  const [announcement, setAnnouncement] = useState<AnnouncementSettings>(SETTING_DEFAULTS.announcement)
  const [seo, setSeo] = useState<SeoSettings>(SETTING_DEFAULTS.seo)
  const [newMessage, setNewMessage] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['brand', 'contact', 'social', 'announcement', 'seo'])

      if (data) {
        for (const row of data) {
          const val = row.value as any
          if (row.key === 'brand') setBrand({ ...SETTING_DEFAULTS.brand, ...val })
          if (row.key === 'contact') setContact({ ...SETTING_DEFAULTS.contact, ...val })
          if (row.key === 'social') setSocial({ ...SETTING_DEFAULTS.social, ...val })
          if (row.key === 'announcement') setAnnouncement({ ...SETTING_DEFAULTS.announcement, ...val })
          if (row.key === 'seo') setSeo({ ...SETTING_DEFAULTS.seo, ...val })
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save(key: Tab, value: unknown) {
    setSaving(true)
    await supabase.from('site_settings').upsert({ key, value })
    bustSettingsCache(key)
    setSaving(false)
    setSaved(key)
    setTimeout(() => setSaved(null), 2500)
  }

  function addMessage() {
    const msg = newMessage.trim()
    if (!msg) return
    setAnnouncement(p => ({ ...p, messages: [...p.messages, msg] }))
    setNewMessage('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          {[0, 150, 300].map((d) => (
            <span key={d} className="w-2 h-2 bg-[#D4A017] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
          <span className="font-syndicatgrotesk text-[10px] tracking-[0.2em] uppercase text-white/30 ml-3">Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-brandon text-xl font-black tracking-[0.15em] uppercase text-[#1A1A1A]">
          Store Settings
        </h1>
        <p className="font-syndicatgrotesk text-[10px] tracking-[0.2em] uppercase text-[#8A7A6A] mt-1">
          Customize your store — changes reflect live on the website
        </p>
      </div>

      <div className="bg-[#0D0D0D] max-w-3xl">
        {/* Tab bar */}
        <div className="flex overflow-x-auto border-b border-white/[0.08]">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 font-syndicatgrotesk text-[9px] tracking-[0.2em] uppercase whitespace-nowrap transition-colors border-b-2 -mb-px flex-shrink-0 ${
                tab === t.key
                  ? 'text-[#D4A017] border-[#D4A017]'
                  : 'text-white/35 border-transparent hover:text-white/60'
              }`}
            >
              <span className={tab === t.key ? 'text-[#D4A017]' : 'text-white/25'}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-5">

          {/* ── BRAND ── */}
          {tab === 'brand' && (
            <>
              <div className="space-y-1 pb-4 border-b border-white/[0.06]">
                <p className="font-brandon text-sm font-black tracking-[0.15em] uppercase text-white">Brand Identity</p>
                <p className="font-syndicatgrotesk text-[9px] text-white/30 tracking-wider">Store name and identity shown across the site</p>
              </div>
              <Input
                label="Store Name"
                value={brand.name}
                onChange={e => setBrand(p => ({ ...p, name: e.target.value }))}
                placeholder="Brofinds"
              />
              <Input
                label="Tagline"
                value={brand.tagline}
                onChange={e => setBrand(p => ({ ...p, tagline: e.target.value }))}
                placeholder="Wear Gold Every Day."
                hint="Shown in the footer under your store name"
              />
              <Input
                label="Site URL"
                value={brand.site_url}
                onChange={e => setBrand(p => ({ ...p, site_url: e.target.value }))}
                placeholder="https://yourstore.com"
                hint="Used for SEO metadata base URL"
              />
              <Input
                label="Logo / Favicon URL"
                value={brand.favicon_url}
                onChange={e => setBrand(p => ({ ...p, favicon_url: e.target.value }))}
                placeholder="/images/logo/logo.png"
                hint="Path or URL to your logo image"
              />
              <SaveButton saving={saving} saved={saved === 'brand'} onClick={() => save('brand', brand)} />
            </>
          )}

          {/* ── CONTACT ── */}
          {tab === 'contact' && (
            <>
              <div className="space-y-1 pb-4 border-b border-white/[0.06]">
                <p className="font-brandon text-sm font-black tracking-[0.15em] uppercase text-white">Contact Info</p>
                <p className="font-syndicatgrotesk text-[9px] text-white/30 tracking-wider">Shown in the footer, contact page, and WhatsApp button</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input
                  label="Phone Number"
                  value={contact.phone}
                  onChange={e => setContact(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+91 7977109157"
                />
                <Input
                  label="WhatsApp Number"
                  value={contact.whatsapp}
                  onChange={e => setContact(p => ({ ...p, whatsapp: e.target.value }))}
                  placeholder="+91 91489 97472"
                  hint="Used for the floating WhatsApp button"
                />
              </div>
              <Input
                label="Email"
                type="email"
                value={contact.email}
                onChange={e => setContact(p => ({ ...p, email: e.target.value }))}
                placeholder="store@example.com"
              />
              <Textarea
                label="Address"
                value={contact.address}
                onChange={e => setContact(p => ({ ...p, address: e.target.value }))}
                placeholder={'Shop No. 1, Building Name,\nStreet, City – PIN'}
                rows={3}
              />
              <Input
                label="Business Hours"
                value={contact.hours}
                onChange={e => setContact(p => ({ ...p, hours: e.target.value }))}
                placeholder="Mon–Sat: 10 AM – 8 PM · Sun: 11 AM – 6 PM"
              />
              <SaveButton saving={saving} saved={saved === 'contact'} onClick={() => save('contact', contact)} />
            </>
          )}

          {/* ── SOCIAL ── */}
          {tab === 'social' && (
            <>
              <div className="space-y-1 pb-4 border-b border-white/[0.06]">
                <p className="font-brandon text-sm font-black tracking-[0.15em] uppercase text-white">Social Media</p>
                <p className="font-syndicatgrotesk text-[9px] text-white/30 tracking-wider">Full URLs shown in footer — leave blank to hide that icon</p>
              </div>
              <Input
                label="Instagram URL"
                value={social.instagram}
                onChange={e => setSocial(p => ({ ...p, instagram: e.target.value }))}
                placeholder="https://instagram.com/yourstore"
              />
              <Input
                label="Facebook URL"
                value={social.facebook}
                onChange={e => setSocial(p => ({ ...p, facebook: e.target.value }))}
                placeholder="https://facebook.com/yourpage"
              />
              <Input
                label="YouTube URL"
                value={social.youtube}
                onChange={e => setSocial(p => ({ ...p, youtube: e.target.value }))}
                placeholder="https://youtube.com/@yourchannel"
              />
              <SaveButton saving={saving} saved={saved === 'social'} onClick={() => save('social', social)} />
            </>
          )}

          {/* ── ANNOUNCEMENTS ── */}
          {tab === 'announcement' && (
            <>
              <div className="flex items-start justify-between pb-4 border-b border-white/[0.06]">
                <div className="space-y-1">
                  <p className="font-brandon text-sm font-black tracking-[0.15em] uppercase text-white">Announcement Bar</p>
                  <p className="font-syndicatgrotesk text-[9px] text-white/30 tracking-wider">Scrolling messages at the top of every page</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-0.5">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={announcement.enabled}
                      onChange={e => setAnnouncement(p => ({ ...p, enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-white/10 peer-checked:bg-[#D4A017]/40 rounded-full transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white/30 peer-checked:bg-[#D4A017] peer-checked:translate-x-5 transition-all" />
                  </div>
                  <span className="font-syndicatgrotesk text-[9px] tracking-widest uppercase text-white/30">
                    {announcement.enabled ? 'On' : 'Off'}
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                {announcement.messages.length === 0 && (
                  <p className="font-syndicatgrotesk text-[10px] text-white/20 tracking-wider py-2">No messages yet — add one below</p>
                )}
                {announcement.messages.map((msg, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-white/20 font-syndicatgrotesk text-[10px] w-5 text-right flex-shrink-0">{i + 1}</span>
                    <input
                      className="flex-1 px-3 py-2 bg-[#1A1A1A] border border-white/10 text-white/80 font-syndicatgrotesk text-xs focus:border-[#D4A017]/40 focus:outline-none transition-colors"
                      value={msg}
                      onChange={e => {
                        const msgs = [...announcement.messages]
                        msgs[i] = e.target.value
                        setAnnouncement(p => ({ ...p, messages: msgs }))
                      }}
                    />
                    <button
                      onClick={() => setAnnouncement(p => ({ ...p, messages: p.messages.filter((_, j) => j !== i) }))}
                      className="p-1.5 text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Remove"
                    >
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  className="flex-1 px-3 py-2 bg-[#1A1A1A] border border-white/10 text-white/80 font-syndicatgrotesk text-xs focus:border-[#D4A017]/40 focus:outline-none transition-colors placeholder:text-white/15"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="✦ New announcement message…"
                  onKeyDown={e => { if (e.key === 'Enter') addMessage() }}
                />
                <button
                  onClick={addMessage}
                  className="px-4 py-2 border border-[#D4A017]/30 text-[#D4A017] font-syndicatgrotesk text-[10px] tracking-widest uppercase hover:bg-[#D4A017]/10 transition-colors flex-shrink-0"
                >
                  + Add
                </button>
              </div>
              <p className="font-syndicatgrotesk text-[9px] text-white/15 tracking-wider -mt-2">
                Press Enter or click + Add · Drag to reorder is not yet supported
              </p>

              <SaveButton saving={saving} saved={saved === 'announcement'} onClick={() => save('announcement', announcement)} />
            </>
          )}

          {/* ── SEO ── */}
          {tab === 'seo' && (
            <>
              <div className="space-y-1 pb-4 border-b border-white/[0.06]">
                <p className="font-brandon text-sm font-black tracking-[0.15em] uppercase text-white">SEO &amp; Metadata</p>
                <p className="font-syndicatgrotesk text-[9px] text-white/30 tracking-wider">Controls how your store appears in Google and social link previews</p>
              </div>
              <Input
                label="Page Title"
                value={seo.title}
                onChange={e => setSeo(p => ({ ...p, title: e.target.value }))}
                placeholder="Brofinds — Gold Jewelry"
                hint="Shown in browser tab and Google results"
              />
              <Textarea
                label="Meta Description"
                value={seo.description}
                onChange={e => setSeo(p => ({ ...p, description: e.target.value }))}
                placeholder="Free shipping on orders of ₹1,000 and above. Easy 7-day returns. Shop handcrafted jewelry."
                rows={3}
              />
              <Input
                label="OG Image URL"
                value={seo.og_image}
                onChange={e => setSeo(p => ({ ...p, og_image: e.target.value }))}
                placeholder="https://yourstore.com/og-image.jpg"
                hint="Shown when your site is shared on WhatsApp, Twitter, etc. (1200×630px recommended)"
              />

              {/* Live preview */}
              <div className="mt-2 p-4 bg-white/[0.03] border border-white/[0.06]">
                <p className="font-syndicatgrotesk text-[9px] tracking-[0.2em] uppercase text-white/25 mb-3">Google Preview</p>
                <p className="font-syndicatgrotesk text-[11px] text-blue-400 truncate">{seo.title || 'Craftoo'}</p>
                <p className="font-syndicatgrotesk text-[10px] text-green-400/60 mt-0.5">{brand.site_url || 'https://yourstore.com'}</p>
                <p className="font-syndicatgrotesk text-[10px] text-white/40 mt-1 line-clamp-2">{seo.description || 'No description set.'}</p>
              </div>

              <SaveButton saving={saving} saved={saved === 'seo'} onClick={() => save('seo', seo)} />
            </>
          )}

        </div>
      </div>
    </div>
  )
}
