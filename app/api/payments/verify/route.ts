import { createHmac, timingSafeEqual } from 'crypto'
import Razorpay from 'razorpay'
import {
  ApiError,
  getOptionalUser,
  getServiceClient,
  handleApiError,
} from '@/lib/flower-quest/server'
import { logger } from '@/lib/logger'

function isValidSignature(expected: string, provided: unknown): provided is string {
  if (typeof provided !== 'string' || !/^[a-f0-9]{64}$/i.test(provided)) return false
  const expectedBytes = Buffer.from(expected, 'hex')
  const providedBytes = Buffer.from(provided, 'hex')
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes)
}

export async function POST(req: Request) {
  try {
    const user = await getOptionalUser(req)
    if (!user) throw new ApiError('Unauthorized', 401)

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) throw new ApiError('Payment verification is not configured', 503)

    const body = await req.json() as {
      orderId?: unknown
      razorpay_order_id?: unknown
      razorpay_payment_id?: unknown
      razorpay_signature?: unknown
    }
    if (
      typeof body.orderId !== 'string' ||
      typeof body.razorpay_order_id !== 'string' ||
      typeof body.razorpay_payment_id !== 'string' ||
      typeof body.razorpay_signature !== 'string'
    ) {
      throw new ApiError('Missing payment fields', 400)
    }

    const expectedSignature = createHmac('sha256', keySecret)
      .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
      .digest('hex')
    if (!isValidSignature(expectedSignature, body.razorpay_signature)) {
      throw new ApiError('Invalid payment signature', 400)
    }

    const supabase = getServiceClient()
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, status, total, razorpay_order_id')
      .eq('id', body.orderId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (orderError) throw orderError
    if (!order || order.razorpay_order_id !== body.razorpay_order_id) {
      throw new ApiError('Payment does not match this order', 400)
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
    const payment = await razorpay.payments.fetch(body.razorpay_payment_id)
    const expectedAmount = Math.round(Number(order.total) * 100)
    if (
      payment.order_id !== order.razorpay_order_id ||
      payment.amount !== expectedAmount ||
      payment.currency !== 'INR' ||
      payment.status !== 'captured' ||
      !payment.captured
    ) {
      throw new ApiError('Payment is not captured for the expected amount and order', 409)
    }

    const { data: finalized, error: finalizeError } = await supabase.rpc('finalize_flower_quest_payment', {
      p_order_id: order.id,
      p_user_id: user.id,
      p_razorpay_order_id: body.razorpay_order_id,
      p_razorpay_payment_id: body.razorpay_payment_id,
    })
    if (finalizeError) throw finalizeError
    if (order.status !== 'paid' && finalized !== true) {
      throw new Error('Payment could not be finalized')
    }

    logger.info('Payment verified', { route: 'payments/verify', orderId: order.id, userId: user.id, amount: Number(order.total), alreadyPaid: order.status === 'paid' })
    return Response.json({ success: true, orderId: order.id }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error, 'Payment verification failed')
  }
}
