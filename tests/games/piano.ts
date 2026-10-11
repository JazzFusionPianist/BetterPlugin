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
scene.environmentIntensity = .4
environment.dispose(); generator.dispose()
scene.add(new THREE.HemisphereLight('#ffead1', '#30241e', .55))
const light = new THREE.DirectionalLight('#fff0d3', 2.2)
light.position.set(-4, 10, 5)
light.castShadow = true
light.shadow.mapSize.set(2048, 2048)
light.shadow.camera.left = -32; light.shadow.camera.right = 32
light.shadow.camera.top = 32; light.shadow.camera.bottom = -32
light.shadow.normalBias = .035
scene.add(light)
const fill = new THREE.DirectionalLight('#ffdfb2', .55)
fill.position.set(6, 5, -5); scene.add(fill)
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 120)
camera.position.set(17, 2, -8)
camera.lookAt(5, -2, -27.2)
const room = createChessRoom(scene, renderer, [], [], () => {}, () => false)
await room.ready
renderer.render(scene, camera)
const piano = scene.getObjectByName('upright-u1')!
const size = new THREE.Box3().setFromObject(piano).getSize(new THREE.Vector3()).divideScalar(10)
const nodes: THREE.Object3D[] = []
piano.traverse(node => nodes.push(node))
Object.assign(window, { pianoQA: { size: size.toArray(), whiteKeys: nodes.filter(node => node.name.startsWith('white-key-')).length, blackKeys: (piano.getObjectByName('black-keys') as THREE.InstancedMesh).count, pedals: nodes.filter(node => node.name === 'pedal').length, casters: nodes.filter(node => node.name === 'caster').length } })
document.body.dataset.ready = 'true'
