'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RotateCcw, Scan, Plus, Minus, Volume2, VolumeX } from 'lucide-react'
import { createChessRoom } from '../lib/chess3dRoom'
import { loadChessPieces } from '../lib/chess3dPieces'
import { useGameActive } from '../hooks/useGameSurface'
import { useChessAudio } from '../hooks/useChessAudio'
import { checkedKing, legalTargets, squareName, type BoardPosition as Pos, type ChessPosition } from '../lib/chess3d'
import '../styles/chess3d.css'

export interface Chess3DBoardProps {
  state: ChessPosition
  myColor: 'white' | 'black'
  onMove: (from: Pos, to: Pos) => void
  lastFrom: Pos | null
  lastTo: Pos | null
  isMyTurn: boolean
  playing: boolean
  canPremove?: boolean
  premove?: { from: Pos; to: Pos } | null
  onPremove?: (move: { from: Pos; to: Pos } | null) => void
  labels: { reset: string; top: string; zoomIn: string; zoomOut: string; unavailable: string; board: string; lamp: string; soundOn: string; soundOff: string }
  fallback: React.ReactNode
  opponentLabel?: string
  largeOpponentLabel?: boolean
}

interface Stage {
  sync: () => void
  active: (value: boolean) => void
  camera: (action: 'reset' | 'top' | 'in' | 'out') => void
}

const equal = (a: Pos | null | undefined, b: Pos | null | undefined) => !!a && !!b && a[0] === b[0] && a[1] === b[1]
const pieceNames: Record<string, string> = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' }

