/**
 * A customer's contact details and their one delivery address. Checkout and the profile page
 * use the same rules, and checkout saves them back to the profile.
 */
export type CustomerDetails = { name: string; email: string; phone: string; address: string }

export const EMPTY_DETAILS: CustomerDetails = { name: '', email: '', phone: '', address: '' }

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/** Cleans the four fields and returns the first problem, if any. */
export function checkCustomerDetails(input: Partial<Record<keyof CustomerDetails, unknown>>):
  { ok: true; details: CustomerDetails } | { ok: false; error: string } {
  const details: CustomerDetails = {
    name: text(input.name),
    email: text(input.email).toLowerCase(),
    phone: text(input.phone).replace(/[\s-]/g, '').replace(/^(\+?91)(?=[6-9]\d{9}$)/, ''),
    address: text(input.address),
  }
  if (!details.name || details.name.length > 120) return { ok: false, error: 'Enter your full name.' }
  if (!details.email || details.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) {
    return { ok: false, error: 'Enter a valid email address.' }
  }
  if (!/^[6-9][0-9]{9}$/.test(details.phone)) return { ok: false, error: 'Enter a valid 10-digit mobile number.' }
  if (!details.address || details.address.length > 2000) return { ok: false, error: 'Enter your delivery address.' }
  return { ok: true, details }
}
