'use client'

import { useState, useEffect, useRef } from 'react'
import { useCartStore } from '@/store/cart'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import Link from 'next/link'
import { ShoppingBag, Check, Loader2, Tag, X, MessageCircle, MapPin, Pencil, Phone, ArrowLeft, ArrowRight } from 'lucide-react'
import { EMPTY_DETAILS, checkCustomerDetails, type CustomerDetails } from '@/lib/customer-details'
import { COUPON_CODE_PATTERN, normalizeCouponCode, type CouponQuote } from '@/lib/flower-quest/coupon'
import { describeGiftExtras, useGiftExtras } from '@/store/gift-extras'
import { CUSTOMIZATION_CALL_NOTE, giftExtraKeys } from '@/lib/gift-extras'
import { GiftPhotoUploader } from '@/components/gift-photo-uploader'
import { FREE_SHIPPING_THRESHOLD, amountToFreeShipping, hasFreeShipping } from '@/lib/shipping'
import { LAST_ORDER_KEY, WHATSAPP_NUMBER, type LastOrder, type OrderConflict, type PlacedOrder } from '@/lib/whatsapp-order'

type CouponCheck =
  | { status: 'applied'; quote: CouponQuote }
  | { status: 'invalid'; message: string }
  | { status: 'unavailable'; message: string }

