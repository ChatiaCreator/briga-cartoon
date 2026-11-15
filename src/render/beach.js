// The beach stage: sand, animated sea, palm trees, umbrellas, a kiosk, a lifeguard tower,
// seagulls and a little plane towing an ad banner. Everything is drawn in code.
import * as THREE from 'three';
import { glowTexture, billboardTexture } from './textures.js';
import { WALL } from '../sim/fighter.js';

function canvas(w, h, draw, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

const SAND = '#f2d49b';

// ---------- Textures ----------
function beachSky() {
  return canvas(16, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1f8fe0');
    gr.addColorStop(0.55, '#5cc4f5');
    gr.addColorStop(0.85, '#b8ecff');
    gr.addColorStop(1, '#e8fbff');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function beachSun() {
  return canvas(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,250,200,1)'); gr.addColorStop(0.42, 'rgba(255,236,120,1)');
    gr.addColorStop(0.46, 'rgba(255,236,120,0.45)'); gr.addColorStop(1, 'rgba(255,236,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function whiteCloud(seed) {
  return canvas(512, 192, (g, w, h) => {
    const r = rng(seed);
    const puffs = [];
    for (let i = 0; i < 7; i++) puffs.push([80 + i * 55 + r() * 20, 120 - Math.sin((i / 6) * Math.PI) * 50 - r() * 15, 40 + Math.sin((i / 6) * Math.PI) * 30 + r() * 10]);
    g.fillStyle = '#bfe3f7';
    for (const [x, y, rad] of puffs) { g.beginPath(); g.arc(x, y + 9, rad, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffffff';
    for (const [x, y, rad] of puffs) { g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#bfe3f7'; g.fillRect(40, 150, 440, 40);
    g.clearRect(0, 168, w, h);
  });
}
// Plain tiling sand.
function sandTexture() {
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = SAND; g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(170,120,60,0.16)';
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
    }
    // Wind ripples.
    g.strokeStyle = 'rgba(200,150,80,0.22)'; g.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      const y = (i + 0.5) * h / 10;
      g.beginPath();
      for (let x = -10; x <= w + 10; x += 16) g.lineTo(x, y + Math.sin(x / w * Math.PI * 4 + i) * 6);
      g.stroke();
    }
  }, true);
}
// What is drawn on the fighting lane (transparent overlay over the sand).
function laneTexture() {
  return canvas(2048, 512, (g, w, h) => {
    const r = rng(17);
    // "FIGHT!" carved in the sand with a stick: a dark groove and a light ridge.
    g.save();
    g.translate(w / 2, h / 2); g.scale(1, 0.62); g.rotate(-0.03);
    g.font = 'bold 190px Impact, Arial Black, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 22; g.strokeStyle = 'rgba(255,248,225,0.8)'; g.strokeText('FIGHT!', 4, 12);
    g.lineWidth = 16; g.strokeStyle = 'rgba(176,122,62,0.85)'; g.strokeText('FIGHT!', 0, 6);
    g.fillStyle = 'rgba(214,168,104,0.55)'; g.fillText('FIGHT!', 0, 6);
    // A heart scribbled next to it.
    g.translate(430, -30); g.rotate(0.2);
    g.lineWidth = 10; g.strokeStyle = 'rgba(176,122,62,0.8)';
    g.beginPath(); g.moveTo(0, 40); g.bezierCurveTo(-70, -10, -40, -70, 0, -30); g.bezierCurveTo(40, -70, 70, -10, 0, 40); g.stroke();
    g.restore();
    // Footprints wandering across.
    g.fillStyle = 'rgba(180,128,66,0.35)';
    for (let i = 0; i < 26; i++) {
      const x = 80 + i * 75, y = h * 0.78 + Math.sin(i * 0.6) * 30 + (i % 2 ? 16 : -16);
      g.beginPath(); g.ellipse(x, y, 16, 8, 0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + 20, y, 6, 6, 0, 0, Math.PI * 2); g.fill();
    }
    // Shells and starfish.
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = r() * h;
      if (Math.abs(x - w / 2) < 520 && Math.abs(y - h / 2) < 130) continue;
      g.save(); g.translate(x, y); g.rotate(r() * 6);
      if (r() < 0.3) {
        g.fillStyle = r() < 0.5 ? '#ff7a59' : '#ff9f43';
        g.beginPath();
        for (let k = 0; k <= 10; k++) {
          const a = (k / 10) * Math.PI * 2, rad = k % 2 ? 9 : 24;
          g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad * 0.7);
        }
        g.fill();
      } else {
        g.fillStyle = r() < 0.5 ? '#fff4e6' : '#ffd1dc';
        g.beginPath(); g.moveTo(0, 10); g.arc(0, 0, 13, Math.PI * 0.95, Math.PI * 2.05); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(160,110,80,0.6)'; g.lineWidth = 2;
        for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(0, 8); g.lineTo(k * 5, -10); g.stroke(); }
      }
      g.restore();
    }
  });
}
function seaTexture() {
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    const r = rng(9);
    // Wave crests: short light arcs, tiled so the texture repeats.
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, len = 30 + r() * 60;
      g.strokeStyle = r() < 0.6 ? 'rgba(170,240,255,0.9)' : 'rgba(40,120,170,0.35)';
      g.lineWidth = 3 + r() * 3;
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
        g.beginPath();
        for (let k = 0; k <= 8; k++) g.lineTo(x + dx + (k / 8) * len, y + dy + Math.sin((k / 8) * Math.PI * 2) * 4);
        g.stroke();
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(r() * w, r() * h, 1.5 + r() * 2, 0, Math.PI * 2); g.fill(); }
  }, true);
}
function foamTexture() {
  return canvas(1024, 64, (g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.45 + Math.sin(x / 40) * 7 + Math.sin(x / 13) * 3);
    g.lineTo(w, h); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let x = 0; x < w; x += 22) { g.beginPath(); g.arc(x, h * 0.35 + Math.sin(x) * 6, 4, 0, Math.PI * 2); g.fill(); }
  }, true);
}
function hillsTexture() {
  return canvas(2048, 256, (g, w, h) => {
    const hill = (cx, cw, ch, c) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(cx - cw, h);
      for (let k = 0; k <= 30; k++) {
        const u = k / 30, x = cx - cw + u * cw * 2;
        g.lineTo(x, h - ch * Math.pow(Math.sin(u * Math.PI), 0.8) * (1 + Math.sin(u * 17) * 0.03));
      }
      g.fill();
    };
    hill(300, 330, 150, '#6fae9a'); hill(620, 220, 210, '#5f9f8c'); hill(1500, 420, 120, '#78b6a2');
    hill(1820, 200, 180, '#5f9f8c'); hill(1100, 160, 70, '#86c0ad');
  });
}
function stripes(a, b, n = 8, w = 256, h = 64) {
  return canvas(w, h, (g) => {
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * w) / n, 0, w / n + 1, h); }
  });
}
function towelTexture(a, b) {
  return canvas(128, 256, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.fillStyle = b;
    for (let i = 0; i < 5; i++) g.fillRect(0, 20 + i * 48, w, 18);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let x = 4; x < w; x += 10) { g.fillRect(x, 0, 3, 8); g.fillRect(x, h - 8, 3, 8); }
  });
}
function signTexture(lines, bg, fg) {
  return canvas(512, 160, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#1b1b1b'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([text, size, y]) => {
      g.font = `bold ${size}px Impact, Arial Black, sans-serif`;
      g.lineWidth = 8; g.strokeStyle = '#1b1b1b'; g.strokeText(text, w / 2, y);
      g.fillStyle = fg; g.fillText(text, w / 2, y);
    });
  });
}
function frondTexture() {
  return canvas(64, 256, (g, w, h) => {
    // A palm leaf: a midrib with leaflets, pointing up the texture.
    for (let i = 0; i < 26; i++) {
      const y = h - 8 - i * 9.4, len = Math.sin((i / 26) * Math.PI * 0.9 + 0.15) * (w / 2 - 2);
      g.strokeStyle = i % 3 ? '#3fae4a' : '#2e8f3c'; g.lineWidth = 6;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 + s * len, y - 12); g.stroke(); }
    }
    g.strokeStyle = '#6b8f2f'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 4); g.stroke();
  });
}
function trunkTexture() {
  return canvas(64, 64, (g, w, h) => {
    g.fillStyle = '#a8743f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7e5329';
    for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 6); g.lineTo(w, y + 10); g.lineTo(0, y + 4); g.fill(); }
  }, true);
}
function gullTexture(up) {
  return canvas(64, 32, (g) => {
    g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath();
    if (up) { g.moveTo(4, 8); g.quadraticCurveTo(18, 6, 32, 20); g.quadraticCurveTo(46, 6, 60, 8); }
    else { g.moveTo(4, 24); g.quadraticCurveTo(18, 12, 32, 18); g.quadraticCurveTo(46, 12, 60, 24); }
    g.stroke();
    g.strokeStyle = '#5a6b7a'; g.lineWidth = 2; g.stroke();
  });
}
function sailTexture(color) {
  return canvas(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(62, 6); g.lineTo(62, 92); g.lineTo(18, 92); g.fill();
    g.fillStyle = color;
    g.beginPath(); g.moveTo(68, 18); g.lineTo(68, 92); g.lineTo(104, 92); g.fill();
    g.fillStyle = '#1b1b1b'; g.fillRect(62, 4, 5, 92);
    g.fillStyle = '#e8402e';
    g.beginPath(); g.moveTo(10, 96); g.lineTo(118, 96); g.lineTo(100, 116); g.lineTo(26, 116); g.fill();
  });
}
function bannerTexture() {
  return canvas(1024, 128, (g, w, h) => {
    g.fillStyle = '#fff6d8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e8402e'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    g.font = 'bold 80px Impact, Arial Black, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#e8402e'; g.fillText('RAÇÃO TOP • O CACHORRO APROVA!', w / 2, h / 2 + 4);
  });
}

