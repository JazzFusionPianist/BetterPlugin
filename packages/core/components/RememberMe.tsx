import type { CSSProperties } from 'react'

const checkboxStyle: CSSProperties = { appearance: 'auto', width: 16, height: 16, margin: 0, accentColor: 'var(--sl-ink)', cursor: 'pointer', flex: 'none' }

export function RememberMe({ checked, onChange, disabled }: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 6px', fontSize: 13, color: 'var(--sl-t2)', cursor: 'pointer' }}>
    <input type="checkbox" name="rememberMe" checked={checked} disabled={disabled}
      style={checkboxStyle} onChange={event => onChange(event.target.checked)} />
    <span>keep me signed in</span>
  </label>
}
