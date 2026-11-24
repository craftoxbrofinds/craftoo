import { isAdmin } from '@/lib/auth'
import { ApiError, getServiceClient, handleApiError } from '@/lib/flower-quest/server'
import { billResponse, buildBillPdf, loadBillData } from '@/lib/bill-pdf'

type RouteContext = { params: Promise<{ id: string }> }

/** The order's bill as a PDF, for staff. Add ?download=1 to save it instead of viewing it. */
export async function GET(req: Request, { params }: RouteContext) {
  try {
    if (!(await isAdmin(req))) throw new ApiError('Unauthorized', 401)
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError('Order not found.', 404)

    const bill = await loadBillData(getServiceClient(), id)
    if (!bill) throw new ApiError('Order not found.', 404)
    return billResponse(await buildBillPdf(bill), bill, new URL(req.url).searchParams.has('download'))
  } catch (error) {
    return handleApiError(error, 'Bill PDF failed', 'The bill couldn’t be created. Please try again.')
  }
}
