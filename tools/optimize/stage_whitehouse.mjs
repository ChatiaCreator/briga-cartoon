// Builds the White House stage (Trump's boss stage) from the painting tools/stages_src/whitehouse.png:
//   assets/stages/whitehouse_back.webp   the painting down to the curb, sides mirrored for wide screens
//   assets/stages/whitehouse_floor.webp  the plaza seen from above (unprojected from the painting)
// Usage: cd tools/optimize && node stage_whitehouse.mjs
//
// The plaza is read as a floor seen by a camera looking straight ahead: its tile lines meet at the
// vanishing point (CX, HORIZON) and the "FIGHT FRIENDS" badge has the proportions of a badge seen
// from above with a focal length of F px. A floor point at depth D in front of that camera shows up
// at y = HORIZON + FH / D, x = CX + F * X / D. The badge (EMBLEM_Y) lands on the fight line (z = 0),
// the curb (CURB_Y) EMBLEM_TO_CURB metres behind it. The backdrop stands further back than the
// curb (so the whole house fits the camera): from there up to STRETCH_TO the floor is the strip of
// plaza next to the curb, stretched in depth (the lights' reflections on the wet stone just get
// longer). Towards the camera, and sideways past the painting, the plaza is mirrored.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'tools/stages_src/whitehouse.png');
const OUT = path.join(ROOT, 'assets/stages');

const CX = 836, HORIZON = 590, F = 730;
const CURB_Y = 716, EMBLEM_Y = 800, BOTTOM_Y = 940;
const EMBLEM_TO_CURB = 4.5;
const FH = EMBLEM_TO_CURB / (1 / (CURB_Y - HORIZON) - 1 / (EMBLEM_Y - HORIZON));
const ZCAM = FH / (EMBLEM_Y - HORIZON);           // painting camera, metres in front of the fight line
// Floor texture: X in [-W/2, W/2], Z from Z0 (far, under the backdrop) to Z0 + DEPTH. Keep the
// numbers in src/render/whitehouse.js (FLOOR) in step.
const W = 28, DEPTH = 21, Z0 = -12.3, PX_PER_M = 80;
const BACK_SIDE = 400;                            // px mirrored onto each side of the backdrop

const img = sharp(SRC);
const { width: IW, height: IH } = await img.metadata();
const src = await img.removeAlpha().raw().toBuffer();

// Backdrop: rows 0..CURB_Y, with BACK_SIDE mirrored columns added on each side.
{
  const h = CURB_Y, w = IW + 2 * BACK_SIDE, out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sx = x - BACK_SIDE;
      if (sx < 0) sx = -sx - 1; else if (sx >= IW) sx = 2 * IW - sx - 1;
      src.copy(out, (y * w + x) * 3, (y * IW + sx) * 3, (y * IW + sx) * 3 + 3);
    }
  }
  await sharp(out, { raw: { width: w, height: h, channels: 3 } }).webp({ quality: 86 }).toFile(path.join(OUT, 'whitehouse_back.webp'));
  console.log('whitehouse_back.webp', w + 'x' + h);
}

// Floor.
{
  const zFar = ZCAM - FH / (CURB_Y + 6 - HORIZON);  // a few px past the curb stone
  const zNear = ZCAM - FH / (BOTTOM_Y - HORIZON);
  // The badge spans about z -1.8..1.4; the row of floor lamps sits at z 2.1..2.4. Past the painting's
  // bottom edge, a plain strip of stone between the two (NEAR_BAND) is mirrored back and forth.
  const STRETCH_TO = -2.6, NEAR_BAND = [1.45, 2.0];
  const plazaZ = (Z) => {
    if (Z < STRETCH_TO) return zFar + ((Z - Z0) / (STRETCH_TO - Z0)) * (STRETCH_TO - zFar);
    if (Z > zNear) return mirror(NEAR_BAND[0] + (Z - zNear), NEAR_BAND[0], NEAR_BAND[1]);
    return Z;
  };
  const mirror = (v, a, b) => { const L = b - a; let t = (v - a) % (2 * L); if (t < 0) t += 2 * L; return a + (t > L ? 2 * L - t : t); };
  const sample = (x, y, o, out) => {
    x = Math.max(0, Math.min(IW - 1.001, x)); y = Math.max(0, Math.min(IH - 1.001, y));
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    for (let c = 0; c < 3; c++) {
      const p = (yy, xx) => src[(yy * IW + xx) * 3 + c];
      const v = (p(y0, x0) * (1 - fx) + p(y0, x0 + 1) * fx) * (1 - fy) + (p(y0 + 1, x0) * (1 - fx) + p(y0 + 1, x0 + 1) * fx) * fy;
      out[o + c] = Math.round(v);
    }
  };
  const w = W * PX_PER_M, h = DEPTH * PX_PER_M, out = Buffer.alloc(w * h * 3);
  for (let j = 0; j < h; j++) {
    const Z = plazaZ(Z0 + (j + 0.5) / PX_PER_M);
    const D = ZCAM - Z;
    const y = HORIZON + FH / D;
    const halfX = (CX * D) / F;                     // painted half-width at this depth (m)
    for (let i = 0; i < w; i++) {
      const X = mirror(-W / 2 + (i + 0.5) / PX_PER_M, -halfX, halfX);
      sample(CX + (F * X) / D, y, (j * w + i) * 3, out);
    }
  }
  await sharp(out, { raw: { width: w, height: h, channels: 3 } }).webp({ quality: 84 }).toFile(path.join(OUT, 'whitehouse_floor.webp'));
  console.log('whitehouse_floor.webp', w + 'x' + h, `painted plaza z ${zFar.toFixed(2)}..${zNear.toFixed(2)} m, badge at z 0`);
}
for (const f of ['whitehouse_back.webp', 'whitehouse_floor.webp']) console.log(f, (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0), 'KB');
