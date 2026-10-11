import { finishSnapshot, joinPath, dirName, baseName, type ProjectRegion, type ProjectSnapshot, type ProjectTrack, type RegionNote } from './projectRegions.ts'

/**
 * REAPER project (`.rpp`, plain text). Item POSITION/LENGTH and take SOFFS are
 * seconds, independent of tempo. Only the active take of a WAVE source is
 * shared; rate changes, section/reverse sources and MIDI are rejected.
 */
interface Block { name: string; params: string[]; lines: string[][]; blocks: Block[]; entries: (string[] | Block)[] }

export function tokenizeRppLine(line: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < line.length) {
    while (i < line.length && /\s/.test(line[i])) i++
    if (i >= line.length) break
    const q = line[i]
    if (q === '"' || q === "'" || q === '`') {
      const end = line.indexOf(q, i + 1)
      if (end < 0) { out.push(line.slice(i + 1)); break }
      out.push(line.slice(i + 1, end)); i = end + 1
    } else {
      let end = i
      while (end < line.length && !/\s/.test(line[end])) end++
      out.push(line.slice(i, end)); i = end
    }
  }
  return out
}

export function parseRppBlocks(text: string): Block {
  const lines = text.split(/\r?\n/)
  const root: Block = { name: '#root', params: [], lines: [], blocks: [], entries: [] }
  const stack = [root]
  if (lines.length > 20_000_000) throw new Error('Project file is too large.')
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('<')) {
      const [name, ...params] = tokenizeRppLine(line.slice(1))
      const block: Block = { name: name ?? '', params, lines: [], blocks: [], entries: [] }
      stack[stack.length - 1].blocks.push(block)
      stack[stack.length - 1].entries.push(block)
      stack.push(block)
      if (stack.length > 64) throw new Error('Project nesting is too deep.')
    } else if (line === '>') {
      if (stack.length === 1) throw new Error('Invalid REAPER project structure.')
      stack.pop()
    } else {
      const tokens = tokenizeRppLine(line), top = stack[stack.length - 1]
      top.lines.push(tokens); top.entries.push(tokens)
    }
  }
  if (stack.length !== 1) throw new Error('Unterminated REAPER project block.')
  return root
}

const line = (b: Block, key: string) => b.lines.find(l => l[0] === key)
const n = (v: string | undefined, fallback: number) => {
  if (v === undefined) return fallback
  const x = Number(v)
  if (!Number.isFinite(x)) throw new Error('Invalid REAPER number.')
  return x
}

/** Split an ITEM into takes in file order: a TAKE line starts the next take. */
function takes(item: Block) {
  const all: { selected: boolean; lines: string[][]; blocks: Block[] }[] = [{ selected: false, lines: [], blocks: [] }]
  for (const entry of item.entries) {
    if (Array.isArray(entry)) {
      if (entry[0] === 'TAKE') { all.push({ selected: entry.includes('SEL'), lines: [], blocks: [] }); continue }
      all[all.length - 1].lines.push(entry)
    } else all[all.length - 1].blocks.push(entry)
  }
  return all
}

export function parseReaperProject(input: { text: string; projectPath: string }): ProjectSnapshot {
  const root = parseRppBlocks(input.text)
  const project = root.blocks[0]
  if (!project || project.name !== 'REAPER_PROJECT') throw new Error('Not a REAPER project.')
  const rateLine = line(project, 'SAMPLERATE')
  const rate = rateLine ? n(rateLine[1], 0) : 0
  const projectDir = dirName(input.projectPath)
  // RECORD_PATH may hold media under a subfolder; relative FILE paths are project-relative.
  const tracks: ProjectTrack[] = [], regions: ProjectRegion[] = []
  for (const track of project.blocks.filter(b => b.name === 'TRACK')) {
    const id = line(track, 'TRACKID')?.[1] ?? track.params[0] ?? String(tracks.length)
    const name = line(track, 'NAME')?.[1] || `Track ${tracks.length + 1}`
    tracks.push({ id, name, order: tracks.length, channels: null })
    track.blocks.filter(b => b.name === 'ITEM').forEach((item, index) => {
      const region: ProjectRegion = { id: `${id}#${line(item, 'IGUID')?.[1] ?? index}`, trackId: id,
        name: line(item, 'NAME')?.[1] || name, source: null, startSeconds: 0, offsetSeconds: 0, lengthSeconds: 0,
        notes: [], disabledReason: null }
      regions.push(region)
      try {
        region.startSeconds = n(line(item, 'POSITION')?.[1], NaN)
        region.lengthSeconds = n(line(item, 'LENGTH')?.[1], NaN)
        const all = takes(item)
        const take = all.find(t => t.selected) ?? all[0]
        const get = (key: string) => take.lines.find(l => l[0] === key)
        region.name = get('NAME')?.[1] || region.name
        if (n(line(item, 'MUTE')?.[1], 0) !== 0) throw new Error('Muted item.')
        region.offsetSeconds = n(get('SOFFS')?.[1], 0)
        const rateParams = get('PLAYRATE')
        if (rateParams && n(rateParams[1], 1) !== 1) throw new Error('Rate-changed items need rendering before sharing.')
        if (rateParams && n(rateParams[3], 0) !== 0) throw new Error('Pitch-shifted items need rendering before sharing.')
        const source = take.blocks.find(b => b.name === 'SOURCE')
        if (!source) throw new Error('Empty item.')
        if (source.params[0] === 'SECTION') throw new Error('Reversed or section sources need rendering before sharing.')
        if (source.params[0] !== 'WAVE') throw new Error(`${source.params[0] ?? 'Unknown'} sources are not supported yet.`)
        const file = line(source, 'FILE')?.[1]
        if (!file) throw new Error('The item has no source file.')
        region.source = { candidates: [...new Set([joinPath(projectDir, file), joinPath(projectDir, 'Audio/' + baseName(file)), joinPath(projectDir, 'Media/' + baseName(file))])] }
        const notes = new Set<RegionNote>()
        const itemVol = n(line(item, 'VOLPAN')?.[1], 1), takeVol = n(get('VOLPAN')?.[1], 1)
        if (Math.abs(itemVol - 1) > 1e-6 || Math.abs(takeVol - 1) > 1e-6) notes.add('gain')
        // REAPER's default 10 ms item fades are not reported.
        if (n(line(item, 'FADEIN')?.[2], 0) > 0.0105 || n(line(item, 'FADEOUT')?.[2], 0) > 0.0105) notes.add('fade')
        if (take.blocks.some(b => /ENV$/.test(b.name))) notes.add('envelope')
        region.notes = [...notes]
      } catch (e) { region.disabledReason = e instanceof Error ? e.message : String(e) }
    })
  }
  return finishSnapshot({ daw: 'REAPER', kind: 'reaper', name: baseName(input.projectPath).replace(/\.rpp$/i, ''),
    sampleRate: rate > 0 ? rate : null, tracks, regions })
}