/** Seeded grain stays identical across devices and needs no external asset download. */
function woodTexture(light: boolean, seed: number) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const pixels = ctx.createImageData(512, 512)
  let random = seed
  const noise = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 4294967296 }
  const base = light ? [173, 159, 132] : [76, 57, 43]
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const warp = 7 * Math.sin(y * .009 + Math.sin(x * .012)) + 3 * Math.sin(y * .025)
    const line = Math.sin((x + warp) * .30) * .5 + Math.sin((x + warp) * .97) * .25
    const broad = Math.sin(x * .027 + .5 * Math.sin(y * .008))
    const pore = noise() > .983 ? -25 : 0
    const grain = broad * 6 + line * (light ? 7 : 9) + (noise() - .5) * 6 + pore * .65
    const i = (y * 512 + x) * 4
    for (let c = 0; c < 3; c++) pixels.data[i + c] = base[c] + grain
    pixels.data[i + 3] = 255
  }
  ctx.putImageData(pixels, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return texture
}

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
  cylinder(.325, .325, .018, .115, trim)
  cylinder(.247, .247, .018, .258, trim)
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
    const notch = mesh(new THREE.BoxGeometry(.020, .28, .38), trim, .035, 1.16)
    notch.rotation.z = -.45
    ball(.055, 1.33)
  }
  if (kind === 'N') {
    const profile = new THREE.Shape()
    profile.moveTo(-.24, .72)
    profile.bezierCurveTo(-.32, .98, -.25, 1.25, -.10, 1.32)
    profile.lineTo(-.12, 1.49); profile.lineTo(-.01, 1.40); profile.lineTo(.07, 1.47)
    profile.quadraticCurveTo(.12, 1.39, .10, 1.31)
    profile.bezierCurveTo(.19, 1.25, .21, 1.17, .35, 1.08)
    profile.quadraticCurveTo(.42, 1.01, .32, .96)
    profile.lineTo(.23, .97); profile.quadraticCurveTo(.14, 1.07, .06, 1.06)
    profile.bezierCurveTo(.01, .94, .05, .80, .23, .72)
    profile.closePath()
    const neck = mesh(new THREE.ExtrudeGeometry(profile, { depth: .20, bevelEnabled: true, bevelSize: .055, bevelThickness: .055, bevelSegments: 5, curveSegments: 20, steps: 1 }), material, 0, 0, -.10)
    neck.rotation.y = piece[0] === 'w' ? Math.PI / 6 : Math.PI * 7 / 6
    for (const side of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(.024, 12, 8), trim, .095, 1.25, side * .16)
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
  group.scale.y = 1.10
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
  const audio = useChessAudio()
  const playSound = useRef(audio.play)
  playSound.current = audio.play
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
  useEffect(() => { stage.current?.sync() }, [props.lastFrom, props.lastTo, props.premove, props.opponentLabel, props.playing])
  useEffect(() => { stage.current?.active(active) }, [active])
  useEffect(() => { if (!active) audio.stop() }, [active, audio.stop])

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
    renderer.shadowMap.autoUpdate = false
    renderer.shadowMap.needsUpdate = true
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = .93
    renderer.domElement.setAttribute('aria-hidden', 'true')
    renderer.domElement.dataset.chess3d = 'true'
    el.prepend(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#211d19')
    const environment = new RoomEnvironment()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const env = pmrem.fromScene(environment, .04)
    scene.environment = env.texture
    scene.environmentIntensity = .25
    environment.dispose(); pmrem.dispose()
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 120)
    const target = new THREE.Vector3(0, .0625, 0)
    const defaultOffset = (playing: boolean) => playing ? new THREE.Vector3(0, 17, 15).normalize().multiplyScalar(23.5) : new THREE.Vector3(3, 16, 30).normalize().multiplyScalar(34)
    let playing = latest.current.playing
    camera.position.copy(target).add(defaultOffset(playing))
    camera.lookAt(target)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(target)
    controls.enablePan = false
    controls.minDistance = 17
    controls.maxDistance = 37
    controls.minPolarAngle = .15
    controls.maxPolarAngle = 1.08 * 1.2
    controls.minAzimuthAngle = -.75
    controls.maxAzimuthAngle = .75
    controls.rotateSpeed = .45
    controls.zoomSpeed = .65
    controls.enabled = activeRef.current
    controls.update()
    const hemi = new THREE.HemisphereLight('#ffead1', '#30241e', .28)
    scene.add(hemi)
    const sun = new THREE.SpotLight('#fff0d3', 748, 70, .55, .70, 2)
    sun.position.set(-3, 18, 5)
    sun.target.position.copy(target)
    scene.add(sun.target)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = .5
    sun.shadow.camera.far = 70
    sun.shadow.normalBias = .035
    sun.shadow.bias = -.0001
    sun.shadow.radius = 3
    scene.add(sun)
    const fill = new THREE.DirectionalLight('#ffdfb2', .20)
    fill.position.set(6, 5, -5); scene.add(fill)
    const maple = woodTexture(true, 173)
    const walnut = woodTexture(false, 347)
    const textures = [maple, walnut]
    for (const texture of textures) texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    const porcelain = new THREE.MeshPhysicalMaterial({ color: '#f1e8d6', map: maple, roughness: .55, clearcoat: .18, clearcoatRoughness: .4 })
    const graphite = new THREE.MeshPhysicalMaterial({ color: '#28211c', roughness: .43, clearcoat: .24, clearcoatRoughness: .35 })
    const lightTrim = new THREE.MeshStandardMaterial({ color: '#8f795a', roughness: .55 })
    const darkTrim = new THREE.MeshStandardMaterial({ color: '#514634', roughness: .38, metalness: .15 })
    const materials: THREE.Material[] = [porcelain, graphite, lightTrim, darkTrim]
    const box = (w: number, h: number, d: number, material: THREE.Material, y: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
      mesh.position.y = y; mesh.receiveShadow = mesh.castShadow = true; scene.add(mesh); return mesh
    }
    const frameMaterial = new THREE.MeshPhysicalMaterial({ map: walnut, color: '#b9ac98', roughness: .58, clearcoat: .18 })
    materials.push(frameMaterial)
    box(8.8, .27, 8.8, frameMaterial, -.19)
    box(8.72, .025, 8.72, lightTrim, -.045)
    box(8.64, .055, 8.64, frameMaterial, -.012)
    // Thin inlaid rails give the wooden frame a finished edge without metallic ornament.
    for (const sign of [-1, 1]) {
      const horizontal = box(8.48, .012, .025, darkTrim, .022)
      horizontal.position.z = sign * 4.20
      const vertical = box(.025, .012, 8.48, darkTrim, .022)
      vertical.position.x = sign * 4.20
    }
    const tiles: THREE.Mesh[] = []
    const tileMaterials = [maple, walnut].map(map => {
      const material = new THREE.MeshPhysicalMaterial({ map, roughness: .58, clearcoat: .16, clearcoatRoughness: .45 })
      materials.push(material); return material
    })
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const geometry = new THREE.BoxGeometry(1, .055, 1)
      const uv = geometry.getAttribute('uv')
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + col * .137 + row * .061, uv.getY(i) + row * .173)
      const tile = new THREE.Mesh(geometry, tileMaterials[(row + col) % 2])
      tile.position.set(col - 3.5, .035, row - 3.5)
      tile.userData.pos = [row, col]; tile.receiveShadow = true
      tiles.push(tile); scene.add(tile)
    }
    const labelCanvas = document.createElement('canvas')
    labelCanvas.width = labelCanvas.height = 1024
    const ctx = labelCanvas.getContext('2d')!
    ctx.font = '500 18px sans-serif'; ctx.fillStyle = '#e4cfa5'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (let i = 0; i < 8; i++) {
      const xy = ((i - 3.5) / 8.64 + .5) * 1024
      ctx.fillText('abcdefgh'[i], xy, 992)
      ctx.fillText(String(8 - i), 32, xy)
      ctx.save(); ctx.translate(xy, 32); ctx.rotate(Math.PI); ctx.fillText('abcdefgh'[i], 0, 0); ctx.restore()
      ctx.save(); ctx.translate(992, xy); ctx.rotate(Math.PI); ctx.fillText(String(8 - i), 0, 0); ctx.restore()
    }
    const labelsTexture = new THREE.CanvasTexture(labelCanvas)
    const labelMaterial = new THREE.MeshBasicMaterial({ map: labelsTexture, transparent: true, depthWrite: false })
    materials.push(labelMaterial)
    const labelPlane = new THREE.Mesh(new THREE.PlaneGeometry(8.64, 8.64), labelMaterial)
    labelPlane.rotation.x = -Math.PI / 2; labelPlane.position.y = .023; scene.add(labelPlane)
    let prototypes = new Map<string, THREE.Group>()
    const modelsReady = loadChessPieces(porcelain, graphite).then(models => {
      prototypes = models
      if (disposed) for (const model of models.values()) model.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose() })
    }).catch(() => {
      if (disposed) return
      // Keep a playable local set if a host rejects the binary asset.
      for (const color of ['w', 'b']) for (const kind of ['P', 'R', 'N', 'B', 'Q', 'K']) {
        prototypes.set(color + kind, pieceModel(color + kind, color === 'w' ? porcelain : graphite, color === 'w' ? lightTrim : darkTrim))
      }
    })
    const pieces = new Map<string, THREE.Group>()
    const markers = new THREE.Group(); scene.add(markers)
    const selectedMat = new THREE.MeshBasicMaterial({ color: '#d0b478', transparent: true, opacity: .62, depthWrite: false })
    const lastMat = new THREE.MeshBasicMaterial({ color: '#d0b478', transparent: true, opacity: .40, depthWrite: false })
    const checkMat = new THREE.MeshBasicMaterial({ color: '#ff8179', transparent: true, opacity: .70, depthWrite: false })
    const moveMat = new THREE.MeshBasicMaterial({ color: '#bdc6a4', depthWrite: false })
    const preMat = new THREE.MeshBasicMaterial({ color: '#8cb5ee', transparent: true, opacity: .50, depthWrite: false })
    materials.push(selectedMat, lastMat, checkMat, moveMat, preMat)
    const squareGeo = new THREE.PlaneGeometry(.98, .98)
    const dotGeo = new THREE.CircleGeometry(.105, 28)
    const ringGeo = new THREE.RingGeometry(.39, .445, 40)
    let frame = 0, disposed = false, roomReady = false, visible = activeRef.current, movingUntil = 0, needsPaint = false
    let pulseTimer = 0, soundTimer = 0
    let boardKey = ''
    const destinations = new Map<THREE.Group, { from: THREE.Vector3; to: THREE.Vector3; start: number }>()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const paint = () => {
      frame = 0
      if (disposed || !visible || !roomReady) return
      const now = performance.now()
      if (destinations.size) renderer.shadowMap.needsUpdate = true
      for (const [piece, animation] of destinations) {
        const t = Math.min(1, (now - animation.start) / 260)
        piece.position.lerpVectors(animation.from, animation.to, t * t * (3 - 2 * t))
        piece.position.y += Math.sin(t * Math.PI) * .16
        if (t === 1) destinations.delete(piece)
      }
      const pulsing = room.animateCandles(now, reducedMotion)
      renderer.render(scene, camera)
      el.dataset.cameraMode = playing ? 'playing' : 'lobby'
      el.dataset.cameraDistance = String(camera.position.distanceTo(controls.target))
      const boardCenter = target.clone().project(camera)
      el.dataset.boardCenterX = String((boardCenter.x + 1) * el.clientWidth / 2)
      el.dataset.boardCenterY = String((1 - boardCenter.y) * el.clientHeight / 2)
      const lampPoint = room.lampPoint.clone().project(camera)
      el.dataset.lampX = String((lampPoint.x + 1) * el.clientWidth / 2)
      el.dataset.lampY = String((1 - lampPoint.y) * el.clientHeight / 2)
      const tableLampPoint = room.tableLampPoint.clone().project(camera)
      el.dataset.tableLampX = String((tableLampPoint.x + 1) * el.clientWidth / 2)
      el.dataset.tableLampY = String((1 - tableLampPoint.y) * el.clientHeight / 2)
      const readerLampPoint = room.readerLampPoint.clone().project(camera)
      el.dataset.readerLampX = String((readerLampPoint.x + 1) * el.clientWidth / 2)
      el.dataset.readerLampY = String((1 - readerLampPoint.y) * el.clientHeight / 2)
      // Project accessible square targets alongside the camera, not against a fixed grid.
      const squareButtons = el.querySelectorAll<HTMLButtonElement>('[role="gridcell"]')
      squareButtons.forEach((button, index) => {
        const piece = latest.current.state.board[Math.floor(index / 8)][index % 8]
        const head = piece ? prototypes.get(piece)?.userData.aimY ?? ({ P: .76, R: .92, N: 1.2, B: 1.15, Q: 1.4, K: 1.45 }[piece[1]] ?? .76) * 1.1 : .09
        // Aim at a piece's visible head, not a tile hidden behind the nearer rank.
        const point = new THREE.Vector3(index % 8 - 3.5, head, Math.floor(index / 8) - 3.5).project(camera)
        button.dataset.screenX = String((point.x + 1) * el.clientWidth / 2)
        button.dataset.screenY = String((1 - point.y) * el.clientHeight / 2)
      })
      needsPaint = false
      if (now < movingUntil) request()
      else if (pulsing) pulseTimer = window.setTimeout(request, 80)
    }
    const request = () => { clearTimeout(pulseTimer); needsPaint = true; if (visible && !frame && !disposed) frame = requestAnimationFrame(paint) }
    controls.addEventListener('change', request)
    const room = createChessRoom(scene, renderer, materials, textures, request, () => disposed)
    Promise.all([room.ready, modelsReady]).then(() => {
      if (!disposed) { roomReady = true; el.dataset.roomReady = 'true'; el.dataset.pieceSource = prototypes.get('wP')?.userData.aimY ? 'poly-haven' : 'fallback'; sync(); request() }
    }).catch(() => { if (!disposed) setFailed(true) })
    let lastWidth = 0, lastHeight = 0
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      if (w !== lastWidth || h !== lastHeight) {
        lastWidth = w; lastHeight = h
        renderer.setSize(w, h, false)
        const labelScale = w <= 600 ? 1.6 : latest.current.largeOpponentLabel ? 1.5 : 1
        room.setOpponentLabelScale(labelScale)
        el.dataset.opponentLabelScale = String(labelScale)
        camera.aspect = w / h
        camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(19)) * Math.max(1, .75 / camera.aspect)))
        camera.updateProjectionMatrix()
        request()
      } else request()
    }
    const marker = (pos: Pos | null | undefined, material: THREE.Material, shape: THREE.BufferGeometry = squareGeo) => {
      if (!pos) return
      const mesh = new THREE.Mesh(shape, material)
      mesh.position.set(pos[1] - 3.5, .069, pos[0] - 3.5); mesh.rotation.x = -Math.PI / 2
      markers.add(mesh)
    }
    const sync = () => {
      room.setOpponentLabel(latest.current.opponentLabel ?? '')
      el.dataset.opponentLabel = latest.current.opponentLabel ?? ''
      if (!roomReady) return
      const p = latest.current
      if (playing !== p.playing) {
        playing = p.playing
        camera.position.copy(controls.target).add(defaultOffset(playing))
        controls.update()
      }
      const turn = playing ? p.state.turn === p.myColor ? 'near' : 'far' : null
      room.setTurn(turn)
      el.dataset.candleTurn = turn ?? ''
      const nextKey = JSON.stringify(p.state.board)
      if (nextKey !== boardKey) {
        if (boardKey && visible && p.lastFrom && p.lastTo) {
          clearTimeout(soundTimer)
          soundTimer = window.setTimeout(() => { if (!disposed && visible) playSound.current() }, reducedMotion ? 0 : 260)
        }
        renderer.shadowMap.needsUpdate = true
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
      const hit = raycaster.intersectObjects([...tiles, ...pieces.values(), ...room.lampTargets, ...room.tableLampTargets, ...room.readerLampTargets], true)[0]
      if (hit && room.lampTargets.some(node => node === hit.object)) { toggleLamp('wall'); return }
      if (hit && room.tableLampTargets.some(node => node === hit.object)) { toggleLamp('table'); return }
      if (hit && room.readerLampTargets.some(node => node === hit.object)) { toggleLamp('reader'); return }
      const pos = hit?.object.userData.pos as Pos | undefined
      if (pos) select.current(pos)
    }
    const pointerCancel = (e: PointerEvent) => { down.delete(e.pointerId); if (!down.size) multiTouch = false }
    const contextLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(frame); frame = 0; setFailed(true) }
    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointerup', pointerUp)
    renderer.domElement.addEventListener('pointercancel', pointerCancel)
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    const observer = new ResizeObserver(resize); observer.observe(el)
    const toggleLamp = (id: 'wall' | 'table' | 'reader') => {
      if (!visible || !roomReady) return
      const enabled = room.toggleLamp(id)
      el.dataset[id === 'wall' ? 'lampOn' : id === 'table' ? 'tableLampOn' : 'readerLampOn'] = String(enabled)
      request()
    }
    el.dataset.lampOn = 'true'
    el.dataset.readerLampOn = 'true'
    el.dataset.tableLampOn = 'true'
    stage.current = {
      sync,
      camera(action) {
        if (!visible) return
        const offset = camera.position.clone().sub(controls.target)
        if (action === 'reset') offset.copy(defaultOffset(playing))
        else if (action === 'top') offset.set(0, 26, 4)
        else offset.setLength(THREE.MathUtils.clamp(offset.length() * (action === 'in' ? .85 : 1 / .85), controls.minDistance, controls.maxDistance))
        camera.position.copy(controls.target).add(offset)
        controls.update(); request()
      },
      active(value) {
        visible = value
        controls.enabled = value
        if (!value) { clearTimeout(pulseTimer); clearTimeout(soundTimer); cancelAnimationFrame(frame); frame = 0; down.clear(); multiTouch = false }
        else { if (needsPaint || destinations.size) request(); resize() }
      },
    }
    resize(); sync()
    return () => {
      disposed = true; clearTimeout(pulseTimer); clearTimeout(soundTimer); cancelAnimationFrame(frame); observer.disconnect(); controls.dispose()
      delete el.dataset.roomReady
      stage.current = null
      const geometries = new Set<THREE.BufferGeometry>()
      scene.traverse(node => { if (node instanceof THREE.Mesh) geometries.add(node.geometry) })
      for (const model of prototypes.values()) model.traverse(node => { if (node instanceof THREE.Mesh) geometries.add(node.geometry) })
      geometries.add(squareGeo); geometries.add(dotGeo); geometries.add(ringGeo)
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose())
      labelsTexture.dispose(); textures.forEach(texture => texture.dispose()); room.dispose(); env.dispose(); sun.shadow.dispose(); renderer.dispose()
      renderer.domElement.remove()
    }
  }, [failed])

  if (failed) return <div className="chess3d-fallback"><span role="status">{props.labels.unavailable}</span>{props.fallback}</div>
  return (
    <div className="chess3d-stage" ref={host} data-selected={selected ? squareName(selected) : ''}>
      <div className="chess3d-camera">
        {([{ action: 'reset', label: props.labels.reset, Icon: RotateCcw }, { action: 'top', label: props.labels.top, Icon: Scan }, { action: 'in', label: props.labels.zoomIn, Icon: Plus }, { action: 'out', label: props.labels.zoomOut, Icon: Minus }] as const).map(({ action, label, Icon }) => (
          <button type="button" key={action} aria-label={label} title={label} onClick={() => stage.current?.camera(action)}><Icon size={16} /></button>
        ))}
        <button type="button" aria-label={audio.enabled ? props.labels.soundOff : props.labels.soundOn} title={audio.enabled ? props.labels.soundOff : props.labels.soundOn} aria-pressed={audio.enabled} onClick={audio.toggle}>{audio.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
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
