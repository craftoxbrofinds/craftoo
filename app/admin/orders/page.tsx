'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { describeGiftExtraKeys } from '@/lib/gift-extras'
import { CouponVerify, STATUS_BADGE, STATUS_OPTIONS, orderNumber, rupees } from '@/components/admin/order-ui'
import { formatDateIST } from '@/lib/datetime'

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }

  const fetchOrders = async () => {
    const token = await getToken()
    const res = await fetch('/api/admin/orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    setOrders(data.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchOrders() }, [])

  const [notice, setNotice] = useState('')

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingId(id)
    setNotice('')
    const token = await getToken()
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) setNotice(body.error || 'The order could not be updated.')
    else if (body.warning) setNotice(body.warning)
    setUpdatingId(null)
    fetchOrders()
  }

  // Revenue counts final totals (products after coupon + extra charges), excluding cancelled orders.
  const revenue = orders
    .filter(o => o.status?.toLowerCase() !== 'cancelled')
    .reduce((a, o) => a + Number(o.total || 0) + Number(o.charges_total || 0), 0)

  const filtered = orders.filter(o => {
    const ms = !search ||
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.id?.toLowerCase().includes(search.toLowerCase()) ||
      o.address?.toLowerCase().includes(search.toLowerCase())
    const mf = !filterStatus || o.status?.toLowerCase() === filterStatus
    return ms && mf
  })

  const statusCount = (s: string) =>
    orders.filter(o => o.status?.toLowerCase() === s).length

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3">
        {[0, 150, 300].map(d => (
          <span key={d} className="w-2 h-2 bg-[#D4A017] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
        <span className="font-syndicatgrotesk text-[11px] tracking-widest uppercase text-[#C4B49A] ml-2">Loading orders…</span>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="font-brandon text-2xl font-black uppercase tracking-tight text-[#1A1A1A]">Orders</h1>
        <p className="font-syndicatgrotesk text-[11px] tracking-[0.15em] text-[#8A7A6A] mt-0.5">
          {orders.length} total orders · ₹{revenue.toLocaleString('en-IN')} revenue
        </p>
      </div>

      {notice && (
        <p role="alert" className="px-4 py-3 border border-amber-300 bg-amber-50 text-amber-800 font-syndicatgrotesk text-xs">{notice}</p>
      )}

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_OPTIONS.slice(0, 4).map(s => {
          const count = statusCount(s)
          const active = filterStatus === s
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(active ? '' : s)}
              className={`text-left p-4 border transition-all ${
                active
                  ? 'border-[#D4A017] bg-[#D4A017]/5'
                  : 'border-[#E8E0D5] bg-white hover:border-[#D4A017]/40'
              }`}
            >
              <p className="font-syndicatgrotesk text-[9px] tracking-[0.2em] uppercase capitalize text-[#8A7A6A]">{s}</p>
              <p className="font-brandon text-xl font-black text-[#1A1A1A] mt-1">{count}</p>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by order number, name, phone or address…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2.5 border border-[#E8E0D5] bg-white font-syndicatgrotesk text-sm text-[#1A1A1A] placeholder-[#C4B49A] outline-none focus:border-[#D4A017] transition-colors"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 border border-[#E8E0D5] bg-white font-syndicatgrotesk text-sm text-[#1A1A1A] outline-none focus:border-[#D4A017] transition-colors"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s} className="capitalize">
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E8E0D5] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px]">
            <thead className="bg-[#FAF7F2] border-b border-[#E8E0D5]">
              <tr>
                {['Order', 'Date', 'Customer', 'Address', 'Items', 'Total', 'Coupon', 'Status', 'Details'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-syndicatgrotesk text-[9px] tracking-[0.22em] uppercase text-[#8A7A6A] font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => {
                const contact = o.contact ?? { name: '', email: '', phone: '', address: o.address ?? '' }
                const customized = (o.order_items ?? []).some((item: any) => (item.gift_extras ?? []).length > 0)
                return (
                  <tr
                    key={o.id}
                    className={`border-b border-[#F0EBE1] transition-colors align-top hover:bg-[#FAF7F2] ${i % 2 === 0 ? '' : 'bg-[#FDFCFA]'}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-mono text-xs font-semibold text-[#1A1A1A] underline decoration-[#D4A017]/50 underline-offset-2 hover:text-[#D4A017]"
                      >
                        {orderNumber(o)}
                      </Link>
                      {customized && (
                        <p className="mt-1 font-syndicatgrotesk text-[9px] font-semibold uppercase tracking-[0.15em] text-[#7565a5]">Customized</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-syndicatgrotesk text-[11px] text-[#8A7A6A] whitespace-nowrap">
                      {o.created_at ? formatDateIST(o.created_at, { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3 max-w-[180px] font-syndicatgrotesk text-[11px] leading-4">
                      <p className="font-semibold text-[#1A1A1A]">{contact.name || '—'}</p>
                      {contact.phone && <p className="text-[#8A7A6A]">{contact.phone}</p>}
                      {contact.email && <p className="text-[#8A7A6A] break-all">{contact.email}</p>}
                    </td>
                    <td className="px-4 py-3 max-w-[220px] font-syndicatgrotesk text-[11px] leading-4 text-[#1A1A1A] whitespace-pre-line break-words">
                      {contact.address || <span className="text-[#C4B49A]">—</span>}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <div className="space-y-1">
                        {o.order_items?.slice(0, 3).map((item: any) => {
                          const extras = describeGiftExtraKeys(item.gift_extras)
                          return (
                            <p key={item.id} className="font-syndicatgrotesk text-[10px] leading-4 text-[#8A7A6A]">
                              <span className="line-clamp-1">{item.products?.name || 'Item'} ×{item.quantity}</span>
                              {extras && (
                                <span className="block text-[#7565a5]">
                                  + {extras}{(item.gift_photos?.length ?? 0) > 0 ? ` (${item.gift_photos.length} photo${item.gift_photos.length === 1 ? '' : 's'})` : ''}
                                </span>
                              )}
                            </p>
                          )
                        })}
                        {(o.order_items?.length || 0) > 3 && (
                          <p className="font-syndicatgrotesk text-[10px] text-[#C4B49A]">+{o.order_items.length - 3} more</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-brandon text-sm font-black text-[#1A1A1A] whitespace-nowrap">
                      {rupees(Number(o.total || 0) + Number(o.charges_total || 0))}
                      {Number(o.charges_total) > 0 && (
                        <p className="mt-0.5 font-syndicatgrotesk text-[10px] font-normal text-[#8A7A6A]">incl. {rupees(o.charges_total)} charges</p>
                      )}
                    </td>
                    <td className="px-4 py-3 w-[220px]">
                      <CouponVerify orderId={o.id} coupon={o.coupon} discountAmount={o.discount_amount} />
                    </td>
                    <td className="px-4 py-3 space-y-1.5">
                      <span className={`inline-block font-syndicatgrotesk text-[10px] font-semibold px-2 py-0.5 capitalize whitespace-nowrap ${STATUS_BADGE[o.status?.toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
                        {o.status || 'pending'}
                      </span>
                      <select
                        aria-label={`Status for order ${orderNumber(o)}`}
                        value={o.status?.toLowerCase() || 'pending'}
                        onChange={e => handleStatusChange(o.id, e.target.value)}
                        disabled={updatingId === o.id}
                        className="block border border-[#E8E0D5] bg-white px-2 py-1.5 font-syndicatgrotesk text-[11px] text-[#1A1A1A] outline-none focus:border-[#D4A017] transition-colors disabled:opacity-50 capitalize"
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s} className="capitalize">
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        aria-label={`View details for order ${orderNumber(o)}`}
                        className="inline-flex items-center gap-1 whitespace-nowrap bg-[#1A1A1A] px-3 py-2 font-syndicatgrotesk text-[9px] font-bold uppercase tracking-[0.18em] text-white hover:bg-[#D4A017] transition-colors"
                      >
                        View details →
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-14 text-center font-syndicatgrotesk text-[11px] tracking-wider uppercase text-[#C4B49A]">
                    {search || filterStatus ? 'No orders match your filters' : 'No orders yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