// ---------- Props ----------
const toon = (o) => new THREE.MeshToonMaterial(o);

function palm(height, lean, seed) {
  const r = rng(seed);
  const group = new THREE.Group();
  const trunkMat = toon({ map: trunkTexture() });
  const segs = 9;
  let top = new THREE.Vector3();
  for (let i = 0; i < segs; i++) {
    const u0 = i / segs, u1 = (i + 1) / segs;
    const p0 = new THREE.Vector3(Math.pow(u0, 2) * lean, u0 * height, 0);
    const p1 = new THREE.Vector3(Math.pow(u1, 2) * lean, u1 * height, 0);
    const len = p0.distanceTo(p1);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - u1 * 0.07, 0.17 - u0 * 0.07, len * 1.05, 10), trunkMat);
    seg.position.copy(p0).lerp(p1, 0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
    seg.castShadow = true;
    group.add(seg);
    top = p1;
  }
  const crown = new THREE.Group();
  crown.position.copy(top);
  const frondMat = toon({ map: frondTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  const n = 8;
  for (let i = 0; i < n; i++) {
    // A long plane bent down along its length like a drooping leaf.
    const geo = new THREE.PlaneGeometry(0.75, 2.4, 1, 10);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k) + 1.2; // 0..2.4 along the leaf
      pos.setXYZ(k, pos.getX(k), y * 0.85, -Math.pow(y / 2.4, 2) * 1.3);
    }
    geo.rotateX(-Math.PI / 2 + 0.55 + r() * 0.2);
    geo.computeVertexNormals();
    const f = new THREE.Mesh(geo, frondMat);
    f.rotation.y = (i / n) * Math.PI * 2 + r() * 0.3;
    f.castShadow = true;
    crown.add(f);
  }
  const nutMat = toon({ color: 0x6b4a22 });
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), nutMat);
    c.position.set(Math.cos(i * 2.1) * 0.14, -0.12, Math.sin(i * 2.1) * 0.14);
    crown.add(c);
  }
  group.add(crown);
  group.userData.crown = crown;
  group.userData.seed = r() * 10;
  return group;
}

