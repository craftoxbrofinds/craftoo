import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { isAdmin } from '@/lib/auth'

const fileServiceUrl = process.env.FILE_STORAGE_URL || 'https://nayanfood.in/craftoo/files'

export async function POST(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
  }

  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const storedFileName = `${randomUUID()}.${extension}`
  const response = await fetch(`${fileServiceUrl.replace(/\/$/, '')}/${encodeURIComponent(storedFileName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: await file.arrayBuffer(),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    return NextResponse.json({ error: result.error || 'Remote file upload failed' }, { status: 502 })
  }

  return NextResponse.json({
    url: `${fileServiceUrl.replace(/\/$/, '')}/${encodeURIComponent(result.storedFileName || storedFileName)}`,
  })
}