import { useRef } from 'react'
import FloatingOrbs from '../FloatingOrbs'
import { useT } from '../../i18n/LanguageContext'

interface Props {
  isDark: boolean
  wallpaper: string | null
  onToggleDark: () => void
  onSetWallpaper: (url: string | null) => void
  onClose: () => void
}

export default function DisplayPanel({ isDark, wallpaper, onToggleDark, onSetWallpaper, onClose }: Props) {
  const { t } = useT()
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePick = () => fileRef.current?.click()
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert(t('alert.maxFileSize5mb')); return }
    const reader = new FileReader()
    reader.onload = () => onSetWallpaper(reader.result as string)
    reader.readAsDataURL(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="settings-panel">
      <FloatingOrbs count={28} />

      <div className="settings-card settings-header-card" onClick={onClose} role="button" tabIndex={0}>
        <span className="settings-header-back">‹</span>
        <span className="settings-header-title">{t('settings.display')}</span>
      </div>

      <div className="display-stack">
        <div className="settings-card settings-row-card" onClick={onToggleDark} role="button" tabIndex={0}>
          <span>{t('display.darkMode')}</span>
          <button
            className={`pill-toggle${isDark ? ' on' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleDark() }}
            tabIndex={-1}
          />
        </div>

        <div className="settings-card settings-row-card" onClick={handlePick} role="button" tabIndex={0}>
          <span>{t('display.setWallpaper')}</span>
          <span className="settings-row-action">{t('display.choose')}</span>
        </div>

        {wallpaper && (
          <div
            className="settings-card settings-row-card"
            onClick={() => onSetWallpaper(null)}
            role="button"
            tabIndex={0}
          >
            <span>{t('display.removeWallpaper')}</span>
            <span className="settings-row-action settings-row-action-danger">{t('display.remove')}</span>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}
