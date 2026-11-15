// The Marco Zero stage (Recife): the player's painting split in two. The buildings are a
// backdrop plane; the square's floor, with the big compass rose, was "unprojected" from the
// painting into a top-down texture (tools: camera estimated from the bollards and lamp posts),
// so the fighters stand on it in 3D and it keeps its perspective as the camera moves.
// The numbers below come from that estimate (metres, the fight line at z = 0).
import * as THREE from 'three';

const BACK = { w: 46.374, h: 17.002, z: -15.727 };
const FLOOR = { w: 28, d: 24.027, z: -4.014 };
const SHIFT = -1.704; // puts the compass rose's centre circle in the middle of the fight

function loadTex(url) {
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function petalTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32);
  g.fillStyle = '#ffd23f';
  for (let i = 0; i < 5; i++) { g.rotate((Math.PI * 2) / 5); g.beginPath(); g.ellipse(0, -12, 8, 13, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#e8902e'; g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildMarcoZero(arena) {
  const s = arena.scene;
  s.background = new THREE.Color(0x1f8ff0);
  s.fog = null;
  s.add(new THREE.HemisphereLight(0xffffff, 0xd8b890, 1.7));
  arena.sun.color.set(0xfff0d8);
  arena.sun.intensity = 2.4;

  // Sky above the painting, for tall screens.
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(BACK.w * 1.6, 40), new THREE.MeshBasicMaterial({ color: 0x1f8ff0 }));
  sky.position.set(SHIFT, BACK.h + 19.5, BACK.z - 0.1);
  s.add(sky);

  // Buildings, lamp posts and bunting: unlit, so the painting keeps its own light.
  const back = new THREE.Mesh(new THREE.PlaneGeometry(BACK.w, BACK.h),
    new THREE.MeshBasicMaterial({ map: loadTex('assets/stages/marcozero_back.webp') }));
  back.position.set(SHIFT, BACK.h / 2, BACK.z);
  s.add(back);

  // The square's floor with the compass rose, plus a shadow catcher for the fighters.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR.w, FLOOR.d),
    new THREE.MeshBasicMaterial({ map: loadTex('assets/stages/marcozero_floor.webp') }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(SHIFT, 0, FLOOR.z);
  s.add(floor);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR.w, FLOOR.d), new THREE.ShadowMaterial({ opacity: 0.28 }));
  shade.rotation.x = -Math.PI / 2;
  shade.position.set(0, 0.004, FLOOR.z);
  shade.receiveShadow = true;
  s.add(shade);

  // Yellow ipê flowers drifting down.
  const tex = petalTexture();
  arena.petals = [];
  for (let i = 0; i < 14; i++) {
    const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    p.scale.setScalar(0.12);
    p.userData = { x: -10 + Math.random() * 20, y: Math.random() * 6, z: -3 + Math.random() * 4, sp: 0.3 + Math.random() * 0.5, ph: Math.random() * 6 };
    s.add(p);
    arena.petals.push(p);
  }
}

export function updateMarcoZero(a, dt, T) {
  for (const p of a.petals) {
    const u = p.userData;
    u.y -= u.sp * dt * 0.6; u.x += Math.sin(T * 0.8 + u.ph) * dt * 0.4;
    if (u.y < 0.02) { u.y = 5 + Math.random() * 2; u.x = -10 + Math.random() * 20; }
    p.position.set(u.x, u.y, u.z);
    p.material.rotation = T * 1.5 + u.ph;
  }
}
