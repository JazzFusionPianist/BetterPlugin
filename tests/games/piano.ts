import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createChessRoom } from '../../packages/core/lib/chess3dRoom'

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = .93
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
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
}
const room = createChessRoom(scene, renderer, [], [], () => {}, () => false)
await room.ready
room.setOpponentLabel('@opponent')
const lighting = () => ['wall-lamp-light', 'table-lamp-light', 'near-candle-light', 'far-candle-light'].map(name => {
  const light = scene.getObjectByName(name) as THREE.PointLight
  return { name, position: light.position.toArray(), intensity: light.intensity }
})
const initialLights = lighting()
room.toggleLamp('wall'); room.toggleLamp('table')
const unlitLights = lighting()
room.toggleLamp('wall'); room.toggleLamp('table')
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
Object.assign(window, { pianoQA: {
  lighting: { initialLights, unlitLights, nearTurn, farTurn },
  size: size.toArray(), whiteKeys: nodes.filter(node => node.name.startsWith('white-key-')).length,
  blackKeys: black.count, blackKeyHeight: black.geometry.boundingBox!.max.y - .705,
  pedals: nodes.filter(node => node.name === 'pedal').length, casters: nodes.filter(node => node.name === 'caster').length,
  pianoX: piano.position.x, benchX: bench.position.x,
  externalPiano: !!scene.getObjectByName('tall3-upright-piano'),
  benchSize: new THREE.Box3().setFromObject(bench).getSize(new THREE.Vector3()).divideScalar(10).toArray(),
  chairX: scene.getObjectByName('opponent-chair')!.position.x,
  furniture: ['sofa-03', 'green-chair-01', 'round-side-table', 'table-lamp'].map(name => {
    const model = scene.getObjectByName(name)!
    const bounds = new THREE.Box3().setFromObject(model)
    return { name, min: bounds.min.toArray(), max: bounds.max.toArray() }
  }),
} })
document.body.dataset.ready = 'true'
