import 'server-only'
import { logger } from '@/lib/logger'

/**
 * Uploads to our file storage (nayanfood.in/craftoo/files, see deploy/file-storage/index.php).
 * Downloads are public; uploads need the secret FILE_STORAGE_API_KEY, sent as X-API-Key. This
 * only ever runs on our server, so the key never reaches the browser.
 */
export const FILE_STORAGE_URL = (process.env.FILE_STORAGE_URL || 'https://nayanfood.in/craftoo/files').replace(/\/$/, '')

/** Extensions the file server accepts. Keep in sync with $allowedExtensions in index.php. */
export const STORABLE_IMAGE_EXTENSIONS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
}

export class FileStorageError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

/** Stores the file under `fileName` (a plain name like "abc.jpg") and returns its public URL. */
export async function putFile(fileName: string, body: ArrayBuffer | Uint8Array, contentType: string): Promise<string> {
  const apiKey = process.env.FILE_STORAGE_API_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!apiKey) throw new FileStorageError('File storage is not configured (FILE_STORAGE_API_KEY is missing).', 503)

  const response = await fetch(`${FILE_STORAGE_URL}/${encodeURIComponent(fileName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'X-API-Key': apiKey },
    body: body as BodyInit,
  })
  const result = await response.json().catch(() => ({})) as { storedFileName?: string; error?: string }
  if (!response.ok) {
    logger.error('File storage upload failed', { fileName, httpStatus: response.status, reason: result.error })
    throw new FileStorageError(result.error || 'Remote file upload failed', 502)
  }
  return `${FILE_STORAGE_URL}/${encodeURIComponent(result.storedFileName || fileName)}`
}
