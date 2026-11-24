import { isAdmin } from '@/lib/auth'
import { ApiError, getServiceClient, handleApiError } from '@/lib/flower-quest/server'
import { verifyOrderCoupon } from '@/lib/flower-quest/coupon-orders'

type RouteContext = { params: Promise<{ id: string }> }

/** Admin Verify button: checks the order's coupon against the order (see verifyOrderCoupon). */
export async function GET(req: Request, { params }: RouteContext) {
  try {
    if (!(await isAdmin(req))) throw new ApiError('Unauthorized', 401)
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError('Order not found.', 404)
    return Response.json(await verifyOrderCoupon(getServiceClient(), id), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error, 'Order coupon check failed', 'The coupon could not be checked. Please try again.')
  }
}
