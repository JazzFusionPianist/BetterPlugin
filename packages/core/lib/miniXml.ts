/**
 * Minimal, non-validating XML reader for DAW project files.
 * Elements and attributes only: text is ignored, no DTD or external entity is
 * ever resolved, and node/depth limits bound hostile or corrupted input.
 */
export interface XmlNode { name: string; attrs: Record<string, string>; children: XmlNode[] }
export interface XmlLimits {
  maxNodes?: number
  maxDepth?: number
  /** Return true to parse but not retain a subtree (large device/plugin state). */
  skip?: (name: string, depth: number) => boolean
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
function decode(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isSafeInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
    }
    return ENTITIES[body] ?? whole
  })
}

export function parseXml(source: string, limits: XmlLimits = {}): XmlNode {
  const maxNodes = limits.maxNodes ?? 3_000_000, maxDepth = limits.maxDepth ?? 256
  const root: XmlNode = { name: '#document', attrs: {}, children: [] }
  const stack: XmlNode[] = [root]
  let skipping = 0, nodes = 0, i = source.charCodeAt(0) === 0xfeff ? 1 : 0
  const fail = (message: string): never => { throw new Error(`Invalid project XML: ${message}.`) }
  while (i < source.length) {
    const open = source.indexOf('<', i)
    if (open < 0) break
    if (source.startsWith('<!--', open)) { const end = source.indexOf('-->', open + 4); if (end < 0) fail('comment'); i = end + 3; continue }
    if (source.startsWith('<![CDATA[', open)) { const end = source.indexOf(']]>', open + 9); if (end < 0) fail('CDATA'); i = end + 3; continue }
    if (source.startsWith('<?', open)) { const end = source.indexOf('?>', open + 2); if (end < 0) fail('declaration'); i = end + 2; continue }
    if (source.startsWith('<!', open)) {
      // DOCTYPE is skipped without expanding anything; internal subsets are rejected.
      const end = source.indexOf('>', open + 2)
      if (end < 0 || source.slice(open, end).includes('[')) fail('DOCTYPE')
      i = end + 1; continue
    }
    // Find the tag end outside quoted attribute values.
    let end = open + 1, quote = 0
    for (; end < source.length; end++) {
      const c = source.charCodeAt(end)
      if (quote) { if (c === quote) quote = 0 } else if (c === 34 || c === 39) quote = c
      else if (c === 62) break
    }
    if (end >= source.length) fail('unterminated tag')
    const body = source.slice(open + 1, end)
    i = end + 1
    if (body[0] === '/') {
      const name = body.slice(1).trim()
      if (skipping) { skipping--; if (skipping) continue; else { stack.pop(); continue } }
      const top = stack.pop()
      if (!top || top.name !== name || !stack.length) fail(`mismatched </${name}>`)
      continue
    }
    const selfClosing = body.endsWith('/')
    const inner = selfClosing ? body.slice(0, -1) : body
    const nameMatch = /^[^\s/>]+/.exec(inner)
    if (!nameMatch) fail('element name')
    const name = nameMatch![0]
    if (skipping) { if (!selfClosing) skipping++; continue }
    if (++nodes > maxNodes) fail('too many elements')
    const depth = stack.length
    if (depth > maxDepth) fail('nesting too deep')
    if (limits.skip?.(name, depth)) {
      if (!selfClosing) { skipping = 1; stack.push({ name, attrs: {}, children: [] }) }
      continue
    }
    const attrs: Record<string, string> = Object.create(null)
    const re = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, rest = inner.slice(name.length)
    for (let m = re.exec(rest); m; m = re.exec(rest)) attrs[m[1]] = decode(m[2] ?? m[3] ?? '')
    const node: XmlNode = { name, attrs, children: [] }
    stack[stack.length - 1].children.push(node)
    if (!selfClosing) stack.push(node)
  }
  if (stack.length !== 1 || skipping) fail('unclosed element')
  if (root.children.length !== 1) fail('expected one root element')
  return root.children[0]
}

export const child = (node: XmlNode | undefined, name: string) => node?.children.find(c => c.name === name)
export const children = (node: XmlNode | undefined, name: string) => node?.children.filter(c => c.name === name) ?? []
/** Follow a child path, e.g. path(set, 'LiveSet', 'Tracks'). */
export function path(node: XmlNode | undefined, ...names: string[]): XmlNode | undefined {
  let current = node
  for (const name of names) current = child(current, name)
  return current
}
/** Ableton-style <Name Value="…"/> leaf. */
export const valueOf = (node: XmlNode | undefined, name: string) => child(node, name)?.attrs.Value
export function* descendants(node: XmlNode, name: string): Generator<XmlNode> {
  for (const c of node.children) { if (c.name === name) yield c; yield* descendants(c, name) }
}
/** Strict finite number; DAW files must not silently coerce garbage to zero. */
export function num(value: string | undefined, fallback?: number): number {
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback
    throw new Error('Missing numeric project value.')
  }
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error('Invalid numeric project value.')
  return n
}
