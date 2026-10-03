'use client'

import { useState, useEffect, useRef } from 'react'
import { useCartStore } from '@/store/cart'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import Link from 'next/link'
import { ShoppingBag, Shield, Truck, BadgeCheck } from 'lucide-react'

function getFirstImage(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr) && arr.length > 0) return arr[0]
  } catch {}
  return raw
}

const inputCls = `w-full px-4 py-3 bg-white border border-border-light font-syndicatgrotesk text-sm text-warm-black placeholder-muted-taupe outline-none focus:border-deep-gold focus:ring-1 focus:ring-deep-gold/20 transition-all`

export default function CheckoutPage() {
  const { items, fetchCart } = useCartStore()
  const router = useRouter()

  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/signin'); return }
      await fetchCart(session.access_token)
      setPageLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (!error) return
    errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    errorRef.current?.focus({ preventScroll: true })
  }, [error])

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const itemCount = items.reduce((a, i) => a + i.quantity, 0)

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) { setError('Your cart is empty.'); return }
    setError('')

    if (!form.name.trim()) {
      setError('Please enter your full name before continuing.')
      return
    }
    if (!form.email.trim()) {
      setError('Please enter your email address before continuing.')
      return
    }
    if (!/^[6-9][0-9]{9}$/.test(form.phone)) {
      setError('Please enter a valid 10-digit phone number before continuing.')
      return
    }
    if (!form.address.trim()) {
      setError('Please enter your delivery address before continuing.')
      return
    }

    setLoading(true)
    const orderLines = items.map(item =>
      `• ${item.product.name} × ${item.quantity} — ₹${(item.product.price * item.quantity).toLocaleString('en-IN')}`
    )
    const message = [
      'Hello Craftoo, I would like to place an order.',
      '',
      'Items:',
      ...orderLines,
      `Total: ₹${total.toLocaleString('en-IN')}`,
      '',
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      `Address: ${form.address}`,
    ].join('\n')
    window.location.href = `https://wa.me/918971210413?text=${encodeURIComponent(message)}`
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-warm-beige flex items-center justify-center gap-2">
        {[0, 150, 300].map(d => (
          <span key={d} className="w-2 h-2 bg-deep-gold rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-warm-beige">
        <Navbar />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

          {/* Page header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-px bg-deep-gold/60" />
              <span className="font-syndicatgrotesk text-[9px] tracking-[0.35em] uppercase text-deep-gold">
                Secure Checkout
              </span>
              <div className="w-8 h-px bg-deep-gold/60" />
            </div>
            <h1 className="font-brandon text-2xl sm:text-3xl font-black uppercase tracking-tight text-warm-black">
              Complete Your Order
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 lg:gap-8 items-start">

            {/* ── LEFT — Delivery form ── */}
            <div className="bg-white border border-border-light shadow-sm">

              {/* Section title */}
              <div className="px-6 py-4 border-b border-border-light bg-soft-cream">
                <h2 className="font-brandon text-sm font-black uppercase tracking-[0.15em] text-warm-black">
                  Delivery Details
                </h2>
              </div>

              <div className="px-6 py-6">
                {error && (
                  <div
                    ref={errorRef}
                    role="alert"
                    tabIndex={-1}
                    className="mb-5 flex items-start gap-2 px-4 py-3 border border-red-300 bg-red-50 text-red-700 font-syndicatgrotesk text-xs"
                  >
                    <span className="shrink-0 mt-0.5">✕</span>
                    {error}
                  </div>
                )}

                <form noValidate onSubmit={handleCheckout} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-syndicatgrotesk text-[10px] tracking-[0.2em] uppercase text-text-muted mb-1.5">
                        Full Name <span className="text-deep-gold">*</span>
                      </label>
                      <input
                        required type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="Priya Sharma"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block font-syndicatgrotesk text-[10px] tracking-[0.2em] uppercase text-text-muted mb-1.5">
                        Email Address <span className="text-deep-gold">*</span>
                      </label>
                      <input
                        required type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="priya@example.com"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-syndicatgrotesk text-[10px] tracking-[0.2em] uppercase text-text-muted mb-1.5">
                      Phone Number <span className="text-deep-gold">*</span>
                    </label>
                    <input
                      required type="tel" pattern="[6-9][0-9]{9}" maxLength={10}
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      placeholder="9876543210"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="block font-syndicatgrotesk text-[10px] tracking-[0.2em] uppercase text-text-muted mb-1.5">
                      Delivery Address <span className="text-deep-gold">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                      placeholder="Flat / House No., Street, City, State, PIN Code"
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                  {/* Security badge */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-soft-cream border border-border-light">
                    <Shield size={16} className="text-deep-gold shrink-0" />
                    <div>
                      <p className="font-syndicatgrotesk text-[10px] tracking-[0.15em] uppercase text-warm-black font-semibold">
                        100% Secure Checkout
                      </p>
                      <p className="font-syndicatgrotesk text-[10px] text-text-muted mt-0.5">
                        We currently accept UPI payments only.
                      </p>
                    </div>
                  </div>

                  {/* Policy line */}
                  <p className="font-syndicatgrotesk text-[10px] text-text-muted leading-relaxed">
                    By placing your order you agree to our{' '}
                    <Link href="/policies/terms" target="_blank" className="text-deep-gold hover:underline">Terms of Service</Link>,{' '}
                    <Link href="/policies/returns" target="_blank" className="text-deep-gold hover:underline">Return Policy</Link>, and{' '}
                    <Link href="/policies/privacy" target="_blank" className="text-deep-gold hover:underline">Privacy Policy</Link>.
                  </p>

                  <button
                    type="submit"
                    disabled={loading || items.length === 0}
                    className="w-full py-4 bg-warm-black text-ivory font-syndicatgrotesk text-[11px] font-bold tracking-[0.25em] uppercase hover:bg-deep-gold disabled:opacity-50 transition-colors duration-200"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-ivory/30 border-t-ivory rounded-full animate-spin" />
                        Opening WhatsApp…
                      </span>
                    ) : (
                      'Continue on WhatsApp'
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* ── RIGHT — Order summary ── */}
            <div className="space-y-4">

              {/* Items card */}
              <div className="bg-white border border-border-light shadow-sm">
                <div className="px-5 py-4 border-b border-border-light bg-soft-cream flex items-center gap-2">
                  <ShoppingBag size={14} className="text-deep-gold" />
                  <h2 className="font-brandon text-sm font-black uppercase tracking-[0.15em] text-warm-black">
                    Order Summary
                  </h2>
                  <span className="ml-auto font-syndicatgrotesk text-[10px] text-text-muted">
                    {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {items.length === 0 ? (
                  <p className="px-5 py-6 font-syndicatgrotesk text-xs text-text-muted">No items in cart.</p>
                ) : (
                  <ul className="divide-y divide-border-light max-h-72 overflow-y-auto">
                    {items.map(item => {
                      const img = getFirstImage(item.product.image)
                      return (
                        <li key={item.id} className="px-5 py-4 flex gap-3">
                          <div className="w-14 h-14 shrink-0 bg-soft-cream border border-border-light overflow-hidden">
                            {img ? (
                              <img src={img} alt={item.product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ShoppingBag size={14} className="text-muted-taupe" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-brandon text-xs font-black uppercase tracking-wide text-warm-black truncate leading-snug">
                              {item.product.name}
                            </p>
                            <p className="font-syndicatgrotesk text-[10px] text-text-muted mt-0.5">
                              Qty: {item.quantity}
                            </p>
                          </div>
                          <p className="font-brandon text-sm font-black text-warm-black whitespace-nowrap">
                            ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* Totals */}
                <div className="px-5 py-4 bg-soft-cream border-t border-border-light space-y-2">
                  <div className="flex justify-between font-syndicatgrotesk text-xs text-text-muted">
                    <span>Subtotal</span>
                    <span className="text-warm-black">₹{total.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between font-syndicatgrotesk text-xs text-text-muted">
                    <span>Shipping</span>
                    <span className="text-deep-gold font-semibold">Free</span>
                  </div>
                  <div className="pt-2 border-t border-border-light flex justify-between">
                    <span className="font-brandon text-sm font-black uppercase text-warm-black">Total</span>
                    <span className="font-brandon text-lg font-black text-warm-black">
                      ₹{total.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trust badges card */}
              <div className="bg-white border border-border-light shadow-sm px-5 py-4">
                <p className="font-syndicatgrotesk text-[9px] tracking-[0.2em] uppercase text-text-muted mb-3">
                  Why shop with us
                </p>
                <div className="space-y-2.5">
                  {[
                    { Icon: Shield,     label: 'UPI Payments Only' },
                    { Icon: Truck,      label: 'Free Shipping on Orders Above ₹599' },
                    { Icon: BadgeCheck, label: 'Handmade With Care' },
                  ].map(({ Icon, label }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <Icon size={13} className="text-deep-gold shrink-0" />
                      <span className="font-syndicatgrotesk text-[10px] text-text-muted">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}
