import { isAdmin } from '@/lib/auth'
import { ApiError, getOptionalUser, getServiceClient, handleApiError } from '@/lib/flower-quest/server'
import { isChargeKind, type OrderCharge } from '@/lib/order-charges'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Staff add or remove extra charges on an order.
 * POST   { kind, label, quantity, unitAmount }  adds one
 * DELETE ?chargeId=…                           removes one
 * Both return the order's charges.
 */

const UUID = /^[0-9a-f-]{36}$/i
const noStore = { 'Cache-Control': 'no-store' }

async function listCharges(orderId: string): Promise<OrderCharge[]> {
  const { data, error } = await getServiceClient()
    .from('order_charges')
    .select('id, kind, label, quantity, unit_amount, amount, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as OrderCharge[]
}

async function requireOrder(req: Request, params: RouteContext['params']): Promise<string> {
  if (!(await isAdmin(req))) throw new ApiError('Unauthorized', 401)
  const { id } = await params
  if (!UUID.test(id)) throw new ApiError('Order not found.', 404)
  const { data, error } = await getServiceClient().from('orders').select('id').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError('Order not found.', 404)
  return id
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const orderId = await requireOrder(req, params)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    if (!isChargeKind(body.kind)) throw new ApiError('Choose a charge type.', 400)
    const label = typeof body.label === 'string' ? body.label.trim() : ''
    if (!label || label.length > 120) throw new ApiError('Enter a short description for the charge.', 400)
    const quantity = Number(body.quantity ?? 1)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new ApiError('Quantity must be a whole number from 1 to 999.', 400)
    const unitAmount = Math.round(Number(body.unitAmount) * 100) / 100
    if (!Number.isFinite(unitAmount) || unitAmount <= 0 || unitAmount > 100000) throw new ApiError('Enter an amount above ₹0.', 400)

    const staff = await getOptionalUser(req)
    const { error } = await getServiceClient().from('order_charges').insert({
      order_id: orderId,
      kind: body.kind,
      label,
      quantity,
      unit_amount: unitAmount,
      created_by: staff?.id ?? null,
    })
    if (error) throw error
    return Response.json({ charges: await listCharges(orderId) }, { headers: noStore })
  } catch (error) {
    return handleApiError(error, 'Adding an order charge failed', 'The charge couldn’t be added. Please try again.')
  }
}

export async function DELETE(req: Request, { params }: RouteContext) {
  try {
    const orderId = await requireOrder(req, params)
    const chargeId = new URL(req.url).searchParams.get('chargeId') ?? ''
    if (!UUID.test(chargeId)) throw new ApiError('Charge not found.', 404)
    const { error } = await getServiceClient().from('order_charges').delete().eq('id', chargeId).eq('order_id', orderId)
    if (error) throw error
    return Response.json({ charges: await listCharges(orderId) }, { headers: noStore })
  } catch (error) {
    return handleApiError(error, 'Removing an order charge failed', 'The charge couldn’t be removed. Please try again.')
  }
}