function umbrella(a, b) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.3), toon({ color: 0xf5efe6 }));
  pole.position.y = 1.15;
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.45, 12, 1, true), toon({ map: stripes(a, b, 12), side: THREE.DoubleSide }));
  canopy.position.y = 2.3;
  canopy.castShadow = true;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), toon({ color: 0xf5efe6 }));
  tip.position.y = 2.55;
  g.add(pole, canopy, tip);
  return g;
}

function towel(a, b) {
  const t = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), toon({ map: towelTexture(a, b) }));
  t.rotation.x = -Math.PI / 2;
  t.position.y = 0.012;
  t.receiveShadow = true;
  return t;
}

function cooler() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), toon({ color: 0x1e88e5 }));
  box.position.y = 0.2;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.08, 0.44), toon({ color: 0xffffff }));
  lid.position.y = 0.44;
  box.castShadow = true;
  g.add(box, lid);
  return g;
}

function beachBall() {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), toon({ map: stripes('#ffffff', '#e8402e', 6) }));
  ball.position.y = 0.22;
  ball.castShadow = true;
  return ball;
}

function surfboard(color) {
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.5, 6, 12), toon({ color }));
  b.scale.z = 0.18;
  b.position.y = 0.9;
  b.castShadow = true;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 0.09), toon({ color: 0xffffff }));
  stripe.position.y = 0.9;
  const g = new THREE.Group();
  g.add(b, stripe);
  return g;
}

