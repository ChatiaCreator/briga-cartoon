// Turns a drawn portrait on a flat background into a game portrait: the background (flood-filled
// from the borders, stopped by the drawing's black outline) becomes transparent, then 512x512 WebP.
// Usage: cd tools/optimize && node portrait_cutout.mjs <in.png> <out.webp> [tolerance]
import sharp from 'sharp';
const [inp, out, tolArg] = process.argv.slice(2);
const TOL = Number(tolArg || 34);
const { data, info } = await sharp(inp).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, px = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
// Background colour: the median of the border pixels.
const border = [];
for (let x = 0; x < W; x++) border.push(px(x), px((H - 1) * W + x));
for (let y = 0; y < H; y++) border.push(px(y * W), px(y * W + W - 1));
const med = [0, 1, 2].map((c) => border.map((p) => p[c]).sort((a, b) => a - b)[border.length >> 1]);
const dist = (i) => { const p = px(i); return Math.hypot(p[0] - med[0], p[1] - med[1], p[2] - med[2]); };
const bg = new Uint8Array(W * H), stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const i = stack.pop();
  if (bg[i] || dist(i) > TOL) continue;
  bg[i] = 1;
  const x = i % W, y = (i / W) | 0;
  if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1);
  if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W);
}
// Alpha with a soft 1-px edge (background pixels next to the figure get half alpha).
const rgba = Buffer.alloc(W * H * 4);
let kept = 0;
for (let i = 0; i < W * H; i++) {
  rgba[i * 4] = data[i * 3]; rgba[i * 4 + 1] = data[i * 3 + 1]; rgba[i * 4 + 2] = data[i * 3 + 2];
  let a = bg[i] ? 0 : 255;
  if (bg[i]) {
    const x = i % W, y = (i / W) | 0;
    const near = (x > 0 && !bg[i - 1]) || (x < W - 1 && !bg[i + 1]) || (y > 0 && !bg[i - W]) || (y < H - 1 && !bg[i + W]);
    if (near) a = 110;
  } else kept++;
  rgba[i * 4 + 3] = a;
}
await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).resize(512, 512).webp({ quality: 88, alphaQuality: 90 }).toFile(out);
console.log('background', med.join(','), '| figure', (100 * kept / (W * H)).toFixed(1) + '% of the picture ->', out);
