import { supabase } from '@/lib/supabase'
import { MAX_GIFT_PHOTO_BYTES, MAX_UPLOAD_MB } from '@/lib/gift-extras'

export async function uploadImage(file: File | Blob, fileName = 'image.jpg') {
  // Uploads pass through our server, which accepts about 4.5 MB on Vercel.
  if (file.size > MAX_GIFT_PHOTO_BYTES) throw new Error(`${fileName} is over ${MAX_UPLOAD_MB} MB. Please use a smaller image.`)
  const { data: { session } } = await supabase.auth.getSession()
  const formData = new FormData()
  formData.append('file', file, fileName)

  const response = await fetch('/api/admin/uploads/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: formData,
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Image upload failed')
  return result.url as string
}