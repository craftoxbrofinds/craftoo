'use client'

import { useCartStore } from '@/store/cart'
import { X, Minus, Plus, ShoppingBag, ArrowRight, Trash2, Check } from 'lucide-react'
import { GIFT_EXTRAS, useGiftExtras } from '@/store/gift-extras'
import { amountToFreeShipping, hasFreeShipping } from '@/lib/shipping'
import { CUSTOMIZATION_CALL_NOTE } from '@/lib/gift-extras'
import { GiftPhotoUploader } from '@/components/gift-photo-uploader'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

function getFirstImage(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr) && arr.length > 0) return arr[0]
  } catch {}
  return raw
}

export function CartDrawer() {
  const { isOpen, setIsOpen, items, updateQuantity, removeItem, isLoading } = useCartStore()
  const giftExtras = useGiftExtras(state => state.byProduct)
  const toggleExtra = useGiftExtras(state => state.toggle)
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [stockError, setStockError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    let active = true
    setToken(null)
    setUserName(null)
    setAuthLoading(true)
    setAuthError(null)

    const loadAccount = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!active) return

        setToken(session?.access_token ?? null)
        if (!session) {
          setUserName(null)
          return
        }

        const email = session.user.email ?? ''
        const metadataName = session.user.user_metadata?.full_name
        setUserName(
          typeof metadataName === 'string' && metadataName.trim()
            ? metadataName.trim()
            : email.split('@')[0] || 'there',
        )

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('name')
          .eq('id', session.user.id)
          .maybeSingle()
        if (profileError) {
          console.error('Could not load cart greeting name', profileError)
          return
        }
        if (!active) return

        const profileName = profile?.name?.trim()
        if (profileName && profileName.toLowerCase() !== email.toLowerCase()) {
          setUserName(profileName)
        }
      } catch (error) {
        console.error('Could not verify the current cart account', error)
        if (active) {
          setToken(null)
          setUserName(null)
          setAuthError('We could not verify your account. Please sign in again.')
        }
      } finally {
        if (active) setAuthLoading(false)
      }
    }

    void loadAccount()
    return () => {
      active = false
    }
  }, [isOpen])

  useEffect(() => {
    if (stockError) {
      const t = setTimeout(() => setStockError(null), 3000)
      return () => clearTimeout(t)
    }
  }, [stockError])

  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      const t = setTimeout(() => setVisible(true), 10)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), 320)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const itemCount = items.reduce((a, i) => a + i.quantity, 0)

  const handleUpdateQty = async (cartItemId: string, newQty: number) => {
    if (!token) return
    try {
      // Gift extras are dropped by the cart store once the server confirms the item is gone.
      setStockError(null)
      if (newQty <= 0) await removeItem(token, cartItemId)
      else await updateQuantity(token, cartItemId, newQty)
    } catch (err: any) {
      setStockError(err.message)
    }
  }

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Panel */}
      <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full">
        <div className={`pointer-events-auto w-screen max-w-[420px] flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-gray-200">
            <div className="flex min-w-0 items-center gap-3">
              <ShoppingBag size={17} className="text-deep-gold" />
              <div className="min-w-0">
                <h2 className="font-brandon text-sm font-black uppercase tracking-[0.2em] text-warm-black">
                  Your Cart
                </h2>
                <p className="truncate font-syndicatgrotesk text-[10px] text-text-muted" aria-live="polite">
                  {authLoading
                    ? 'Checking your account…'
                    : token
                      ? `Hi, ${userName ?? 'there'}`
                      : 'Sign in to view your cart'}
                </p>
              </div>
              {token && itemCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 bg-deep-gold text-white font-brandon text-[10px] font-black rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center border border-gray-200 bg-white text-gray-500 hover:border-deep-gold/50 hover:text-deep-gold transition-colors"
              aria-label="Close cart"
            >
              <X size={15} />
            </button>
          </div>

          {/* Stock error banner */}
          {stockError && (
            <div className="px-6 py-2.5 bg-red-50 border-b border-red-200 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="font-syndicatgrotesk text-[10px] tracking-[0.1em] text-red-700">{stockError}</p>
            </div>
          )}

          {/* Items */}
          <div className="flex-1 overflow-y-auto bg-[#f5f5f5] [scrollbar-width:thin] [scrollbar-color:#B8860B_#e5e5e5]">
            {authLoading ? (
              <div className="flex h-full items-center justify-center bg-white px-8 text-center">
                <p className="font-syndicatgrotesk text-sm text-text-muted" role="status">Checking your account…</p>
              </div>
            ) : authError ? (
              <div className="flex h-full flex-col items-center justify-center gap-5 bg-white px-8 py-20 text-center" role="alert">
                <p className="font-syndicatgrotesk text-sm leading-6 text-text-muted">{authError}</p>
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); router.push('/signin') }}
                  className="px-7 py-2.5 bg-warm-black text-ivory font-syndicatgrotesk text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-deep-gold transition-colors"
                >
                  Sign In
                </button>
              </div>
            ) : !token ? (
              <div className="flex h-full flex-col items-center justify-center gap-5 bg-white px-8 py-20 text-center">
                <div className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-full flex items-center justify-center bg-gray-50">
                  <ShoppingBag size={28} className="text-muted-taupe" />
                </div>
                <div>
                  <p className="font-brandon text-base font-black uppercase tracking-wide text-warm-black mb-1">
                    Sign in to view your cart
                  </p>
                  <p className="font-syndicatgrotesk text-xs text-text-muted leading-relaxed">
                    Your account keeps your cart ready for checkout.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); router.push('/signin') }}
                  className="px-7 py-2.5 bg-warm-black text-ivory font-syndicatgrotesk text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-deep-gold transition-colors"
                >
                  Sign In
                </button>
              </div>
            ) : items.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full gap-5 py-20 text-center px-8 bg-white">
                <div className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-full flex items-center justify-center bg-gray-50">
                  <ShoppingBag size={28} className="text-muted-taupe" />
                </div>
                <div>
                  <p className="font-brandon text-base font-black uppercase tracking-wide text-warm-black mb-1">
                    Your cart is empty
                  </p>
                  <p className="font-syndicatgrotesk text-xs text-text-muted leading-relaxed">
                    Explore our collections and add something made with love
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-7 py-2.5 bg-warm-black text-ivory font-syndicatgrotesk text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-deep-gold transition-colors"
                >
                  Shop Now
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 px-0">
                {items.map((item) => {
                  const img = getFirstImage(item.product.image)
                  return (
                    <li key={item.id} className="py-4 px-4 flex gap-4 bg-white">
                      {/* Product image */}
                      <div className="w-20 h-20 shrink-0 bg-gray-50 border border-gray-200 overflow-hidden">
                        {img ? (
                          <img
                            src={img}
                            alt={item.product.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag size={18} className="text-muted-taupe" />
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-brandon text-sm font-black uppercase tracking-wide text-warm-black leading-snug line-clamp-2">
                              {item.product.name}
                            </h3>
                            <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={`Gift extras for ${item.product.name}`}>
                              {GIFT_EXTRAS.map(extra => {
                                const checked = Boolean(giftExtras[item.product.id]?.[extra.key])
                                return (
                                  <button
                                    key={extra.key}
                                    type="button"
                                    role="checkbox"
                                    aria-checked={checked}
                                    onClick={() => toggleExtra(item.product.id, extra.key)}
                                    className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-syndicatgrotesk text-[10px] transition-colors ${
                                      checked ? 'border-[#7565a5] bg-[#f4eefb] text-warm-black' : 'border-border-light text-text-muted hover:border-[#cbbde4]'
                                    }`}
                                  >
                                    <span className={`grid h-3 w-3 place-items-center border ${checked ? 'border-[#7565a5] bg-[#7565a5] text-white' : 'border-[#cbbde4] text-transparent'}`}>
                                      <Check size={9} strokeWidth={3.5} aria-hidden="true" />
                                    </span>
                                    {extra.short}
                                  </button>
                                )
                              })}
                            </div>
                            {giftExtras[item.product.id]?.photo && <GiftPhotoUploader productId={item.product.id} compact />}
                            {GIFT_EXTRAS.some(extra => giftExtras[item.product.id]?.[extra.key]) && (
                              <p className="mt-1 font-syndicatgrotesk text-[10px] leading-4 text-[#5b4d8a]">
                                {CUSTOMIZATION_CALL_NOTE}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => void handleUpdateQty(item.id, 0)}
                            disabled={isLoading}
                            className="shrink-0 text-muted-taupe hover:text-red-500 transition-colors disabled:opacity-40 p-0.5"
                            aria-label="Remove item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          {/* Qty stepper */}
                          <div className="flex items-center border border-gray-300 bg-white divide-x divide-gray-300">
                            <button
                              disabled={isLoading}
                              onClick={() => handleUpdateQty(item.id, item.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-deep-gold hover:bg-soft-cream transition-colors disabled:opacity-40"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="w-8 h-7 flex items-center justify-center font-brandon text-xs font-black text-warm-black">
                              {item.quantity}
                            </span>
                            <button
                              disabled={isLoading || (item.product.stock !== null && item.product.stock !== undefined && item.quantity >= item.product.stock)}
                              onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-deep-gold hover:bg-soft-cream transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Plus size={11} />
                            </button>
                          </div>

                          {/* Price */}
                          <span className="font-brandon text-base font-black text-warm-black">
                            ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {token && items.length > 0 && (
            <div className="bg-white border-t border-gray-200 px-6 py-5 space-y-4">

              {/* Order summary */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-syndicatgrotesk text-[10px] tracking-[0.15em] uppercase text-text-muted">
                    Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})
                  </span>
                  <span className="font-brandon text-sm font-black text-warm-black">
                    ₹{total.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-syndicatgrotesk text-[10px] tracking-[0.15em] uppercase text-text-muted">
                    Shipping
                  </span>
                  {hasFreeShipping(total) ? (
                    <span className="font-syndicatgrotesk text-[11px] text-deep-gold font-semibold">Free</span>
                  ) : (
                    <span className="font-syndicatgrotesk text-[11px] text-warm-black">Added to final bill</span>
                  )}
                </div>
                {!hasFreeShipping(total) && (
                  <p className="font-syndicatgrotesk text-[10px] leading-4 text-deep-gold">
                    Add ₹{amountToFreeShipping(total).toLocaleString('en-IN')} more for free shipping.
                  </p>
                )}
                <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                  <span className="font-brandon text-sm font-black uppercase tracking-wide text-warm-black">
                    {hasFreeShipping(total) ? 'Total' : 'Total (before delivery)'}
                  </span>
                  <span className="font-brandon text-xl font-black text-warm-black">
                    ₹{total.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Checkout CTA */}
              <button
                onClick={() => { setIsOpen(false); router.push('/checkout') }}
                className="w-full flex items-center justify-center gap-2 py-4 bg-warm-black text-ivory font-syndicatgrotesk text-[11px] font-bold tracking-[0.25em] uppercase hover:bg-deep-gold transition-colors duration-200 group"
              >
                Proceed to Checkout
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform duration-200" />
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-2.5 border border-gray-300 bg-white font-syndicatgrotesk text-[10px] tracking-[0.18em] uppercase text-gray-500 hover:border-deep-gold/60 hover:text-deep-gold transition-colors"
              >
                Continue Shopping
              </button>

              {/* Temporarily hidden: checkout trust note. */}
              {/* <p className="text-center font-syndicatgrotesk text-[9px] tracking-[0.1em] text-muted-taupe">
                🔒 Secure checkout · Free returns · Handmade with care
              </p> */}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
