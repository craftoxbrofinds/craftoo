import { ApiError, getOptionalUser, getServiceClient, handleApiError } from '@/lib/flower-quest/server'
import { checkCustomerDetails, type CustomerDetails } from '@/lib/customer-details'
import { saveCustomerDetails } from '@/lib/customer-details-server'

/**
 * The signed-in customer's profile: name, contact email, phone and their one delivery address.
 * GET returns it (falling back to the account email); PUT saves it.
 */

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  try {
    const user = await getOptionalUser(req)
    if (!user) throw new ApiError('Sign in to see your profile.', 401)

    const { data, error } = await getServiceClient()
      .from('users')
      .select('name, email, contact_email, phone, delivery_address')
      .eq('id', user.id)
      .maybeSingle()
    if (error) throw error

    const accountEmail = data?.email || user.email || ''
    // The signup trigger stores the email as the name when no name was given; don't show that.
    const name = data?.name && data.name !== accountEmail ? data.name : ''
    const details: CustomerDetails = {
      name,
      email: data?.contact_email || accountEmail,
      phone: data?.phone || '',
      address: data?.delivery_address || '',
    }
    return Response.json({ details, accountEmail }, { headers: noStore })
  } catch (error) {
    return handleApiError(error, 'Profile lookup failed', 'Your profile couldn’t be loaded. Please try again.')
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getOptionalUser(req)
    if (!user) throw new ApiError('Sign in to update your profile.', 401)

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const checked = checkCustomerDetails(body)
    if (!checked.ok) throw new ApiError(checked.error, 400)

    await saveCustomerDetails(user.id, checked.details)
    return Response.json({ details: checked.details }, { headers: noStore })
  } catch (error) {
    return handleApiError(error, 'Profile update failed', 'Your profile couldn’t be saved. Please try again.')
  }
}
