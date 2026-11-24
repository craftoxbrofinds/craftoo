import 'server-only'
import { getServiceClient } from '@/lib/flower-quest/server'
import type { CustomerDetails } from '@/lib/customer-details'

/** Saves the customer's contact details and delivery address to their profile (public.users). */
export async function saveCustomerDetails(userId: string, details: CustomerDetails): Promise<void> {
  const { error } = await getServiceClient()
    .from('users')
    .upsert(
      { id: userId, name: details.name, contact_email: details.email, phone: details.phone, delivery_address: details.address },
      { onConflict: 'id' },
    )
  if (error) throw error
}