/** ₹1,200 for whole rupees, ₹179.90 when there are paise. */
const rupees = (value: number) => {
  const paise = Math.round(value * 100) % 100 !== 0
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: 2 })}`
}

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
  const { items, fetchCart, clearCart } = useCartStore()
  const giftExtras = useGiftExtras(state => state.byProduct)
  const giftPhotos = useGiftExtras(state => state.photos)
  const router = useRouter()
  const hasGiftExtras = items.some(item => describeGiftExtras(giftExtras[item.product.id]))

  // Checkout steps: 1 delivery address, 2 order summary, 3 review and place the order.
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [form, setForm] = useState<CustomerDetails>(EMPTY_DETAILS)
  // The address saved on the shopper's profile. Without one, step 1 shows the form.
  const [savedAddress, setSavedAddress] = useState<CustomerDetails | null>(null)
  const [editingAddress, setEditingAddress] = useState(true)
  const [savingAddress, setSavingAddress] = useState(false)
  // Set when the address couldn't be saved to the profile; the order can still go ahead.
  const [addressNotSaved, setAddressNotSaved] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<CouponQuote | null>(null)
  const [couponChecking, setCouponChecking] = useState(false)
  const [couponMessage, setCouponMessage] = useState('')
  // The order the shopper is reviewing before it is sent on WhatsApp.
  const [review, setReview] = useState<{ coupon: CouponQuote | null } | null>(null)
  const [sending, setSending] = useState(false)
  const [reviewError, setReviewError] = useState('')
  // An earlier order that blocks this one (same coupon, or the same items still pending).
  const [placedBefore, setPlacedBefore] = useState<OrderConflict['order'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/signin'); return }
      await Promise.all([
        fetchCart(session.access_token),
        // The address saved on the profile (from an earlier order or the profile page).
        fetch('/api/user/profile', { headers: { Authorization: `Bearer ${session.access_token}` } })
          .then(res => (res.ok ? res.json() : null))
          .then(body => {
            const saved = body?.details
            if (!saved) return
            setForm({ ...EMPTY_DETAILS, ...saved })
            const checked = checkCustomerDetails(saved)
            if (checked.ok) {
              setSavedAddress(checked.details)
              setEditingAddress(false)
            }
          })
          .catch(() => { /* the shopper can still type their details */ }),
      ])
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
  const cartSignature = items.map(item => `${item.id}:${item.quantity}:${item.product.price}`).join('|')
  // Once a coupon is applied, the server's figures (from the saved cart) are the ones we show.
  const subtotal = appliedCoupon ? appliedCoupon.subtotal : total
  const discount = appliedCoupon ? appliedCoupon.discountAmount : 0
  const payable = appliedCoupon ? appliedCoupon.total : total
  // Free shipping is judged on the product subtotal before any coupon.
  const freeShipping = hasFreeShipping(subtotal)
  const toFreeShipping = amountToFreeShipping(subtotal)

  /** Asks the server whether the code is valid for this shopper's cart, and what it takes off. */
  const checkCoupon = async (rawCode: string): Promise<CouponCheck> => {
    const code = normalizeCouponCode(rawCode)
    if (!COUPON_CODE_PATTERN.test(code)) {
      return { status: 'invalid', message: 'Enter a valid coupon code. It uses letters, numbers and dashes only.' }
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { status: 'invalid', message: 'Sign in again to use your coupon.' }
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ code }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.ok) return { status: 'applied', quote: body as CouponQuote }
      if (response.status === 400 || response.status === 401 || response.status === 422) {
        return { status: 'invalid', message: body.error || 'This coupon can’t be used for this order.' }
      }
      return { status: 'unavailable', message: 'We couldn’t check coupons just now. Try again in a moment, or remove the code to continue.' }
    } catch {
      return { status: 'unavailable', message: 'We couldn’t check coupons just now. Check your connection and try again.' }
    }
  }

  const applyCoupon = async (rawCode: string = couponCode): Promise<CouponCheck> => {
    setCouponChecking(true)
    setCouponMessage('')
    const result = await checkCoupon(rawCode)
    setCouponChecking(false)
    if (result.status === 'applied') {
      setAppliedCoupon(result.quote)
      setCouponCode(result.quote.code)
    } else {
      setAppliedCoupon(null)
      setCouponMessage(result.message)
    }
    return result
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponMessage('')
  }

  // The discount depends on the cart, so check the coupon again whenever the cart changes.
  const lastCheckedCart = useRef('')
  useEffect(() => {
    if (!appliedCoupon) {
      lastCheckedCart.current = cartSignature
      return
    }
    if (lastCheckedCart.current === cartSignature) return
    lastCheckedCart.current = cartSignature
    void applyCoupon(appliedCoupon.code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature])

  /** The WhatsApp order message, using the figures the server recorded for the order. */
  const buildMessage = (placed: PlacedOrder): string => {
    const coupon = placed.coupon
    const orderLines = items.flatMap(item => {
      const extras = describeGiftExtras(giftExtras[item.product.id])
      const photos = giftExtras[item.product.id]?.photo ? giftPhotos[item.product.id] ?? [] : []
      return [
        `• ${item.product.name} × ${item.quantity} — ${rupees(item.product.price * item.quantity)}`,
        ...(extras ? [`   Gift extras: ${extras}`] : []),
        ...(photos.length > 0 ? [`   Photos added: ${photos.length} (uploaded on the website)`] : []),
      ]
    })
    const shipsFree = hasFreeShipping(placed.subtotal)
    const delivery = shipsFree
      ? `Delivery: Free (orders of ${rupees(FREE_SHIPPING_THRESHOLD)} and above)`
      : 'Delivery: please add the delivery charge to my final bill'
    const extrasNote = hasGiftExtras ? ' and gift extras' : ''
    return [
      'Hello Craftoo, I would like to place an order.',
      `Order ref: ${placed.ref}`,
      '',
      'Items:',
      ...orderLines,
      '',
      ...(hasGiftExtras ? ['Gift extras: please call me to confirm my customization.'] : []),
      ...(coupon
        ? [
            `Subtotal: ${rupees(placed.subtotal)}`,
            `Flower Quest coupon: ${coupon.code} (${coupon.discountPercent}% off products)`,
            `Estimated discount: −${rupees(placed.discountAmount)}`,
            delivery,
            shipsFree && !hasGiftExtras
              ? `Estimated total: ${rupees(placed.total)}`
              : `Estimated total (before delivery${extrasNote}): ${rupees(placed.total)}`,
            'The coupon discount applies to products only.',
            '',
            // TODO(payment-gateway): remove this manual step once online payment is live. The coupon
            // should then be reserved at checkout and marked redeemed only after the bill is paid
            // (see "Future: online payment" in docs/flower-quest.md).
            'Please verify my coupon and send the final bill.',
          ]
        : [
            delivery,
            shipsFree && !hasGiftExtras
              ? `Total to pay: ${rupees(placed.total)}`
              : shipsFree
                ? `Total (before gift extras): ${rupees(placed.total)}`
                : `Total (before delivery${extrasNote}): ${rupees(placed.total)}`,
          ]),
      '',
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      `Address: ${form.address}`,
    ].join('\n')
  }

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  /** Step 1: save a new or changed address to the profile, then go on to the order summary. */
  const saveAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const checked = checkCustomerDetails(form)
    if (!checked.ok) { setError(checked.error); return }
    setSavingAddress(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/signin?returnTo=/checkout'); return }
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(checked.details),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Your address couldn’t be saved.')
      setForm(body.details)
      setSavedAddress(body.details)
      setAddressNotSaved(false)
    } catch (err) {
      // Don't block the order: use the address for this order and let the shopper know.
      console.warn('Address could not be saved to the profile', err)
      setForm(checked.details)
      setSavedAddress(checked.details)
      setAddressNotSaved(true)
    } finally {
      setSavingAddress(false)
    }
    setEditingAddress(false)
    setStep(2)
    scrollTop()
  }

  const useSavedAddress = () => {
    if (!savedAddress) return
    setForm(savedAddress)
    setError('')
    setStep(2)
    scrollTop()
  }

  /** Step 2 → 3: check photos and any typed coupon, then show the review. */
  const goToReview = async () => {
    if (items.length === 0) { setError('Your cart is empty.'); return }
    if (!savedAddress) { setStep(1); return }
    setError('')

    const missingPhoto = items.find(item => giftExtras[item.product.id]?.photo && !(giftPhotos[item.product.id]?.length))
    if (missingPhoto) {
      setError(`Upload at least one photo for ${missingPhoto.product.name}, or untick “Your photo” for it.`)
      return
    }

    // A code that was typed but never applied (or edited since) is checked before we continue.
    const normalizedCouponCode = normalizeCouponCode(couponCode)
    let coupon = appliedCoupon && appliedCoupon.code === normalizedCouponCode ? appliedCoupon : null
    if (normalizedCouponCode && !coupon) {
      setLoading(true)
      const result = await applyCoupon(normalizedCouponCode)
      setLoading(false)
      if (result.status !== 'applied') {
        setError(result.status === 'invalid'
          ? `Coupon not applied: ${result.message} Remove it to continue without a discount.`
          : result.message)
        return
      }
      coupon = result.quote
    }

    setReviewError('')
    setPlacedBefore(null)
    setReview({ coupon })
    setStep(3)
    scrollTop()
  }

  const goToStep = (target: 1 | 2 | 3) => {
    if (sending) return
    if (target === 3) { void goToReview(); return }
    if (target === 2 && !savedAddress) return
    setError('')
    setReviewError('')
    setStep(target)
    scrollTop()
  }

  const sendOrder = async () => {
    if (!review) return
    setSending(true)
    setReviewError('')

    setPlacedBefore(null)
    // Open the WhatsApp tab now, while this is still the shopper's tap: browsers block a new tab
    // opened after the order request finishes. It is pointed at WhatsApp once the order is saved.
    const whatsappTab = window.open('', '_blank')
    const fail = (message: string) => {
      whatsappTab?.close()
      setReviewError(message)
      setSending(false)
    }

    // The order is recorded first, so the same coupon can't go on a second order and sending the
    // same items again reuses the order instead of creating a duplicate. The coupon itself is
    // redeemed when staff confirm the order.
    const coupon = review.coupon
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { fail('Sign in again to send your order.'); return }

    let response: Response
    let body: any
    try {
      response = await fetch('/api/orders/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          ...form,
          couponCode: coupon?.code ?? '',
          expectedTotal: coupon ? coupon.total : total,
          // Saved on the order so staff can see what customization was asked for.
          giftExtras: Object.fromEntries(items.map(item => [item.product.id, giftExtraKeys(giftExtras[item.product.id])])),
          giftPhotos: Object.fromEntries(items.map(item => [item.product.id, giftPhotos[item.product.id] ?? []])),
        }),
      })
      body = await response.json().catch(() => ({}))
    } catch {
      fail('We couldn’t send your order just now. Check your connection and try again.')
      return
    }

    if (response.ok) {
      const placed = body as PlacedOrder
      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildMessage(placed))}`
      let whatsappOpened = false
      if (whatsappTab && !whatsappTab.closed) {
        whatsappTab.opener = null
        whatsappTab.location.href = whatsappUrl
        whatsappOpened = true
      }

      // The server has emptied the saved cart; clear this page's copy and the gift extras too.
      clearCart()
      useGiftExtras.getState().keepOnly([])
      try {
        const last: LastOrder = { ref: placed.ref, whatsappUrl, whatsappOpened, at: Date.now() }
        sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(last))
      } catch { /* storage unavailable: the home page just won't show the confirmation */ }

      // Back to the home page, which confirms the order. If the WhatsApp tab was blocked, it shows
      // an "Open WhatsApp" button instead (a tap there is never blocked).
      router.replace(`/?order=${encodeURIComponent(placed.ref)}`)
      return
    }

    const conflict = body as Partial<OrderConflict>
    if (response.status === 409 && conflict.reason === 'changed') {
      // The cart changed since the review opened (perhaps in another tab): reload it and show
      // the new figures before anything is sent.
      await fetchCart(session.access_token)
      let fresh: CouponQuote | null = null
      if (coupon) {
        const result = await applyCoupon(coupon.code)
        if (result.status === 'applied') fresh = result.quote
      }
      setReview({ coupon: fresh })
      fail(conflict.error || 'Your cart changed. Check the new total and tap send again.')
      return
    }
    if (response.status === 409 && conflict.order) {
      setPlacedBefore(conflict.order)
      fail(conflict.error || 'You’ve already placed this order.')
      return
    }
    if (response.status === 422 && coupon) {
      setAppliedCoupon(null)
      setCouponMessage(body.error || 'This coupon can’t be used for this order.')
      fail(`${body.error || 'This coupon can’t be used for this order.'} Go back to the order summary and remove the coupon to send your order without it.`)
      return
    }
    fail(body.error || 'We couldn’t send your order just now. Please try again in a moment.')
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

  const reviewCoupon = review?.coupon ?? null
  const reviewSubtotal = reviewCoupon ? reviewCoupon.subtotal : total
  const reviewTotal = reviewCoupon ? reviewCoupon.total : total
  // Totals in the sidebar: the review's snapshot on step 3, the live cart before that.
  const shownSubtotal = step === 3 ? reviewSubtotal : subtotal
  const shownCoupon = step === 3 ? reviewCoupon : appliedCoupon
  const shownTotal = step === 3 ? reviewTotal : payable
  const shownFreeShipping = hasFreeShipping(shownSubtotal)
  const estimated = Boolean(shownCoupon) || hasGiftExtras || !shownFreeShipping

  const STEPS = [
    { n: 1 as const, label: 'Delivery address' },
    { n: 2 as const, label: 'Order summary' },
    { n: 3 as const, label: 'Review & place order' },
  ]

  const primaryBtn = 'inline-flex items-center justify-center gap-2 bg-warm-black px-6 py-4 font-syndicatgrotesk text-[11px] font-bold uppercase tracking-[0.22em] text-ivory transition-colors hover:bg-deep-gold disabled:opacity-50'
  const secondaryBtn = 'inline-flex items-center justify-center gap-2 border border-border-light bg-white px-5 py-4 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.2em] text-warm-black transition-colors hover:border-[#7565a5] disabled:opacity-50'
  const cardCls = 'bg-white border border-border-light shadow-sm'
  const cardHead = 'px-6 py-4 border-b border-border-light bg-soft-cream flex items-center gap-2'
  const cardTitle = 'font-brandon text-sm font-black uppercase tracking-[0.15em] text-warm-black'
  const labelCls = 'block font-syndicatgrotesk text-[10px] tracking-[0.2em] uppercase text-text-muted mb-1.5'
  const linkBtn = 'inline-flex items-center gap-1 font-syndicatgrotesk text-[10px] font-semibold uppercase tracking-[0.16em] text-deep-gold hover:underline disabled:opacity-50'

  const errorBox = error ? (
    <div
      ref={errorRef}
      role="alert"
      tabIndex={-1}
      className="flex items-start gap-2 px-4 py-3 border border-red-300 bg-red-50 text-red-700 font-syndicatgrotesk text-xs"
    >
      <span className="shrink-0 mt-0.5">✕</span>
      {error}
    </div>
  ) : null

  const addressCard = (details: CustomerDetails) => (
    <div className="font-syndicatgrotesk text-sm leading-6 text-warm-black">
      <p className="font-semibold">{details.name}</p>
      <p className="text-text-muted">{details.phone} · <span className="break-all">{details.email}</span></p>
      <p className="mt-1 whitespace-pre-line break-words">{details.address}</p>
    </div>
  )

  /** Subtotal, coupon, shipping and total. Shown inside the order summary (step 2) and the review (step 3). */
  const totalsBlock = (
    <div className="border-t border-border-light bg-soft-cream px-6 py-4 space-y-2 font-syndicatgrotesk text-xs text-text-muted">
      <div className="flex justify-between"><span>Subtotal</span><span className="text-warm-black">{rupees(shownSubtotal)}</span></div>
      {shownCoupon && (
        <div className="flex items-start justify-between gap-3 text-green-700">
          <span className="flex min-w-0 items-start gap-1.5">
            <Tag size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-all">Coupon <span className="font-mono font-semibold">{shownCoupon.code}</span> ({shownCoupon.discountPercent}%)</span>
          </span>
          <span className="shrink-0 font-semibold">−{rupees(shownCoupon.discountAmount)}</span>
        </div>
      )}
      <div className="flex justify-between gap-3">
        <span>Shipping</span>
        {shownFreeShipping
          ? <span className="text-deep-gold font-semibold">Free</span>
          : <span className="text-right text-warm-black">Added to your final bill</span>}
      </div>
      {!shownFreeShipping && step === 2 && (
        <p className="text-[10px] leading-4 text-deep-gold">
          Add {rupees(amountToFreeShipping(shownSubtotal))} more for free shipping (orders of {rupees(FREE_SHIPPING_THRESHOLD)} and above).
        </p>
      )}
      {hasGiftExtras && (
        <div className="flex justify-between gap-3"><span>Gift extras</span><span className="text-right">Confirmed by phone</span></div>
      )}
      <div className="pt-2 border-t border-border-light flex items-end justify-between gap-3">
        <span className="font-brandon text-sm font-black uppercase text-warm-black">{estimated ? 'Estimated total' : 'Total'}</span>
        <span className="font-brandon text-lg font-black text-warm-black">{rupees(shownTotal)}</span>
      </div>
      {estimated && (
        <p className="text-[10px] leading-4">Our team will confirm the final bill on WhatsApp before you pay.</p>
      )}
    </div>
  )

  const itemPhotos = (productId: string) =>
    giftExtras[productId]?.photo && (giftPhotos[productId]?.length ?? 0) > 0 ? giftPhotos[productId] : []

  return (
    <div className="min-h-screen bg-warm-beige">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-px bg-deep-gold/60" />
            <span className="font-syndicatgrotesk text-[9px] tracking-[0.35em] uppercase text-deep-gold">Checkout</span>
            <div className="w-8 h-px bg-deep-gold/60" />
          </div>
          <h1 className="font-brandon text-2xl sm:text-3xl font-black uppercase tracking-tight text-warm-black">
            Complete Your Order
          </h1>
        </div>

        {/* Steps */}
        <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Checkout steps">
          {STEPS.map(({ n, label }) => {
            const done = step > n
            const current = step === n
            const reachable = n < step
            return (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => reachable && goToStep(n)}
                  disabled={!reachable || sending}
                  aria-current={current ? 'step' : undefined}
                  className={`flex w-full items-center gap-2 border-b-2 pb-2 text-left transition-colors ${current ? 'border-[#7565a5]' : done ? 'border-[#9b8ac4]' : 'border-border-light'} ${reachable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-syndicatgrotesk text-[11px] font-bold ${current ? 'bg-[#7565a5] text-white' : done ? 'bg-[#9b8ac4] text-white' : 'border border-border-light bg-white text-text-muted'}`}>
                    {done ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : n}
                  </span>
                  <span className={`font-syndicatgrotesk text-[10px] uppercase tracking-[0.14em] sm:text-[11px] ${current ? 'font-bold text-warm-black' : 'text-text-muted'}`}>
                    {label}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        {items.length === 0 ? (
          <div className={`${cardCls} px-8 py-14 text-center`}>
            <ShoppingBag className="mx-auto mb-4 h-9 w-9 text-muted-taupe/50" aria-hidden="true" />
            <p className="font-syndicatgrotesk text-xs uppercase tracking-[0.15em] text-text-muted">Your cart is empty</p>
            <Link href="/" className={`${primaryBtn} mt-6`}>Continue shopping</Link>
          </div>
        ) : (
          <div className="space-y-5">

              {/* STEP 1 — Delivery address */}
              {step === 1 && (
                <section className={cardCls} aria-labelledby="step-address">
                  <div className={cardHead}>
                    <MapPin size={14} className="text-deep-gold" aria-hidden="true" />
                    <h2 id="step-address" className={cardTitle}>Delivery address</h2>
                  </div>
                  <div className="px-6 py-6 space-y-5">
                    {errorBox}

                    {savedAddress && !editingAddress ? (
                      <>
                        <div className="border border-[#cbbde4] bg-[#f7f1fb] px-5 py-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="font-syndicatgrotesk text-[10px] font-semibold uppercase tracking-[0.2em] text-deep-gold">Saved address</p>
                            <button type="button" onClick={() => { setForm(savedAddress); setEditingAddress(true) }} className={linkBtn}>
                              <Pencil size={11} aria-hidden="true" /> Change
                            </button>
                          </div>
                          {addressCard(savedAddress)}
                        </div>
                        <button type="button" onClick={useSavedAddress} className={`${primaryBtn} w-full`}>
                          Deliver to this address <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <form noValidate onSubmit={saveAddress} className="space-y-4">
                        <p className="font-syndicatgrotesk text-[11px] leading-5 text-text-muted">
                          {savedAddress
                            ? 'Update your details below. The new address replaces the one saved on your profile.'
                            : 'Add where we should deliver. We’ll save it to your profile so it’s ready for your next order.'}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="co-name" className={labelCls}>Full Name <span className="text-deep-gold">*</span></label>
                            <input id="co-name" type="text" autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Priya Sharma" className={inputCls} />
                          </div>
                          <div>
                            <label htmlFor="co-phone" className={labelCls}>Phone Number <span className="text-deep-gold">*</span></label>
                            <input id="co-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} placeholder="9876543210" className={inputCls} />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="co-email" className={labelCls}>Email Address <span className="text-deep-gold">*</span></label>
                          <input id="co-email" type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="priya@example.com" className={inputCls} />
                        </div>
                        <div>
                          <label htmlFor="co-address" className={labelCls}>Delivery Address <span className="text-deep-gold">*</span></label>
                          <textarea id="co-address" rows={4} autoComplete="street-address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Flat / House No., Street, City, State, PIN Code" className={`${inputCls} resize-none`} />
                        </div>
                        <div className="flex flex-col-reverse gap-3 sm:flex-row">
                          {savedAddress && (
                            <button type="button" onClick={() => { setForm(savedAddress); setEditingAddress(false); setError('') }} className={secondaryBtn}>
                              Cancel
                            </button>
                          )}
                          <button type="submit" disabled={savingAddress} className={`${primaryBtn} flex-1`}>
                            {savingAddress
                              ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Saving…</>
                              : <>Save address &amp; continue <ArrowRight size={14} aria-hidden="true" /></>}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </section>
              )}

              {/* STEP 2 — Order summary */}
              {step === 2 && (
                <>
                  {addressNotSaved && (
                    <p className="border border-amber-300 bg-amber-50 px-4 py-3 font-syndicatgrotesk text-xs leading-5 text-amber-800">
                      We couldn’t save your address to your profile just now, but this order will still use it.
                    </p>
                  )}
                  <section className={cardCls} aria-labelledby="step-summary">
                    <div className={cardHead}>
                      <ShoppingBag size={14} className="text-deep-gold" aria-hidden="true" />
                      <h2 id="step-summary" className={cardTitle}>Order summary</h2>
                      <span className="ml-auto font-syndicatgrotesk text-[10px] text-text-muted">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                    </div>
                    <ul className="divide-y divide-border-light">
                      {items.map(item => {
                        const img = getFirstImage(item.product.image)
                        const extras = describeGiftExtras(giftExtras[item.product.id])
                        return (
                          <li key={item.id} className="px-6 py-4 flex gap-4">
                            <div className="w-16 h-16 shrink-0 bg-soft-cream border border-border-light overflow-hidden">
                              {img ? <img src={img} alt={item.product.name} className="w-full h-full object-cover" /> : null}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-brandon text-sm font-black uppercase tracking-wide text-warm-black leading-snug">{item.product.name}</p>
                              <p className="font-syndicatgrotesk text-[11px] text-text-muted mt-0.5">Qty {item.quantity} · {rupees(item.product.price)} each</p>
                              {extras && (
                                <p className="mt-1 flex items-center gap-1 font-syndicatgrotesk text-[11px] text-deep-gold">
                                  <Check size={11} strokeWidth={3} aria-hidden="true" /> {extras}
                                </p>
                              )}
                              {giftExtras[item.product.id]?.photo && <GiftPhotoUploader productId={item.product.id} compact />}
                            </div>
                            <p className="font-brandon text-sm font-black text-warm-black whitespace-nowrap">{rupees(item.product.price * item.quantity)}</p>
                          </li>
                        )
                      })}
                    </ul>
                    {totalsBlock}
                    {hasGiftExtras && (
                      <p className="flex items-start gap-1.5 border-t border-border-light px-6 py-3 font-syndicatgrotesk text-[11px] leading-5 text-[#5b4d8a]">
                        <Phone size={12} className="mt-1 shrink-0" aria-hidden="true" /> {CUSTOMIZATION_CALL_NOTE}
                      </p>
                    )}
                  </section>

                  {/* Coupon */}
                  <section className={`${cardCls} px-6 py-5`}>
                    <label htmlFor="flower-quest-coupon" className={labelCls}>
                      Flower Quest Coupon Code <span className="normal-case tracking-normal">(optional)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="flower-quest-coupon"
                        type="text"
                        name="flowerQuestCoupon"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        maxLength={48}
                        value={couponCode}
                        readOnly={Boolean(appliedCoupon)}
                        onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponMessage('') }}
                        onKeyDown={e => {
                          if (e.key !== 'Enter') return
                          e.preventDefault()
                          if (!appliedCoupon && couponCode.trim()) void applyCoupon()
                        }}
                        placeholder="e.g. FQ7K2MQ9XR"
                        aria-invalid={Boolean(couponMessage)}
                        aria-describedby="flower-quest-coupon-status"
                        className={`${inputCls} min-w-0 flex-1 font-mono tracking-wide ${appliedCoupon ? 'border-green-600/60 bg-green-50/60' : ''} ${couponMessage ? 'border-red-300' : ''}`}
                      />
                      {appliedCoupon ? (
                        <button type="button" onClick={removeCoupon} className="inline-flex shrink-0 items-center gap-1.5 border border-border-light bg-white px-4 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted transition-colors hover:border-warm-black hover:text-warm-black">
                          <X size={13} aria-hidden="true" /> Remove
                        </button>
                      ) : (
                        <button type="button" onClick={() => void applyCoupon()} disabled={couponChecking || !couponCode.trim()} className="inline-flex min-w-[92px] shrink-0 items-center justify-center gap-1.5 bg-warm-black px-4 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.18em] text-ivory transition-colors hover:bg-deep-gold disabled:opacity-40">
                          {couponChecking ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : 'Apply'}
                        </button>
                      )}
                    </div>
                    <div id="flower-quest-coupon-status" role="status" aria-live="polite" className="mt-1.5 font-syndicatgrotesk text-[11px] leading-5">
                      {appliedCoupon ? (
                        <p className="flex items-start gap-1.5 text-green-700">
                          <Check size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                          <span>
                            Coupon accepted: {appliedCoupon.discountPercent}% off your products, an estimated saving of <strong>{rupees(appliedCoupon.discountAmount)}</strong>.
                            {appliedCoupon.discountAmount >= appliedCoupon.maximumDiscountAmount ? ` (Maximum discount is ${rupees(appliedCoupon.maximumDiscountAmount)}.)` : ''}
                          </span>
                        </p>
                      ) : couponMessage ? (
                        <p className="text-red-700">{couponMessage}</p>
                      ) : (
                        <p className="text-text-muted">Have a Flower Quest coupon? Apply it to see your discount. It applies to products only, not delivery.</p>
                      )}
                    </div>
                  </section>


                  {errorBox}
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <button type="button" onClick={() => goToStep(1)} className={secondaryBtn}>
                      <ArrowLeft size={13} aria-hidden="true" /> Back
                    </button>
                    <button type="button" onClick={() => void goToReview()} disabled={loading} className={`${primaryBtn} flex-1`}>
                      {loading
                        ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Checking your order…</>
                        : <>Continue to review <ArrowRight size={14} aria-hidden="true" /></>}
                    </button>
                  </div>
                </>
              )}

              {/* STEP 3 — Review & place order */}
              {step === 3 && review && (
                <>
                  <section className={cardCls} aria-labelledby="step-review">
                    <div className={cardHead}>
                      <Check size={14} className="text-deep-gold" aria-hidden="true" />
                      <h2 id="step-review" className={cardTitle}>Review your order</h2>
                      <button type="button" onClick={() => goToStep(2)} disabled={sending} className={`ml-auto ${linkBtn}`}>
                        <Pencil size={11} aria-hidden="true" /> Edit
                      </button>
                    </div>
                    <ul className="divide-y divide-border-light">
                      {items.map(item => {
                        const img = getFirstImage(item.product.image)
                        const extras = describeGiftExtras(giftExtras[item.product.id])
                        const photos = itemPhotos(item.product.id)
                        return (
                          <li key={item.id} className="flex gap-3 px-6 py-3">
                            <div className="h-12 w-12 shrink-0 overflow-hidden border border-border-light bg-soft-cream">
                              {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-brandon text-xs font-black uppercase tracking-wide text-warm-black">{item.product.name}</p>
                              <p className="mt-0.5 font-syndicatgrotesk text-[10px] text-text-muted">Qty {item.quantity} · {rupees(item.product.price)} each</p>
                              {extras && (
                                <p className="mt-0.5 flex items-center gap-1 font-syndicatgrotesk text-[10px] text-deep-gold">
                                  <Check size={11} strokeWidth={3} aria-hidden="true" /> {extras}
                                </p>
                              )}
                              {photos.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {photos.map((url, i) => (
                                    <img key={url} src={url} alt={`Your photo ${i + 1}`} className="h-8 w-8 border border-[#cbbde4] object-cover" />
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="whitespace-nowrap font-brandon text-sm font-black text-warm-black">{rupees(item.product.price * item.quantity)}</p>
                          </li>
                        )
                      })}
                    </ul>
                    {totalsBlock}
                  </section>

                  <section className={`${cardCls} px-6 py-4`}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 font-syndicatgrotesk text-[10px] font-semibold uppercase tracking-[0.2em] text-deep-gold">
                        <MapPin size={12} aria-hidden="true" /> Deliver to
                      </p>
                      <button type="button" onClick={() => goToStep(1)} disabled={sending} className={linkBtn}>
                        <Pencil size={11} aria-hidden="true" /> Change
                      </button>
                    </div>
                    {addressCard(form)}
                    {hasGiftExtras && (
                      <p className="mt-3 font-syndicatgrotesk text-[11px] font-semibold leading-5 text-[#5b4d8a]">
                        {CUSTOMIZATION_CALL_NOTE} Keep your phone ({form.phone}) handy.
                      </p>
                    )}
                  </section>

                  {reviewError && (
                    <div role="alert" className="border border-red-200 bg-red-50 px-5 py-3 font-syndicatgrotesk text-xs leading-5 text-red-700">
                      <p>{reviewError}</p>
                      {placedBefore && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <a
                            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                              `Hello Craftoo, I placed order ${placedBefore.ref}${placedBefore.couponCode ? ` with coupon ${placedBefore.couponCode}` : ''} and would like to check on it.`,
                            )}`}
                            className="inline-flex items-center gap-1.5 font-semibold text-warm-black underline underline-offset-2 hover:text-deep-gold"
                          >
                            <MessageCircle size={13} aria-hidden="true" /> Message us about order {placedBefore.ref}
                          </a>
                          <Link href="/orders" className="font-semibold text-warm-black underline underline-offset-2 hover:text-deep-gold">
                            View my orders
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="font-syndicatgrotesk text-[10px] text-text-muted leading-relaxed">
                    By placing your order you agree to our{' '}
                    <Link href="/policies/terms" target="_blank" className="text-deep-gold hover:underline">Terms &amp; Conditions</Link> and{' '}
                    <Link href="/policies/privacy" target="_blank" className="text-deep-gold hover:underline">Privacy Policy</Link>.
                  </p>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <button type="button" onClick={() => goToStep(2)} disabled={sending} className={secondaryBtn}>
                      <ArrowLeft size={13} aria-hidden="true" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={sendOrder}
                      disabled={sending}
                      className="inline-flex flex-1 items-center justify-center gap-2 bg-[#1f8f4e] px-6 py-4 font-syndicatgrotesk text-[11px] font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-[#177a41] disabled:opacity-60"
                    >
                      {sending
                        ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Opening WhatsApp…</>
                        : <><MessageCircle size={15} aria-hidden="true" /> Place order on WhatsApp</>}
                    </button>
                  </div>
                </>
              )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
