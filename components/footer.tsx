'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { categoryService } from '@/services/category.service'
import { useSiteSettings } from '@/hooks/use-site-settings'
import { openCookieSettings } from '@/lib/cookie-consent'

const POLICY_LINKS = [
  { label: 'Shipping',   href: '/policies/shipping' },
  // Temporarily hidden: returns link in the Info section.
  // { label: 'Returns',    href: '/policies/returns' },
  { label: 'Privacy Policy',       href: '/policies/privacy' },
  { label: 'Terms & Conditions',   href: '/policies/terms' },
  // Temporarily hidden: orders link in the Info section.
  // { label: 'Orders',     href: '/orders' },
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

  const storeName = brand.name || 'Craftoo'

  return (
    <footer className="relative bg-[#f1eaf8] border-t border-[#dccff0] overflow-hidden">

      {/* Soft lavender glows, matching the rest of the site */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(117,101,165,0.12),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(155,138,196,0.10),transparent_50%)] pointer-events-none" />


      {/* ── MOBILE footer (< sm) ── */}
      <div className="sm:hidden relative z-10">

        {/* Big brand mark */}
        <div className="px-6 pt-10 pb-6 border-b border-[#dccff0]">
          <p className="font-brandon text-[1.9rem] font-black uppercase tracking-tighter text-[#3f3a46] leading-none whitespace-nowrap">
            {storeName.includes(' ') ? (
              <>
                {storeName.split(' ').slice(0, -1).join(' ')}{' '}
                <span className="text-[#7565a5]">{storeName.split(' ').slice(-1)[0]}</span>
              </>
            ) : (
              <span className="text-[#7565a5]">{storeName}</span>
            )}
          </p>
          <img
            src="/images/logo/craftoo-logo-round-256.png"
            alt="Craftoo"
            width={72}
            height={72}
            loading="lazy"
            className="mt-4 h-[72px] w-[72px] object-contain drop-shadow-[0_6px_14px_rgba(117,101,165,0.18)]"
          />
        </div>

        {/* Social row */}
        {socialLinks.length > 0 && (
          <div className="px-6 py-5 border-b border-[#dccff0]">
            <p className="font-syndicatgrotesk text-[8px] tracking-[0.4em] uppercase text-[#7565a5] mb-4">Follow Us</p>
            <div className="flex items-center gap-3">
              {socialLinks.map(({ href, label, svg }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex items-center gap-2.5 px-4 py-2.5 border border-[#dccff0] bg-white/70 text-[#7d7484] hover:border-[#7565a5] hover:text-[#7565a5] hover:bg-white transition-all duration-200"
                >
                  {svg}
                  <span className="font-syndicatgrotesk text-[9px] tracking-[0.15em] uppercase">{label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Quick links — horizontal pill tags */}
        <div className="px-6 py-5 border-b border-[#dccff0]">
          <p className="font-syndicatgrotesk text-[8px] tracking-[0.4em] uppercase text-[#7565a5] mb-3">Collections</p>
          <div className="flex flex-wrap gap-2">
            {discoverLinks.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="px-3 py-1.5 border border-[#dccff0] bg-white/70 font-syndicatgrotesk text-[9px] tracking-[0.15em] uppercase text-[#7d7484] hover:border-[#7565a5] hover:text-[#7565a5] hover:bg-white transition-all duration-200"
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* Policies */}
        <div className="px-6 py-5 border-b border-[#dccff0]">
          <p className="font-syndicatgrotesk text-[8px] tracking-[0.4em] uppercase text-[#7565a5] mb-3">Info</p>
          <div className="flex flex-wrap gap-2">
            {POLICY_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="px-3 py-1.5 border border-[#dccff0] bg-white/70 font-syndicatgrotesk text-[9px] tracking-[0.15em] uppercase text-[#7d7484] hover:border-[#7565a5] hover:text-[#7565a5] hover:bg-white transition-all duration-200"
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={openCookieSettings}
              className="px-3 py-1.5 border border-[#dccff0] bg-white/70 font-syndicatgrotesk text-[9px] tracking-[0.15em] uppercase text-[#7d7484] hover:border-[#7565a5] hover:text-[#7565a5] hover:bg-white transition-all duration-200"
            >
              Cookie settings
            </button>
          </div>
        </div>

        {/* Temporarily hidden: footer trust marquee. */}
        {/* <div className="overflow-hidden border-b border-[#dccff0] py-3 bg-white/60">
          <div className="flex animate-marquee-ltr whitespace-nowrap">
            {[...TRUST, ...TRUST, ...TRUST].map((t, i) => (
              <span key={i} className="inline-flex items-center gap-2 px-6 font-syndicatgrotesk text-[8px] tracking-[0.3em] uppercase text-[#7565a5]">
                <span className="text-[#9b8ac4]">{t.icon}</span>
                {t.label}
              </span>
            ))}
          </div>
        </div> */}

        {/* Bottom */}
        <div className="px-6 py-5 flex items-center justify-between">
          <p className="font-syndicatgrotesk text-[8px] text-[#7d7484] tracking-wider">
            © {new Date().getFullYear()} {storeName}
          </p>
          {/* Temporarily hidden: payment-method labels. */}
          {/* <div className="flex gap-3">
            {['UPI', 'VISA', 'RuPay'].map(m => (
              <span key={m} className="font-syndicatgrotesk text-[8px] tracking-[0.15em] uppercase text-[#7d7484]">{m}</span>
            ))}
          </div> */}
        </div>
      </div>

      {/* ── DESKTOP footer (sm+) ── */}
      <div className="hidden sm:block relative z-10">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-12">

            {/* Brand */}
            <div className="space-y-5">
              <div>
                <p className="font-brandon text-base font-black tracking-[0.22em] text-[#3f3a46] uppercase leading-none">
                  {storeName}
                </p>
                <img
                  src="/images/logo/craftoo-logo-round-256.png"
                  alt="Craftoo"
                  width={88}
                  height={88}
                  loading="lazy"
                  className="mt-4 h-[88px] w-[88px] object-contain drop-shadow-[0_8px_18px_rgba(117,101,165,0.18)]"
                />
              </div>
              {brand.tagline && (
                <p className="font-syndicatgrotesk text-xs text-[#7d7484] leading-relaxed max-w-xs">
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
                      className="w-9 h-9 flex items-center justify-center border border-[#dccff0] text-[#7d7484] hover:border-[#7565a5] hover:text-[#7565a5] hover:bg-white transition-all duration-200"
                    >
                      {svg}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Discover */}
            <div className="space-y-4">
              <h4 className="font-brandon text-xs font-black uppercase tracking-[0.22em] text-[#3f3a46]">Discover</h4>
              <div className="w-8 h-px bg-[#9b8ac4]" />
              <ul className="space-y-2.5">
                {discoverLinks.map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="font-syndicatgrotesk text-xs text-[#7d7484] hover:text-[#7565a5] transition-colors duration-200">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Policies */}
            <div className="space-y-4">
              <h4 className="font-brandon text-xs font-black uppercase tracking-[0.22em] text-[#3f3a46]">Policies</h4>
              <div className="w-8 h-px bg-[#9b8ac4]" />
              <ul className="space-y-2.5">
                {/* Track Order is temporarily hidden with the customer order links. */}
                {[...POLICY_LINKS /*, { label: 'Track Order', href: '/orders' } */].map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="font-syndicatgrotesk text-xs text-[#7d7484] hover:text-[#7565a5] transition-colors duration-200">
                      {label}
                    </Link>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={openCookieSettings}
                    className="font-syndicatgrotesk text-xs text-[#7d7484] hover:text-[#7565a5] transition-colors duration-200"
                  >
                    Cookie settings
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h4 className="font-brandon text-xs font-black uppercase tracking-[0.22em] text-[#3f3a46]">Contact</h4>
              <div className="w-8 h-px bg-[#9b8ac4]" />
              <ul className="space-y-2.5">
                {contact.phone && (
                  <li>
                    <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="font-syndicatgrotesk text-xs text-[#7d7484] hover:text-[#7565a5] transition-colors duration-200">
                      {contact.phone}
                    </a>
                  </li>
                )}
                {contact.whatsapp && (
                  <li>
                    <a href={`https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, '')}`} className="font-syndicatgrotesk text-xs text-[#7d7484] hover:text-[#7565a5] transition-colors duration-200">
                      WhatsApp: {contact.whatsapp}
                    </a>
                  </li>
                )}
                {contact.email && (
                  <li>
                    <a href={`mailto:${contact.email}`} className="font-syndicatgrotesk text-xs text-[#7d7484] hover:text-[#7565a5] transition-colors duration-200">
                      {contact.email}
                    </a>
                  </li>
                )}
                {contact.address && (
                  <li className="font-syndicatgrotesk text-xs text-[#7d7484] leading-relaxed whitespace-pre-line">
                    {contact.address}
                  </li>
                )}
              </ul>
              <div className="pt-1">
                <a href="/signup" className="inline-flex items-center gap-1.5 font-syndicatgrotesk text-[9px] tracking-[0.2em] uppercase px-4 py-2 border border-[#9b8ac4] text-[#3f3a46] hover:border-[#7565a5] hover:text-[#7565a5] transition-all duration-200">
                  Create Account →
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-[#dccff0] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-syndicatgrotesk text-[10px] tracking-wider text-[#7d7484]">
              © {new Date().getFullYear()} {storeName} · Handmade with care
            </p>
            <div className="flex flex-wrap items-center gap-4 font-syndicatgrotesk text-[10px] tracking-wider text-[#7d7484]">
              <Link href="/policies/privacy" className="hover:text-[#7565a5]">Privacy Policy</Link>
              <Link href="/policies/terms" className="hover:text-[#7565a5]">Terms &amp; Conditions</Link>
              <button type="button" onClick={openCookieSettings} className="hover:text-[#7565a5]">Cookie settings</button>
            </div>
          </div>

          {/* Temporarily hidden: footer trust strip. */}
          {/* <div className="border-t border-[#dccff0] mt-12 pt-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
              {[
                { label: 'Free Shipping', sub: 'On orders of ₹1,000 and above' },
                { label: 'Cash on Delivery', sub: 'Pay when you receive' },
                { label: '7-Day Returns', sub: 'Hassle-free process' },
                { label: 'Handmade With Care', sub: 'Thoughtfully crafted gifts' },
              ].map(({ label, sub }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-[#9b8ac4] shrink-0" />
                  <div>
                    <p className="font-brandon text-xs font-black uppercase tracking-wide text-[#3f3a46]">{label}</p>
                    <p className="font-syndicatgrotesk text-[10px] text-[#7d7484] mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#dccff0] pt-6">
              <p className="font-syndicatgrotesk text-[10px] tracking-wider text-[#7d7484] text-center sm:text-left">
                © 2025 {storeName} · All Rights Reserved · Made with love
              </p>
              <div className="flex flex-wrap items-center justify-end gap-4">
                {['UPI', 'VISA', 'Mastercard', 'RuPay'].map((method) => (
                  <span key={method} className="font-syndicatgrotesk text-[9px] tracking-[0.18em] uppercase text-[#7d7484]">
                    {method}
                  </span>
                ))}
              </div>
            </div>
          </div> */}
        </div>
      </div>

    </footer>
  )
}
