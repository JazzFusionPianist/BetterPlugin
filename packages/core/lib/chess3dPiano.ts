import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// Yamaha's public U1 front/side dimension drawing, not an internal manufacturing CAD.
// https://www.yamaha.com/us/pianos/images/u1linenew.jpg
export const U1_DIMENSIONS = { width: 1.53, height: 1.21, depth: .62, whiteKeys: 52, blackKeys: 36 } as const

export function createU1Piano(materials: THREE.Material[], textures: THREE.Texture[], normalMap: THREE.Texture | null) {
  const piano = new THREE.Group()
  piano.name = 'upright-u1'
  const lacquer = new THREE.MeshPhysicalMaterial({ color: '#171715', roughness: .24, metalness: .04, clearcoat: .85, clearcoatRoughness: .13, normalMap, normalScale: new THREE.Vector2(.012, .012), envMapIntensity: .8 })
  const satin = new THREE.MeshStandardMaterial({ color: '#121311', roughness: .45 })
  const ivory = new THREE.MeshPhysicalMaterial({ color: '#f1ede1', roughness: .27, clearcoat: .3, clearcoatRoughness: .2 })
  const ebony = new THREE.MeshPhysicalMaterial({ color: '#111211', roughness: .32, clearcoat: .35 })
  const brass = new THREE.MeshStandardMaterial({ color: '#bd9755', metalness: .84, roughness: .25 })
  const felt = new THREE.MeshStandardMaterial({ color: '#7c2425', roughness: 1 })
  const spruce = new THREE.MeshStandardMaterial({ color: '#554235', roughness: .9 })
  materials.push(lacquer, satin, ivory, ebony, brass, felt, spruce)
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, at: [number, number, number], name = '') => {
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
      blackMatrices.push(new THREE.Matrix4().makeTranslation(-span / 2 + whiteIndex * pitch, .721, .121))
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
      whiteShapes.set(key, geometry)
    }
    const node = add(geometry, ivory, [-span / 2 + (whiteIndex + .5) * pitch, .687, 0], `white-key-${midi}`)
    node.rotation.x = -Math.PI / 2
    whiteIndex++
  }
  const black = new THREE.InstancedMesh(new RoundedBoxGeometry(.0136, .029, .107, 3, .0012), ebony, blackMatrices.length)
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
  const pedal = new THREE.Shape()
  pedal.moveTo(-.054, .055); pedal.lineTo(-.11, .058)
  pedal.bezierCurveTo(-.15, .056, -.158, .031, -.20, .029)
  pedal.lineTo(-.20, .020); pedal.bezierCurveTo(-.149, .020, -.117, .024, -.094, .035)
  pedal.lineTo(-.054, .036); pedal.closePath()
  const pedalGeo = new THREE.ExtrudeGeometry(pedal, { depth: .022, bevelEnabled: true, bevelSize: .002, bevelThickness: .002, bevelSegments: 4, curveSegments: 16 })
  for (const x of [-.050, 0, .050]) {
    const node = add(pedalGeo, brass, [x - .011, 0, 0], 'pedal')
    node.rotation.y = Math.PI / 2
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
    const wordmark = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
    materials.push(wordmark)
    const label = add(new THREE.PlaneGeometry(.155, .026), wordmark, [0, .75, .09])
    label.rotation.x = -.40
    label.castShadow = false
  }
  return { piano, lacquer }
}
