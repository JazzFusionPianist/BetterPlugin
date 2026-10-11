import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export async function loadChessPieces(white: THREE.Material, black: THREE.Material) {
  const asset = await new GLTFLoader().loadAsync(new URL('../assets/chess-pieces.glb', import.meta.url).href)
  const prototypes = new Map<string, THREE.Group>()
  const originals = new Set<THREE.Material>()
  for (const kind of ['P', 'R', 'N', 'B', 'Q', 'K']) {
    const original = asset.scene.getObjectByName(kind)!
    const bounds = new THREE.Box3().setFromObject(original)
    const center = bounds.getCenter(new THREE.Vector3())
    for (const color of ['w', 'b']) {
      const group = new THREE.Group()
      const model = original.clone(true)
      model.position.set(-center.x, -bounds.min.y, -center.z)
      group.add(model)
      group.scale.setScalar(17.4)
      if (kind === 'N') group.rotation.y = color === 'w' ? Math.PI : 0
      group.userData.aimY = bounds.getSize(new THREE.Vector3()).y * 17.4 * .83 + .068
      group.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) originals.add(material)
        node.material = color === 'w' ? white : black
        node.castShadow = node.receiveShadow = true
      })
      prototypes.set(color + kind, group)
    }
  }
  originals.forEach(material => material.dispose())
  return prototypes
}
