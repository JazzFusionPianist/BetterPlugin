import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
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
  const curtain = new THREE.MeshStandardMaterial({ color: '#302c25', roughness: 1, side: THREE.DoubleSide })
  const glass = new THREE.MeshPhysicalMaterial({ color: '#263135', roughness: .2, metalness: .25, clearcoat: .8 })
  materials.push(brass, curtain, glass)
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
  const tableLampTargets: THREE.Mesh[] = []
  const tableLampPoint = new THREE.Vector3()
  const tableEmitters: THREE.MeshStandardMaterial[] = []
  let tableGlow: THREE.PointLight | undefined, tableLampOn = true
  const readerLampTargets: THREE.Mesh[] = []
  const readerLampPoint = new THREE.Vector3()
  const readerEmitters: THREE.MeshStandardMaterial[] = []
  let readerGlow: THREE.SpotLight | undefined, readerLampOn = true
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
  chair.name = 'opponent-chair'
  chair.position.set(0, floorY, -9.1)
  room.add(chair)
  const labelCanvas = document.createElement('canvas')
  labelCanvas.width = 1024; labelCanvas.height = 192
  const labelTexture = new THREE.CanvasTexture(labelCanvas)
  labelTexture.colorSpace = THREE.SRGBColorSpace
  textures.push(labelTexture)
  const labelMaterial = new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, depthWrite: false })
  materials.push(labelMaterial)
  const chairLabel = mesh(new THREE.PlaneGeometry(3.5, .66), labelMaterial, [0, 10.3, 0], chair)
  chairLabel.name = 'opponent-nameplate'
  chairLabel.castShadow = chairLabel.receiveShadow = false
  chairLabel.visible = false
  let opponentLabel = ''
  const setOpponentLabel = (text: string) => {
    if (text === opponentLabel) return
    opponentLabel = text
    chairLabel.visible = !!text
    const ctx = labelCanvas.getContext('2d')!
    ctx.clearRect(0, 0, 1024, 192)
    if (text) {
      ctx.fillStyle = '#201b16'; ctx.strokeStyle = '#a18b70'; ctx.lineWidth = 4
      ctx.beginPath(); ctx.roundRect(5, 5, 1014, 182, 22); ctx.fill(); ctx.stroke()
      let font = 72
      do { ctx.font = `600 ${font--}px sans-serif` } while (ctx.measureText(text).width > 930 && font > 24)
      ctx.fillStyle = '#f0e4cd'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(text, 512, 98, 930)
    }
    labelTexture.needsUpdate = true
    changed()
  }

  const loadFurniture = async (url: URL, name: string) => {
    const asset = await new GLTFLoader().loadAsync(url.href)
    const model = asset.scene
    model.name = name
    const ownedMaterials = new Set<THREE.Material>(), ownedTextures = new Set<THREE.Texture>()
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return
      node.castShadow = node.receiveShadow = true
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        ownedMaterials.add(material)
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) ownedTextures.add(value)
      }
      if (disposed()) node.geometry.dispose()
    })
    if (disposed()) { ownedMaterials.forEach(value => value.dispose()); ownedTextures.forEach(value => value.dispose()); return }
    materials.push(...ownedMaterials); textures.push(...ownedTextures)
    return model
  }
  const floorModel = (model: THREE.Object3D, x: number, z: number, parent: THREE.Object3D = room) => {
    const bounds = new THREE.Box3().setFromObject(model), center = bounds.getCenter(new THREE.Vector3())
    model.position.set(x - center.x, (parent === room ? floorY : 0) - bounds.min.y, z - center.z)
    parent.add(model)
  }
  pending.push(loadFurniture(new URL('../assets/chess-chair.glb', import.meta.url), 'green-chair-01').then(model => {
    if (!model) return
    // One warm hue across the original albedo preserves detail without green/brown patches.
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return
      const chairMaterials = (Array.isArray(node.material) ? node.material : [node.material]) as THREE.Material[]
      for (const material of chairMaterials) {
        material.onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
            #include <map_fragment>
            float fabricLight = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            diffuseColor.rgb = vec3(0.42, 0.19, 0.11) * fabricLight;
          `)
        }
        material.customProgramCacheKey = () => 'slur-chair-chocolate-v4'
      }
    })
    model.scale.setScalar(10)
    floorModel(model, 0, 0, chair)
  }))
  pending.push(loadFurniture(new URL('../assets/chess-sofa.glb', import.meta.url), 'sofa-03').then(sofa => {
    if (!sofa) return
    sofa.scale.setScalar(9.2)
    sofa.rotation.y = Math.PI / 2
    const bounds = new THREE.Box3().setFromObject(sofa), center = bounds.getCenter(new THREE.Vector3())
    // Back near the left wall, front toward the room; keep the window corner free.
    sofa.position.set(-23.8 - bounds.min.x, floorY - bounds.min.y, -6.5 - center.z)
    room.add(sofa)
  }))
  pending.push(loadFurniture(new URL('../assets/chess-side-table.glb', import.meta.url), 'round-side-table').then(async table => {
    if (!table) return
    const size = new THREE.Box3().setFromObject(table).getSize(new THREE.Vector3())
    table.scale.setScalar(5.8 / Math.max(size.x, size.z))
    floorModel(table, -19.7, -23.3)
    const top = new THREE.Box3().setFromObject(table).max.y
    const tableLamp = await loadFurniture(new URL('../assets/chess-table-lamp.glb', import.meta.url), 'table-lamp')
    if (!tableLamp) return
    tableLamp.scale.setScalar(10)
    const bounds = new THREE.Box3().setFromObject(tableLamp), center = bounds.getCenter(new THREE.Vector3())
    tableLamp.position.set(-19.7 - center.x, top - bounds.min.y, -23.3 - center.z)
    room.add(tableLamp)
    tableLamp.updateWorldMatrix(true, true)
    tableLamp.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return
      tableLampTargets.push(node)
      const list = (Array.isArray(node.material) ? node.material : [node.material]) as THREE.MeshStandardMaterial[]
      for (const material of list) if (material.emissiveMap && !tableEmitters.includes(material)) {
        material.emissive.set('#ffc986'); material.emissiveIntensity = 24
        tableEmitters.push(material)
      }
    })
    const bulbNode = tableLamp.getObjectByName('industrial_pipe_lamp_bulb')!
    new THREE.Box3().setFromObject(bulbNode).getCenter(tableLampPoint)
    const glowMaterial = new THREE.MeshBasicMaterial({ color: '#ffd5a0' })
    materials.push(glowMaterial)
    const filament = mesh(new THREE.SphereGeometry(.065, 12, 8), glowMaterial, tableLampPoint.toArray() as [number, number, number])
    filament.name = 'table-lamp-filament'
    filament.castShadow = filament.receiveShadow = false
    tableLampTargets.push(filament)
    tableGlow = new THREE.PointLight('#ffc986', 60, 18, 2)
    tableGlow.name = 'table-lamp-light'
    tableGlow.position.copy(tableLampPoint)
    room.add(tableGlow)
  }))

  const candles: { flame: THREE.Mesh; material: THREE.MeshStandardMaterial; light: THREE.PointLight }[] = []
  let candleTurn: 'near' | 'far' | null = null
  pending.push(loadFurniture(new URL('../assets/chess-candles.glb', import.meta.url), 'candle-source').then(model => {
    if (!model) return
    for (const [index, sign] of [1, -1].entries()) {
      const candle = model.clone(true)
      candle.name = index === 0 ? 'near-candle' : 'far-candle'
      candle.scale.setScalar(7)
      const bounds = new THREE.Box3().setFromObject(candle), center = bounds.getCenter(new THREE.Vector3())
      candle.position.set(sign * 6.7 - center.x, -.325 - bounds.min.y, sign * 3.6 - center.z)
      room.add(candle)
      candle.updateWorldMatrix(true, true)
      candle.traverse(node => {
        if (!(node instanceof THREE.Mesh) || !node.material.name.includes('flame')) return
        const material = (node.material as THREE.MeshStandardMaterial).clone()
        node.material = material
        material.emissive.set('#ffc477'); material.emissiveIntensity = 3
        materials.push(material)
        node.visible = node.castShadow = node.receiveShadow = false
        const light = new THREE.PointLight('#ffb76d', 0, 7, 2)
        light.name = index === 0 ? 'near-candle-light' : 'far-candle-light'
        new THREE.Box3().setFromObject(node).getCenter(light.position)
        room.add(light)
        candles.push({ flame: node, material, light })
      })
    }
  }))
  const setTurn = (turn: 'near' | 'far' | null) => { candleTurn = turn }
  const animateCandles = (time: number, reducedMotion: boolean) => {
    const pulse = reducedMotion ? 1 : .15 + .85 * (.5 + .5 * Math.sin(time * .0028)) ** 2
    candles.forEach((candle, index) => {
      const lit = candleTurn === (index === 0 ? 'near' : 'far')
      candle.flame.visible = lit
      candle.material.opacity = lit ? pulse : 0
      candle.light.intensity = lit ? 9 * pulse : 0
    })
    return candleTurn !== null && !reducedMotion
  }

  // Ten world units per metre, shared with the 1.85 m desk and 0.49 m chair.
  const pianoX = 12.5
  const { piano, lacquer } = createU1Piano(materials, textures)
  piano.scale.setScalar(10)
  piano.position.set(pianoX, floorY, -27.2)
  room.add(piano)
  pending.push(loadFurniture(new URL('../assets/chess-reader-lamp.glb', import.meta.url), 'reader-floor-lamp').then(model => {
    if (!model) return
    const nodes: THREE.Object3D[] = []
    model.traverse(node => nodes.push(node))
    const stem = nodes.find(node => node.name.includes('telescoping'))!
    const assembly = stem.parent!
    const headParts = assembly.children.filter(node => /downward_opal|suspended_socket|open_metal_shade|top_cap/.test(node.name))
    const arm = assembly.children.find(node => node.name.includes('offset_arm'))!
    const extension = .2
    stem.scale.y = (.222 + extension) / .222
    stem.position.y += extension / 2
    arm.position.y += extension
    headParts.forEach(node => { node.position.y += extension })
    const head = new THREE.Group()
    head.name = 'reader-aimed-head'
    head.position.set(-.292, 1.324 + extension, .037)
    assembly.add(head)
    model.updateWorldMatrix(true, true)
    headParts.forEach(node => head.attach(node))
    head.rotation.z = -.4
    model.scale.setScalar(10)
    // The stem/base fit the side gap; only the raised reading head overhangs the lid.
    model.position.set(22.45, floorY, -27.2)
    room.add(model)
    model.updateWorldMatrix(true, true)
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return
      readerLampTargets.push(node)
      for (const material of (Array.isArray(node.material) ? node.material : [node.material]) as THREE.MeshStandardMaterial[]) {
        material.envMapIntensity = .12
        if (material.name === 'Warm opal luminous diffuser') {
          material.emissive.set('#ffd3a1'); material.emissiveIntensity = 2
          readerEmitters.push(material)
        }
      }
    })
    readerLampPoint.copy(head.localToWorld(new THREE.Vector3(0, -.10, .075)))
    // Emit through the tilted opening instead of placing a light behind the metal shade.
    const aperture = head.localToWorld(new THREE.Vector3(0, -.153, 0))
    const direction = new THREE.Vector3(0, -1, 0).transformDirection(head.matrixWorld)
    const lidY = floorY + 12.1
    readerGlow = new THREE.SpotLight('#ffd3a1', 70, 14, .65, .75, 2)
    readerGlow.name = 'reader-lamp-light'
    readerGlow.position.copy(aperture)
    readerGlow.target.position.copy(aperture).addScaledVector(direction, (lidY - aperture.y) / direction.y)
    readerGlow.target.name = 'reader-lamp-lid-target'
    readerGlow.castShadow = true
    readerGlow.shadow.mapSize.set(512, 512)
    readerGlow.shadow.camera.near = .05
    readerGlow.shadow.camera.far = 14
    readerGlow.shadow.normalBias = .01
    readerGlow.shadow.bias = -.0001
    readerGlow.shadow.radius = 2
    room.add(readerGlow, readerGlow.target)
  }))
  const bench = new THREE.Group()
  bench.name = 'piano-bench'
  bench.position.set(pianoX, floorY, -22)
  room.add(bench)
  const benchLeather = leather.clone()
  benchLeather.color.set('#24211e')
  benchLeather.normalScale.set(.10, .10)
  benchLeather.map = null
  benchLeather.roughness = .65
  materials.push(benchLeather)
  box([6.5, .36, 3.5], [0, 4.21, 0], lacquer, .055, bench)
  box([6.40, .52, 3.40], [0, 4.64, 0], benchLeather, .15, bench)
  for (const z of [-1.38, 1.38]) box([5.7, .45, .16], [0, 3.90, z], lacquer, .035, bench)
  for (const x of [-2.9, 2.9]) box([.16, .45, 2.65], [x, 3.90, 0], lacquer, .035, bench)
  for (const x of [-2.75, 2.75]) for (const z of [-1.18, 1.18]) {
    const leg = mesh(new THREE.CylinderGeometry(.31, .23, 4.1, 4), lacquer, [x, 2.05, z], bench)
    leg.rotation.y = Math.PI / 4
    box([.34, .055, .34], [x, .035, z], benchLeather, .015, bench)
  }

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
  const lampTargets: THREE.Mesh[] = []
  const wallEmitters: THREE.MeshStandardMaterial[] = []
  const lampPoint = new THREE.Vector3(-8.5, 4.2, -30)
  const lamp = new THREE.PointLight('#ffd19b', 180, 45, 2)
  lamp.name = 'wall-lamp-light'
  lamp.position.copy(lampPoint)
  room.add(lamp)
  pending.push(loadFurniture(new URL('../assets/chess-wall-lamp.glb', import.meta.url), 'wall-lamp').then(model => {
    if (!model) return
    model.scale.setScalar(10)
    const bounds = new THREE.Box3().setFromObject(model), center = bounds.getCenter(new THREE.Vector3())
    model.position.set(-8.5 - center.x, 4 - center.y, -31.7 - bounds.min.z)
    room.add(model)
    model.updateWorldMatrix(true, true)
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return
      lampTargets.push(node)
      for (const material of (Array.isArray(node.material) ? node.material : [node.material]) as THREE.MeshStandardMaterial[]) {
        material.envMapIntensity = .15
        if (material.name.includes('bulb')) {
          material.emissive.set('#ffc786'); material.emissiveIntensity = 2.5
          wallEmitters.push(material)
          new THREE.Box3().setFromObject(node).getCenter(lampPoint)
        }
      }
    })
    // The bulb is the emitter; the shade and brass only reflect incident light.
    lamp.position.copy(lampPoint).add(new THREE.Vector3(0, -.25, .1))
  }))
  if (!areaLightsReady) { RectAreaLightUniformsLib.init(); areaLightsReady = true }
  const pianoFillIntensity = .65
  const softbox = new THREE.RectAreaLight('#ffe4c6', pianoFillIntensity, 7, 10)
  softbox.position.set(-8, 6, -13)
  softbox.lookAt(pianoX, -1, -27.2)
  room.add(softbox)
  let reflection: THREE.WebGLRenderTarget | undefined
  let lampOn = true, readyForReflection = false
  const updateReflection = () => {
    if (disposed()) return
    // Capture the actual warm room once, instead of a white studio-box reflection.
    const cube = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType })
    const capture = new THREE.CubeCamera(.1, 100, cube)
    capture.position.set(pianoX, floorY + 8, -25)
    piano.visible = false
    try {
      capture.update(renderer, scene)
      const generator = new THREE.PMREMGenerator(renderer)
      const previous = reflection
      reflection = generator.fromCubemap(cube.texture)
      generator.dispose()
      lacquer.envMap = reflection.texture
      lacquer.needsUpdate = true
      previous?.dispose()
    } finally { piano.visible = true; cube.dispose() }
    renderer.shadowMap.needsUpdate = true
    changed()
  }
  const toggleLamp = (id: 'wall' | 'table' | 'reader' = 'wall') => {
    if (id === 'reader') {
      readerLampOn = !readerLampOn
      if (readerGlow) readerGlow.intensity = readerLampOn ? 70 : 0
      readerEmitters.forEach(material => { material.emissiveIntensity = readerLampOn ? 2 : 0 })
      if (readyForReflection) updateReflection()
      changed()
      return readerLampOn
    }
    if (id === 'table') {
      tableLampOn = !tableLampOn
      if (tableGlow) tableGlow.intensity = tableLampOn ? 60 : 0
      tableEmitters.forEach(material => { material.emissiveIntensity = tableLampOn ? 24 : 0 })
      const filament = room.getObjectByName('table-lamp-filament')
      if (filament) filament.visible = tableLampOn
      if (readyForReflection) updateReflection()
      changed()
      return tableLampOn
    }
    lampOn = !lampOn
    lamp.intensity = lampOn ? 180 : 0
    softbox.intensity = lampOn ? pianoFillIntensity : 0
    wallEmitters.forEach(material => { material.emissiveIntensity = lampOn ? 2.5 : 0 })
    if (readyForReflection) updateReflection()
    changed()
    return lampOn
  }
  const ready = Promise.all(pending).then(() => {
    readyForReflection = true
    updateReflection()
  })
  return { ready, setOpponentLabel, setTurn, animateCandles, toggleLamp, readerLampTargets, readerLampPoint, tableLampTargets, tableLampPoint, lampTargets, lampPoint, dispose: () => { reflection?.dispose(); readerGlow?.shadow.dispose() } }
}
