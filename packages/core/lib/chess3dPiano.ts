import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// Yamaha's public U1 front/side dimension drawing, not an internal manufacturing CAD.
// https://www.yamaha.com/us/pianos/images/u1linenew.jpg
export const U1_DIMENSIONS = { width: 1.53, height: 1.21, depth: .62, whiteKeys: 52, blackKeys: 36 } as const

function keySurfaceTextures(textures: THREE.Texture[]) {
  const canvases = Array.from({ length: 3 }, () => {
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 512
    return canvas
  })
  let seed = 49371
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  const pixels = canvases.map(canvas => canvas.getContext('2d')!.createImageData(256, 512))
  for (let y = 0; y < 512; y++) for (let x = 0; x < 256; x++) {
    const warp = 2 * Math.sin(y * .012) + Math.sin(y * .031)
    const grain = Math.sin((x + warp) * .46) + .5 * Math.sin((x + warp) * 1.37)
    const micro = noise() - .5
    const values = [244 + grain * 2 + micro * 3, 218 + grain * 12 + micro * 16, 128 + grain * 10 + micro * 18]
    for (let layer = 0; layer < 3; layer++) {
      const i = (y * 256 + x) * 4, value = Math.round(values[layer])
      pixels[layer].data[i] = pixels[layer].data[i + 1] = pixels[layer].data[i + 2] = value
      pixels[layer].data[i + 3] = 255
    }
  }
  const maps = canvases.map((canvas, index) => {
    canvas.getContext('2d')!.putImageData(pixels[index], 0, 0)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = index === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace
    textures.push(texture)
    return texture
  })
  const sideCanvas = document.createElement('canvas')
  sideCanvas.width = 256; sideCanvas.height = 128
  const ctx = sideCanvas.getContext('2d')!, side = ctx.createImageData(256, 128)
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
    const edge = y >= 114, grain = Math.sin(y * 2.1 + Math.sin(x * .022)) * 4 + (noise() - .5) * 3
    const base = edge ? [151, 143, 126] : [242, 241, 235], i = (y * 256 + x) * 4
    for (let c = 0; c < 3; c++) side.data[i + c] = base[c] + (edge ? grain : grain * .25)
    side.data[i + 3] = 255
  }
  ctx.putImageData(side, 0, 0)
  const edge = new THREE.CanvasTexture(sideCanvas)
  edge.colorSpace = THREE.SRGBColorSpace
  textures.push(edge)
  return { color: maps[0], roughness: maps[1], bump: maps[2], edge }
}