function sandcastle() {
  const g = new THREE.Group();
  const mat = toon({ color: 0xe0b878 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.6), mat);
  base.position.y = 0.15;
  g.add(base);
  for (const [x, z, h] of [[-0.4, -0.2, 0.55], [0.4, -0.2, 0.55], [0, 0, 0.75], [-0.4, 0.2, 0.45], [0.4, 0.2, 0.45]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, h, 10), mat);
    t.position.set(x, h / 2, z);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.2, 10), mat);
    c.position.set(x, h + 0.1, z);
    g.add(t, c);
  }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.12), toon({ color: 0xe8402e, side: THREE.DoubleSide }));
  flag.position.set(0.09, 1.15, 0);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3), toon({ color: 0x333333 }));
  stick.position.set(0, 1.07, 0);
  g.add(flag, stick);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function kiosk(canImg) {
  const g = new THREE.Group();
  const wood = toon({ color: 0x9a6a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 1.6), wood);
  body.position.y = 0.55;
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 1.8), toon({ color: 0xf5efe6 }));
  counter.position.y = 1.12;
  g.add(body, counter);
  for (const x of [-1.5, 1.5]) for (const z of [-0.7, 0.7]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5), wood);
    post.position.set(x, 1.9, z);
    g.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.0, 4, 1), toon({ color: 0xd9b25e }));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.7);
  roof.position.y = 3.1;
  roof.castShadow = true;
  g.add(roof);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshBasicMaterial({ map: signTexture([['QUIOSQUE DO ZÉ', 58, 58], ['ÁGUA DE COCO • GELADA', 34, 118]], '#ffd23f', '#e8402e') }));
  sign.position.set(0, 2.45, 0.86);
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: billboardTexture('garra', canImg) }));
  poster.position.set(0, 0.55, 0.81);
  g.add(sign, poster);
  // Coconuts with straws on the counter.
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), toon({ color: 0x4f8f2f }));
    c.position.set(-1.2 + i * 0.35, 1.28, 0.5);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25), toon({ color: i % 2 ? 0xff5fa2 : 0xffffff }));
    straw.position.set(-1.2 + i * 0.35 + 0.04, 1.44, 0.5); straw.rotation.z = -0.3;
    g.add(c, straw);
  }
  g.traverse((o) => { if (o.isMesh && o.geometry.type !== 'PlaneGeometry') o.castShadow = true; });
  return g;
}

