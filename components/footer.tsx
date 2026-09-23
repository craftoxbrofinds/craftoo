'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { categoryService } from '@/services/category.service'
import { useSiteSettings } from '@/hooks/use-site-settings'

const POLICY_LINKS = [
  { label: 'Shipping',   href: '/policies/shipping' },
  { label: 'Returns',    href: '/policies/returns' },
  { label: 'Privacy',    href: '/policies/privacy' },
  { label: 'Terms',      href: '/policies/terms' },
  { label: 'Orders',     href: '/orders' },
  { label: 'Contact Us', href: '/contact' },
]

const TRUST = [
  { icon: '✦', label: 'Free Shipping' },
  { icon: '✦', label: 'Cash on Delivery' },
  { icon: '✦', label: '7-Day Returns' },
  { icon: '✦', label: 'Handmade With Care' },
]

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function Footer() {
  const [discoverLinks, setDiscoverLinks] = useState<{ label: string; href: string }[]>([])
  const brand = useSiteSettings('brand')
  const contact = useSiteSettings('contact')
  const social = useSiteSettings('social')

  useEffect(() => {
    categoryService.getAll().then(cats => {
      setDiscoverLinks(
        cats.map(c => ({
          label: c.name,
          href: `/category/${c.slug || c.name.toLowerCase().replace(/\s+/g, '-')}`,
        }))
      )
    }).catch(() => {})
  }, [])

  const socialLinks = [
    social.instagram && { href: social.instagram, label: 'Instagram', svg: <InstagramIcon /> },
    social.facebook  && { href: social.facebook,  label: 'Facebook',  svg: <FacebookIcon /> },
    social.youtube   && { href: social.youtube,   label: 'YouTube',   svg: <YouTubeIcon /> },
  ].filter(Boolean) as { href: string; label: string; svg: React.ReactNode }[]

  const storeName = brand.name || 'My Store'

  return (
    <footer className="relative bg-[#f1eaf8] border-t border-[#dccff0] overflow-hidden">

      {/* Ambient gold glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(184,134,11,0.10),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(212,160,23,0.06),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(184,134,11,0.05),transparent_50%)] pointer-events-none" />

      {/* Subtle warm grid texture */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(212,160,23,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(212,160,23,0.8) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* ── MOBILE footer (< sm) ── */}
      <div className="sm:hidden relative z-10">

        {/* Big brand mark */}
        <div className="px-6 pt-10 pb-6 border-b border-[#B8860B]/15">
          <p className="font-brandon text-[1.9rem] font-black uppercase tracking-tighter text-white leading-none whitespace-nowrap">
            {storeName.includes(' ') ? (
              <>
                {storeName.split(' ').slice(0, -1).join(' ')}{' '}
                <span className="text-[#B8860B]">{storeName.split(' ').slice(-1)[0]}</span>
              </>
            ) : (
              <span className="text-[#B8860B]">{storeName}</span>
            )}
          </p>
        </div>

        {/* Social row */}
        {socialLinks.length > 0 && (
          <div className="px-6 py-5 border-b border-[#B8860B]/15">
            <p className="font-syndicatgrotesk text-[8px] tracking-[0.4em] uppercase text-[#B8860B]/35 mb-4">Follow Us</p>
            <div className="flex items-center gap-3">
              {socialLinks.map(({ href, label, svg }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex items-center gap-2.5 px-4 py-2.5 border border-[#B8860B]/20 bg-[#B8860B]/[0.04] text-[#7A6F62] hover:border-[#B8860B]/70 hover:text-[#B8860B] hover:bg-[#B8860B]/10 transition-all duration-200"
                >
                  {svg}
                  <span className="font-syndicatgrotesk text-[9px] tracking-[0.15em] uppercase">{label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Quick links — horizontal pill tags */}
        <div className="px-6 py-5 border-b border-[#B8860B]/15">
          <p className="font-syndicatgrotesk text-[8px] tracking-[0.4em] uppercase text-[#B8860B]/35 mb-3">Collections</p>
          <div className="flex flex-wrap gap-2">
            {discoverLinks.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="px-3 py-1.5 border border-[#B8860B]/20 bg-[#B8860B]/[0.04] font-syndicatgrotesk text-[9px] tracking-[0.15em] uppercase text-[#7A6F62] hover:border-[#B8860B]/70 hover:text-[#B8860B] hover:bg-[#B8860B]/10 transition-all duration-200"
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* Policies */}
        <div className="px-6 py-5 border-b border-[#B8860B]/15">
          <p className="font-syndicatgrotesk text-[8px] tracking-[0.4em] uppercase text-[#B8860B]/35 mb-3">Info</p>
          <div className="flex flex-wrap gap-2">
            {POLICY_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="px-3 py-1.5 border border-[#B8860B]/20 bg-[#B8860B]/[0.04] font-syndicatgrotesk text-[9px] tracking-[0.15em] uppercase text-[#7A6F62] hover:border-[#B8860B]/70 hover:text-[#B8860B] hover:bg-[#B8860B]/10 transition-all duration-200"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Trust marquee strip */}
        <div className="overflow-hidden border-b border-[#B8860B]/15 py-3 bg-[#B8860B]/[0.03]">
          <div className="flex animate-marquee-ltr whitespace-nowrap">
            {[...TRUST, ...TRUST, ...TRUST].map((t, i) => (
              <span key={i} className="inline-flex items-center gap-2 px-6 font-syndicatgrotesk text-[8px] tracking-[0.3em] uppercase text-[#B8860B]/60">
                <span className="text-[#B8860B]/40">{t.icon}</span>
                {t.label}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="px-6 py-5 flex items-center justify-between">
          <p className="font-syndicatgrotesk text-[8px] text-[#B8860B]/30 tracking-wider">
            © 2025 {storeName}
          </p>
          <div className="flex gap-3">
            {['UPI', 'VISA', 'RuPay'].map(m => (
              <span key={m} className="font-syndicatgrotesk text-[8px] tracking-[0.15em] uppercase text-[#B8860B]/30">{m}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── DESKTOP footer (sm+) ── */}
      <div className="hidden sm:block relative z-10">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-12">

            {/* Brand */}
            <div className="space-y-5">
              <div>
                <p className="font-brandon text-base font-black tracking-[0.22em] text-white uppercase leading-none">
                  {storeName}
                </p>
              </div>
              {brand.tagline && (
                <p className="font-syndicatgrotesk text-xs text-[#7A6F62] leading-relaxed max-w-xs">
                  {brand.tagline}
                </p>
              )}
              {socialLinks.length > 0 && (
                <div className="flex gap-2.5">
                  {socialLinks.map(({ href, label, svg }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="w-9 h-9 flex items-center justify-center border border-[#B8860B]/20 text-[#7A6F62] hover:border-[#B8860B] hover:text-[#B8860B] hover:bg-[#B8860B]/10 transition-all duration-200"
                    >
                      {svg}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Discover */}
            <div className="space-y-4">
              <h4 className="font-brandon text-xs font-black uppercase tracking-[0.22em] text-white">Discover</h4>
              <div className="w-8 h-px bg-[#B8860B]/40" />
              <ul className="space-y-2.5">
                {discoverLinks.map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="font-syndicatgrotesk text-xs text-[#7A6F62] hover:text-[#B8860B] transition-colors duration-200">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Policies */}
            <div className="space-y-4">
              <h4 className="font-brandon text-xs font-black uppercase tracking-[0.22em] text-white">Policies</h4>
              <div className="w-8 h-px bg-[#B8860B]/40" />
              <ul className="space-y-2.5">
                {[...POLICY_LINKS, { label: 'Track Order', href: '/orders' }].map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="font-syndicatgrotesk text-xs text-[#7A6F62] hover:text-[#B8860B] transition-colors duration-200">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h4 className="font-brandon text-xs font-black uppercase tracking-[0.22em] text-white">Contact</h4>
              <div className="w-8 h-px bg-[#B8860B]/40" />
              <ul className="space-y-2.5">
                {contact.phone && (
                  <li>
                    <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="font-syndicatgrotesk text-xs text-[#7A6F62] hover:text-[#B8860B] transition-colors duration-200">
                      {contact.phone}
                    </a>
                  </li>
                )}
                {contact.whatsapp && (
                  <li>
                    <a href={`https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, '')}`} className="font-syndicatgrotesk text-xs text-[#7A6F62] hover:text-[#B8860B] transition-colors duration-200">
                      WhatsApp: {contact.whatsapp}
                    </a>
                  </li>
                )}
                {contact.email && (
                  <li>
                    <a href={`mailto:${contact.email}`} className="font-syndicatgrotesk text-xs text-[#7A6F62] hover:text-[#B8860B] transition-colors duration-200">
                      {contact.email}
                    </a>
                  </li>
                )}
                {contact.address && (
                  <li className="font-syndicatgrotesk text-xs text-[#7A6F62] leading-relaxed whitespace-pre-line">
                    {contact.address}
                  </li>
                )}
              </ul>
              <div className="pt-1">
                <a href="/signup" className="inline-flex items-center gap-1.5 font-syndicatgrotesk text-[9px] tracking-[0.2em] uppercase px-4 py-2 border border-[#B8860B]/40 text-white hover:border-[#B8860B] hover:text-[#B8860B] transition-all duration-200">
                  Create Account →
                </a>
              </div>
            </div>
          </div>

          {/* Trust strip */}
          <div className="border-t border-[#B8860B]/15 mt-12 pt-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
              {[
                { label: 'Free Shipping', sub: 'On orders above ₹599' },
                { label: 'Cash on Delivery', sub: 'Pay when you receive' },
                { label: '7-Day Returns', sub: 'Hassle-free process' },
                { label: 'Handmade With Care', sub: 'Thoughtfully crafted gifts' },
              ].map(({ label, sub }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-[#B8860B]/30 shrink-0" />
                  <div>
                    <p className="font-brandon text-xs font-black uppercase tracking-wide text-white">{label}</p>
                    <p className="font-syndicatgrotesk text-[10px] text-[#7A6F62] mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#B8860B]/15 pt-6">
              <p className="font-syndicatgrotesk text-[10px] tracking-wider text-[#B8860B]/30 text-center sm:text-left">
                © 2025 {storeName} · All Rights Reserved · Made with love
              </p>
              <div className="flex flex-wrap items-center justify-end gap-4">
                {['UPI', 'VISA', 'Mastercard', 'RuPay'].map((method) => (
                  <span key={method} className="font-syndicatgrotesk text-[9px] tracking-[0.18em] uppercase text-[#B8860B]/30">
                    {method}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

    </footer>
  )
}
