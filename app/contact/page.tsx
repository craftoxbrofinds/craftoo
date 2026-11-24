import Link from 'next/link'
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { getSiteSettingServer } from '@/lib/site-settings'
import { WHATSAPP_NUMBER } from '@/lib/whatsapp-order'

export const revalidate = 300

export async function generateMetadata() {
  const brand = await getSiteSettingServer('brand')
  return { title: `Contact Us — ${brand.name || 'Craftoo'}` }
}

/** "+91 91489 97472" from "919148997472". */
function formatIndianNumber(digits: string): string {
  const local = digits.replace(/^91(?=\d{10}$)/, '')
  return /^\d{10}$/.test(local) ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : `+${digits}`
}

export default async function ContactPage() {
  const [contact, brand] = await Promise.all([getSiteSettingServer('contact'), getSiteSettingServer('brand')])
  const storeName = brand.name || 'Craftoo'

  // WhatsApp and phone fall back to the number orders are sent to, so customers can always reach us.
  const waDigits = (contact.whatsapp || contact.phone || '').replace(/[^0-9]/g, '') || WHATSAPP_NUMBER
  const whatsappLabel = contact.whatsapp || formatIndianNumber(waDigits)
  const phoneLabel = contact.phone || formatIndianNumber(waDigits)
  const phoneHref = `tel:${(contact.phone || `+${waDigits}`).replace(/[^\d+]/g, '')}`
  const whatsappHref = `https://wa.me/${waDigits}?text=${encodeURIComponent(`Hello ${storeName}, I have a question.`)}`

  const rows = [
    { Icon: MessageCircle, title: 'WhatsApp', body: <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="hover:text-rich-gold">{whatsappLabel}</a>, note: 'The quickest way to reach us, for orders, custom requests and anything else.' },
    { Icon: Phone, title: 'Phone', body: <a href={phoneHref} className="hover:text-rich-gold">{phoneLabel}</a> },
    ...(contact.email ? [{ Icon: Mail, title: 'Email', body: <a href={`mailto:${contact.email}`} className="break-all hover:text-rich-gold">{contact.email}</a> }] : []),
    ...(contact.address ? [{ Icon: MapPin, title: 'Address', body: <span className="whitespace-pre-line">{contact.address}</span> }] : []),
    ...(contact.hours ? [{ Icon: Clock, title: 'Hours', body: <span className="whitespace-pre-line">{contact.hours}</span> }] : []),
  ]

  return (
    <div className="min-h-screen bg-site-black">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-px bg-gradient-to-r from-transparent to-rich-gold" />
            <span className="font-syndicatgrotesk text-[9px] tracking-[0.35em] uppercase text-rich-gold">Get in Touch</span>
            <div className="w-10 h-px bg-gradient-to-l from-transparent to-rich-gold" />
          </div>
          <h1 className="font-brandon text-3xl sm:text-4xl font-black uppercase tracking-tight text-ivory mb-3">Contact Us</h1>
          <p className="font-syndicatgrotesk text-sm text-muted-taupe leading-relaxed">
            Questions about a gift, a custom order or an order you’ve placed? We’re happy to help.
          </p>
        </div>

        {/* WhatsApp first: it's how orders are confirmed */}
        <div className="mb-8 flex flex-col gap-4 border border-[#dccff0] bg-white px-6 py-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex-1">
            <p className="font-brandon text-sm font-black uppercase tracking-tight text-ivory mb-1">Chat with us on WhatsApp</p>
            <p className="font-syndicatgrotesk text-xs text-muted-taupe">Message us any time and our team will reply as soon as we can.</p>
          </div>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 bg-[#1f8f4e] px-5 py-3 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#177a41]"
          >
            <MessageCircle size={14} aria-hidden="true" /> WhatsApp us
          </a>
        </div>

        <ul className="divide-y divide-[#e9e1ed] border border-[#e9e1ed] bg-white">
          {rows.map(({ Icon, title, body, note }) => (
            <li key={title} className="flex gap-4 px-6 py-5">
              <span className="grid h-9 w-9 shrink-0 place-items-center bg-[#f4eefb] text-rich-gold">
                <Icon size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 font-syndicatgrotesk">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-taupe">{title}</p>
                <div className="mt-0.5 text-sm text-ivory">{body}</div>
                {note && <p className="mt-1 text-xs leading-5 text-muted-taupe">{note}</p>}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 font-syndicatgrotesk text-xs leading-6 text-muted-taupe">
          Placed an order? You can see its status in{' '}
          <Link href="/orders" className="text-rich-gold hover:underline">My Orders</Link>. See also our{' '}
          <Link href="/policies/shipping" className="text-rich-gold hover:underline">Shipping Policy</Link> and{' '}
          <Link href="/policies/terms" className="text-rich-gold hover:underline">Terms &amp; Conditions</Link>.
        </p>
      </div>

      <Footer />
    </div>
  )
}
