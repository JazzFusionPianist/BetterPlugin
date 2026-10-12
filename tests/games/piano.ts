import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createChessRoom } from '../../packages/core/lib/chess3dRoom'
import { configureChessShadows } from '../../packages/core/lib/chess3dShadows'

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = .93
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.BasicShadowMap
document.body.append(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color('#211d19')
const generator = new THREE.PMREMGenerator(renderer)
const environment = new RoomEnvironment()
scene.environment = generator.fromScene(environment, .04).texture
scene.environmentIntensity = .25
environment.dispose(); generator.dispose()
scene.add(new THREE.HemisphereLight('#ffead1', '#30241e', .28))
const light = new THREE.SpotLight('#fff0d3', 748, 70, .55, .70, 2)
light.position.set(-3, 18, 5)
light.castShadow = true
light.shadow.mapSize.set(2048, 2048)
light.shadow.camera.near = .5; light.shadow.camera.far = 70
light.shadow.normalBias = .035
scene.add(light)
const fill = new THREE.DirectionalLight('#ffdfb2', .20)
fill.position.set(6, 5, -5); scene.add(fill)
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 120)
camera.position.set(24.5, 2, -8)
camera.lookAt(12.5, -2, -27.2)
if (new URLSearchParams(location.search).get('view') === 'room') {
  camera.position.set(23, 15, 23)
  camera.lookAt(-4, -2, -12)
} else if (new URLSearchParams(location.search).get('view') === 'reader') {
  camera.position.set(27, 9, -10)
  camera.lookAt(16, 1, -27)
}
const materials: THREE.Material[] = []
const room = createChessRoom(scene, renderer, materials, [], () => {}, () => false)
await room.ready
configureChessShadows(renderer, materials)
room.setOpponentLabel('@opponent')
const lighting = () => ['wall-lamp-light', 'table-lamp-light', 'near-candle-light', 'far-candle-light', 'torch-uplight', 'torch-ceiling-bounce'].map(name => {
  const light = scene.getObjectByName(name) as THREE.PointLight
  return { name, position: light.position.toArray(), intensity: light.intensity }
})
const initialLights = lighting()
room.toggleLamp('wall'); room.toggleLamp('table'); room.toggleLamp('reader')
const unlitLights = lighting()
const readerEmissions = () => room.readerLampTargets.flatMap(node => (Array.isArray(node.material) ? node.material : [node.material]) as THREE.MeshStandardMaterial[]).filter(material => material.emissive.getHex() !== 0).map(material => material.emissiveIntensity)
const unlitReaderEmissions = readerEmissions()
room.toggleLamp('wall'); room.toggleLamp('table'); room.toggleLamp('reader')
room.setTurn('near'); room.animateCandles(1000, false)
const nearTurn = lighting()
room.setTurn('far'); room.animateCandles(1000, false)
const farTurn = lighting()
room.setTurn(null); room.animateCandles(1000, false)
renderer.render(scene, camera)
const piano = scene.getObjectByName('upright-u1')!
const size = new THREE.Box3().setFromObject(piano).getSize(new THREE.Vector3()).divideScalar(10)
const nodes: THREE.Object3D[] = []
piano.traverse(node => nodes.push(node))
const black = piano.getObjectByName('black-keys') as THREE.InstancedMesh
black.geometry.computeBoundingBox()
const bench = scene.getObjectByName('piano-bench')!
const pianoBounds = new THREE.Box3().setFromObject(piano)
const readerBounds = room.readerLampTargets.map(node => new THREE.Box3().setFromObject(node))
const readerBase = room.readerLampTargets.find(node => node.name.includes('weighted_circular_base'))!
const readerBaseBounds = new THREE.Box3().setFromObject(readerBase)
const readerLight = scene.getObjectByName('torch-uplight') as THREE.SpotLight
const whiteKeyMaterials = (piano.getObjectByName('white-key-21') as THREE.Mesh).material as THREE.MeshPhysicalMaterial[]
const whiteKeyMaterial = whiteKeyMaterials[0]
const pedal = piano.getObjectByName('pedal') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
const pedalVertices = pedal.geometry.getAttribute('position')
const pedalFoot = new THREE.Box3()
for (let i = 0; i < pedalVertices.count; i++) {
  if (pedalVertices.getZ(i) > .16 && pedalVertices.getZ(i) < .18) pedalFoot.expandByPoint(new THREE.Vector3().fromBufferAttribute(pedalVertices, i))
}
Object.assign(window, { pianoQA: {
  readerLamp: { baseMin: readerBaseBounds.min.toArray(), baseMax: readerBaseBounds.max.toArray(), pianoMin: pianoBounds.min.toArray(), pianoMax: pianoBounds.max.toArray(), overlapsPiano: readerBounds.some(bounds => bounds.intersectsBox(pianoBounds)), beam: readerLight.position.toArray(), target: readerLight.target.position.toArray(), angle: readerLight.angle, shadows: readerLight.castShadow, unlitEmissions: unlitReaderEmissions, litEmissions: readerEmissions() },
  toggleReader: () => { room.toggleLamp('reader'); renderer.render(scene, camera) },
  pedalFoot: { size: pedalFoot.getSize(new THREE.Vector3()).toArray(), color: pedal.material.color.getHexString(), roughness: pedal.material.roughness, environment: pedal.material.envMapIntensity, emissive: pedal.material.emissive.getHex() },
  whiteKeyMaterial: { color: whiteKeyMaterial.color.getHexString(), roughness: whiteKeyMaterial.roughness, clearcoat: whiteKeyMaterial.clearcoat, environment: whiteKeyMaterial.envMapIntensity, emissive: whiteKeyMaterial.emissive.getHex(), textured: !!whiteKeyMaterial.map && !!whiteKeyMaterial.roughnessMap && !!whiteKeyMaterial.bumpMap, bump: whiteKeyMaterial.bumpScale, woodenEdge: !!whiteKeyMaterials[1].map },
  keyToneCount: new Set(nodes.filter(node => node.name.startsWith('white-key-')).map(node => ((node as THREE.Mesh).material as THREE.MeshPhysicalMaterial[])[0].color.getHex())).size,
  lighting: { initialLights, unlitLights, nearTurn, farTurn },
  size: size.toArray(), whiteKeys: nodes.filter(node => node.name.startsWith('white-key-')).length,
  blackKeys: black.count, blackKeyHeight: black.geometry.boundingBox!.max.y - .705,
  pedals: nodes.filter(node => node.name === 'pedal').length, casters: nodes.filter(node => node.name === 'caster').length,
  pianoX: piano.position.x, benchX: bench.position.x,
  externalPiano: !!scene.getObjectByName('tall3-upright-piano'),
  pianoTopLamp: !!scene.getObjectByName('piano-mushroom-lamp'),
  benchSize: new THREE.Box3().setFromObject(bench).getSize(new THREE.Vector3()).divideScalar(10).toArray(),
  chairX: scene.getObjectByName('opponent-chair')!.position.x,
  furniture: ['sofa-03', 'green-chair-01', 'round-side-table', 'table-lamp', 'torch-floor-lamp'].map(name => {
    const model = scene.getObjectByName(name)!
    const bounds = new THREE.Box3().setFromObject(model)
    return { name, min: bounds.min.toArray(), max: bounds.max.toArray() }
  }),
} })
document.body.dataset.ready = 'true'