function lifeguardTower() {
  const g = new THREE.Group();
  const white = toon({ color: 0xf5f5f5 });
  for (const x of [-0.6, 0.6]) for (const z of [-0.5, 0.5]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.1), white);
    leg.position.set(x, 1.0, z);
    g.add(leg);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.4), white);
  deck.position.y = 2.05;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 1.1), toon({ color: 0xe8402e }));
  cabin.position.y = 2.6;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.4), white);
  roof.position.y = 3.16;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.36), new THREE.MeshBasicMaterial({ map: signTexture([['SALVA-VIDAS', 80, 82]], '#ffffff', '#e8402e') }));
  sign.position.set(0, 2.75, 0.56);
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.06), toon({ color: 0xdddddd }));
  ladder.position.set(0, 1.0, 0.95); ladder.rotation.x = -0.4;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2), toon({ color: 0x333333 }));
  mast.position.set(0.7, 3.75, 0);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38, 6, 1), toon({ color: 0xffd23f, side: THREE.DoubleSide }));
  flag.position.set(1.0, 4.15, 0);
  g.add(deck, cabin, roof, sign, ladder, mast, flag);
  g.traverse((o) => { if (o.isMesh && o !== sign) o.castShadow = true; });
  g.userData.flag = flag;
  return g;
}

function volleyNet() {
  const g = new THREE.Group();
  const pole = toon({ color: 0xf5efe6 });
  for (const x of [-2, 2]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5), pole);
    p.position.set(x, 1.25, 0);
    g.add(p);
  }
  const netTex = canvas(256, 64, (c, w, h) => {
    c.strokeStyle = 'rgba(30,30,40,0.9)'; c.lineWidth = 2;
    for (let x = 0; x <= w; x += 8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y <= h; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, 6);
  });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.9), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  net.position.y = 2.0;
  g.add(net);
  return g;
}