export function createU1Piano(materials: THREE.Material[], textures: THREE.Texture[]) {
  const piano = new THREE.Group()
  piano.name = 'upright-u1'
  const lacquer = new THREE.MeshPhysicalMaterial({ color: '#171715', roughness: .22, metalness: .04, clearcoat: .9, clearcoatRoughness: .12, envMapIntensity: .8 })
  const satin = new THREE.MeshStandardMaterial({ color: '#121311', roughness: .45 })
  const keyMaps = keySurfaceTextures(textures)
  const ivory = new THREE.MeshPhysicalMaterial({ color: '#c7c5be', map: keyMaps.color, roughnessMap: keyMaps.roughness, bumpMap: keyMaps.bump, bumpScale: .000055, roughness: .58, clearcoat: .08, clearcoatRoughness: .45, envMapIntensity: .18 })
  const keySide = ivory.clone()
  keySide.map = keyMaps.edge; keySide.bumpMap = null; keySide.roughnessMap = null
  const keyTones = ['#c7c5be', '#c4c2ba', '#cbc9c2', '#c6c4bd'].map(color => {
    const material = ivory.clone()
    material.color.set(color)
    return material
  })
  const ebony = new THREE.MeshPhysicalMaterial({ color: '#111211', roughness: .28, clearcoat: .5, clearcoatRoughness: .24 })
  const brass = new THREE.MeshStandardMaterial({ color: '#bd9755', metalness: .84, roughness: .25 })
  const pedalMetal = new THREE.MeshStandardMaterial({ color: '#806440', metalness: .72, roughness: .48, envMapIntensity: .12 })
  const felt = new THREE.MeshStandardMaterial({ color: '#7c2425', roughness: 1 })
  const spruce = new THREE.MeshStandardMaterial({ color: '#554235', roughness: .9 })
  materials.push(lacquer, satin, ivory, keySide, ...keyTones, ebony, brass, pedalMetal, felt, spruce)
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], at: [number, number, number], name = '') => {
    const node = new THREE.Mesh(geometry, material)
    node.position.set(...at)
    node.name = name
    node.castShadow = node.receiveShadow = true
    piano.add(node)
    return node
  }
  const box = (size: [number, number, number], at: [number, number, number], material: THREE.Material = lacquer, radius = .002, name = '') =>
    add(new RoundedBoxGeometry(...size, 3, Math.min(radius, ...size.map(v => v / 3))), material, at, name)

  // The narrow upper cabinet and projecting keybed follow the U1 side silhouette.
  box([1.48, 1.135, .325], [0, .6075, -.1475], satin)
  for (const x of [-.739, .739]) box([.048, 1.15, .355], [x, .605, -.1325])
  box([1.53, .025, .375], [0, 1.1975, -.1225], lacquer, .003, 'top-lid')
  box([1.48, .012, .35], [0, 1.179, -.135], satin)
  box([1.485, .003, .016], [0, 1.176, .038], lacquer, .0008, 'lid-front-lip')
  box([1.412, .328, .018], [0, 1.001, .034], lacquer, .002, 'upper-panel')
  for (const x of [-.715, .715]) box([.013, .331, .014], [x, 1.001, .044])
  box([1.45, .018, .035], [0, .828, .043])
  box([1.416, .557, .019], [0, .3425, .027], lacquer, .002, 'lower-panel')
  box([1.50, .060, .35], [0, .07, -.135])
  for (const x of [-.72, .72]) box([.018, .566, .017], [x, .345, .043])
  box([1.50, .050, .606], [0, .646, -.007], lacquer, .004, 'keybed')
  box([1.397, .024, .022], [0, .670, .299], lacquer, .003)

  const cheek = new THREE.Shape()
  cheek.moveTo(-.026, .873)
  cheek.bezierCurveTo(-.055, .797, -.140, .747, -.237, .731)
  cheek.bezierCurveTo(-.283, .725, -.307, .724, -.307, .701)
  cheek.lineTo(-.307, .626); cheek.lineTo(-.023, .626); cheek.closePath()
  const cheekGeo = new THREE.ExtrudeGeometry(cheek, { depth: .047, bevelEnabled: true, bevelSize: .002, bevelThickness: .002, bevelSegments: 4, curveSegments: 24 })
  for (const x of [-.741, .694]) {
    const node = add(cheekGeo, lacquer, [x, 0, 0], 'curved-cheek')
    node.rotation.y = Math.PI / 2
  }
  for (const x of [-.707, .707]) {
    box([.058, .567, .061], [x, .3455, .259], lacquer, .003, 'front-leg')
    box([.108, .058, .18], [x, .065, .22], lacquer, .003)
  }
  const wheelGeo = new THREE.CylinderGeometry(.019, .019, .019, 24)
  for (const x of [-.708, .708]) for (const z of [-.263, .263]) {
    const wheel = add(wheelGeo, brass, [x, .019, z], 'caster')
    wheel.rotation.z = Math.PI / 2
    box([.031, .015, .027], [x, .0405, z], brass)
  }
  for (let i = 0; i < 5; i++) box([.065, 1.06, .04], [-.58 + i * .29, .61, -.289], spruce)

  // Separate key shapes include the rear notches; black keys follow A0..C8.
  const whiteNotes = new Set([0, 2, 4, 5, 7, 9, 11])
  const isWhite = (midi: number) => whiteNotes.has((midi + 12) % 12)
  const pitch = .0233
  const span = pitch * U1_DIMENSIONS.whiteKeys
  const whiteShapes = new Map<string, THREE.ExtrudeGeometry>()
  const blackMatrices: THREE.Matrix4[] = []
  let whiteIndex = 0
  for (let midi = 21; midi <= 108; midi++) {
    if (!isWhite(midi)) {
      blackMatrices.push(new THREE.Matrix4().makeTranslation(-span / 2 + whiteIndex * pitch, 0, 0))
      continue
    }
    const left = midi > 21 && !isWhite(midi - 1), right = midi < 108 && !isWhite(midi + 1)
    const key = `${left}-${right}`
    let geometry = whiteShapes.get(key)
    if (!geometry) {
      const half = (pitch - .0007) / 2
      const shape = new THREE.Shape()
      shape.moveTo(-half, -.297); shape.lineTo(half, -.297)
      shape.lineTo(half, -.151); shape.lineTo(half - (right ? .0076 : 0), -.151)
      shape.lineTo(half - (right ? .0076 : 0), -.065)
      shape.lineTo(-half + (left ? .0076 : 0), -.065)
      shape.lineTo(-half + (left ? .0076 : 0), -.151)
      shape.lineTo(-half, -.151); shape.closePath()
      geometry = new THREE.ExtrudeGeometry(shape, { depth: .018, bevelEnabled: true, bevelSize: .00025, bevelThickness: .00025, bevelSegments: 2 })
      // Caps follow the key length; the thin lower edge exposes the wooden core.
      const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv')
      for (let i = 0; i < positions.count; i++) {
        const across = positions.getX(i) / (pitch - .0007) + .5, along = (positions.getY(i) + .297) / .232
        const cap = Math.abs(normals.getZ(i)) > .5
        uv.setXY(i, cap ? across : Math.abs(normals.getX(i)) > .5 ? along : across, cap ? along : positions.getZ(i) / .018)
      }
      whiteShapes.set(key, geometry)
    }
    const node = add(geometry, [keyTones[(whiteIndex * 7 + Math.floor(whiteIndex / 3)) % keyTones.length], keySide], [-span / 2 + (whiteIndex + .5) * pitch, .687, 0], `white-key-${midi}`)
    node.rotation.x = -Math.PI / 2
    whiteIndex++
  }
  // Low, flat playing surfaces with a sloping nose, not tall rectangular teeth.
  const blackProfile = new THREE.Shape()
  blackProfile.moveTo(-.065, .706)
  blackProfile.lineTo(-.171, .706)
  blackProfile.lineTo(-.171, .709)
  blackProfile.lineTo(-.160, .720)
  blackProfile.lineTo(-.065, .720)
  blackProfile.closePath()
  const blackGeometry = new THREE.ExtrudeGeometry(blackProfile, { depth: .013, bevelEnabled: true, bevelSize: .0004, bevelThickness: .0004, bevelSegments: 4 })
  blackGeometry.rotateY(Math.PI / 2)
  blackGeometry.translate(-.0065, 0, 0)
  const blackPositions = blackGeometry.getAttribute('position')
  for (let i = 0; i < blackPositions.count; i++) {
    const taper = THREE.MathUtils.clamp((blackPositions.getY(i) - .706) / .014, 0, 1)
    blackPositions.setX(i, blackPositions.getX(i) * (1 - .12 * taper))
  }
  blackGeometry.computeVertexNormals()
  const black = new THREE.InstancedMesh(blackGeometry, ebony, blackMatrices.length)
  black.name = 'black-keys'
  blackMatrices.forEach((matrix, index) => black.setMatrixAt(index, matrix))
  black.castShadow = black.receiveShadow = true
  piano.add(black)
  box([span, .007, .009], [0, .702, .060], felt)

  const fallboard = box([1.409, .163, .021], [0, .776, .065], lacquer, .003, 'open-fallboard')
  fallboard.rotation.x = -.40
  const musicRest = box([.877, .041, .008], [0, .801, .069], lacquer, .002, 'folded-music-rest')
  musicRest.rotation.x = -.40
  box([1.395, .0025, .003], [0, .708, .108], brass, .0005)
  box([1.40, .002, .002], [0, 1.211 - .002, -.254], brass, .0003)
  const hingeGeo = new THREE.CylinderGeometry(.0025, .0025, .009, 12)
  for (let i = 0; i < 12; i++) {
    const hinge = add(hingeGeo, brass, [-.65 + i * .118, .707, .109])
    hinge.rotation.z = Math.PI / 2
  }
  const lock = add(new THREE.CylinderGeometry(.0035, .0035, .002, 20), brass, [0, .652, .311])
  lock.rotation.x = Math.PI / 2
  // Elliptical cross-sections blend the bent shank into a rounded foot plate.
  const sections = [
    [.042, .066, .007, .007], [.063, .066, .008, .007],
    [.088, .052, .008, .006], [.117, .039, .010, .0055],
    [.143, .037, .016, .006], [.171, .037, .020, .0065],
    [.195, .036, .017, .006], [.210, .034, .007, .004], [.213, .033, .001, .001],
  ]
  const positions: number[] = [], indices: number[] = [], sides = 32, rings = 49
  const pedalPath = new THREE.CatmullRomCurve3(sections.map(([z, y]) => new THREE.Vector3(0, y, z)))
  const pedalSection = new THREE.CatmullRomCurve3(sections.map(([, , width, height]) => new THREE.Vector3(width, height, 0)))
  for (let ring = 0; ring < rings; ring++) {
    const t = ring / (rings - 1), center = pedalPath.getPoint(t), profile = pedalSection.getPoint(t)
    for (let side = 0; side < sides; side++) {
      const angle = side * Math.PI * 2 / sides
      positions.push(Math.cos(angle) * Math.max(.0005, profile.x), center.y + Math.sin(angle) * Math.max(.0005, profile.y), center.z)
    }
  }
  for (let ring = 0; ring < rings - 1; ring++) for (let side = 0; side < sides; side++) {
    const a = ring * sides + side, b = ring * sides + (side + 1) % sides
    indices.push(a, b, b + sides, a, b + sides, a + sides)
  }
  const end = (rings - 1) * sides
  for (let side = 1; side < sides - 1; side++) indices.push(0, side + 1, side, end, end + side, end + side + 1)
  const pedalGeo = new THREE.BufferGeometry()
  pedalGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  pedalGeo.setIndex(indices)
  pedalGeo.computeVertexNormals()
  for (const x of [-.050, 0, .050]) {
    box([.021, .038, .006], [x, .064, .040], satin, .003, 'pedal-socket')
    add(pedalGeo, pedalMetal, [x, 0, 0], 'pedal')
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = 768; canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.font = '500 64px sans-serif'; ctx.fillStyle = '#c2a366'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('YAMAHA', 384, 64)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    textures.push(texture)
    const wordmark = new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, metalness: .5, roughness: .3 })
    materials.push(wordmark)
    const label = add(new THREE.PlaneGeometry(.155, .026), wordmark, [0, .75, .09])
    label.rotation.x = -.40
    label.castShadow = false
  }
  return { piano, lacquer }
}
