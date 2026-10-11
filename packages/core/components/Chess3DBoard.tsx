'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RotateCcw, Scan, Plus, Minus } from 'lucide-react'
import { useGameActive } from '../hooks/useGameSurface'
import { checkedKing, legalTargets, squareName, type BoardPosition as Pos, type ChessPosition } from '../lib/chess3d'
import '../styles/chess3d.css'

export interface Chess3DBoardProps {
  state: ChessPosition
  myColor: 'white' | 'black'
  onMove: (from: Pos, to: Pos) => void
  lastFrom: Pos | null
  lastTo: Pos | null
  isMyTurn: boolean
  canPremove?: boolean
  premove?: { from: Pos; to: Pos } | null
  onPremove?: (move: { from: Pos; to: Pos } | null) => void
  labels: { reset: string; top: string; zoomIn: string; zoomOut: string; unavailable: string; board: string }
  fallback: React.ReactNode
}

interface Stage {
  sync: () => void
  active: (value: boolean) => void
  camera: (action: 'reset' | 'top' | 'in' | 'out') => void
}

const equal = (a: Pos | null | undefined, b: Pos | null | undefined) => !!a && !!b && a[0] === b[0] && a[1] === b[1]
const pieceNames: Record<string, string> = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' }

/** Procedural Staunton pieces share geometry, with a sculpted knight profile. */
function pieceModel(piece: string, material: THREE.Material, trim: THREE.Material) {
  const group = new THREE.Group()
  const mesh = (geometry: THREE.BufferGeometry, mat = material, x = 0, y = 0, z = 0) => {
    const node = new THREE.Mesh(geometry, mat)
    node.position.set(x, y, z)
    node.castShadow = true
    node.receiveShadow = true
    group.add(node)
    return node
  }
  const cylinder = (top: number, bottom: number, height: number, y: number, mat = material) =>
    mesh(new THREE.CylinderGeometry(top, bottom, height, 32), mat, 0, y)
  const ball = (radius: number, y: number) => mesh(new THREE.SphereGeometry(radius, 24, 16), material, 0, y)
  const kind = piece[1]
  const height = { P: .85, R: 1.06, N: 1.17, B: 1.29, Q: 1.48, K: 1.59 }[kind] ?? 1
  mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, .025), new THREE.Vector2(.29, .025), new THREE.Vector2(.33, .06),
    new THREE.Vector2(.34, .12), new THREE.Vector2(.31, .18), new THREE.Vector2(.25, .22),
    new THREE.Vector2(.24, .27), new THREE.Vector2(.19, .30), new THREE.Vector2(.15, .42),
    new THREE.Vector2(.12, height * .64), new THREE.Vector2(.19, height * .70),
    new THREE.Vector2(.20, height * .73), new THREE.Vector2(0, height * .73),
  ], 40))
  cylinder(.32, .32, .025, .125, trim)
  if (kind === 'P') ball(.205, .68)
  if (kind === 'R') {
    cylinder(.265, .23, .24, .83)
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3
      const node = mesh(new THREE.BoxGeometry(.13, .16, .13), material, Math.cos(angle) * .20, 1.01, Math.sin(angle) * .20)
      node.rotation.y = -angle
    }
  }
  if (kind === 'B') {
    const head = ball(.215, 1.04)
    head.scale.y = 1.32
    const notch = mesh(new THREE.BoxGeometry(.035, .30, .40), trim, .035, 1.16)
    notch.rotation.z = -.45
    ball(.055, 1.33)
  }
  if (kind === 'N') {
    const profile = new THREE.Shape()
    profile.moveTo(-.24, .72)
    profile.bezierCurveTo(-.28, 1.02, -.21, 1.18, -.10, 1.22)
    profile.lineTo(-.11, 1.43); profile.lineTo(.01, 1.35); profile.lineTo(.08, 1.42)
    profile.lineTo(.14, 1.25); profile.lineTo(.31, 1.09); profile.lineTo(.32, .97)
    profile.lineTo(.21, .94); profile.lineTo(.09, 1.01)
    profile.bezierCurveTo(.02, .93, .02, .81, .20, .72)
    profile.closePath()
    const neck = mesh(new THREE.ExtrudeGeometry(profile, { depth: .23, bevelEnabled: true, bevelSize: .035, bevelThickness: .04, bevelSegments: 3, steps: 1 }), material, 0, 0, -.115)
    neck.rotation.y = piece[0] === 'w' ? -Math.PI / 2 : Math.PI / 2
    for (const side of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(.027, 12, 8), trim, .075, 1.21, side * .16)
      eye.rotation.y = neck.rotation.y
      eye.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), neck.rotation.y)
    }
  }
  if (kind === 'Q') {
    cylinder(.26, .19, .18, 1.19)
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7
      const peak = mesh(new THREE.SphereGeometry(.063, 16, 12), material, Math.cos(a) * .21, 1.32, Math.sin(a) * .21)
      peak.scale.y = 1.5
    }
    ball(.082, 1.47)
  }
  if (kind === 'K') {
    cylinder(.20, .17, .13, 1.23)
    ball(.13, 1.32)
    mesh(new THREE.BoxGeometry(.09, .31, .09), material, 0, 1.56)
    mesh(new THREE.BoxGeometry(.28, .085, .09), material, 0, 1.58)
  }
  return group
}

