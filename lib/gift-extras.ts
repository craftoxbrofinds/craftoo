/**
 * Optional gift extras (customization) a shopper can tick for a product. Shared by the cart store,
 * the WhatsApp order API and the admin order pages. The team confirms any extra charge.
 */
export type GiftExtraKey = 'chocolates' | 'photo'
export type GiftExtras = Partial<Record<GiftExtraKey, boolean>>

export const GIFT_EXTRAS: { key: GiftExtraKey; label: string; short: string; hint: string }[] = [
  {
    key: 'chocolates',
    label: 'Add chocolates',
    short: 'Chocolates',
    hint: 'We’ll tuck a few chocolates in with your gift.',
  },
  {
    key: 'photo',
    label: 'Add your photo',
    short: 'Your photo',
    hint: 'Upload the photos you’d like us to use, right here.',
  },
]

/** Shopper photo uploads for the "Your photo" extra. */
export const MAX_GIFT_PHOTOS = 5
/**
 * Uploads pass through our server on Vercel, which accepts at most about 4.5 MB per request,
 * so photos and images are limited to 4 MB. Used for customer photos and admin images.
 */
export const MAX_UPLOAD_MB = 4
export const MAX_GIFT_PHOTO_BYTES = MAX_UPLOAD_MB * 1024 * 1024
export const GIFT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const GIFT_EXTRA_KEYS = GIFT_EXTRAS.map(extra => extra.key)

/** Shown wherever a shopper picks or reviews customization. */
export const CUSTOMIZATION_CALL_NOTE = 'Our team will call you to confirm your customization.'

/** "Chocolates, Your photo" for the ticked extras, or an empty string. */
export function describeGiftExtras(extras: GiftExtras | undefined): string {
  return GIFT_EXTRAS.filter(extra => extras?.[extra.key]).map(extra => extra.short).join(', ')
}

/** The ticked keys, in display order, from either a flags object or a saved list. */
export function giftExtraKeys(extras: GiftExtras | readonly string[] | null | undefined): GiftExtraKey[] {
  if (!extras) return []
  const ticked = Array.isArray(extras)
    ? (key: GiftExtraKey) => extras.includes(key)
    : (key: GiftExtraKey) => Boolean((extras as GiftExtras)[key])
  return GIFT_EXTRA_KEYS.filter(ticked)
}

/** Display labels for saved keys, e.g. ['photo'] → "Your photo". */
export function describeGiftExtraKeys(keys: readonly string[] | null | undefined): string {
  return GIFT_EXTRAS.filter(extra => keys?.includes(extra.key)).map(extra => extra.short).join(', ')
}
