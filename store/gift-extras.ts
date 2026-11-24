import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { GIFT_EXTRAS, MAX_GIFT_PHOTOS, type GiftExtraKey, type GiftExtras } from '@/lib/gift-extras'

/**
 * The gift extras a shopper ticked for products in their cart. They are remembered on this device
 * for the signed-in account only, are dropped once the product leaves the cart, and are saved
 * with the order when it is sent on WhatsApp.
 */
export { GIFT_EXTRAS, describeGiftExtras, type GiftExtraKey, type GiftExtras } from '@/lib/gift-extras'

export type AddedProduct = { id: string; name: string; price: number; image?: string; quantity: number }

type GiftExtrasState = {
  /** The account these extras belong to. */
  ownerId: string | null
  byProduct: Record<string, GiftExtras>
  /** Uploaded photo URLs for the "Your photo" extra, by product. */
  photos: Record<string, string[]>
  addPhoto: (productId: string, url: string) => void
  removePhoto: (productId: string, url: string) => void
  /** The product shown in the "added to cart" popup, if it is open. */
  added: AddedProduct | null
  toggle: (productId: string, key: GiftExtraKey) => void
  clear: (productId: string) => void
  /** Keeps only the extras for products that are still in the cart. */
  keepOnly: (productIds: string[]) => void
  /** Ties the extras to the signed-in account; a different account (or signing out) starts empty. */
  setOwner: (userId: string | null) => void
  showAdded: (product: AddedProduct) => void
  closeAdded: () => void
}

export const useGiftExtras = create<GiftExtrasState>()(
  persist(
    set => ({
      ownerId: null,
      byProduct: {},
      photos: {},
      added: null,
      toggle: (productId, key) => set(state => {
        const current = state.byProduct[productId] ?? {}
        const next = { ...current, [key]: !current[key] }
        const byProduct = { ...state.byProduct }
        if (GIFT_EXTRAS.some(extra => next[extra.key])) byProduct[productId] = next
        else delete byProduct[productId]
        // Unticking "Your photo" drops its uploaded photos too.
        if (key === 'photo' && !next.photo && state.photos[productId]) {
          const photos = { ...state.photos }
          delete photos[productId]
          return { byProduct, photos }
        }
        return { byProduct }
      }),
      addPhoto: (productId, url) => set(state => {
        const current = state.photos[productId] ?? []
        if (current.includes(url) || current.length >= MAX_GIFT_PHOTOS) return state
        return { photos: { ...state.photos, [productId]: [...current, url] } }
      }),
      removePhoto: (productId, url) => set(state => {
        const next = (state.photos[productId] ?? []).filter(photo => photo !== url)
        const photos = { ...state.photos }
        if (next.length > 0) photos[productId] = next
        else delete photos[productId]
        return { photos }
      }),
      clear: productId => set(state => {
        if (!state.byProduct[productId] && !state.photos[productId]) return state
        const byProduct = { ...state.byProduct }
        const photos = { ...state.photos }
        delete byProduct[productId]
        delete photos[productId]
        return { byProduct, photos }
      }),
      keepOnly: productIds => set(state => {
        const keep = new Set(productIds)
        const stale = [...Object.keys(state.byProduct), ...Object.keys(state.photos)].filter(id => !keep.has(id))
        if (stale.length === 0) return state
        const byProduct = { ...state.byProduct }
        const photos = { ...state.photos }
        for (const id of stale) {
          delete byProduct[id]
          delete photos[id]
        }
        return { byProduct, photos }
      }),
      setOwner: userId => set(state => (
        state.ownerId === userId ? state : { ownerId: userId, byProduct: {}, photos: {}, added: null }
      )),
      showAdded: product => set({ added: product }),
      closeAdded: () => set({ added: null }),
    }),
    {
      name: 'craftoo-gift-extras',
      storage: createJSONStorage(() => localStorage),
      // Only the ticked extras are remembered; the popup itself never reopens after a reload.
      partialize: state => ({ ownerId: state.ownerId, byProduct: state.byProduct, photos: state.photos }),
    },
  ),
)
