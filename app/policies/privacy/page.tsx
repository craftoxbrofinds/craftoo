import { PolicyLayout } from '@/components/policy-layout'
import { getSiteSettingServer } from '@/lib/site-settings'
import { CookieSettingsButton } from '@/components/cookie-settings-button'

export const metadata = { title: 'Privacy Policy — Craftoo' }
export const revalidate = 300

const bullet = (label: string, text: string) => (
  <li key={label} className="flex gap-3">
    <span className="text-rich-gold shrink-0">—</span>
    <span><span className="text-ivory">{label}:</span> {text}</span>
  </li>
)

const STORAGE = [
  { name: 'Sign-in session', kind: 'Browser storage', purpose: 'Keeps you signed in to your account.', lasts: 'Until you sign out', type: 'Essential' },
  { name: 'flower_quest_guest', kind: 'Cookie', purpose: 'Counts daily Flower Quest plays on this browser, so the daily limit is fair. It holds a random ID only.', lasts: '30 days', type: 'Essential' },
  { name: 'craftoo-gift-extras', kind: 'Browser storage', purpose: 'Remembers the gift extras you ticked and the links to photos you uploaded, while the items are in your cart.', lasts: 'Until the item leaves your cart or you sign out', type: 'Essential' },
  { name: 'craftoo:last-order, flowerQuestClaim', kind: 'Session storage', purpose: 'Shows your order confirmation after checkout, and keeps a game reward ready to claim after you sign in.', lasts: 'Until you close the tab', type: 'Essential' },
  { name: 'craftoo-cookie-consent', kind: 'Browser storage', purpose: 'Remembers your cookie choice.', lasts: 'Until you clear it', type: 'Essential' },
  { name: 'Vercel Analytics', kind: 'No cookies', purpose: 'Counts page visits anonymously so we can improve the store. It doesn’t identify you or follow you to other sites.', lasts: '—', type: 'Optional' },
]

