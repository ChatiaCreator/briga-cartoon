// The Brasília stage: the player's painting of a fight stage in front of the Congress, split
// like the Marco Zero one: the backdrop is a plane and the floor (the star with the "Ordem e
// Progresso" globe) was unprojected from the painting into a top-down texture, with plain
// tiles where the painting ends. Metres; the fight line at z = 0.
import * as THREE from 'three';

// The backdrop is drawn smaller and further than the floor's scale so the whole scene (the
// Congress, the VIP box) fits the camera; its sides are mirrored copies of the painting's edges.
const BACK = { h: 8.6, z: -10.6 };
BACK.w = BACK.h * 2472 / 739;
const FLOOR = { w: 28, d: 18.9, z: -1.45 };
const SHIFT = 0.14;

function loadTex(url) {
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildBrasilia(arena) {
  const s = arena.scene;
  s.background = new THREE.Color(0x3a2a7a);
  s.fog = null;
  s.add(new THREE.HemisphereLight(0xffffff, 0x9a86c8, 1.7));
  arena.sun.color.set(0xfff0e0);
  arena.sun.intensity = 2.4;
  // Truss colour above the painting, for tall screens.
  const top = new THREE.Mesh(new THREE.PlaneGeometry(BACK.w * 1.6, 30), new THREE.MeshBasicMaterial({ color: 0x3a2a7a }));
  top.position.set(SHIFT, BACK.h + 14.9, BACK.z - 0.1);
  s.add(top);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(BACK.w, BACK.h),
    new THREE.MeshBasicMaterial({ map: loadTex('assets/stages/brasilia_back.webp') }));
  back.position.set(SHIFT, BACK.h / 2, BACK.z);
  s.add(back);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR.w, FLOOR.d),
    new THREE.MeshBasicMaterial({ map: loadTex('assets/stages/brasilia_floor.webp') }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(SHIFT, 0, FLOOR.z);
  s.add(floor);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR.w, FLOOR.d), new THREE.ShadowMaterial({ opacity: 0.3 }));
  shade.rotation.x = -Math.PI / 2;
  shade.position.set(SHIFT, 0.004, FLOOR.z);
  shade.receiveShadow = true;
  s.add(shade);
  // Green and yellow confetti over the stage.
  arena.confetti = [];
  const colors = [0x1fa84a, 0xffd23f, 0x2a5bd7, 0xffffff];
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.11), new THREE.MeshBasicMaterial({ color: colors[i % 4], side: THREE.DoubleSide }));
    c.userData = { x: -8 + Math.random() * 16, y: Math.random() * 6, z: -4 + Math.random() * 5, sp: 0.5 + Math.random() * 0.6, ph: Math.random() * 6 };
    s.add(c);
    arena.confetti.push(c);
  }
}

export function updateBrasilia(a, dt, T) {
  for (const c of a.confetti) {
    const u = c.userData;
    u.y -= u.sp * dt * 0.7; u.x += Math.sin(T * 1.3 + u.ph) * dt * 0.5;
    if (u.y < 0.02) { u.y = 6 + Math.random() * 2; u.x = -8 + Math.random() * 16; }
    c.position.set(u.x, u.y, u.z);
    c.rotation.set(T * 3 + u.ph, T * 2 + u.ph, 0);
  }
}
