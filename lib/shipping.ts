/**
 * Delivery rule: orders whose product subtotal (before any coupon) is ₹1,000 or more ship free.
 * Below that, delivery is charged on the final bill the team sends on WhatsApp, so the site
 * shows no fixed amount.
 */
export const FREE_SHIPPING_THRESHOLD = 1000

export const FREE_SHIPPING_LABEL = `Free shipping on orders of ₹${FREE_SHIPPING_THRESHOLD.toLocaleString('en-IN')} and above`

/** `subtotal` is the product subtotal before any coupon discount. */
export function hasFreeShipping(subtotal: number): boolean {
  return subtotal >= FREE_SHIPPING_THRESHOLD
}

/** How much more the shopper needs to add for free shipping (0 once they qualify). */
export function amountToFreeShipping(subtotal: number): number {
  return Math.max(0, Math.ceil((FREE_SHIPPING_THRESHOLD - subtotal) * 100) / 100)
}
