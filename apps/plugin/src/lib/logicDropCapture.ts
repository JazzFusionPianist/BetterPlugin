import { useEffect, useRef } from 'react'
import { inspectLogicDropSelection } from './dawRegionBridge'
import { readLogicSelection, matchLogicDrop, type LogicSelection } from '@orb/core/lib/logicRegionDrop.ts'
import { sha256 } from '@orb/core/lib/regionBundle.ts'
import { rememberLogicEvidence } from './regionSharing'

/** Capture at drag entry, validate after file promises resolve. No menus or exports. */
export function useLogicDropCapture() {
  const captures = useRef(new Map<string, Promise<{ selection?: LogicSelection; error?: Error }>>())
  useEffect(() => {
    const onEnter = (event: Event) => {
      const id = (event as CustomEvent).detail?.captureId
      if (typeof id !== 'string' || !/^logic-\d+$/.test(id) || captures.current.has(id)) return
      if (captures.current.size >= 8) captures.current.delete(captures.current.keys().next().value!)
      captures.current.set(id, inspectLogicDropSelection().then(snapshot => ({ selection: readLogicSelection(snapshot) }))
        .catch(error => ({ error: error instanceof Error ? error : new Error(String(error)) })))
    }
    window.addEventListener('__juceLogicRegionEnter', onEnter)
    return () => { window.removeEventListener('__juceLogicRegionEnter', onEnter); captures.current.clear() }
  }, [])
  return async (files: File[], captureId: string) => {
    const pending = captures.current.get(captureId)
    captures.current.delete(captureId)
    if (!pending) throw new Error('Logic selection was not captured. Drag the regions into Slur again.')
    const before = await pending
    if (before.error) throw before.error
    if (!before.selection) throw new Error('Logic selection is unavailable.')
    const after = readLogicSelection(await inspectLogicDropSelection())
    const matched = matchLogicDrop(before.selection, after, files.map(f => f.name))
    const projectId = await sha256(new TextEncoder().encode(before.selection.project).buffer)
    const id = crypto.randomUUID()
    return files.map((file, i) => rememberLogicEvidence(file, { captureId: id, projectId, region: matched[i]! }))
  }
}
