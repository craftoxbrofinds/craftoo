'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useRouter } from 'next/navigation'
import { ArrowRight, Camera, Candy, Check, Phone, ShoppingBag, X } from 'lucide-react'
import { useCartStore } from '@/store/cart'
import { GIFT_EXTRAS, useGiftExtras, type GiftExtraKey } from '@/store/gift-extras'
import { CUSTOMIZATION_CALL_NOTE } from '@/lib/gift-extras'
import { GiftPhotoUploader } from '@/components/gift-photo-uploader'

const EXTRA_ICONS: Record<GiftExtraKey, typeof Candy> = { chocolates: Candy, photo: Camera }

/** Shown after a product is added to the cart: confirms it and offers optional gift extras. */
export function AddedToCartDialog() {
  const router = useRouter()
  const added = useGiftExtras(state => state.added)
  const extras = useGiftExtras(state => (added ? state.byProduct[added.id] : undefined))
  const toggle = useGiftExtras(state => state.toggle)
  const closeAdded = useGiftExtras(state => state.closeAdded)
  const openCart = useCartStore(state => state.setIsOpen)

  return (
    <DialogPrimitive.Root open={Boolean(added)} onOpenChange={open => { if (!open) closeAdded() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-[#2d2636]/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-[90] max-h-[92svh] overflow-y-auto border-t border-border-light bg-white shadow-[0_-18px_50px_rgba(63,58,70,.18)] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-6 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:border sm:shadow-[0_24px_70px_rgba(63,58,70,.22)] sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-0"
        >
          {added && (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border-light bg-soft-cream px-5 py-4">
                <span className="added-tick grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#5f9a6d] text-white shadow-[0_6px_16px_rgba(95,154,109,.35)]">
                  <Check size={19} strokeWidth={3} aria-hidden="true" />
                </span>
                <DialogPrimitive.Title className="flex-1 font-brandon text-sm font-black uppercase tracking-[0.14em] text-warm-black">
                  Added to your cart
                </DialogPrimitive.Title>
                <DialogPrimitive.Close className="p-1 text-text-muted transition-colors hover:text-warm-black" aria-label="Close">
                  <X size={18} />
                </DialogPrimitive.Close>
              </div>

              {/* Product */}
              <div className="flex items-center gap-4 px-5 pt-5">
                <div className="h-16 w-16 shrink-0 overflow-hidden border border-border-light bg-soft-cream">
                  {added.image ? (
                    <img src={added.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ShoppingBag size={18} className="text-text-muted" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-brandon text-sm font-black uppercase leading-snug tracking-wide text-warm-black">{added.name}</p>
                  <p className="mt-1 font-syndicatgrotesk text-xs text-text-muted">
                    Qty {added.quantity} · <span className="font-semibold text-deep-gold">₹{(added.price * added.quantity).toLocaleString('en-IN')}</span>
                  </p>
                </div>
              </div>

              {/* Gift extras */}
              <div className="px-5 pb-2 pt-5">
                <p className="font-syndicatgrotesk text-[10px] font-semibold uppercase tracking-[0.2em] text-deep-gold">Make it extra special</p>
                <DialogPrimitive.Description className="mt-1 font-syndicatgrotesk text-xs leading-5 text-text-muted">
                  Customise this gift. Tick what you’d like and we’ll add it to your order.
                </DialogPrimitive.Description>

                <div className="mt-3 space-y-2.5">
                  {GIFT_EXTRAS.map(extra => {
                    const Icon = EXTRA_ICONS[extra.key]
                    const checked = Boolean(extras?.[extra.key])
                    return (
                      <div key={extra.key}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggle(added.id, extra.key)}
                        className={`flex w-full items-center gap-3 border px-3.5 py-3 text-left transition-colors ${
                          checked ? 'border-[#7565a5] bg-[#f4eefb]' : 'border-border-light bg-white hover:border-[#cbbde4]'
                        }`}
                      >
                        <span className={`grid h-10 w-10 shrink-0 place-items-center ${checked ? 'bg-[#7565a5] text-white' : 'bg-soft-cream text-deep-gold'}`}>
                          <Icon size={19} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-brandon text-[13px] font-black uppercase tracking-wide text-warm-black">{extra.label}</span>
                          <span className="mt-0.5 block font-syndicatgrotesk text-[11px] leading-4 text-text-muted">{extra.hint}</span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`grid h-6 w-6 shrink-0 place-items-center border-2 transition-colors ${
                            checked ? 'border-[#7565a5] bg-[#7565a5] text-white' : 'border-[#cbbde4] bg-white text-transparent'
                          }`}
                        >
                          <Check size={15} strokeWidth={3.2} />
                        </span>
                      </button>
                      {extra.key === 'photo' && checked && <GiftPhotoUploader productId={added.id} />}
                      </div>
                    )
                  })}
                </div>
                <p className="mt-3 flex items-start gap-1.5 font-syndicatgrotesk text-[11px] leading-4 text-[#5b4d8a]">
                  <Phone size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {CUSTOMIZATION_CALL_NOTE}
                </p>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2.5 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
                <DialogPrimitive.Close className="border border-border-light bg-white py-3.5 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.2em] text-warm-black transition-colors hover:border-[#7565a5]">
                  Keep shopping
                </DialogPrimitive.Close>
                <button
                  type="button"
                  onClick={() => {
                    closeAdded()
                    openCart(false)
                    router.push('/checkout')
                  }}
                  className="inline-flex items-center justify-center gap-1.5 bg-warm-black py-3.5 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-deep-gold"
                >
                  Checkout <ArrowRight size={13} aria-hidden="true" />
                </button>
              </div>
            </>
          )}
          <style>{`
            @keyframes added-tick-pop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1) } }
            .added-tick { animation: added-tick-pop 420ms cubic-bezier(.2,.9,.3,1.3) both }
            @media (prefers-reduced-motion: reduce) { .added-tick { animation: none } }
          `}</style>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
