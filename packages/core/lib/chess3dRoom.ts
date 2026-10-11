import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { createU1Piano } from './chess3dPiano'

const maps = {
  walnut: [new URL('../assets/chess-room3d/walnut-color.webp', import.meta.url), new URL('../assets/chess-room3d/walnut-normal.webp', import.meta.url), new URL('../assets/chess-room3d/walnut-roughness.webp', import.meta.url)],
  leather: [new URL('../assets/chess-room3d/leather-color.webp', import.meta.url), new URL('../assets/chess-room3d/leather-normal.webp', import.meta.url), new URL('../assets/chess-room3d/leather-roughness.webp', import.meta.url)],
  plaster: [new URL('../assets/chess-room3d/plaster-color.webp', import.meta.url), new URL('../assets/chess-room3d/plaster-normal.webp', import.meta.url), new URL('../assets/chess-room3d/plaster-roughness.webp', import.meta.url)],
  parquet: [new URL('../assets/chess-room3d/parquet-color.webp', import.meta.url), new URL('../assets/chess-room3d/parquet-normal.webp', import.meta.url), new URL('../assets/chess-room3d/parquet-roughness.webp', import.meta.url)],
}
let areaLightsReady = false

export function createChessRoom(scene: THREE.Scene, renderer: THREE.WebGLRenderer, materials: THREE.Material[], textures: THREE.Texture[], changed: () => void, disposed: () => boolean) {
  const room = new THREE.Group()
  room.name = 'music-room-3d'
  scene.add(room)
  const pending: Promise<unknown>[] = []
  const loader = new THREE.TextureLoader()
  const pbr = (name: keyof typeof maps, color: string, repeat: [number, number], roughness: number, bump = .3) => {
    const layers = maps[name].map((url, index) => {
      let texture: THREE.Texture
      pending.push(new Promise<void>((resolve, reject) => {
        texture = loader.load(url.href, value => {
          if (disposed()) value.dispose()
          else changed()
          resolve()
        }, undefined, reject)
      }))
      texture!.colorSpace = index === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace
      texture!.wrapS = texture!.wrapT = THREE.RepeatWrapping
      texture!.repeat.set(...repeat)
      texture!.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
      textures.push(texture!)
      return texture!
    })
    const material = new THREE.MeshPhysicalMaterial({ color, map: layers[0], normalMap: layers[1], roughnessMap: layers[2], roughness, normalScale: new THREE.Vector2(bump, bump), envMapIntensity: .35 })
    materials.push(material)
    return material
  }
  const wood = pbr('walnut', '#514133', [1.5, 1], .82, .12)
  const leather = pbr('leather', '#3c3530', [1.2, 1.2], .76, .32)
  const plaster = pbr('plaster', '#685745', [5, 2.5], .98, .22)
  const floor = pbr('parquet', '#51463d', [7, 7], .92, .15)
  floor.roughnessMap = null
  floor.roughness = .96
  floor.envMapIntensity = .03
  wood.clearcoat = .14
  wood.clearcoatRoughness = .5
  const brass = new THREE.MeshStandardMaterial({ color: '#ad8852', metalness: .78, roughness: .34 })
  const linen = new THREE.MeshStandardMaterial({ color: '#dac7a8', roughness: 1, side: THREE.DoubleSide })
  const curtain = new THREE.MeshStandardMaterial({ color: '#302c25', roughness: 1, side: THREE.DoubleSide })
  const glass = new THREE.MeshPhysicalMaterial({ color: '#263135', roughness: .2, metalness: .25, clearcoat: .8 })
  const bulb = new THREE.MeshStandardMaterial({ color: '#ffdeb1', emissive: '#ffbf70', emissiveIntensity: 3 })
  materials.push(brass, linen, curtain, glass, bulb)
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, at: [number, number, number], parent: THREE.Object3D = room) => {
    const node = new THREE.Mesh(geometry, material)
    node.position.set(...at)
    node.castShadow = node.receiveShadow = true
    parent.add(node)
    return node
  }
  const box = (size: [number, number, number], at: [number, number, number], material = wood, radius = .06, parent: THREE.Object3D = room) =>
    mesh(new RoundedBoxGeometry(...size, 3, Math.min(radius, ...size.map(v => v / 3))), material, at, parent)
  const floorY = -8.3
  const ground = mesh(new THREE.PlaneGeometry(60, 80), floor, [0, floorY, 8])
  ground.rotation.x = -Math.PI / 2
  ground.castShadow = false
  mesh(new THREE.PlaneGeometry(50, 26), plaster, [0, floorY + 13, -32])
  for (const sign of [-1, 1]) {
    const wall = mesh(new THREE.PlaneGeometry(80, 26), plaster, [sign * 25, floorY + 13, 8])
    wall.rotation.y = -sign * Math.PI / 2
    box([.22, 1.05, 80], [sign * 24.8, floorY + .525, 8])
    box([.3, .12, 80], [sign * 24.75, floorY + 1.1, 8])
  }
  box([50, 1.05, .22], [0, floorY + .525, -31.8])
  box([50, .12, .3], [0, floorY + 1.1, -31.75])

  // Solid beveled walnut, with a shallow top and joinery beneath it.
  box([18.5, .44, 11.8], [0, -.545, 0], wood, .12)
  for (const x of [-7.9, 7.9]) for (const z of [-4.6, 4.6]) {
    mesh(new THREE.CylinderGeometry(.28, .20, 7.55, 20), wood, [x, floorY + 3.775, z])
    box([.7, .7, .7], [x, -1.18, z])
  }
  for (const z of [-4.8, 4.8]) box([16.3, .8, .22], [0, -1.17, z])
  for (const x of [-8, 8]) box([.22, .8, 9.7], [x, -1.17, 0])
  box([6.2, .73, .24], [0, -1.17, 4.95])
  const handle = mesh(new THREE.CylinderGeometry(.045, .045, .9, 12), brass, [0, -1.17, 5.15])
  handle.rotation.z = Math.PI / 2

  const chair = new THREE.Group()
  chair.position.set(-.8, floorY, -9.1)
  room.add(chair)
  for (const x of [-2, 2]) for (const z of [-1.7, 1.7]) {
    const leg = mesh(new THREE.CylinderGeometry(.19, .11, 4.6, 20), wood, [x, 2.3, z], chair)
    leg.rotation.z = -Math.sign(x) * .045
  }
  box([4.9, .42, 4.6], [0, 4.6, 0], wood, .12, chair)
  box([4.65, .62, 4.3], [0, 4.98, .05], leather, .2, chair)
  const outline = (width: number, bottom: number, top: number) => {
    const shape = new THREE.Shape()
    shape.moveTo(-width / 2, bottom)
    shape.lineTo(-width / 2, top - .65)
    shape.quadraticCurveTo(0, top + .65, width / 2, top - .65)
    shape.lineTo(width / 2, bottom)
    shape.closePath()
    return shape
  }
  const frame = outline(5.2, 4.5, 10.9)
  const opening = outline(4.45, 5.1, 10.45)
  frame.holes.push(new THREE.Path(opening.getPoints().reverse()))
  const back = mesh(new THREE.ExtrudeGeometry(frame, { depth: .26, bevelEnabled: true, bevelSegments: 4, bevelSize: .08, bevelThickness: .08, curveSegments: 24 }), wood, [0, 0, -1.9], chair)
  back.rotation.x = -.075
  const cushion = mesh(new THREE.ExtrudeGeometry(outline(4.4, 5.15, 10.4), { depth: .18, bevelEnabled: true, bevelSegments: 5, bevelSize: .15, bevelThickness: .18, curveSegments: 24 }), leather, [0, 0, -1.72], chair)
  cushion.rotation.x = -.075
  const nail = new THREE.SphereGeometry(.038, 8, 6)
  for (let i = 0; i < 34; i++) {
    const x = -2.15 + 4.3 * i / 33
    const y = 9.82 + .45 * (1 - (x / 2.15) ** 2)
    mesh(nail, brass, [x, y, -1.46 - y * .075], chair)
  }
  for (const x of [-2.17, 2.17]) for (let y = 5.3; y < 9.8; y += .22) mesh(nail, brass, [x, y, -1.46 - y * .075], chair)

  // Ten world units per metre, shared with the 1.85 m desk and 0.49 m chair.
  const { piano, lacquer } = createU1Piano(materials, textures, wood.normalMap)
  piano.scale.setScalar(10)
  piano.position.set(5, floorY, -27.2)
  room.add(piano)
  const bench = new THREE.Group()
  bench.position.set(5, floorY, -22.7)
  room.add(bench)
  box([6, .35, 2.8], [0, 4.9, 0], wood, .08, bench)
  box([5.85, .55, 2.7], [0, 5.2, 0], leather, .17, bench)
  for (const x of [-2.45, 2.45]) for (const z of [-.95, .95]) mesh(new THREE.CylinderGeometry(.15, .11, 4.8, 16), wood, [x, 2.4, z], bench)

  // Pleats, window rails and the wall lamp all have actual depth under orbit.
  box([7, 12, .12], [-17, 1.2, -31.65], glass)
  for (const x of [-20.6, -17, -13.4]) box([.18, 12.5, .25], [x, 1.2, -31.45])
  for (const y of [-5, 1.2, 7.4]) box([7.4, .18, .25], [-17, y, -31.45])
  for (const x of [-21.8, -12.2]) {
    const folds = new THREE.PlaneGeometry(2.5, 16, 32, 12)
    const positions = folds.getAttribute('position')
    for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.sin(positions.getX(i) * 9) * .22)
    folds.computeVertexNormals()
    mesh(folds, curtain, [x, .1, -30.9])
  }
  const plate = mesh(new THREE.CylinderGeometry(.46, .46, .12, 32), brass, [-8.5, 3.4, -31.65])
  plate.rotation.x = Math.PI / 2
  const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(-8.5, 2.8, -31.5), new THREE.Vector3(-8.5, 2.7, -30.1), new THREE.Vector3(-8.5, 4, -30)])
  mesh(new THREE.TubeGeometry(arm, 20, .07, 10, false), brass, [0, 0, 0])
  mesh(new THREE.CylinderGeometry(.7, 1.08, 1.55, 48, 1, true), linen, [-8.5, 4.55, -30])
  mesh(new THREE.SphereGeometry(.13, 16, 10), bulb, [-8.5, 4.2, -30])
  const lamp = new THREE.PointLight('#ffd19b', 180, 45, 2)
  lamp.position.set(-8.5, 4.2, -29.8)
  room.add(lamp)
  if (!areaLightsReady) { RectAreaLightUniformsLib.init(); areaLightsReady = true }
  const softbox = new THREE.RectAreaLight('#ffe4c6', 2.8, 7, 10)
  softbox.position.set(-8, 6, -13)
  softbox.lookAt(5, -1, -27.2)
  room.add(softbox)
  let reflection: THREE.WebGLRenderTarget | undefined
  const ready = Promise.all(pending).then(() => {
    if (disposed()) return
    // Capture the actual warm room once, instead of a white studio-box reflection.
    const cube = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType })
    const capture = new THREE.CubeCamera(.1, 100, cube)
    capture.position.set(5, floorY + 8, -25)
    piano.visible = false
    try {
      capture.update(renderer, scene)
      const generator = new THREE.PMREMGenerator(renderer)
      reflection = generator.fromCubemap(cube.texture)
      generator.dispose()
      lacquer.envMap = reflection.texture
      lacquer.needsUpdate = true
    } finally { piano.visible = true; cube.dispose() }
    renderer.shadowMap.needsUpdate = true
    changed()
  })
  return { ready, dispose: () => reflection?.dispose() }
}
