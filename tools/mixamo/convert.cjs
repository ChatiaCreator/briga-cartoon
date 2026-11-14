// Converts Mixamo .fbx animations (downloaded "Without Skin") into assets/models/mixamo_anims.glb,
// retargeted to the fighters' skeleton. Usage: node tools/mixamo/convert.cjs  (needs the local
// server on :8765 and Playwright). Clip names come from the file names in tools/mixamo/in/.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '../..');
const IN = path.join(__dirname, 'in');
const OUT = path.join(ROOT, 'assets/models/mixamo_anims.glb');

function readGlbJson(file) {
  const b = fs.readFileSync(file);
  return JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)));
}

(async () => {
  const files = fs.readdirSync(IN).filter((f) => f.toLowerCase().endsWith('.fbx')).sort();
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto('http://127.0.0.1:8765/tools/mixamo/convert.html');
  await p.waitForFunction('window.ready===true', null, { timeout: 60000 });
  const clips = [];
  for (const f of files) {
    const r = await p.evaluate((u) => window.convert(u), 'in/' + f);
    clips.push({ name: f.replace(/\.fbx$/i, ''), ...r });
    console.log(f, r.duration.toFixed(2) + 's', Object.keys(r.rot).length, 'bones');
  }
  await b.close();

  // GLB with the fighters' bare node tree and one animation per clip.
  const src = readGlbJson(path.join(ROOT, 'assets/models/hotmonster.glb'));
  const nodes = src.nodes.map((n) => { const m = { ...n }; delete m.mesh; delete m.skin; return m; });
  const clean = (n) => (n || '').replace(/^mixamorig[:_]?/, '');
  const index = new Map(nodes.map((n, i) => [clean(n.name), i]));
  const chunks = [], accessors = [], bufferViews = []; let off = 0;
  const add = (arr, type, minmax) => {
    const buf = Buffer.from(new Float32Array(arr).buffer);
    chunks.push(buf); bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length }); off += buf.length;
    const comps = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type];
    const a = { bufferView: bufferViews.length - 1, componentType: 5126, count: arr.length / comps, type };
    if (minmax) { a.min = [Math.min(...arr)]; a.max = [Math.max(...arr)]; }
    accessors.push(a); return accessors.length - 1;
  };
  const animations = clips.map((c) => {
    const input = add(c.times, 'SCALAR', true);
    const samplers = [], channels = [];
    for (const [bone, vals] of Object.entries(c.rot)) {
      if (!index.has(bone)) continue;
      samplers.push({ input, output: add(vals, 'VEC4'), interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: index.get(bone), path: 'rotation' } });
    }
    samplers.push({ input, output: add(c.hipsPos, 'VEC3'), interpolation: 'LINEAR' });
    channels.push({ sampler: samplers.length - 1, target: { node: index.get('Hips'), path: 'translation' } });
    return { name: c.name, samplers, channels };
  });
  const json = { asset: { version: '2.0', generator: 'briga mixamo convert' }, scene: 0, scenes: src.scenes, nodes, animations, accessors, bufferViews, buffers: [{ byteLength: off }] };
  let js = Buffer.from(JSON.stringify(json)); while (js.length % 4) js = Buffer.concat([js, Buffer.from(' ')]);
  const bin = Buffer.concat(chunks);
  const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const ch = (len, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(len, 0); h.write(type, 4); return h; };
  fs.writeFileSync(OUT, Buffer.concat([head, ch(js.length, 'JSON'), js, ch(bin.length, 'BIN\0'), bin]));
  console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes,', animations.length, 'clips');
})();
