// The White House: Trump's boss stage, from the player's painting (tools/stages_src/whitehouse.png)
// split like the Brasília one by tools/optimize/stage_whitehouse.mjs: the house behind the fence
// is a backdrop plane, and the wet plaza with the "FIGHT FRIENDS" badge was unprojected from the
// painting into a top-down floor (the badge lies on the fight line). A night storm: rain, lightning
// flashes over the whole scene and thunder, and the painting's red and blue spotlights on the
// fighters. Metres; the fight line at z = 0.
import * as THREE from 'three';
import { sfx } from '../audio.js';

// Drawn further and smaller than the floor's scale so the whole house, the flag and the lightning
// fit the camera; its sides are mirrored copies of the painting's edges.
const BACK = { h: 7.0, z: -12 };
BACK.w = BACK.h * 2472 / 716;
// Keep in step with tools/optimize/stage_whitehouse.mjs (W, DEPTH, Z0).
const FLOOR = { w: 28, d: 21, z: -12.3 + 21 / 2 };
const RAIN = 220;

function loadTex(url) {
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildWhitehouse(arena) {
  const s = arena.scene;
  s.background = new THREE.Color(0x1d1f4a);
  s.fog = null;
  const hemi = new THREE.HemisphereLight(0xc4c8ff, 0x3a2a5a, 1.35);
  s.add(hemi);
  arena.sun.color.set(0xd6dcff); // moonlight
  arena.sun.intensity = 1.9;
  // The painting's spotlights: red from the left, blue from the right, warm lamps in front.
  const red = new THREE.PointLight(0xff3344, 14, 14, 1.6); red.position.set(-6.5, 1.6, -2.5);
  const blue = new THREE.PointLight(0x3a6bff, 14, 14, 1.6); blue.position.set(6.5, 1.6, -2.5);
  const warm = new THREE.PointLight(0xffc77a, 6, 12, 1.6); warm.position.set(0, 3.2, 4);
  s.add(red, blue, warm);

  // Storm sky above the painting, for tall screens.
  const top = new THREE.Mesh(new THREE.PlaneGeometry(BACK.w * 1.6, 30), new THREE.MeshBasicMaterial({ color: 0x1d1f4a }));
  top.position.set(0, BACK.h + 14.9, BACK.z - 0.1);
  s.add(top);
  const backMat = new THREE.MeshBasicMaterial({ map: loadTex('assets/stages/whitehouse_back.webp') });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(BACK.w, BACK.h), backMat);
  back.position.set(0, BACK.h / 2, BACK.z);
  s.add(back);
  // Lightning: a white sheet over the sky that flashes.
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(BACK.w * 1.6, BACK.h + 30),
    new THREE.MeshBasicMaterial({ color: 0xdfe4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.position.set(0, (BACK.h + 30) / 2, BACK.z + 0.05);
  s.add(flash);

  const floorMat = new THREE.MeshBasicMaterial({ map: loadTex('assets/stages/whitehouse_floor.webp') });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR.w, FLOOR.d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, FLOOR.z);
  s.add(floor);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR.w, FLOOR.d), new THREE.ShadowMaterial({ opacity: 0.32 }));
  shade.rotation.x = -Math.PI / 2;
  shade.position.set(0, 0.004, FLOOR.z);
  shade.receiveShadow = true;
  s.add(shade);

  // Rain: thin streaks falling at a slant over the stage.
  const pos = new Float32Array(RAIN * 6);
  const drops = [];
  for (let i = 0; i < RAIN; i++) drops.push({ x: -11 + Math.random() * 22, y: Math.random() * 8, z: -6 + Math.random() * 12, sp: 9 + Math.random() * 4 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaab8ff, transparent: true, opacity: 0.35, depthWrite: false }));
  rain.frustumCulled = false;
  s.add(rain);

  arena.wh = { hemi, red, blue, flash, backMat, floorMat, drops, pos, geo, next: 3 + Math.random() * 4, bolt: -1 };
}

export function updateWhitehouse(a, dt, T) {
  const w = a.wh;
  // Lightning: every few seconds a double flash (sky sheet, the painting and the lights brighten),
  // then thunder.
  w.next -= dt;
  if (w.next <= 0) { w.bolt = 0; w.next = 5 + Math.random() * 7; w.thunder = 0.35 + Math.random() * 0.5; }
  let k = 0;
  if (w.bolt >= 0) {
    w.bolt += dt;
    const t = w.bolt;
    k = Math.max(0, 1 - t / 0.09) + (t > 0.16 ? Math.max(0, 0.7 - (t - 0.16) / 0.25) : 0);
    if (t > 0.6) w.bolt = -1;
  }
  if (w.thunder != null) { w.thunder -= dt; if (w.thunder <= 0) { w.thunder = null; sfx('thunder'); } }
  w.flash.material.opacity = 0.32 * k;
  w.hemi.intensity = 1.35 + 2.2 * k;
  a.sun.intensity = 1.9 + 2.5 * k;
  // The spotlights sway a little, like the painting's beams.
  w.red.intensity = 14 + Math.sin(T * 1.3) * 2;
  w.blue.intensity = 14 + Math.sin(T * 1.1 + 2) * 2;
  // Rain.
  const p = w.pos;
  for (let i = 0; i < w.drops.length; i++) {
    const d = w.drops[i];
    d.y -= d.sp * dt; d.x += d.sp * 0.12 * dt;
    if (d.y < 0) { d.y = 7 + Math.random() * 2; d.x = -11 + Math.random() * 22; }
    const o = i * 6;
    p[o] = d.x; p[o + 1] = d.y; p[o + 2] = d.z;
    p[o + 3] = d.x - 0.04; p[o + 4] = d.y + 0.35; p[o + 5] = d.z;
  }
  w.geo.attributes.position.needsUpdate = true;
}
