'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, MapPin, UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { CustomerOrders } from '@/components/customer-orders'
import { EMPTY_DETAILS, checkCustomerDetails, type CustomerDetails } from '@/lib/customer-details'

const inputCls = 'w-full px-4 py-3 bg-white border border-border-light font-syndicatgrotesk text-sm text-warm-black placeholder-muted-taupe outline-none focus:border-deep-gold focus:ring-1 focus:ring-deep-gold/20 transition-all'
const labelCls = 'block font-syndicatgrotesk text-[10px] tracking-[0.2em] uppercase text-text-muted mb-1.5'

export default function ProfilePage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [accountEmail, setAccountEmail] = useState('')
  const [form, setForm] = useState<CustomerDetails>(EMPTY_DETAILS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/signin?returnTo=/profile'); return }
      setToken(session.access_token)
      try {
        const res = await fetch('/api/user/profile', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || 'Your profile couldn’t be loaded.')
        setForm({ ...EMPTY_DETAILS, ...body.details })
        setAccountEmail(body.accountEmail || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Your profile couldn’t be loaded.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [router])

  const update = (field: keyof CustomerDetails, value: string) => {
    setForm(current => ({ ...current, [field]: value }))
    setSaved(false)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    const checked = checkCustomerDetails(form)
    if (!checked.ok) { setError(checked.error); return }
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify(checked.details),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Your profile couldn’t be saved.')
      setForm(body.details)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your profile couldn’t be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-warm-beige">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="font-syndicatgrotesk text-[9px] tracking-[0.35em] uppercase text-deep-gold">Account</span>
            <div className="flex-1 h-px bg-deep-gold/60" />
          </div>
          <h1 className="font-brandon text-3xl sm:text-4xl font-black uppercase tracking-tight text-warm-black">My Profile</h1>
          {accountEmail && (
            <p className="font-syndicatgrotesk text-xs text-muted-taupe mt-1">Signed in as <span className="text-warm-black">{accountEmail}</span></p>
          )}
        </div>

        {/* Details */}
        <section aria-labelledby="details-heading" className="bg-white border border-border-light shadow-sm">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-border-light bg-soft-cream">
            <UserRound size={15} className="text-deep-gold" aria-hidden="true" />
            <h2 id="details-heading" className="font-brandon text-sm font-black uppercase tracking-[0.15em] text-warm-black">My details</h2>
          </div>

          {loading ? (
            <div className="px-6 py-8 flex items-center gap-2 font-syndicatgrotesk text-xs text-muted-taupe">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading your details…
            </div>
          ) : (
            <form noValidate onSubmit={save} className="px-6 py-6 space-y-4">
              <p className="font-syndicatgrotesk text-[11px] leading-5 text-text-muted">
                We fill these in at checkout, so you don’t have to type them again. They’re also updated whenever you place an order.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="profile-name" className={labelCls}>Full name</label>
                  <input id="profile-name" type="text" autoComplete="name" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Priya Sharma" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="profile-phone" className={labelCls}>Phone number</label>
                  <input id="profile-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={form.phone} onChange={e => update('phone', e.target.value.replace(/\D/g, ''))} placeholder="9876543210" className={inputCls} />
                </div>
              </div>

              <div>
                <label htmlFor="profile-email" className={labelCls}>Email for order updates</label>
                <input id="profile-email" type="email" autoComplete="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="priya@example.com" className={inputCls} />
              </div>

              <div>
                <label htmlFor="profile-address" className={`${labelCls} flex items-center gap-1.5`}>
                  <MapPin size={11} aria-hidden="true" /> Delivery address
                </label>
                <textarea
                  id="profile-address"
                  rows={4}
                  autoComplete="street-address"
                  value={form.address}
                  onChange={e => update('address', e.target.value)}
                  placeholder="Flat / House No., Street, City, State, PIN Code"
                  className={`${inputCls} resize-none`}
                />
                <p className="mt-1 font-syndicatgrotesk text-[10px] text-text-muted">This is where we’ll deliver your orders.</p>
              </div>

              {error && (
                <p role="alert" className="px-4 py-3 border border-red-300 bg-red-50 text-red-700 font-syndicatgrotesk text-xs">{error}</p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-3.5 bg-warm-black text-ivory font-syndicatgrotesk text-[10px] font-bold tracking-[0.22em] uppercase hover:bg-deep-gold disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save details'}
                </button>
                {saved && (
                  <span role="status" className="inline-flex items-center gap-1.5 font-syndicatgrotesk text-xs text-green-700">
                    <Check size={14} aria-hidden="true" /> Saved
                  </span>
                )}
              </div>
            </form>
          )}
        </section>

        {/* Orders */}
        <section aria-labelledby="orders-heading">
          <h2 id="orders-heading" className="mb-4 font-brandon text-xl font-black uppercase tracking-tight text-warm-black">My orders</h2>
          {token && <CustomerOrders />}
        </section>
      </div>

      <Footer />
    </div>
  )
}
