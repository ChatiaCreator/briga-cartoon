// The Pet Shop stage: the painted shop front (assets/stages/petshop_wall.webp, the player's
// art with the sides mirrored so wide screens stay covered) as a backdrop, the street from
// the same picture as the floor, warm afternoon light and a few leaves drifting down.
import * as THREE from 'three';
import { glowTexture } from './textures.js';

const WALL_Z = -2.4;            // backdrop distance behind the fighters
const WALL_H = 6.8;             // shop door ~1.9 m tall next to the 1.8 m fighters
const WALL_W = WALL_H * 2472 / 776;

function loadTex(url, repeat = null) {
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

function leafTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32); g.rotate(0.6);
  g.fillStyle = '#7fbf3a'; g.beginPath(); g.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3f7a1d'; g.lineWidth = 3; g.beginPath(); g.moveTo(-24, 0); g.lineTo(24, 0); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildPetshop(arena) {
  const s = arena.scene;
  s.background = new THREE.Color(0x4a78e0);
  s.fog = new THREE.Fog(0x8fb4f0, 40, 90);
  s.add(new THREE.HemisphereLight(0xfff6e8, 0x8a6a55, 1.6));
  arena.sun.color.set(0xffe2b8);
  arena.sun.intensity = 2.6;

  // Sky behind everything (the picture's sky continues above it on tall screens).
  const skyC = document.createElement('canvas'); skyC.width = 4; skyC.height = 256;
  const sg = skyC.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#2f63d8'); gr.addColorStop(1, '#5e8ff0');
  sg.fillStyle = gr; sg.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyC); skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(160, 40), new THREE.MeshBasicMaterial({ map: skyTex, fog: false }));
  sky.position.set(0, WALL_H + 18, WALL_Z - 0.2);
  s.add(sky);

  // The shop front: unlit so it keeps the painting's own colours and light.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_H),
    new THREE.MeshBasicMaterial({ map: loadTex('assets/stages/petshop_wall.webp'), fog: false }));
  wall.position.set(0, WALL_H / 2 - 0.02, WALL_Z);
  s.add(wall);

  // Street: the asphalt of the picture, tiled, from the curb to past the camera.
  const depth = 26;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W + 20, depth),
    new THREE.MeshToonMaterial({ map: loadTex('assets/stages/petshop_road.webp', [(WALL_W + 20) / 9, depth / 2]) }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, WALL_Z + depth / 2);
  road.receiveShadow = true;
  s.add(road);
  // A soft shadow where the street meets the curb.
  const curb = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, 0.9),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(30,20,20,0.35)'), transparent: true, depthWrite: false }));
  curb.rotation.x = -Math.PI / 2; curb.position.set(0, 0.003, WALL_Z + 0.25); curb.scale.y = 0.6;
  s.add(curb);

  // Leaves from the tree drifting across the street.
  const leafTex = leafTexture();
  arena.leaves = [];
  for (let i = 0; i < 10; i++) {
    const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: leafTex, transparent: true, depthWrite: false }));
    l.scale.setScalar(0.18);
    l.userData = { x: -12 + Math.random() * 24, y: 1 + Math.random() * 5, z: -2 + Math.random() * 3, sp: 0.4 + Math.random() * 0.6, ph: Math.random() * 6 };
    s.add(l);
    arena.leaves.push(l);
  }
}

export function updatePetshop(a, dt, T) {
  for (const l of a.leaves) {
    const u = l.userData;
    u.x += u.sp * dt * 0.8;
    u.y -= u.sp * dt * 0.5;
    if (u.y < 0.05 || u.x > 13) { u.x = -13 + Math.random() * 6; u.y = 4 + Math.random() * 3; }
    l.position.set(u.x + Math.sin(T * 1.5 + u.ph) * 0.3, u.y, u.z);
    l.material.rotation = Math.sin(T * 2 + u.ph) * 1.2;
  }
}
