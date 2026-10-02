import { useId, useState, type ReactNode } from 'react'

/** Keep long stem lists closed until requested, without nesting action buttons. */
export default function StemGroupDisclosure({ projectName, trackCount, actions, children }: {
  projectName?: string
  trackCount: number
  actions: ReactNode
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const title = projectName?.trim() || 'Shared stems'
  return <div className="wd-plate wd-stem-group">
    <div className="wd-plate-caphead">
      <button type="button" className="wd-stem-toggle" aria-expanded={expanded}
        aria-controls={id} onClick={() => setExpanded(value => !value)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={expanded ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} />
        </svg>
        <span className="wd-stem-project" title={title}>{title}</span>
        <span className="wd-stem-count">/ {trackCount} {trackCount === 1 ? 'track' : 'tracks'}</span>
      </button>
      <div className="wd-plate-right">{actions}</div>
    </div>
    <div id={id} hidden={!expanded}>
      {expanded && <><div className="wd-plate-rule" />{children}</>}
    </div>
  </div>
}