export default async function PrivacyPolicy() {
  const contact = await getSiteSettingServer('contact')
  const reachUs = contact.email ? `email us at ${contact.email} or message us on WhatsApp` : 'message us on WhatsApp'

  return (
    <PolicyLayout
      badge="Policies"
      title="Privacy Policy"
      lastUpdated="November 2026"
      intro="Craftoo (“we”, “us”) cares about your privacy. This policy explains what personal data we collect when you use our website, place an order or play Flower Quest, why we collect it, who we share it with, and the choices you have."
      sections={[
        {
          heading: 'What we collect',
          body: (
            <ul className="space-y-2 ml-4">
              {bullet('Account', 'your email address and password when you sign up. Passwords are stored securely by our sign-in provider; we never see them.')}
              {bullet('Profile', 'your name, phone number, email for order updates and one delivery address. These are saved when you place an order or edit your profile.')}
              {bullet('Orders', 'the items you order, prices, any coupon, the gift extras you ask for, and your delivery details.')}
              {bullet('Photos you upload', 'the photos you add for the “Your photo” gift extra, used only to make your order.')}
              {bullet('Flower Quest', 'your game scores, daily play counts and any coupon you claim. The leaderboard shows a nickname, not your name.')}
              {bullet('Messages', 'what you send us on WhatsApp, by phone or by email.')}
              {bullet('Usage', 'anonymous page-visit counts, only if you accept analytics.')}
            </ul>
          ),
        },
        {
          heading: 'How we use it',
          body: (
            <ul className="space-y-2 ml-4">
              {[
                'To take, confirm, make and deliver your orders',
                'To contact you about your order, including a call to confirm customization',
                'To fill in checkout for you next time',
                'To run Flower Quest fairly and issue coupons',
                'To keep the website secure and prevent misuse',
                'To improve the store, using anonymous visit counts if you allow them',
                'To meet our legal and accounting duties',
              ].map(t => (
                <li key={t} className="flex gap-3"><span className="text-rich-gold shrink-0">—</span><span>{t}</span></li>
              ))}
            </ul>
          ),
        },
        {
          heading: 'Your photos',
          body: 'Photos you upload are stored on our own file server, at a long, random web address that can’t be guessed. They are shown only to you (on your order) and to our team, so we can make your item. Anyone who has that exact link could open the photo, so please don’t share it. We don’t use your photos for anything else, such as marketing, without asking you first. Ask us any time to delete them, for example once your order is delivered.',
        },
        {
          heading: 'Who we share it with',
          body: (
            <div className="space-y-3">
              <p>We don’t sell your personal data. We share it only with services that help us run the store:</p>
              <ul className="space-y-2 ml-4">
                {bullet('Supabase', 'hosts our database and handles sign-in.')}
                {bullet('Vercel', 'hosts the website and, if you allow it, counts visits anonymously.')}
                {bullet('Our file storage server', 'stores product images and the photos you upload.')}
                {bullet('WhatsApp (Meta)', 'carries the messages you send us. WhatsApp’s own privacy policy applies to those chats.')}
                {bullet('Delivery partners', 'receive your name, phone number and address to deliver your order.')}
              </ul>
              <p>We may also share data if the law requires it.</p>
            </div>
          ),
        },
        {
          id: 'cookies',
          heading: 'Cookies & storage',
          body: (
            <div className="space-y-4">
              <p>
                We use a small number of cookies and browser storage items. Most are essential: the site can’t keep you signed in, keep your cart or run
                Flower Quest without them. Analytics is optional and is switched on only if you choose “Accept all”. We don’t use advertising or
                cross-site tracking cookies.
              </p>
              <div className="overflow-x-auto border border-[#e9e1ed] bg-white">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="bg-[#f7f1fb] text-[10px] uppercase tracking-[0.12em] text-ivory">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Kind</th>
                      <th className="px-3 py-2 font-semibold">What it does</th>
                      <th className="px-3 py-2 font-semibold">How long</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e9e1ed]">
                    {STORAGE.map(row => (
                      <tr key={row.name} className="align-top">
                        <td className="px-3 py-2 font-mono text-[11px] text-ivory">{row.name}</td>
                        <td className="px-3 py-2">{row.kind}</td>
                        <td className="px-3 py-2">{row.purpose}</td>
                        <td className="px-3 py-2">{row.lasts}</td>
                        <td className="px-3 py-2">{row.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                You can change your choice at any time with “Cookie settings” in the footer, or here: <CookieSettingsButton />. You can also clear
                cookies and site data in your browser, but you’ll be signed out and your cart’s gift extras will be forgotten.
              </p>
            </div>
          ),
        },
        {
          heading: 'How long we keep it',
          body: 'We keep your account and profile while your account is open. Order records are kept for as long as Indian tax and accounting law requires. Uploaded photos are kept with your order until you ask us to delete them. Game play counts are kept only as long as needed to run the daily limits.',
        },
        {
          heading: 'Your rights',
          body: (
            <ul className="space-y-2 ml-4">
              {[
                'See the personal data we hold about you',
                'Correct it; you can edit your details on your profile',
                'Ask us to delete your account, photos or other data, where the law allows',
                'Withdraw your consent to optional analytics at any time',
                'Raise a complaint with us, and with the Data Protection Board of India if you aren’t happy with our reply',
              ].map(t => (
                <li key={t} className="flex gap-3"><span className="text-rich-gold shrink-0">✓</span><span>{t}</span></li>
              ))}
            </ul>
          ),
        },
        {
          heading: 'Security',
          body: 'We use HTTPS, access rules on our database, and secret keys for uploads. Only our team can see order details and photos in the admin area. No website is completely secure, so please keep your password private.',
        },
        {
          heading: 'Children',
          body: 'Our store is not meant for children under 18 without a parent or guardian. If you think a child has given us personal data without permission, contact us and we’ll delete it.',
        },
        {
          heading: 'Changes to this policy',
          body: 'We may update this policy. The date at the top shows the latest version, and we’ll point out important changes on the website.',
        },
        {
          heading: 'Contact',
          body: `For any privacy question or request, please ${reachUs}. We reply within 2 working days.`,
        },
      ]}
      relatedLinks={[
        { label: 'Terms & Conditions', href: '/policies/terms' },
        { label: 'Shipping Policy', href: '/policies/shipping' },
      ]}
    />
  )
}
