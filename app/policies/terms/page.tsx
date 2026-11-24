import { PolicyLayout } from '@/components/policy-layout'
import { getSiteSettingServer } from '@/lib/site-settings'
import { FREE_SHIPPING_THRESHOLD } from '@/lib/shipping'
import { MAX_GIFT_PHOTOS } from '@/lib/gift-extras'

export const metadata = { title: 'Terms & Conditions — Craftoo' }
export const revalidate = 300

const listItem = (text: string, mark = '—', markCls = 'text-rich-gold') => (
  <li key={text} className="flex gap-3">
    <span className={`${markCls} shrink-0`}>{mark}</span>
    <span>{text}</span>
  </li>
)

export default async function TermsAndConditions() {
  const contact = await getSiteSettingServer('contact')
  const reachUs = contact.email ? `email us at ${contact.email} or message us on WhatsApp` : 'message us on WhatsApp'
  const threshold = `₹${FREE_SHIPPING_THRESHOLD.toLocaleString('en-IN')}`

  return (
    <PolicyLayout
      badge="Policies"
      title="Terms & Conditions"
      lastUpdated="November 2026"
      intro="These terms apply when you use the Craftoo website, create an account, play Flower Quest or place an order with us. By doing any of these, you agree to them. Please read them carefully."
      sections={[
        {
          heading: 'Who can order',
          body: 'You must be at least 18 years old, or have a parent or guardian’s permission, to create an account or place an order. You agree that the details you give us (name, phone, email and delivery address) are true and up to date.',
        },
        {
          heading: 'Your account',
          body: 'Keep your password private. You are responsible for what happens on your account. If you think someone else has used it, tell us straight away. Your saved details and one delivery address are kept on your profile and used to fill in checkout for you; you can change them at any time.',
        },
        {
          heading: 'How ordering works',
          body: (
            <ul className="space-y-2 ml-4">
              {[
                'When you tap “Send on WhatsApp”, your order is saved on our website and WhatsApp opens with your order details filled in. Your cart is cleared once the order is saved.',
                'Your order is a request. It is confirmed only when our team replies on WhatsApp and sends you the final bill.',
                'Prices shown at checkout are estimates. The final bill includes any delivery charge and the cost of any gift extras you asked for.',
                'We may decline or cancel an order, for example if an item is out of stock, a price is shown in error, or we suspect misuse.',
              ].map(t => listItem(t))}
            </ul>
          ),
        },
        {
          heading: 'Prices and payment',
          body: 'All prices are in Indian Rupees (₹). We currently take payment by UPI, after our team confirms your order and sends the final bill. Please pay only to the payment details we share in our official WhatsApp chat.',
        },
        {
          heading: 'Delivery',
          body: `Delivery is free on orders of ${threshold} and above, based on the product total before any coupon. For smaller orders, the delivery charge is added to your final bill. See our Shipping Policy for delivery times.`,
        },
        {
          heading: 'Customization and your photos',
          body: (
            <ul className="space-y-2 ml-4">
              {[
                'You can ask for gift extras such as chocolates or your own photo. Our team will call you to confirm your customization before we start.',
                `If you choose “Your photo”, you upload up to ${MAX_GIFT_PHOTOS} photos (JPG, PNG or WebP) on our website. We use them only to make your order.`,
                'Upload only photos you own or have permission to use. Don’t upload anything unlawful, offensive or that shows someone who hasn’t agreed to it. We may refuse an order that breaks this rule.',
                'Customized items are made for you, so they may not be returnable unless they arrive damaged or wrong.',
              ].map(t => listItem(t))}
            </ul>
          ),
        },
        {
          heading: 'Cancellations and changes',
          body: 'Orders can’t be cancelled on the website. To cancel or change an order, message us on WhatsApp with your order number as soon as possible. We can usually help until the order is shipped or work on a customized item has started.',
        },
        {
          heading: 'Flower Quest and coupons',
          body: (
            <ul className="space-y-2 ml-4">
              {[
                'Flower Quest is a free game. Signed-in players who reach a reward score can claim a discount coupon.',
                'Each account can hold one Flower Quest coupon. A coupon belongs to that account, works on one order only, and has a minimum order value, a maximum discount and an expiry date shown with the code.',
                'The discount applies to product prices only, not delivery or gift extras.',
                'A coupon is held for an order as soon as you send it, and is used up once our team confirms that order. If the order is cancelled, the coupon can be used again until it expires.',
                'Coupons have no cash value and can’t be exchanged or transferred. We may cancel coupons gained through cheating, automated play or misuse.',
              ].map(t => listItem(t))}
            </ul>
          ),
        },
        {
          heading: 'Product images',
          body: 'Our products are handmade, so each piece can differ slightly from the photos. Colours may also look different on different screens.',
        },
        {
          heading: 'Our content',
          body: 'The text, photos, logos and designs on this website belong to Craftoo. Please don’t copy or reuse them without our written permission.',
        },
        {
          heading: 'Things you must not do',
          body: (
            <ul className="space-y-2 ml-4">
              {[
                'Use the website for anything unlawful',
                'Place fake or fraudulent orders',
                'Try to break into, overload or disrupt the website',
                'Cheat at Flower Quest, for example with scripts or bots',
                'Copy or scrape our website without permission',
                'Pretend to be someone else',
              ].map(t => listItem(t, '✗', 'text-red-400/70'))}
            </ul>
          ),
        },
        {
          heading: 'Our responsibility',
          body: 'We take care to make and deliver your order well. If something goes wrong, our responsibility is limited to the amount you paid for that order. We are not responsible for indirect losses. Nothing in these terms takes away your rights under Indian consumer law.',
        },
        {
          heading: 'Law',
          body: 'These terms are governed by the laws of India.',
        },
        {
          heading: 'Changes to these terms',
          body: 'We may update these terms from time to time. The date at the top shows the latest version. Orders are covered by the terms in place when you placed them.',
        },
        {
          heading: 'Contact',
          body: `Questions about these terms? Please ${reachUs}.`,
        },
      ]}
      relatedLinks={[
        { label: 'Privacy Policy', href: '/policies/privacy' },
        { label: 'Shipping Policy', href: '/policies/shipping' },
      ]}
    />
  )
}
