interface Props {
  isDark: boolean
  viewMode: 'default' | 'gallery' | 'list'
  onToggleDark: () => void
  onViewModeChange: (mode: 'default' | 'gallery' | 'list') => void
  onClose: () => void
}

export default function DisplayPanel({ isDark, viewMode, onToggleDark, onViewModeChange, onClose }: Props) {
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
