import { useEffect, useRef } from 'react'
import { inspectLogicDropSelection } from './dawRegionBridge'
import { readLogicSelection, matchLogicDrop, logicRegionsFromDrag, isLogicDragMeta, type LogicSelection, type LogicDragMeta, type HostTimeline } from '@orb/core/lib/logicRegionDrop.ts'
import { callJuceNative, hasJuceNativeFunction } from './juceBridge'
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
  return async (files: File[], captureId: string, metas: unknown[] = []) => {
    const pending = captures.current.get(captureId)
    captures.current.delete(captureId)
    // Newer builds: every file carries its own Logic region start from the drag payload.
    // Positions never depend on file names, so split hits from one take stay distinct.
    if (metas.length === files.length && metas.every(isLogicDragMeta)) {
      let timeline: HostTimeline | null = null
      try { if (hasJuceNativeFunction('getDawTimeline')) timeline = JSON.parse(await callJuceNative('getDawTimeline', [])) } catch { /* musical position only */ }
      const selection = pending ? (await pending).selection ?? null : null   // track names only, optional
      const regions = logicRegionsFromDrag(metas as LogicDragMeta[], timeline, selection)
      const projectId = await sha256(new TextEncoder().encode(selection?.project ?? 'logic').buffer)
      const id = crypto.randomUUID()
      return files.map((file, i) => rememberLogicEvidence(file, { captureId: id, projectId, region: regions[i]! }))
    }
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
