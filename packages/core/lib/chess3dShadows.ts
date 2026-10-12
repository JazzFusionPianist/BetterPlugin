import * as THREE from 'three'

// iOS depth-comparison samplers can shadow the entire lit board. Compare
// ordinary depth samples in GLSL instead, keeping soft edges on every host.
const depthComparison = /float depth = texture2D\( shadowMap, shadowCoord\.xy \)\.r;\s*#ifdef USE_REVERSED_DEPTH_BUFFER\s*shadow = step\( depth, shadowCoord\.z \);\s*#else\s*shadow = step\( shadowCoord\.z, depth \);\s*#endif/
const softComparison = `shadow = 0.0;
                vec2 offset = vec2( max( 0.5, shadowRadius * 0.5 ) ) / shadowMapSize;
                for ( int y = -1; y <= 1; y ++ ) {
                    for ( int x = -1; x <= 1; x ++ ) {
                        float depth = texture2D( shadowMap, shadowCoord.xy + vec2( float( x ), float( y ) ) * offset ).r;
                        #ifdef USE_REVERSED_DEPTH_BUFFER
                            shadow += step( depth, shadowCoord.z );
                        #else
                            shadow += step( shadowCoord.z, depth );
                        #endif
                    }
                }
                shadow /= 9.0;`
const shadowChunk = THREE.ShaderChunk.shadowmap_pars_fragment.replace(depthComparison, softComparison)
const configured = new WeakSet<THREE.Material>()

export function configureChessShadows(renderer: THREE.WebGLRenderer, materials: THREE.Material[]) {
  renderer.shadowMap.type = THREE.BasicShadowMap
  for (const material of materials) {
    if (!(material instanceof THREE.MeshStandardMaterial) || configured.has(material)) continue
    configured.add(material)
    const previousCompile = material.onBeforeCompile
    const previousKey = material.customProgramCacheKey
    material.onBeforeCompile = (shader, currentRenderer) => {
      previousCompile.call(material, shader, currentRenderer)
      shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>', shadowChunk)
    }
    material.customProgramCacheKey = () => `${previousKey.call(material)}|slur-software-pcf-v1`
    material.needsUpdate = true
  }
  renderer.shadowMap.needsUpdate = true
}
