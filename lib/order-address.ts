/**
 * Orders store the delivery details as one string:
 *   "Name: … | Email: … | Phone: … | Address: …"
 * This splits it back into fields. The address itself may contain " | ", so it takes the rest.
 */
export type OrderContact = { name: string; email: string; phone: string; address: string }

export function parseOrderAddress(raw: string | null | undefined): OrderContact {
  const text = raw ?? ''
  const match = /^Name: ([\s\S]*?) \| Email: ([\s\S]*?) \| Phone: ([\s\S]*?) \| Address: ([\s\S]*)$/.exec(text)
  if (!match) return { name: '', email: '', phone: '', address: text }
  return { name: match[1].trim(), email: match[2].trim(), phone: match[3].trim(), address: match[4].trim() }
}

/** wa.me needs the number with its country code; checkout takes 10-digit Indian mobiles. */
export function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`
  if (/^91[6-9]\d{9}$/.test(digits)) return digits
  return null
}