export default function Chess3DBoard(props: Chess3DBoardProps) {
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  latest.current = props
  const stage = useRef<Stage | null>(null)
  const selection = useRef<Pos | null>(null)
  const [selected, setSelected] = useState<Pos | null>(null)
  const [failed, setFailed] = useState(false)
  const active = useGameActive()
  const activeRef = useRef(active)
  activeRef.current = active

  const select = useRef<(pos: Pos) => void>(() => {})
  select.current = (pos: Pos) => {
    const p = latest.current
    if (!activeRef.current || (!p.isMyTurn && !p.canPremove)) return
    const from = selection.current
    if (from && legalTargets(p.state, from, p.myColor).some(to => equal(to, pos))) {
      if (p.isMyTurn) p.onMove(from, pos)
      else p.onPremove?.({ from, to: pos })
      selection.current = null
    } else {
      const piece = p.state.board[pos[0]][pos[1]]
      selection.current = piece?.[0] === (p.myColor === 'white' ? 'w' : 'b') && !equal(from, pos) ? pos : null
      if (!selection.current) p.onPremove?.(null)
    }
    setSelected(selection.current)
    stage.current?.sync()
  }

  useEffect(() => {
    selection.current = null
    setSelected(null)
    stage.current?.sync()
  }, [props.state.board, props.state.turn, props.myColor])
  useEffect(() => { stage.current?.sync() }, [props.lastFrom, props.lastTo, props.premove])
  useEffect(() => { stage.current?.active(active) }, [active])

  useEffect(() => {
    const el = host.current
    if (!el || failed) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    } catch { setFailed(true); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = .95
    renderer.domElement.setAttribute('aria-hidden', 'true')
    renderer.domElement.dataset.chess3d = 'true'
    el.prepend(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#101a18')
    const environment = new RoomEnvironment()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const env = pmrem.fromScene(environment, .04)
    scene.environment = env.texture
    scene.environmentIntensity = .65
    environment.dispose(); pmrem.dispose()
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 100)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, .3, 0)
    controls.enablePan = false
    controls.enableDamping = false
    controls.minPolarAngle = .08
    controls.maxPolarAngle = Math.PI * .44
    controls.rotateSpeed = .65
    controls.zoomSpeed = .65
    const hemi = new THREE.HemisphereLight('#edf8ff', '#647868', .8)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight('#fff4db', 3)
    sun.position.set(-3, 9, 4)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -16; sun.shadow.camera.right = 16
    sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16
    sun.shadow.normalBias = .035
    scene.add(sun)
    const fill = new THREE.DirectionalLight('#b4efd5', .9)
    fill.position.set(6, 5, -5); scene.add(fill)
    const porcelain = new THREE.MeshStandardMaterial({ color: '#e6ded0', roughness: .3, metalness: .10 })
    const graphite = new THREE.MeshStandardMaterial({ color: '#293335', roughness: .27, metalness: .48 })
    const brass = new THREE.MeshStandardMaterial({ color: '#b7a77c', roughness: .3, metalness: .8 })
    const silver = new THREE.MeshStandardMaterial({ color: '#778b8d', roughness: .25, metalness: .85 })
    const materials: THREE.Material[] = [porcelain, graphite, brass, silver]
    const mat = (color: string, roughness = .65) => {
      const value = new THREE.MeshStandardMaterial({ color, roughness })
      materials.push(value); return value
    }
    const box = (w: number, h: number, d: number, material: THREE.Material, y: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
      mesh.position.y = y; mesh.receiveShadow = true; scene.add(mesh); return mesh
    }
    box(200, .1, 200, mat('#182521', .8), -.40).receiveShadow = false
    const shadowMaterial = new THREE.ShadowMaterial({ opacity: .28 })
    materials.push(shadowMaterial)
    const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), shadowMaterial)
    shadowFloor.rotation.x = -Math.PI / 2
    shadowFloor.position.y = -.345
    shadowFloor.receiveShadow = true
    scene.add(shadowFloor)
    box(9, .27, 9, graphite, -.19)
    box(8.92, .025, 8.92, brass, -.045)
    box(8.86, .055, 8.86, graphite, -.012)
    const tiles: THREE.Mesh[] = []
    const tileMaterials = [mat('#d4ded7', .38), mat('#49695f', .4)]
    const geometry = new THREE.BoxGeometry(.995, .055, .995)
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const tile = new THREE.Mesh(geometry, tileMaterials[(row + col) % 2])
      tile.position.set(col - 3.5, .035, row - 3.5)
      tile.userData.pos = [row, col]; tile.receiveShadow = true
      tiles.push(tile); scene.add(tile)
    }
    const labelCanvas = document.createElement('canvas')
    labelCanvas.width = labelCanvas.height = 1024
    const ctx = labelCanvas.getContext('2d')!
    ctx.font = '500 21px sans-serif'; ctx.fillStyle = '#cad5ce'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (let i = 0; i < 8; i++) {
      const xy = ((i - 3.5) / 9 + .5) * 1024
      ctx.fillText('abcdefgh'[i], xy, 984)
      ctx.fillText(String(8 - i), 37, xy)
      ctx.save(); ctx.translate(xy, 37); ctx.rotate(Math.PI); ctx.fillText('abcdefgh'[i], 0, 0); ctx.restore()
      ctx.save(); ctx.translate(984, xy); ctx.rotate(Math.PI); ctx.fillText(String(8 - i), 0, 0); ctx.restore()
    }
    const labelsTexture = new THREE.CanvasTexture(labelCanvas)
    const labelMaterial = new THREE.MeshBasicMaterial({ map: labelsTexture, transparent: true, depthWrite: false })
    materials.push(labelMaterial)
    const labelPlane = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), labelMaterial)
    labelPlane.rotation.x = -Math.PI / 2; labelPlane.position.y = .023; scene.add(labelPlane)
    const prototypes = new Map<string, THREE.Group>()
    for (const color of ['w', 'b']) for (const kind of ['P', 'R', 'N', 'B', 'Q', 'K']) {
      prototypes.set(color + kind, pieceModel(color + kind, color === 'w' ? porcelain : graphite, color === 'w' ? brass : silver))
    }
    const pieces = new Map<string, THREE.Group>()
    const markers = new THREE.Group(); scene.add(markers)
    const selectedMat = new THREE.MeshBasicMaterial({ color: '#eac877', transparent: true, opacity: .48, depthWrite: false })
    const lastMat = new THREE.MeshBasicMaterial({ color: '#f6e9a5', transparent: true, opacity: .30, depthWrite: false })
    const checkMat = new THREE.MeshBasicMaterial({ color: '#ff8179', transparent: true, opacity: .70, depthWrite: false })
    const moveMat = new THREE.MeshBasicMaterial({ color: '#32e9b0', depthWrite: false })
    const preMat = new THREE.MeshBasicMaterial({ color: '#8cb5ee', transparent: true, opacity: .50, depthWrite: false })
    materials.push(selectedMat, lastMat, checkMat, moveMat, preMat)
    const squareGeo = new THREE.PlaneGeometry(.98, .98)
    const dotGeo = new THREE.CircleGeometry(.105, 28)
    const ringGeo = new THREE.RingGeometry(.39, .445, 40)
    let frame = 0, disposed = false, visible = activeRef.current, movingUntil = 0, needsPaint = false
    let boardKey = '', viewColor = latest.current.myColor
    const destinations = new Map<THREE.Group, { from: THREE.Vector3; to: THREE.Vector3; start: number }>()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const paint = () => {
      frame = 0
      if (disposed || !visible) return
      const now = performance.now()
      for (const [piece, animation] of destinations) {
        const t = Math.min(1, (now - animation.start) / 260)
        piece.position.lerpVectors(animation.from, animation.to, t * t * (3 - 2 * t))
        piece.position.y += Math.sin(t * Math.PI) * .16
        if (t === 1) destinations.delete(piece)
      }
      renderer.render(scene, camera)
      // Project accessible square targets alongside the camera, not against a fixed grid.
      const squareButtons = el.querySelectorAll<HTMLButtonElement>('[role="gridcell"]')
      squareButtons.forEach((button, index) => {
        const point = new THREE.Vector3(index % 8 - 3.5, .09, Math.floor(index / 8) - 3.5).project(camera)
        button.dataset.screenX = String((point.x + 1) * el.clientWidth / 2)
        button.dataset.screenY = String((1 - point.y) * el.clientHeight / 2)
      })
      needsPaint = false
      if (now < movingUntil) request()
    }
    const request = () => { needsPaint = true; if (visible && !frame && !disposed) frame = requestAnimationFrame(paint) }
    const fit = (top = false) => {
      const aspect = camera.aspect
      const distance = 6.7 / Math.sin(Math.min(THREE.MathUtils.degToRad(19), Math.atan(Math.tan(THREE.MathUtils.degToRad(19)) * aspect)))
      const sign = latest.current.myColor === 'white' ? 1 : -1
      const portrait = aspect < .9
      camera.position.copy(controls.target).add(new THREE.Vector3(top || portrait ? 0 : 4 * sign, top ? 10 : portrait ? 12 : 9, top ? .01 * sign : 9 * sign).normalize().multiplyScalar(distance))
      controls.minDistance = distance * .60; controls.maxDistance = distance * 1.6
      camera.lookAt(controls.target); controls.update(); request()
    }
    let lastWidth = 0, lastHeight = 0
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      if (w !== lastWidth || h !== lastHeight) {
        lastWidth = w; lastHeight = h
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); fit()
      } else request()
    }
    const marker = (pos: Pos | null | undefined, material: THREE.Material, shape: THREE.BufferGeometry = squareGeo) => {
      if (!pos) return
      const mesh = new THREE.Mesh(shape, material)
      mesh.position.set(pos[1] - 3.5, .069, pos[0] - 3.5); mesh.rotation.x = -Math.PI / 2
      markers.add(mesh)
    }
    const sync = () => {
      const p = latest.current
      const nextKey = JSON.stringify(p.state.board)
      if (nextKey !== boardKey) {
        const previous = new Map(pieces)
        pieces.clear()
        const movedFrom = p.lastFrom?.join(','), movedTo = p.lastTo?.join(',')
        for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
          const code = p.state.board[row][col]
          if (!code) continue
          const key = `${row},${col}`
          const candidateKey = key === movedTo && movedFrom ? movedFrom : key
          let piece = previous.get(candidateKey)
          if (piece?.userData.code !== code) piece = undefined
          if (piece) previous.delete(candidateKey)
          else {
            piece = prototypes.get(code)!.clone(true)
            piece.userData.code = code
            piece.position.set(col - 3.5, .068, row - 3.5); scene.add(piece)
          }
          piece.traverse(child => { child.userData.pos = [row, col] })
          const to = new THREE.Vector3(col - 3.5, .068, row - 3.5)
          if (!piece.position.equals(to) && !reducedMotion && visible) {
            destinations.set(piece, { from: piece.position.clone(), to, start: performance.now() })
            movingUntil = performance.now() + 270
          } else piece.position.copy(to)
          pieces.set(key, piece)
        }
        for (const old of previous.values()) { destinations.delete(old); scene.remove(old) }
        boardKey = nextKey
      }
      markers.clear()
      marker(p.lastFrom, lastMat); marker(p.lastTo, lastMat)
      marker(p.premove?.from, preMat); marker(p.premove?.to, preMat)
      marker(checkedKing(p.state), checkMat)
      marker(selection.current, selectedMat)
      if (selection.current) for (const to of legalTargets(p.state, selection.current, p.myColor)) {
        marker(to, moveMat, p.state.board[to[0]][to[1]] ? ringGeo : dotGeo)
      }
      if (viewColor !== p.myColor) { viewColor = p.myColor; fit() }
      request()
    }
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2()
    const down = new Map<number, { x: number; y: number }>()
    let multiTouch = false
    const pointerDown = (e: PointerEvent) => {
      down.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (down.size > 1) multiTouch = true
    }
    const pointerUp = (e: PointerEvent) => {
      const start = down.get(e.pointerId)
      down.delete(e.pointerId)
      const gesture = multiTouch
      if (!down.size) multiTouch = false
      if (!start || gesture || e.button !== 0 || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects([...tiles, ...pieces.values()], true)[0]
      const pos = hit?.object.userData.pos as Pos | undefined
      if (pos) select.current(pos)
    }
    const pointerCancel = (e: PointerEvent) => { down.delete(e.pointerId); if (!down.size) multiTouch = false }
    const contextLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(frame); frame = 0; setFailed(true) }
    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointerup', pointerUp)
    renderer.domElement.addEventListener('pointercancel', pointerCancel)
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    controls.addEventListener('change', request)
    const observer = new ResizeObserver(resize); observer.observe(el)
    stage.current = {
      sync,
      active(value) {
        visible = value; controls.enabled = value
        if (!value) { cancelAnimationFrame(frame); frame = 0 }
        else { if (needsPaint || destinations.size) request(); resize() }
      },
      camera(action) {
        if (action === 'reset' || action === 'top') fit(action === 'top')
        else {
          const offset = camera.position.clone().sub(controls.target)
          const distance = THREE.MathUtils.clamp(offset.length() * (action === 'in' ? .85 : 1.18), controls.minDistance, controls.maxDistance)
          camera.position.copy(controls.target).add(offset.setLength(distance)); controls.update(); request()
        }
      },
    }
    resize(); sync()
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose()
      stage.current = null
      const geometries = new Set<THREE.BufferGeometry>()
      scene.traverse(node => { if (node instanceof THREE.Mesh) geometries.add(node.geometry) })
      for (const model of prototypes.values()) model.traverse(node => { if (node instanceof THREE.Mesh) geometries.add(node.geometry) })
      geometries.add(squareGeo); geometries.add(dotGeo); geometries.add(ringGeo)
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose())
      labelsTexture.dispose(); env.dispose(); sun.shadow.dispose(); renderer.dispose()
      renderer.domElement.remove()
    }
  }, [failed])

  if (failed) return <div className="chess3d-fallback"><span role="status">{props.labels.unavailable}</span>{props.fallback}</div>
  return (
    <div className="chess3d-stage" ref={host} data-selected={selected ? squareName(selected) : ''}>
      <div className="chess3d-camera" role="toolbar" aria-label={props.labels.board}>
        {([
          ['reset', RotateCcw, props.labels.reset], ['top', Scan, props.labels.top],
          ['in', Plus, props.labels.zoomIn], ['out', Minus, props.labels.zoomOut],
        ] as const).map(([action, Icon, label]) => <button key={action} type="button" title={label} aria-label={label} onClick={() => stage.current?.camera(action)}><Icon size={17} strokeWidth={1.8} /></button>)}
      </div>
      <div className="chess3d-keyboard" role="grid" aria-label={props.labels.board}>
        {props.state.board.map((row, r) => <div role="row" key={r}>{row.map((piece, c) => (
          <button role="gridcell" type="button" key={c} aria-label={`${squareName([r, c])}${piece ? ` ${piece[0] === 'w' ? 'White' : 'Black'} ${pieceNames[piece[1]]}` : ''}`} aria-selected={equal(selected, [r, c])} onClick={() => select.current([r, c])} onKeyDown={e => {
            const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[e.key]
            if (!delta) return
            e.preventDefault()
            const buttons = host.current?.querySelectorAll<HTMLButtonElement>('[role="gridcell"]')
            buttons?.[(r * 8 + c + delta + 64) % 64]?.focus()
          }}>{squareName([r, c])}</button>
        ))}</div>)}
      </div>
    </div>
  )
}
