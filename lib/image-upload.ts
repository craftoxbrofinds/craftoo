import { supabase } from '@/lib/supabase'

export async function uploadImage(file: File | Blob, fileName = 'image.jpg') {
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