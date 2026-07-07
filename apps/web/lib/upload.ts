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
 */
export async function uploadAttachment(
  file: File,
  userId: string,
  onProgress?: (ratio: number) => void,
): Promise<UploadedAttachment> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const contentType = file.type || 'application/octet-stream'

  const presignRes = await fetch(`${UPLOAD_API_BASE}/api/r2-upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ext, contentType, userId }),
  })
  if (!presignRes.ok) {
    throw new UploadError(`Could not start the upload (${presignRes.status}).`)
  }
  const { uploadUrl, publicUrl } = (await presignRes.json()) as {
    uploadUrl: string; publicUrl: string
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', contentType)
    let last = 0
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || !onProgress) return
      const now = performance.now()
      if (now - last < 100 && e.loaded < e.total) return
      last = now
      onProgress(Math.min(0.99, e.loaded / e.total))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress?.(1); resolve() }
      else reject(new UploadError(`Upload failed (${xhr.status}).`))
    }
    xhr.onerror = () => reject(new UploadError('Upload failed — check your connection.'))
    xhr.send(file)
  })

  return { url: publicUrl, type: attachTypeFor(file), name: file.name }
}
