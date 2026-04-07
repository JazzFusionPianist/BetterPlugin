interface Props {
  onClose: () => void
  onOpenDisplay: () => void
  onOpenInfo: () => void
  onOpenNotifSettings: () => void
}

export default function SettingsPanel({ onClose: _onClose, onOpenDisplay, onOpenInfo, onOpenNotifSettings }: Props) {
  return (
    <>
      <div className="s-body" style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0 }}>
        <div className="s-section" style={{ marginBottom: 0 }}>
          <div className="s-nav-row" onClick={onOpenDisplay}>
            <span className="s-row-label">Display</span>
            <span className="s-nav-chev">&#8250;</span>
          </div>
          <div className="s-nav-row" onClick={onOpenInfo}>
            <span className="s-row-label">User info</span>
            <span className="s-nav-chev">&#8250;</span>
          </div>
          <div className="s-nav-row" onClick={onOpenNotifSettings}>
            <span className="s-row-label">Notifications</span>
            <span className="s-nav-chev">&#8250;</span>
          </div>
        </div>
      </div>
    </>
  )
}
