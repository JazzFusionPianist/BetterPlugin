import { useRef } from 'react'

interface Props {
  isDark: boolean
  viewMode: 'default' | 'gallery' | 'list'
  wallpaper: string | null
  onToggleDark: () => void
  onViewModeChange: (mode: 'default' | 'gallery' | 'list') => void
  onSetWallpaper: (url: string | null) => void
  onClose: () => void
}

export default function DisplayPanel({ isDark, viewMode, wallpaper, onToggleDark, onViewModeChange, onSetWallpaper, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePick = () => fileRef.current?.click()
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('max 5MB'); return }
    const reader = new FileReader()
    reader.onload = () => onSetWallpaper(reader.result as string)
    reader.readAsDataURL(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <div className="s-header">
        <div className="s-close" onClick={onClose}>&#8249;</div>
        <span className="s-title">DISPLAY</span>
      </div>

      <div className="s-body">
        <div className="s-section">
          <div className="s-section-label">appearance</div>
          <div className="s-row">
            <span className="s-row-label">Dark mode</span>
            <button
              className={`pill-toggle${isDark ? ' on' : ''}`}
              onClick={onToggleDark}
            />
          </div>
        </div>

        <div className="s-section">
          <div className="s-section-label">wallpaper</div>
          <div className="s-row">
            <span className="s-row-label">Set wallpaper</span>
            <button className="seg-opt" style={{ flex: 'none', padding: '0 12px' }} onClick={handlePick}>Choose</button>
          </div>
          {wallpaper && (
            <div className="s-row">
              <span className="s-row-label" style={{ color: 'var(--t3)', fontSize: 10 }}>Current wallpaper set</span>
              <button className="seg-opt" style={{ flex: 'none', padding: '0 12px' }} onClick={() => onSetWallpaper(null)}>Remove</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </div>

        <div className="s-section">
          <div className="s-section-label">view mode</div>
          <div className="seg">
            <button
              className={`seg-opt${viewMode === 'default' ? ' active' : ''}`}
              onClick={() => onViewModeChange('default')}
            >
              Default
            </button>
            <button
              className={`seg-opt${viewMode === 'gallery' ? ' active' : ''}`}
              onClick={() => onViewModeChange('gallery')}
            >
              Gallery
            </button>
            <button
              className={`seg-opt${viewMode === 'list' ? ' active' : ''}`}
              onClick={() => onViewModeChange('list')}
            >
              List
            </button>
          </div>
          <p className="s-note" style={{ marginTop: 10 }}>
            Default shows online friends as floating orbs.<br />
            Gallery shows profile pictures in a grid.<br />
            List shows names and status at a glance.
          </p>
        </div>
      </div>
    </>
  )
}
