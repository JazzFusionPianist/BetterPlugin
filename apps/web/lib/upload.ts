import { uploadSecureFile } from '@orb/core/lib/secureFiles.ts'
import { supabase } from './supabase'
import type { AttachType } from '@orb/core'

/**
 * Attachment upload for the mobile/web app.
 *
 * The R2 credentials live in the plugin's Vercel project, so we reuse its
 * presign endpoint (CORS-enabled) instead of duplicating secrets. The static
 * export has no API routes of its own.
 */
const UPLOAD_API_BASE =
  process.env.NEXT_PUBLIC_UPLOAD_API_BASE || 'https://better-plugin.vercel.app'

export interface UploadedAttachment {
  url: string
  type: AttachType
  name: string
}

export class UploadError extends Error {}

/**
 * Downscale + re-encode an image before upload so a phone photo lands as
 * a few hundred KB instead of several MB. Keeps aspect ratio, caps the
 * long edge, re-encodes as JPEG. Falls back to the original on any error
 * (e.g. HEIC the browser can't decode).
 */
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/** Map a File's mime to our attachment type (audio by default — this is a
 *  music app; unknown binaries are almost always bounced stems). */
export function attachTypeFor(file: File): AttachType {
  const mime = file.type
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  return 'audio'
}

/**
 * Presign + PUT one file to R2. `onProgress` gets 0..1 (throttled by the
 * caller's render, not here — XHR events are already coarse on mobile).
 *
 * `scope: 'temp'` keys the object under R2's 7-day-expiry prefix — kept
 * for genuinely-ephemeral future uses, but nothing calls it today:
 * chat attachments, stems, covers/tracks, gallery all default to 'perm'
 * and are stored forever (reads go through presigned GETs).
 */
export async function uploadAttachment(
  file: File,
  _userId: string,
  onProgress?: (ratio: number) => void,
  scope: 'temp' | 'perm' | 'public' = 'perm',
): Promise<UploadedAttachment> {
  const { url } = await uploadSecureFile(supabase, file, { apiBase: UPLOAD_API_BASE, public: scope === 'public', onProgress })
  return { url, type: attachTypeFor(file), name: file.name }
}
