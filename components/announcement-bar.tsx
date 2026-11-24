'use client'

import { useSiteSettings } from '@/hooks/use-site-settings'

const FALLBACK_MESSAGES = [
  '✦ FREE SHIPPING on Orders of ₹1,000 and Above',
  '✦ 20% OFF on Your First Order · Use: FIRST20',
  '✦ Easy 7-Day Returns — No Questions Asked',
  '✦ New Collection Arrived — Shop Now',
  '✦ Secure Payments · UPI · Cards · Wallets',
]

export function AnnouncementBar() {
  const { messages, enabled } = useSiteSettings('announcement')

  if (!enabled) return null

  const display = messages.length > 0 ? messages : FALLBACK_MESSAGES
  const repeated = [...display, ...display]

  return (
    <div className="relative w-full z-[9999] overflow-hidden py-2" style={{ background: 'linear-gradient(90deg, #f1eaf8 0%, #fff9f2 50%, #f1eaf8 100%)', borderBottom: '1px solid #dccff0' }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #9B8AC4, #DCCFF0, #9B8AC4, transparent)' }} />

      <div className="flex animate-marquee-ltr whitespace-nowrap">
        {repeated.map((msg, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 font-syndicatgrotesk text-[10px] tracking-[0.2em] uppercase px-8"
            style={{ color: i % 3 === 0 ? '#7565A5' : '#7D7484' }}
          >
            {msg}
          </span>
        ))}
      </div>
    </div>
  )
}
