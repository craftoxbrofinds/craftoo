import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import Link from 'next/link'
import { WHATSAPP_NUMBER } from '@/lib/whatsapp-order'

interface Section {
  /** Anchor for links such as /policies/privacy#cookies. */
  id?: string
  heading: string
  body: string | React.ReactNode
}

interface PolicyLayoutProps {
  badge: string
  title: string
  lastUpdated: string
  intro: string
  sections: Section[]
  relatedLinks?: { label: string; href: string }[]
}

export function PolicyLayout({ badge, title, lastUpdated, intro, sections, relatedLinks }: PolicyLayoutProps) {
  return (
    <div className="min-h-screen bg-site-black">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-px bg-gradient-to-r from-transparent to-rich-gold" />
            <span className="font-syndicatgrotesk text-[9px] tracking-[0.35em] uppercase text-rich-gold/80">{badge}</span>
            <div className="w-10 h-px bg-gradient-to-l from-transparent to-rich-gold" />
          </div>
          <h1 className="font-brandon text-3xl sm:text-4xl font-black uppercase tracking-tight text-ivory mb-3">
            {title}
          </h1>
          <p className="font-syndicatgrotesk text-[10px] tracking-[0.15em] uppercase text-muted-taupe">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Intro */}
        <p className="font-syndicatgrotesk text-sm text-ivory/70 leading-relaxed mb-12 pb-8 border-b border-[#e9e1ed]">
          {intro}
        </p>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((s, i) => (
            <div key={i} id={s.id} className="scroll-mt-28">
              <h2 className="font-brandon text-base font-black uppercase tracking-[0.1em] text-ivory mb-3 flex items-center gap-3">
                <span className="font-syndicatgrotesk text-[10px] text-rich-gold/60 font-normal normal-case tracking-[0.1em]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.heading}
              </h2>
              {typeof s.body === 'string' ? (
                <p className="font-syndicatgrotesk text-sm text-muted-taupe leading-relaxed">{s.body}</p>
              ) : (
                <div className="font-syndicatgrotesk text-sm text-muted-taupe leading-relaxed">{s.body}</div>
              )}
            </div>
          ))}
        </div>

        {/* Related policies */}
        {relatedLinks && relatedLinks.length > 0 && (
          <div className="mt-14 pt-8 border-t border-[#e9e1ed]">
            <p className="font-syndicatgrotesk text-[10px] tracking-[0.2em] uppercase text-rich-gold/70 mb-4">Related Policies</p>
            <div className="flex flex-wrap gap-3">
              {relatedLinks.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-4 py-2 border border-[#dccff0] bg-white font-syndicatgrotesk text-xs text-muted-taupe hover:border-rich-gold/40 hover:text-rich-gold transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Help CTA */}
        <div className="mt-10 px-6 py-5 bg-white border border-[#dccff0] flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex-1">
            <p className="font-brandon text-sm font-black uppercase tracking-tight text-ivory mb-1">Still have questions?</p>
            <p className="font-syndicatgrotesk text-xs text-muted-taupe">Our team is happy to help via WhatsApp or email.</p>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-5 py-2.5 bg-[#7565a5] text-white font-syndicatgrotesk text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-[#5b4d8a] transition-colors text-center"
          >
            WhatsApp Us
          </a>
        </div>
      </div>

      <Footer />
    </div>
  )
}
