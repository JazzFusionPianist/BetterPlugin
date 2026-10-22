// node tools/yamnet-make.mjs — the room's ear for what a sound is (ui/yamnet.js), made small for the app.
// Reads YAMNet as Google published it for the web (./yamnet.sh fetches it into build.noindex/yamnet-src: Apache 2.0 — a
// MobileNet that hears 0.96 s of sound at a time and says which of AudioSet's 521 kinds of sound it is: bass guitar,
// snare drum, singing, trumpet…) and writes ui/yamnet/ (not kept in git — ./yamnet.sh makes it):
//   model.bin    its fourteen layers and the last, as int8 rows (a scale an output channel), the biases and the mel
//                filters float32; its head says where each is
//   classes.json the 521 kinds, by name
//   README       where it came from, and its licence
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const DAW = join(dirname(fileURLToPath(import.meta.url)), '..'), SRC = process.env.YAMNET_SRC || join(DAW, 'build.noindex/yamnet-src'), OUT = join(DAW, 'ui/yamnet')
if (!existsSync(join(SRC, 'tfjs/model.json'))) { console.error('no model: ./yamnet.sh fetches it'); process.exit(1) }
const M = JSON.parse(readFileSync(join(SRC, 'tfjs/model.json'), 'utf8'))
const bin = Buffer.concat(M.weightsManifest[0].paths.map(p => readFileSync(join(SRC, 'tfjs', p))))
const at = {}
{ let off = 0; for (const w of M.weightsManifest.flatMap(g => g.weights)) { const n = w.shape.reduce((a, b) => a * b, 1); at[w.name] = { off, shape: w.shape, dtype: w.dtype, n }; off += n * 4 } }
const P = 'StatefulPartitionedCall/yamnet_frames/'
const f32 = name => { const w = at[name]; if (!w) throw new Error('no weight ' + name); return new Float32Array(bin.buffer.slice(bin.byteOffset + w.off, bin.byteOffset + w.off + w.n * 4)) }
/* the layers, as the graph lays them out: a 3×3 convolution, then thirteen pairs of a 3×3 depthwise and a 1×1 pointwise
   convolution (batch norm folded into each, a bias after, then relu); strides as the graph says them */
const node = n => M.modelTopology.node.find(x => x.name === P + n)
const stride = n => +node(n).attr.strides.list.i[1]
const parts = [], head = { src: 'google/yamnet tfjs 1', rate: 16000, win: 400, hop: 160, fft: 512, mel: 64, patch: 96, patchHop: 48, logOffset: 0, layers: [], tensors: [] }
let off = 0
const put = (name, dtype, shape, bytes) => { head.tensors.push({ name, dtype, shape, offset: off }); parts.push(bytes); off += bytes.length; const pad = (4 - off % 4) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad } }
const putF = (name, shape, f) => put(name, 'f32', shape, Buffer.from(new Float32Array(f).buffer))
/* int8 with a scale for each output channel (the last axis of a tensorflow kernel): stored channel by channel */
const putQ = (name, shape, f) => {
  const outC = shape[shape.length - 1], per = f.length / outC, sc = new Float32Array(outC), q = new Int8Array(f.length)
  for (let o = 0; o < outC; o++) { let m = 0; for (let i = 0; i < per; i++) m = Math.max(m, Math.abs(f[i * outC + o])); sc[o] = m / 127 || 1 }
  for (let o = 0; o < outC; o++) for (let i = 0; i < per; i++) q[o * per + i] = Math.round(f[i * outC + o] / sc[o])      // (laid out by output channel: each a row)
  put(name, 'i8', shape, Buffer.concat([Buffer.from(sc.buffer), Buffer.from(q.buffer)]))
}
head.logOffset = f32(P + 'tf_op_layer_AddV2_9/AddV2_9/y')[0]
putF('window', [400], f32(P + 'tf_op_layer_Mul_9/Mul_9/y'))
putF('mel', [257, 64], f32(P + 'tf_op_layer_MatMul_3/MatMul_3/b'))
putQ('l1.w', [3, 3, 1, 32], f32(P + 'layer1/conv/Conv2D_weights')); putF('l1.b', [32], f32(P + 'layer1/conv/Conv2D_bn_offset'))
head.layers.push({ kind: 'conv', stride: stride('layer1/relu/Relu'), out: 32 })
for (let L = 2; L <= 14; L++) {
  const dw = f32(P + `layer${L}/depthwise_conv/depthwise_weights`), pw = f32(P + `layer${L}/pointwise_conv/Conv2D_weights`), [, , cin, cout] = at[P + `layer${L}/pointwise_conv/Conv2D_weights`].shape
  putQ(`l${L}.dw`, [9, cin], dw)      // (3×3 by channel, as tensorflow keeps it: the channel last)
  putF(`l${L}.db`, [cin], f32(P + `layer${L}/depthwise_conv/depthwise_bn_offset`))
  putQ(`l${L}.pw`, [cin, cout], pw); putF(`l${L}.pb`, [cout], f32(P + `layer${L}/pointwise_conv/Conv2D_bn_offset`))
  head.layers.push({ kind: 'sep', stride: stride(`layer${L}/depthwise_conv/depthwise`), in: cin, out: cout })
}
putQ('fc.w', [1024, 521], f32('unknown_134')); putF('fc.b', [521], f32('unknown_135'))
mkdirSync(OUT, { recursive: true })
const hj = Buffer.from(JSON.stringify(head)), pad = (4 - (4 + hj.length) % 4) % 4, hb = Buffer.concat([hj, Buffer.alloc(pad, 32)]), hl = Buffer.alloc(4); hl.writeUInt32LE(hb.length)
writeFileSync(join(OUT, 'model.bin'), Buffer.concat([hl, hb, ...parts]))
const classes = readFileSync(join(SRC, 'class_map.csv'), 'utf8').trim().split(/\r?\n/).slice(1).map(l => { const m = l.trim().match(/^(\d+),[^,]+,(.*)$/); return m[2].replace(/^"|"$/g, '') })
writeFileSync(join(OUT, 'classes.json'), JSON.stringify(classes))
writeFileSync(join(OUT, 'README'), 'The room\'s ear for what a sound is (ui/yamnet.js): YAMNet, by Google (https://tfhub.dev/google/yamnet/1, the tfjs version),\nthe Apache License 2.0 — its weights cut down to int8 by tools/yamnet-make.mjs. Classes: AudioSet (CC BY 4.0, Google).\n')
console.log(`model.bin: ${((4 + hb.length + off) / 1e6).toFixed(1)} MB, ${head.layers.length} layers, ${classes.length} classes, log offset ${head.logOffset}`)
