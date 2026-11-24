import 'server-only'
import { readFile } from 'fs/promises'
import path from 'path'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { SupabaseClient } from '@supabase/supabase-js'
import { orderRef, parseDbTime } from '@/lib/flower-quest/coupon-orders'
import { parseOrderAddress, type OrderContact } from '@/lib/order-address'
import { loadOrderCharges } from '@/lib/order-charges-server'
import { chargesTotal, type OrderCharge } from '@/lib/order-charges'
import { describeGiftExtraKeys } from '@/lib/gift-extras'
import { hasFreeShipping } from '@/lib/shipping'
import { getSiteSettingServer } from '@/lib/site-settings'
import { formatDateIST } from '@/lib/datetime'

/** Everything printed on an order's bill. */
export type BillData = {
  orderNumber: string
  orderDate: Date
  status: string
  contact: OrderContact
  items: { name: string; quantity: number; price: number; extras: string; photos: number }[]
  subtotal: number
  discount: number
  coupon: { code: string; percent: number } | null
  productsTotal: number
  charges: OrderCharge[]
  finalTotal: number
  freeShipping: boolean
  store: { name: string; phone: string; whatsapp: string; email: string; address: string }
}

/** Loads an order's bill. Pass `userId` to only allow that customer's own order. */
export async function loadBillData(supabase: SupabaseClient, orderId: string, userId?: string): Promise<BillData | null> {
  let query = supabase
    .from('orders')
    .select('id, order_number, status, created_at, subtotal, discount_amount, total, address, game_coupon_id, order_items(quantity, price, gift_extras, gift_photos, products(name))')
    .eq('id', orderId)
  if (userId) query = query.eq('user_id', userId)
  const { data: order, error } = await query.maybeSingle()
  if (error) throw error
  if (!order) return null

  let coupon: BillData['coupon'] = null
  if (order.game_coupon_id) {
    const { data } = await supabase.from('discount_coupons').select('code, discount_percent').eq('id', order.game_coupon_id).maybeSingle()
    if (data) coupon = { code: data.code, percent: data.discount_percent }
  }
  const [chargesByOrder, brand, contact] = await Promise.all([
    loadOrderCharges(supabase, [order.id]),
    getSiteSettingServer('brand'),
    getSiteSettingServer('contact'),
  ])
  const charges = chargesByOrder.get(order.id) ?? []
  const subtotal = Number(order.subtotal ?? order.total)
  const productsTotal = Number(order.total)

  type Row = { quantity: number; price: number | string; gift_extras: string[] | null; gift_photos: string[] | null; products: { name: string } | { name: string }[] | null }
  return {
    orderNumber: orderRef(order),
    orderDate: new Date(parseDbTime(order.created_at)),
    status: order.status ?? 'pending',
    contact: parseOrderAddress(order.address),
    items: ((order.order_items ?? []) as Row[]).map(item => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products
      return {
        name: product?.name || 'Item',
        quantity: item.quantity,
        price: Number(item.price),
        extras: describeGiftExtraKeys(item.gift_extras),
        photos: item.gift_photos?.length ?? 0,
      }
    }),
    subtotal,
    discount: Number(order.discount_amount ?? 0),
    coupon,
    productsTotal,
    charges,
    finalTotal: productsTotal + chargesTotal(charges),
    freeShipping: hasFreeShipping(subtotal),
    store: {
      name: brand.name && brand.name !== 'My Store' ? brand.name : 'Craftoo',
      phone: contact.phone,
      whatsapp: contact.whatsapp,
      email: contact.email,
      address: contact.address,
    },
  }
}

// ---------------------------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------------------------

const PAGE = { width: 595.28, height: 841.89 } // A4
const MARGIN = 44
const INK = rgb(0.247, 0.227, 0.275)       // #3f3a46
const MUTED = rgb(0.49, 0.455, 0.518)      // #7d7484
const ACCENT = rgb(0.459, 0.396, 0.647)    // #7565a5
const LINE = rgb(0.863, 0.812, 0.941)      // #dccff0
const TINT = rgb(0.969, 0.945, 0.984)      // #f7f1fb
const GREEN = rgb(0.13, 0.5, 0.29)

/** The standard PDF fonts only cover Latin-1, so swap common symbols and drop anything else. */
function safe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/•/g, '-')
    .replace(/×/g, 'x')
    .replace(/₹/g, 'Rs.')
    .replace(/…/g, '...')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\n\x20-\x7e\xa0-\xff]/g, '')
}

