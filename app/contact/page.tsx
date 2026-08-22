import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { getSiteSettingServer } from '@/lib/site-settings'

export async function generateMetadata() {
  const brand = await getSiteSettingServer('brand')
  return { title: `Contact Us — ${brand.name || 'Brofinds'}` }
}

export default async function ContactPage() {
  const contact = await getSiteSettingServer('contact')
  const brand = await getSiteSettingServer('brand')

  const storeName = brand.name || 'Brofinds'
  const phone = contact.phone || ''
  const whatsapp = contact.whatsapp || contact.phone || ''
  const email = contact.email || ''
  const address = contact.address || ''
  const hours = contact.hours || ''
  const waNumber = whatsapp.replace(/[^0-9]/g, '')

  return (
    <div className="min-h-screen bg-site-black">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-px bg-gradient-to-r from-transparent to-rich-gold" />
            <span className="font-syndicatgrotesk text-[9px] tracking-[0.35em] uppercase text-rich-gold/80">Get in Touch</span>
            <div className="w-10 h-px bg-gradient-to-l from-transparent to-rich-gold" />
          </div>
          <h1 className="font-brandon text-3xl sm:text-4xl font-black uppercase tracking-tight text-ivory mb-3">
            Contact Us
          </h1>
          <p className="font-syndicatgrotesk text-sm text-ivory/70 leading-relaxed mt-6">
            We&apos;re here to help. Reach out to us via WhatsApp, email, or visit our store.
          </p>
        </div>

        <div className="space-y-10">

          {address && (
            <div>
              <h2 className="font-brandon text-base font-black uppercase tracking-[0.1em] text-ivory mb-3 flex items-center gap-3">
                <span className="font-syndicatgrotesk text-[10px] text-rich-gold/60 font-normal normal-case tracking-[0.1em]">01</span>
                Store Address
              </h2>
              <p className="font-syndicatgrotesk text-sm text-muted-taupe leading-relaxed whitespace-pre-line">
                {address}
              </p>
            </div>
          )}

          {phone && (
            <div>
              <h2 className="font-brandon text-base font-black uppercase tracking-[0.1em] text-ivory mb-3 flex items-center gap-3">
                <span className="font-syndicatgrotesk text-[10px] text-rich-gold/60 font-normal normal-case tracking-[0.1em]">02</span>
                Phone
              </h2>
              <a
                href={`tel:${phone.replace(/\s/g, '')}`}
                className="font-syndicatgrotesk text-sm text-muted-taupe hover:text-rich-gold transition-colors"
              >
                {phone}
              </a>
            </div>
          )}

          {waNumber && (
            <div>
              <h2 className="font-brandon text-base font-black uppercase tracking-[0.1em] text-ivory mb-3 flex items-center gap-3">
                <span className="font-syndicatgrotesk text-[10px] text-rich-gold/60 font-normal normal-case tracking-[0.1em]">03</span>
                WhatsApp
              </h2>
              <a
                href={`https://wa.me/${waNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-syndicatgrotesk text-sm text-muted-taupe hover:text-rich-gold transition-colors"
              >
                {whatsapp}
              </a>
            </div>
          )}

          {email && (
            <div>
              <h2 className="font-brandon text-base font-black uppercase tracking-[0.1em] text-ivory mb-3 flex items-center gap-3">
                <span className="font-syndicatgrotesk text-[10px] text-rich-gold/60 font-normal normal-case tracking-[0.1em]">04</span>
                Email
              </h2>
              <a
                href={`mailto:${email}`}
                className="font-syndicatgrotesk text-sm text-muted-taupe hover:text-rich-gold transition-colors"
              >
                {email}
              </a>
            </div>
          )}

          {hours && (
            <div>
              <h2 className="font-brandon text-base font-black uppercase tracking-[0.1em] text-ivory mb-3 flex items-center gap-3">
                <span className="font-syndicatgrotesk text-[10px] text-rich-gold/60 font-normal normal-case tracking-[0.1em]">05</span>
                Business Hours
              </h2>
              <p className="font-syndicatgrotesk text-sm text-muted-taupe leading-relaxed">
                {hours}
              </p>
            </div>
          )}

        </div>

        {waNumber && (
          <div className="mt-14 px-6 py-5 bg-[#111] border border-white/8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="flex-1">
              <p className="font-brandon text-sm font-black uppercase tracking-tight text-ivory mb-1">Chat with us on WhatsApp</p>
              <p className="font-syndicatgrotesk text-xs text-muted-taupe">Quick replies, 7 days a week.</p>
            </div>
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-5 py-2.5 bg-rich-gold text-[#0D0D0D] font-syndicatgrotesk text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-[#B8860B] transition-colors text-center"
            >
              WhatsApp Us
            </a>
          </div>
        )}

        {!phone && !email && !address && (
          <div className="mt-8 p-6 bg-[#111] border border-white/8 text-center">
            <p className="font-syndicatgrotesk text-sm text-muted-taupe">
              Contact details not configured yet.{' '}
              <a href="/admin/settings" className="text-rich-gold hover:underline">Set them in Admin → Settings</a>
            </p>
          </div>
        )}

      </div>

      <Footer />
    </div>
  )
}
