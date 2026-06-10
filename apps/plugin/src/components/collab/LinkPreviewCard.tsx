import { useLinkPreview } from '../../hooks/useLinkPreview'
import { openExternalUrl } from '../../lib/linkify'

/**
 * Slack/iMessage-style link preview card.
 *
 * Renders nothing while the preview is loading or when the unfurl
 * fails — the message bubble itself still shows the raw URL (via
 * linkify), so the user always has a clickable link even if the
 * card never appears.
 *
 * Layout depends on what came back:
 *   - YouTube and other image-rich previews → "video-like" card with
 *     a wide thumbnail on top and the title/site below.
 *   - Image-less previews → compact text-only card.
 */
export default function LinkPreviewCard ({ url }: { url: string }) {
  const p = useLinkPreview(url)
  if (!p) return null

  const handleOpen = () => openExternalUrl(p.url)

  // Image-rich layout
  if (p.image) {
    return (
      <div
        className="msg-link-preview msg-link-preview-rich"
        role="button"
        onClick={handleOpen}
      >
        <div className="msg-link-preview-thumb">
          <img src={p.image} alt="" referrerPolicy="no-referrer" loading="lazy" />
        </div>
        <div className="msg-link-preview-info">
          {p.siteName && <div className="msg-link-preview-site">{p.siteName}</div>}
          {p.title && <div className="msg-link-preview-title">{p.title}</div>}
          {p.description && (
            <div className="msg-link-preview-desc">{p.description}</div>
          )}
        </div>
      </div>
    )
  }

  // Text-only fallback
  if (!p.title && !p.description) return null
  return (
    <div
      className="msg-link-preview msg-link-preview-text"
      role="button"
      onClick={handleOpen}
    >
      {p.siteName && <div className="msg-link-preview-site">{p.siteName}</div>}
      {p.title && <div className="msg-link-preview-title">{p.title}</div>}
      {p.description && (
        <div className="msg-link-preview-desc">{p.description}</div>
      )}
    </div>
  )
}