/** Rs. 1,234 or Rs. 179.90 */
function money(value: number): string {
  const paise = Math.round(value * 100) % 100 !== 0
  return `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: 2 })}`
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of safe(text).split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue }
      if (line) lines.push(line)
      // A single word longer than the line is cut to fit.
      let rest = word
      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--
        lines.push(rest.slice(0, cut))
        rest = rest.slice(cut)
      }
      line = rest
    }
    lines.push(line)
  }
  return lines
}

const formatDate = (date: Date) =>
  formatDateIST(date)

/** Builds the bill as an A4 PDF. */
export async function buildBillPdf(bill: BillData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${bill.store.name} bill ${bill.orderNumber}`)
  pdf.setAuthor(bill.store.name)
  pdf.setCreator(bill.store.name)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  let logo: Awaited<ReturnType<PDFDocument['embedPng']>> | null = null
  try {
    logo = await pdf.embedPng(await readFile(path.join(process.cwd(), 'public/images/logo/craftoo-logo-round-256.png')))
  } catch { /* no logo file: the bill still works without it */ }

  let page: PDFPage = pdf.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - MARGIN
  const right = PAGE.width - MARGIN
  const contentWidth = right - MARGIN

  const text = (value: string, x: number, size = 10, font = regular, color = INK) =>
    page.drawText(safe(value), { x, y, size, font, color })
  const textRight = (value: string, xRight: number, size = 10, font = regular, color = INK) => {
    const v = safe(value)
    page.drawText(v, { x: xRight - font.widthOfTextAtSize(v, size), y, size, font, color })
  }
  const rule = (color = LINE, thickness = 0.8) =>
    page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness, color })
  const ensureSpace = (needed: number) => {
    if (y - needed >= MARGIN + 40) return
    page = pdf.addPage([PAGE.width, PAGE.height])
    y = PAGE.height - MARGIN
  }

  // --- Header: logo and store details on the left, bill title on the right ---------------------
  const headerTop = y
  if (logo) {
    page.drawImage(logo, { x: MARGIN, y: headerTop - 56, width: 56, height: 56 })
  }
  const storeX = MARGIN + (logo ? 68 : 0)
  y = headerTop - 18
  text(bill.store.name, storeX, 18, bold, ACCENT)
  y -= 14
  for (const line of [
    bill.store.address,
    [bill.store.phone && `Phone ${bill.store.phone}`, bill.store.whatsapp && `WhatsApp ${bill.store.whatsapp}`].filter(Boolean).join('  |  '),
    bill.store.email,
  ].filter(Boolean)) {
    for (const part of wrap(line, regular, 8.5, 250)) { text(part, storeX, 8.5, regular, MUTED); y -= 11 }
  }

  y = headerTop - 18
  textRight('BILL', right, 22, bold, INK)
  y -= 18
  textRight(`Bill no. ${bill.orderNumber}`, right, 10, bold)
  y -= 13
  textRight(`Order date: ${formatDate(bill.orderDate)}`, right, 9, regular, MUTED)
  y -= 12
  textRight(`Bill date: ${formatDate(new Date())}`, right, 9, regular, MUTED)
  y -= 12
  textRight(`Status: ${bill.status.charAt(0).toUpperCase()}${bill.status.slice(1)}`, right, 9, regular, MUTED)

  y = Math.min(y, headerTop - 70) - 18
  rule(ACCENT, 1.2)
  y -= 22

  // --- Bill to -----------------------------------------------------------------------------------
  text('BILL TO', MARGIN, 8, bold, ACCENT)
  y -= 14
  text(bill.contact.name || 'Customer', MARGIN, 11, bold)
  y -= 13
  const reach = [bill.contact.phone, bill.contact.email].filter(Boolean).join('  |  ')
  if (reach) { text(reach, MARGIN, 9, regular, MUTED); y -= 13 }
  for (const line of wrap(bill.contact.address, regular, 9.5, contentWidth * 0.7)) {
    text(line, MARGIN, 9.5); y -= 12
  }
  y -= 14

  // --- Items table -------------------------------------------------------------------------------
  const col = { no: MARGIN + 8, item: MARGIN + 30, qty: right - 190, rate: right - 100, amount: right - 8 }
  const itemWidth = col.qty - col.item - 30
  const drawHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 7, width: contentWidth, height: 22, color: TINT })
    text('#', col.no, 8.5, bold, MUTED)
    text('ITEM', col.item, 8.5, bold, MUTED)
    textRight('QTY', col.qty + 20, 8.5, bold, MUTED)
    textRight('RATE', col.rate + 40, 8.5, bold, MUTED)
    textRight('AMOUNT', col.amount, 8.5, bold, MUTED)
    y -= 24
  }
  drawHeader()

  bill.items.forEach((item, i) => {
    const nameLines = wrap(item.name, bold, 10, itemWidth)
    const notes = [item.extras && `Gift extras: ${item.extras}`, item.photos > 0 && `${item.photos} photo${item.photos === 1 ? '' : 's'} uploaded`]
      .filter(Boolean) as string[]
    const noteLines = notes.flatMap(n => wrap(n, regular, 8.5, itemWidth))
    ensureSpace(nameLines.length * 13 + noteLines.length * 11 + 12)
    if (y > PAGE.height - MARGIN - 5) drawHeader()

    text(String(i + 1), col.no, 10, regular, MUTED)
    textRight(String(item.quantity), col.qty + 20, 10)
    textRight(money(item.price), col.rate + 40, 10)
    textRight(money(item.price * item.quantity), col.amount, 10, bold)
    nameLines.forEach((line, j) => { if (j) y -= 13; text(line, col.item, 10, bold) })
    for (const line of noteLines) { y -= 11; text(line, col.item, 8.5, regular, ACCENT) }
    y -= 10
    rule()
    y -= 16
  })

  // --- Totals ------------------------------------------------------------------------------------
  const labelX = right - 250
  const totalLine = (label: string, value: string, opts: { color?: ReturnType<typeof rgb>; font?: PDFFont; size?: number } = {}) => {
    ensureSpace(16)
    // The amount sits on the first line; a long label wraps underneath.
    textRight(value, col.amount, opts.size ?? 9.5, opts.font ?? regular, opts.color ?? INK)
    for (const [k, line] of wrap(label, opts.font ?? regular, opts.size ?? 9.5, 165).entries()) {
      if (k) y -= 12
      text(line, labelX, opts.size ?? 9.5, opts.font ?? regular, opts.color ?? INK)
    }
    y -= 16
  }

  totalLine('Subtotal', money(bill.subtotal))
  if (bill.discount > 0) {
    totalLine(bill.coupon ? `Coupon ${bill.coupon.code} (${bill.coupon.percent}% off products)` : 'Discount', `- ${money(bill.discount)}`, { color: GREEN })
  }
  for (const charge of bill.charges) {
    const label = charge.quantity > 1 ? `${charge.label} (${charge.quantity} x ${money(Number(charge.unit_amount))})` : charge.label
    totalLine(label, `+ ${money(Number(charge.amount))}`)
  }
  if (!bill.charges.some(c => c.kind === 'shipping') && bill.freeShipping) {
    totalLine('Delivery', 'Free', { color: GREEN })
  }

  ensureSpace(48)
  // y is 16pt below the last total line's baseline; leave room for its descenders above the box.
  y -= 8
  page.drawRectangle({ x: labelX - 12, y: y - 12, width: right - labelX + 12, height: 28, color: ACCENT })
  y -= 3
  text('TOTAL TO PAY', labelX, 11, bold, rgb(1, 1, 1))
  textRight(money(bill.finalTotal), col.amount, 13, bold, rgb(1, 1, 1))
  y -= 40

  // --- Notes -------------------------------------------------------------------------------------
  const notes = [
    'Payment: please pay by UPI to the details shared in our official WhatsApp chat, and send us the payment screenshot.',
    ...(!bill.freeShipping && !bill.charges.some(c => c.kind === 'shipping')
      ? ['Delivery charges for orders under Rs. 1,000 are added by our team.']
      : []),
    'Our products are handmade, so each piece may differ slightly from its photos.',
  ]
  ensureSpace(20 + notes.length * 24)
  text('NOTES', MARGIN, 8, bold, ACCENT)
  y -= 13
  for (const note of notes) {
    for (const line of wrap(note, regular, 8.5, contentWidth)) { text(line, MARGIN, 8.5, regular, MUTED); y -= 11 }
    y -= 3
  }

  // --- Footer on every page ----------------------------------------------------------------------
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    const footer = safe(`Thank you for shopping with ${bill.store.name}!`)
    p.drawText(footer, { x: MARGIN, y: MARGIN - 10, size: 9, font: bold, color: ACCENT })
    const pageLabel = `Bill ${bill.orderNumber}  |  Page ${i + 1} of ${pages.length}`
    p.drawText(pageLabel, { x: right - regular.widthOfTextAtSize(pageLabel, 8), y: MARGIN - 10, size: 8, font: regular, color: MUTED })
  })

  return pdf.save()
}

/** The PDF response, saved as e.g. "Craftoo-bill-K7M2QX.pdf". */
export function billResponse(bytes: Uint8Array, bill: BillData, download: boolean): Response {
  const fileName = `${safe(bill.store.name).replace(/[^A-Za-z0-9-]+/g, '') || 'Craftoo'}-bill-${bill.orderNumber}.pdf`
  return new Response(bytes as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
