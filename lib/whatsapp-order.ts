/** Shared between the checkout page and POST /api/orders/whatsapp. */

/** An order recorded when the shopper taps "Send on WhatsApp". */
export type PlacedOrder = {
  orderId: string
  /** Short reference shown to shoppers and staff, e.g. "3F9A1C2B". */
  ref: string
  /** True when this matched an order the shopper had already placed. */
  existing: boolean
  subtotal: number
  discountAmount: number
  total: number
  coupon: { code: string; discountPercent: number } | null
}

/** Why an order was refused because one was already placed. */
export type OrderConflict = {
  reason: 'already-placed' | 'duplicate' | 'changed'
  error: string
  order?: { id: string; ref: string; status: string; createdAt: string; couponCode: string | null }
}

export const WHATSAPP_NUMBER = '919148997472'

/**
 * The order just sent from checkout, kept for this tab so the home page can confirm it and
 * reopen WhatsApp if the message didn't go out.
 */
export const LAST_ORDER_KEY = 'craftoo:last-order'
export type LastOrder = { ref: string; whatsappUrl: string; whatsappOpened: boolean; at: number }
