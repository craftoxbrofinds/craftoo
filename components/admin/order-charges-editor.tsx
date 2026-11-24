'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { CHARGE_KINDS, describeCharge, type ChargeKind, type OrderCharge } from '@/lib/order-charges'
import { adminHeaders, rupees } from '@/components/admin/order-ui'

const inputCls = 'w-full border border-[#E8E0D5] bg-white px-2.5 py-2 font-syndicatgrotesk text-xs text-[#1A1A1A] outline-none focus:border-[#D4A017]'

/**
 * Lists an order's extra charges and lets staff add or remove them. Photo prints default to one
 * per uploaded photo, so a per-photo price is quick to enter.
 */
export function OrderChargesEditor({
  orderId,
  charges,
  photoCount,
  onChange,
}: {
  orderId: string
  charges: OrderCharge[]
  photoCount: number
  onChange: (charges: OrderCharge[]) => void
}) {
  const [kind, setKind] = useState<ChargeKind>('shipping')
  const [label, setLabel] = useState('Delivery charge')
  const [quantity, setQuantity] = useState('1')
  const [unitAmount, setUnitAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const pickKind = (next: ChargeKind) => {
    const preset = CHARGE_KINDS.find(k => k.kind === next)
    setKind(next)
    setLabel(preset?.defaultLabel ?? '')
    setQuantity(next === 'photo' && photoCount > 0 ? String(photoCount) : '1')
  }

  const call = async (init: RequestInit, query = '') => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/charges${query}`, {
        ...init,
        headers: { ...(await adminHeaders()), 'Content-Type': 'application/json' },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'The charge couldn’t be saved.')
      onChange(body.charges as OrderCharge[])
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The charge couldn’t be saved.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await call({
      method: 'POST',
      body: JSON.stringify({ kind, label, quantity: Number(quantity), unitAmount: Number(unitAmount) }),
    })
    if (ok) setUnitAmount('')
  }

  const remove = (charge: OrderCharge) => {
    if (!window.confirm(`Remove “${charge.label}” (${rupees(charge.amount)}) from this order?`)) return
    void call({ method: 'DELETE' }, `?chargeId=${charge.id}`)
  }

  const preset = CHARGE_KINDS.find(k => k.kind === kind)
  const preview = Number(quantity) * Number(unitAmount)

  return (
    <div className="space-y-3">
      {charges.length > 0 && (
        <ul className="space-y-1.5">
          {charges.map(charge => (
            <li key={charge.id} className="flex items-center justify-between gap-3 text-xs text-[#1A1A1A]">
              <span className="min-w-0">{describeCharge(charge, rupees)}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-semibold">+{rupees(charge.amount)}</span>
                <button
                  type="button"
                  onClick={() => remove(charge)}
                  disabled={saving}
                  className="print:hidden p-1 text-[#8A7A6A] hover:text-red-600 disabled:opacity-40"
                  aria-label={`Remove ${charge.label}`}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="print:hidden space-y-2 border border-dashed border-[#D9CFC2] bg-white p-3">
        <p className="font-syndicatgrotesk text-[9px] font-semibold uppercase tracking-[0.2em] text-[#8A7A6A]">Add a charge</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="sr-only">Charge type</span>
            <select value={kind} onChange={e => pickKind(e.target.value as ChargeKind)} className={inputCls}>
              {CHARGE_KINDS.map(k => <option key={k.kind} value={k.kind}>{k.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Description</span>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              maxLength={120}
              placeholder="Description, e.g. Express delivery"
              className={inputCls}
              required
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block font-syndicatgrotesk text-[10px] text-[#8A7A6A]">
              Quantity{preset?.perUnit ? ` (${preset.perUnit}s)` : ''}
            </span>
            <input type="number" min={1} max={999} step={1} value={quantity} onChange={e => setQuantity(e.target.value)} className={inputCls} required />
          </label>
          <label className="block">
            <span className="mb-0.5 block font-syndicatgrotesk text-[10px] text-[#8A7A6A]">
              Price{preset?.perUnit ? ` per ${preset.perUnit}` : ''} (₹)
            </span>
            <input type="number" min={1} max={100000} step="0.01" value={unitAmount} onChange={e => setUnitAmount(e.target.value)} placeholder="0" className={inputCls} required />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-syndicatgrotesk text-[11px] text-[#8A7A6A]">
            {Number.isFinite(preview) && preview > 0 ? `Adds ${rupees(preview)}` : 'Enter a price to add this charge.'}
          </span>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-[#1A1A1A] px-3.5 py-2 font-syndicatgrotesk text-[10px] font-bold uppercase tracking-[0.16em] text-white hover:bg-[#D4A017] disabled:opacity-40 transition-colors"
          >
            <Plus size={12} aria-hidden="true" /> {saving ? 'Saving…' : 'Add charge'}
          </button>
        </div>
        {error && <p role="alert" className="font-syndicatgrotesk text-[11px] text-red-700">{error}</p>}
      </form>
    </div>
  )
}
