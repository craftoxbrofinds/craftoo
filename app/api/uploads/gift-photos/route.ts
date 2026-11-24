import { randomUUID } from 'crypto'
import { ApiError, getOptionalUser, handleApiError } from '@/lib/flower-quest/server'
import { MAX_GIFT_PHOTO_BYTES, MAX_UPLOAD_MB } from '@/lib/gift-extras'
import { FileStorageError, putFile } from '@/lib/file-storage'

/** Detects the image type from the file's first bytes; the browser's stated type isn't trusted. */
function detectImage(bytes: Uint8Array): { ext: string; type: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', type: 'image/png' }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', type: 'image/webp' }
  return null
}

/**
 * Uploads one photo a signed-in shopper wants used for the "Your photo" gift extra, and returns
 * its URL. The page uploads several photos by calling this once per photo.
 */
export async function POST(req: Request) {
  try {
    const user = await getOptionalUser(req)
    if (!user) throw new ApiError('Sign in to upload photos.', 401)

    const formData = await req.formData().catch(() => null)
    const file = formData?.get('file')
    if (!(file instanceof File)) throw new ApiError('Choose a photo to upload.', 400)
    if (file.size === 0) throw new ApiError('That photo is empty. Choose another one.', 400)
    if (file.size > MAX_GIFT_PHOTO_BYTES) throw new ApiError(`Each photo can be up to ${MAX_UPLOAD_MB} MB.`, 413)

    const bytes = new Uint8Array(await file.arrayBuffer())
    const image = detectImage(bytes)
    if (!image) throw new ApiError('Upload a JPG, PNG or WebP photo.', 415)

    let url: string
    try {
      url = await putFile(`gift-${randomUUID()}.${image.ext}`, bytes, image.type)
    } catch (error) {
      if (error instanceof FileStorageError) console.error('Gift photo upload failed', error.message)
      throw new ApiError('Your photo couldn’t be uploaded just now. Please try again.', 502)
    }

    return Response.json({ url }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error, 'Gift photo upload failed', 'Your photo couldn’t be uploaded just now. Please try again.')
  }
}
