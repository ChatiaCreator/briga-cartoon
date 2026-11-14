// node tools/mixamo/strips.cjs outDir "clip|side|t0|t1" ...  → PNG strips of converted clips on Hotmonster.
const { chromium } = require('playwright');
const [out, ...jobs] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1560, height: 460 } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto('http://127.0.0.1:8765/tools/mixamo/preview.html');
  await p.waitForFunction('window.ready===true', null, { timeout: 120000 });
  for (const j of jobs) {
    const [clip, side, t0, t1, model] = j.split('|');
    const d = await p.evaluate(([m, c, s, a, z]) => window.strip(m, c, 12, s === 'side', +a || 0, z ? +z : null), [model || 'hotmonster.glb', clip, side, t0, t1]);
    await p.screenshot({ path: `${out}/mx_${clip}${side ? '_side' : ''}.png` });
    console.log(clip, d.toFixed(2));
  }
  await b.close();
})();
