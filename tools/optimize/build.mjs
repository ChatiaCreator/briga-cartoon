// Builds the light game assets from the source models in tools/models_src:
//   assets/models/<fighter>.glb  mesh + skeleton only (textures resized to WebP, meshopt geometry)
//   assets/models/anims.glb      every animation (each model's own clips as "<model>:<clip>",
//                                 Mixamo and extra clips as "mixamo:<clip>"), resampled + meshopt.
// Usage: cd tools/optimize && npm install && node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'tools/models_src');
const OUT = path.join(ROOT, 'assets/models');
const FIGHTERS = ['hotmonster', 'flash', 'genildo', 'anderon', 'hgl', 'davidson'];

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const kb = (f) => `${(fs.statSync(f).size / 1024).toFixed(0)} KB`;

// ---- Fighters ----
for (const name of FIGHTERS) {
  const doc = await io.read(path.join(SRC, `${name}.glb`));
  for (const a of doc.getRoot().listAnimations()) a.dispose();
  await doc.transform(
    prune(), dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 85 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const out = path.join(OUT, `${name}.glb`);
  await io.write(out, doc);
  console.log(name.padEnd(12), kb(path.join(SRC, `${name}.glb`)), '->', kb(out));
}

// ---- Animations ----
// flash_anims.glb: the first Flash model, kept for its own clips (the current flash.glb has none).
// Base: Hotmonster's bare node tree (also the reference rig for retargeting).
const base = await io.read(path.join(SRC, 'hotmonster.glb'));
const root = base.getRoot();
for (const m of root.listMeshes()) m.dispose();
for (const s of root.listSkins()) s.dispose();
for (const m of root.listMaterials()) m.dispose();
for (const t of root.listTextures()) t.dispose();
const nodeByName = new Map(root.listNodes().map((n) => [n.getName(), n]));
const buffer = root.listBuffers()[0];
function copyAccessor(acc, arr = null) {
  return base.createAccessor().setType(acc.getType()).setArray(arr || acc.getArray().slice()).setBuffer(buffer)
    .setNormalized(acc.getNormalized());
}
// Only clips the game actually names in its code are kept.
const code = ['poses.js', 'character.js', 'view.js'].map((f) => fs.readFileSync(path.join(ROOT, 'src/render', f), 'utf8')).join('\n')
  + fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
const used = (name) => code.includes(`'${name}'`) || code.includes(`"${name}"`);
// Long clips cut down to the parts the game plays: windows [from, to] (s) laid end to end with
// a 0.1 s gap. Keep src/render/poses.js in step with the new times.
const SPLICE = { Talking_On_A_Cell_Phone: [[0, 7.8], [34.4, 36.6]], Smoking: [[0, 9.3]] };
function splice(times, values, size, windows) {
  const t = [], v = [];
  let offset = 0;
  for (const [a, b] of windows) {
    for (let i = 0; i < times.length; i++) {
      if (times[i] < a || times[i] > b) continue;
      t.push(times[i] - a + offset);
      for (let k = 0; k < size; k++) v.push(values[i * size + k]);
    }
    offset += b - a + 0.1;
  }
  return [new Float32Array(t), new Float32Array(v)];
}
// The game only plays bone rotations, plus the hips position (no scale, no other offsets).
const keepChannel = (node, p) => p === 'rotation' || (p === 'translation' && /Hips$/.test(node.getName()));
for (const a of root.listAnimations()) {
  if (!used(a.getName())) { a.dispose(); continue; }
  a.setName(`hotmonster:${a.getName()}`);
  for (const ch of a.listChannels()) if (!keepChannel(ch.getTargetNode(), ch.getTargetPath())) ch.dispose();
}

const sources = [['flash_anims', 'flash'], ['anderon', 'anderon'], ['hgl', 'hgl'], ['davidson', 'davidson'], ['extra_anims', 'mixamo'], ['mixamo_anims', 'mixamo']];
// Licensed pack clips (not in git): included when the file is present.
if (fs.existsSync(path.join(SRC, 'motifect_anims.glb'))) sources.push(['motifect_anims', 'mixamo']);
for (const [file, prefix] of sources) {
  const doc = await io.read(path.join(SRC, `${file}.glb`));
  for (const a of doc.getRoot().listAnimations()) {
    if (!used(a.getName())) continue;
    const na = base.createAnimation(`${prefix}:${a.getName()}`);
    const samplers = new Map();
    for (const ch of a.listChannels()) {
      const target = ch.getTargetNode() && nodeByName.get(ch.getTargetNode().getName());
      if (!target || !keepChannel(target, ch.getTargetPath())) continue;
      const s = ch.getSampler();
      if (!samplers.has(s)) {
        let input = null, output = null;
        const win = SPLICE[a.getName()];
        if (win) [input, output] = splice(s.getInput().getArray(), s.getOutput().getArray(), s.getOutput().getElementSize(), win);
        samplers.set(s, base.createAnimationSampler().setInterpolation(s.getInterpolation())
          .setInput(copyAccessor(s.getInput(), input)).setOutput(copyAccessor(s.getOutput(), output)));
        na.addSampler(samplers.get(s));
      }
      na.addChannel(base.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(samplers.get(s)));
    }
  }
}
await base.transform(resample({ tolerance: 0.002 }));
// Rotations as 16-bit normalized quaternions (allowed by core glTF for rotation outputs).
for (const a of root.listAnimations()) {
  for (const ch of a.listChannels()) {
    if (ch.getTargetPath() !== 'rotation') continue;
    const out = ch.getSampler().getOutput();
    if (out.getComponentType() !== 5126) continue;
    const f = out.getArray(), q = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, f[i])) * 32767);
    ch.getSampler().setOutput(base.createAccessor().setType('VEC4').setArray(q).setNormalized(true).setBuffer(buffer));
  }
}
await base.transform(prune({ keepLeaves: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const animOut = path.join(OUT, 'anims.glb');
await io.write(animOut, base);
const srcAnim = ['hotmonster', 'flash_anims', 'anderon', 'hgl', 'extra_anims', 'mixamo_anims'];
console.log('anims'.padEnd(12), root.listAnimations().length, 'clips ->', kb(animOut));
