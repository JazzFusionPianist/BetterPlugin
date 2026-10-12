import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from '../../packages/core/node_modules/three/build/three.module.js'
import { configureChessShadows } from '../../packages/core/lib/chess3dShadows.ts'

test('portable shadows use ordinary depth samples with a soft nine-tap filter', () => {
  const renderer = { shadowMap: {} }
  const material = new THREE.MeshPhysicalMaterial()
  configureChessShadows(renderer, [material])
  assert.equal(renderer.shadowMap.type, THREE.BasicShadowMap)
  assert.equal(renderer.shadowMap.needsUpdate, true)
  const shader = { fragmentShader: '#include <shadowmap_pars_fragment>' }
  material.onBeforeCompile(shader, renderer)
  assert(shader.fragmentShader.includes('shadow /= 9.0;'), 'Pinned Three shader chunk is successfully patched')
  assert(shader.fragmentShader.includes('step( shadowCoord.z, depth )'))
  material.dispose()
})

test('existing chair customization is preserved and initialization is idempotent', () => {
  const renderer = { shadowMap: {} }
  const material = new THREE.MeshStandardMaterial()
  let calls = 0
  material.onBeforeCompile = shader => { calls++; shader.fragmentShader += '\n// chair tint' }
  material.customProgramCacheKey = () => 'chair'
  configureChessShadows(renderer, [material])
  const compile = material.onBeforeCompile
  configureChessShadows(renderer, [material])
  assert.equal(material.onBeforeCompile, compile)
  const shader = { fragmentShader: '#include <shadowmap_pars_fragment>' }
  material.onBeforeCompile(shader, renderer)
  assert.equal(calls, 1)
  assert(shader.fragmentShader.endsWith('// chair tint'))
  assert.equal(material.customProgramCacheKey(), 'chair|slur-software-pcf-v1')
  material.dispose()
})