// ---------- The stage ----------
export function buildBeach(arena, canImg) {
  const s = arena.scene;
  const r = rng(4242);
  const W = WALL / 1000;
  s.fog = new THREE.Fog(0xcdeeff, 30, 85);
  s.background = new THREE.Color(0x5cc4f5);
  s.add(new THREE.HemisphereLight(0xffffff, 0xe8c98a, 1.7));
  arena.sun.color.set(0xfff4e0);
  arena.sun.intensity = 2.7;

  // ---- Sky, sun, clouds, far hills ----
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(220, 60), new THREE.MeshBasicMaterial({ map: beachSky(), fog: false }));
  sky.position.set(0, 20, -60);
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: beachSun(), transparent: true, fog: false, depthWrite: false }));
  sun.position.set(-14, 22, -58);
  s.add(sky, sun);
  arena.clouds = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.5), new THREE.MeshBasicMaterial({ map: whiteCloud(i + 21), transparent: true, fog: false, depthWrite: false }));
    c.position.set(-50 + i * 15 + r() * 6, 12 + r() * 10, -55 + i * 0.1);
    c.userData.speed = 0.3 + r() * 0.4;
    s.add(c);
    arena.clouds.push(c);
  }
  const hills = new THREE.Mesh(new THREE.PlaneGeometry(150, 11), new THREE.MeshBasicMaterial({ map: hillsTexture(), transparent: true, fog: false }));
  hills.position.set(0, 4.6, -52);
  s.add(hills);

  // ---- Sea: scrolling waves, darker far away, foam at the shore ----
  const SEA_NEAR = -5.6, SEA_FAR = -54;
  const seaTex = seaTexture(); seaTex.repeat.set(22, 9);
  const seaGeo = new THREE.PlaneGeometry(240, SEA_NEAR - SEA_FAR, 1, 16);
  const colors = [];
  const near = new THREE.Color(0x3fd6d2), far = new THREE.Color(0x1a6fbf), tmp = new THREE.Color();
  const sp = seaGeo.attributes.position;
  for (let k = 0; k < sp.count; k++) {
    const u = (sp.getY(k) / (SEA_NEAR - SEA_FAR)) + 0.5; // 0 near the shore, 1 far
    tmp.copy(near).lerp(far, Math.pow(1 - u, 0.6));
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  seaGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshBasicMaterial({ map: seaTex, vertexColors: true }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.03, (SEA_NEAR + SEA_FAR) / 2);
  s.add(sea);
  arena.seaTex = seaTex;
  // Wet sand where the waves reach.
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(240, 2.2), toon({ color: 0xd9b276 }));
  wet.rotation.x = -Math.PI / 2; wet.position.set(0, -0.015, SEA_NEAR + 0.6);
  wet.receiveShadow = true;
  s.add(wet);
  arena.foam = [];
  for (let i = 0; i < 2; i++) {
    const ft = foamTexture(); ft.repeat.set(10, 1);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(240, 1.0), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, -0.005 + i * 0.002, SEA_NEAR);
    foam.userData.phase = i * Math.PI;
    s.add(foam);
    arena.foam.push(foam);
  }

  // ---- Sand: tiling sand everywhere, the carved lane drawn on top ----
  const sandTex = sandTexture(); sandTex.repeat.set(40, 6);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(240, 30), toon({ map: sandTex }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, -0.01, SEA_NEAR + 1.7 + 15);
  sand.receiveShadow = true;
  s.add(sand);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(2 * W + 10, 7), toon({ map: laneTexture(), transparent: true, depthWrite: false }));
  lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.001, 0.3);
  lane.receiveShadow = true;
  s.add(lane);

  // ---- Boats on the sea, seagulls, the banner plane ----
  arena.boats = [];
  for (const [x, z, sc, color] of [[-18, -34, 2.6, '#1e88e5'], [9, -42, 2.2, '#ff8a00'], [26, -30, 2.8, '#2f9e5f']]) {
    const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: sailTexture(color), transparent: true }));
    b.center.set(0.5, 0.12);
    b.position.set(x, 0, z); b.scale.setScalar(sc);
    b.userData.speed = 0.15 + r() * 0.2;
    s.add(b);
    arena.boats.push(b);
  }
  arena.gullTex = [gullTexture(true), gullTexture(false)];
  arena.gulls = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: arena.gullTex[0], transparent: true, fog: false }));
    g.scale.set(0.9, 0.45, 1);
    g.userData = { x: -30 + r() * 60, y: 7 + r() * 5, z: -14 - r() * 12, speed: 1 + r() * 1.2, phase: r() * 6 };
    s.add(g);
    arena.gulls.push(g);
  }
  const plane = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.6, 6, 10), toon({ color: 0xffffff }));
  body.rotation.z = Math.PI / 2;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 3.2), toon({ color: 0xe8402e }));
  wing.position.set(0.2, 0.25, 0);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.06), toon({ color: 0xe8402e }));
  tail.position.set(-1.1, 0.35, 0);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1, 12, 1), new THREE.MeshBasicMaterial({ map: bannerTexture(), side: THREE.DoubleSide, fog: false }));
  banner.position.set(-6.2, 0, 0);
  const rope = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 0.02), toon({ color: 0x333333 }));
  rope.position.set(-1.6, 0, 0);
  plane.add(body, wing, tail, banner, rope);
  plane.position.set(-70, 12, -30);
  s.add(plane);
  arena.plane = plane;
  arena.bannerGeo = banner.geometry;
  arena.bannerBase = Float32Array.from(banner.geometry.attributes.position.array);

  // ---- Beach life behind the fighters ----
  const add = (o, x, z, ry = 0) => { o.position.x = x; o.position.z = z; o.rotation.y = ry; s.add(o); return o; };
  add(kiosk(canImg), -7.7, -4.0, 0.12);
  const tower = add(lifeguardTower(), 7.9, -4.3, -0.15);
  arena.flag = tower.userData.flag;
  arena.flagBase = Float32Array.from(arena.flag.geometry.attributes.position.array);
  add(volleyNet(), 19, -4.2, -0.1);
  const u1 = add(umbrella('#e8402e', '#ffffff'), -4.6, -3.6); u1.rotation.z = 0.12;
  add(towel('#1e88e5', '#ffd23f'), -4.0, -3.0, 1.4);
  const u2 = add(umbrella('#ffd23f', '#2f9e5f'), 4.4, -3.8); u2.rotation.z = -0.1;
  add(towel('#ff5fa2', '#ffffff'), 5.0, -3.2, 1.7);
  add(cooler(), 5.9, -3.7, 0.4);
  add(sandcastle(), -1.6, -3.4, 0.2);
  const u3 = add(umbrella('#1e88e5', '#ffffff'), -15, -4.0); u3.rotation.z = 0.08;
  const u4 = add(umbrella('#ff8a00', '#ffffff'), 12.6, -3.4); u4.rotation.z = -0.12;
  add(towel('#2f9e5f', '#ffffff'), 13.3, -2.8, 1.3);
  add(beachBall(), 2.2, -3.0);

  // Palm trees: tall ones at the back, two at the edges of the stage.
  arena.palms = [];
  for (const [x, z, h, lean] of [[-13, -4.8, 6.2, 1.2], [-10.6, -5.0, 5.4, -0.8], [10.6, -5.1, 6.0, 1.0], [15, -5.0, 5.0, -1.1], [-20, -4.6, 5.8, 1.0], [21, -4.4, 6.4, -1.0],
    [-(W + 2.2), -1.6, 5.6, 1.3], [W + 2.2, -1.8, 5.8, -1.3]]) {
    const p = palm(h, lean, Math.round(x * 13 + 1000));
    p.position.set(x, 0, z);
    s.add(p);
    arena.palms.push(p);
  }
  // Stage edges: surfboards stuck in the sand, a ball and a cooler.
  for (const side of [-1, 1]) {
    const x = side * (W + 1.4);
    const b1 = surfboard(side < 0 ? 0xff5fa2 : 0x1e88e5);
    b1.position.set(x, -0.3, -1.0); b1.rotation.set(0.05, 0.4 * side, -0.15 * side);
    const b2 = surfboard(0xffd23f);
    b2.position.set(x + side * 0.55, -0.3, -1.3); b2.rotation.set(-0.05, -0.3 * side, 0.1 * side);
    s.add(b1, b2);
  }
  add(cooler(), -(W + 2.6), -0.4, 0.5);
  add(beachBall(), W + 2.8, -0.2);
  // Soft glare of the sun on the water.
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,230,0.5)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glare.position.set(-12, 1, -40); glare.scale.set(30, 6, 1);
  s.add(glare);
}

