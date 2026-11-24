/** Extra charges staff add to an order (delivery, photo prints, customization and so on). */

export type ChargeKind = 'shipping' | 'photo' | 'customization' | 'chocolates' | 'packaging' | 'other'

export const CHARGE_KINDS: { kind: ChargeKind; label: string; defaultLabel: string; perUnit?: string }[] = [
  { kind: 'shipping', label: 'Delivery / shipping', defaultLabel: 'Delivery charge' },
  { kind: 'photo', label: 'Photo print (per photo)', defaultLabel: 'Photo print', perUnit: 'photo' },
  { kind: 'customization', label: 'Customization', defaultLabel: 'Customization charge' },
  { kind: 'chocolates', label: 'Chocolates', defaultLabel: 'Chocolates' },
  { kind: 'packaging', label: 'Gift wrap / packaging', defaultLabel: 'Gift wrap' },
  { kind: 'other', label: 'Other (custom)', defaultLabel: '' },
]

export const isChargeKind = (value: unknown): value is ChargeKind =>
  typeof value === 'string' && CHARGE_KINDS.some(k => k.kind === value)

export type OrderCharge = {
  id: string
  kind: ChargeKind
  label: string
  quantity: number
  unit_amount: number
  amount: number
  created_at: string
}

/** Sum of charges, rounded to paise. */
export function chargesTotal(charges: { amount: number | string }[] | null | undefined): number {
  return (charges ?? []).reduce((sum, c) => sum + Math.round(Number(c.amount) * 100), 0) / 100
}

/** "Photo print · 5 × ₹50" style description for a charge line. */
export function describeCharge(charge: Pick<OrderCharge, 'label' | 'quantity' | 'unit_amount'>, rupees: (n: number) => string): string {
  return charge.quantity > 1 ? `${charge.label} · ${charge.quantity} × ${rupees(Number(charge.unit_amount))}` : charge.label
}
