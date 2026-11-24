import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { isAdmin } from '@/lib/auth'
import { FileStorageError, STORABLE_IMAGE_EXTENSIONS, putFile } from '@/lib/file-storage'
import { MAX_GIFT_PHOTO_BYTES, MAX_UPLOAD_MB } from '@/lib/gift-extras'

export async function POST(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
  }

  if (file.size > MAX_GIFT_PHOTO_BYTES) {
    return NextResponse.json({ error: `Images can be up to ${MAX_UPLOAD_MB} MB.` }, { status: 413 })
  }

  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const contentType = STORABLE_IMAGE_EXTENSIONS[extension]
  if (!contentType) {
    return NextResponse.json({ error: 'Upload a JPG, PNG, WebP, GIF or AVIF image.' }, { status: 415 })
  }

  try {
    const url = await putFile(`${randomUUID()}.${extension}`, await file.arrayBuffer(), contentType)
    return NextResponse.json({ url })
  } catch (error) {
    const status = error instanceof FileStorageError ? error.status : 502
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Remote file upload failed' }, { status })
  }
}