// Ambient motion for the beach: waves, foam, boats, gulls, the plane, swaying palms.
export function updateBeach(a, dt, T) {
  a.seaTex.offset.y = (a.seaTex.offset.y + dt * 0.035) % 1;
  a.seaTex.offset.x = Math.sin(T * 0.3) * 0.05;
  a.foam.forEach((f, i) => {
    const w = Math.sin(T * 0.8 + f.userData.phase);
    f.position.z = -5.6 + w * 0.45;
    f.material.opacity = 0.55 + 0.45 * Math.max(0, w);
    f.material.map.offset.x = T * 0.01 * (i ? -1 : 1);
  });
  for (const b of a.boats) {
    b.position.x += b.userData.speed * dt;
    if (b.position.x > 60) b.position.x = -60;
    b.position.y = Math.sin(T * 1.3 + b.position.x) * 0.06;
  }
  for (const g of a.gulls) {
    const u = g.userData;
    u.x += u.speed * dt;
    if (u.x > 40) u.x = -40;
    g.position.set(u.x, u.y + Math.sin(T * 0.7 + u.phase) * 0.8, u.z);
    g.material.map = a.gullTex[Math.floor(T * 4 + u.phase) % 2];
  }
  const p = a.plane;
  p.position.x += dt * 3.2;
  if (p.position.x > 80) p.position.x = -80;
  p.position.y = 12 + Math.sin(T * 0.5) * 0.4;
  const bp = a.bannerGeo.attributes.position, base = a.bannerBase;
  for (let k = 0; k < bp.count; k++) {
    const x = base[k * 3];
    bp.setZ(k, Math.sin(x * 0.9 + T * 6) * 0.25 * (4.5 - x) / 9);
  }
  bp.needsUpdate = true;
  const fp = a.flag.geometry.attributes.position, fb = a.flagBase;
  for (let k = 0; k < fp.count; k++) {
    const x = fb[k * 3] + 0.3;
    fp.setZ(k, Math.sin(x * 8 - T * 7) * 0.06 * x);
  }
  fp.needsUpdate = true;
  for (const palmTree of a.palms) {
    const c = palmTree.userData.crown, sd = palmTree.userData.seed;
    c.rotation.z = Math.sin(T * 0.9 + sd) * 0.05;
    c.rotation.x = Math.sin(T * 0.7 + sd * 2) * 0.04;
  }
  for (const c of a.clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 60) c.position.x = -60;
  }
}
