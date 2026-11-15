// Visual effects: impact bursts, dog food bags and kibble, the GARRA can, buff aura, dust.
import * as THREE from 'three';
import { bagTexture, burstTexture, glowTexture } from './textures.js';

const HIT_WORDS = ['POW!', 'BAM!', 'TUM!', 'PAF!', 'CRÁ!'];

export class Effects {
  constructor(scene, canImg) {
    this.scene = scene;
    this.items = [];
    this.bursts = {
      light: burstTexture('', '#fff59d', '#ff9800'),
      block: burstTexture('', '#bde0ff', '#1e6fd9'),
      words: HIT_WORDS.map((w) => burstTexture(w, '#ffd23f', '#e8402e')),
      ko: burstTexture('K.O.!', '#ff5252', '#1b1b1b'),
    };
    this.glowGreen = glowTexture('rgba(125,255,26,0.9)');
    this.dustTex = glowTexture('rgba(235,220,200,0.8)');

    // Dog food bag (thrown and in hand).
    const bagTex = bagTexture();
    const side = new THREE.MeshToonMaterial({ color: 0xa86c33 });
    const front = new THREE.MeshToonMaterial({ map: bagTex });
    this.bagGeo = new THREE.BoxGeometry(0.34, 0.44, 0.14);
    this.bagMats = [side, side, side, side, front, front];
    this.handBag = this.makeBag();
    this.handBag.visible = false;
    scene.add(this.handBag);
    this.projMeshes = new Map();

    // GARRA can.
    let canTex = null;
    if (canImg) {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 256;
      c.getContext('2d').drawImage(canImg, 0, 0, 512, 256);
      canTex = new THREE.CanvasTexture(c);
      canTex.colorSpace = THREE.SRGBColorSpace;
    }
    const top = new THREE.MeshToonMaterial({ color: 0xbbbbbb });
    const body = new THREE.MeshToonMaterial({ map: canTex, color: canTex ? 0xffffff : 0x111111 });
    this.can = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.24, 20), [body, top, top]);
    this.can.visible = false;
    scene.add(this.can);

    // Anderon's phone: black body with a glowing screen (screen faces -Z of the phone).
    this.phone = new THREE.Group();
    const phBody = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.014), new THREE.MeshToonMaterial({ color: 0x15151c }));
    const phScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.13), new THREE.MeshBasicMaterial({ color: 0x5fd0ff }));
    phScreen.position.z = 0.0075;
    this.phone.add(phBody, phScreen);
    this.phone.visible = false;
    scene.add(this.phone);

    // Genildo's pistol (barrel along +Z) and the bullets with a glowing tracer behind.
    const gunMat = new THREE.MeshToonMaterial({ color: 0x24242c });
    this.gun = new THREE.Group();
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.2), gunMat);
    slide.position.set(0, 0.02, 0.06);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.11, 0.05), gunMat);
    grip.position.set(0, -0.04, -0.01); grip.rotation.x = -0.25;
    this.gun.add(slide, grip);
    this.gun.visible = false;
    scene.add(this.gun);
    this.bulletGeo = new THREE.CapsuleGeometry(0.03, 0.1, 3, 8).rotateZ(Math.PI / 2);
    this.bulletMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
    const tc = document.createElement('canvas'); tc.width = 128; tc.height = 8;
    const tg = tc.getContext('2d'), gr = tg.createLinearGradient(0, 0, 128, 0);
    gr.addColorStop(0, 'rgba(255,200,80,0)'); gr.addColorStop(1, 'rgba(255,240,180,0.9)');
    tg.fillStyle = gr; tg.fillRect(0, 0, 128, 8);
    this.tracerMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(tc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.tracerGeo = new THREE.PlaneGeometry(1.0, 0.07);

    // Kibble pieces scattered on the ground.
    this.kibbleGeo = new THREE.DodecahedronGeometry(0.05, 0);
    this.kibbleMat = new THREE.MeshToonMaterial({ color: 0x7a4419 });
    this.kibble = [];
  }

  // Phone call heal: a green "+18" rising from the head and sparkles.
  heal(pos, amount) {
    if (!this.healTex) this.healTex = {};
    const key = String(amount);
    if (!this.healTex[key]) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const g = c.getContext('2d');
      g.font = 'bold 84px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 12; g.strokeStyle = '#0b3d12'; g.strokeText(`+${amount}`, 128, 66);
      g.fillStyle = '#7dff1a'; g.fillText(`+${amount}`, 128, 66);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      this.healTex[key] = t;
    }
    const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.3, 0.3));
    this.sprite(this.healTex[key], p, 0.42, 0.9, { grow: 1.1, vel: new THREE.Vector3(0, 0.7, 0), aspect: 2 });
    for (let i = 0; i < 3; i++) {
      this.sprite(this.glowGreen, pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, -0.3 - Math.random() * 0.6, 0.2)), 0.18, 0.7,
        { grow: 0.6, vel: new THREE.Vector3(0, 0.9 + Math.random() * 0.5, 0) });
    }
  }

  makeBag() {
    const m = new THREE.Mesh(this.bagGeo, this.bagMats);
    m.castShadow = true;
    return m;
  }

  sprite(tex, pos, size, life, opts = {}) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: opts.depthTest ?? false, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.scale.setScalar(size * 0.4);
    s.renderOrder = 10;
    this.scene.add(s);
    this.items.push({ obj: s, life, age: 0, size, grow: opts.grow ?? 1, vel: opts.vel || null, rot: opts.rot || 0, aspect: opts.aspect || 1 });
    return s;
  }

  hit(ev) {
    const pos = new THREE.Vector3(ev.x / 1000, ev.y / 1000, 0.6);
    if (ev.ko) {
      // The HUD already shows "K.O.!", so the impact itself is a plain big burst.
      this.sprite(this.bursts.light, pos, 1.6, 0.5, { grow: 1.4 });
    } else if (ev.heavy) {
      const tex = this.bursts.words[Math.floor(Math.random() * this.bursts.words.length)];
      this.sprite(tex, pos, 1.1, 0.45, { grow: 1.3, rot: (Math.random() - 0.5) * 0.6 });
    } else {
      this.sprite(this.bursts.light, pos, 0.6, 0.18, { grow: 1.6 });
    }
  }

  block(ev) {
    this.sprite(this.bursts.block, new THREE.Vector3(ev.x / 1000, ev.y / 1000, 0.6), 0.6, 0.2, { grow: 1.5 });
  }

  dust(x) {
    for (let i = 0; i < 6; i++) {
      this.sprite(this.dustTex, new THREE.Vector3(x / 1000 + (Math.random() - 0.5) * 0.5, 0.1, 0.3), 0.5, 0.5,
        { grow: 2, depthTest: true, vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.6, 0) });
    }
  }

  // A bag bursts: kibble flies out and stays on the floor for a while.
  splash(x, y) {
    const px = x / 1000, py = Math.max(0.1, (y || 0) / 1000);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(this.kibbleGeo, this.kibbleMat);
      m.position.set(px, py, (Math.random() - 0.3) * 0.8);
      m.castShadow = false;
      this.scene.add(m);
      this.kibble.push({
        obj: m, age: 0, life: 4 + Math.random() * 2,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 2),
      });
    }
    // Spare bags on the floor get removed by syncProjectiles.
  }

  makeBullet(dir) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.bulletGeo, this.bulletMat));
    const tr = new THREE.Mesh(this.tracerGeo, this.tracerMat);
    tr.position.x = -0.5 * dir;
    if (dir < 0) tr.rotation.y = Math.PI;
    g.add(tr);
    return g;
  }

  // Muzzle flash where a shot is fired.
  muzzle(pos) {
    this.sprite(this.bursts.light, pos, 0.55, 0.09, { grow: 1.5 });
    this.sprite(this.dustTex, pos, 0.6, 0.4, { grow: 2, vel: new THREE.Vector3(0, 0.4, 0) });
  }

  syncProjectiles(proj, dt, prev = null, k = 1) {
    const seen = new Set();
    for (const p of proj) {
      seen.add(p.id);
      let m = this.projMeshes.get(p.id);
      if (!m) {
        m = p.kind === 'bullet' ? this.makeBullet(Math.sign(p.vx) || 1) : this.makeBag();
        this.scene.add(m);
        this.projMeshes.set(p.id, m);
      }
      const [px, py] = prev?.get(p.id) || [p.x, p.y];
      m.position.set((px + (p.x - px) * k) / 1000, (py + (p.y - py) * k) / 1000, 0);
      if (p.kind !== 'bullet') {
        m.rotation.z -= dt * 8 * Math.sign(p.vx || 1);
        m.rotation.y = 0.5;
      }
    }
    for (const [id, m] of this.projMeshes) {
      if (!seen.has(id)) { this.scene.remove(m); this.projMeshes.delete(id); }
    }
  }

  // Item held in a fighter's hand this frame ('racao' bag, 'can', or nothing).
  holdItems(chars, poses) {
    this.handBag.visible = false;
    this.can.visible = false;
    this.gun.visible = false;
    this.phone.visible = false;
    for (let i = 0; i < chars.length; i++) {
      const what = poses[i]?.hand;
      if (!what) continue;
      const c = chars[i];
      if (what === 'gun') {
        // Grip in the right palm, barrel along the aim.
        this.gun.visible = c.pistolTransform(this.gun.position, this.gun.quaternion);
        continue;
      }
      const hand = c.b.RightHand;
      const pos = hand.getWorldPosition(new THREE.Vector3());
      const q = hand.getWorldQuaternion(new THREE.Quaternion());
      if (what === 'phone') {
        // Lying in the palm along the fingers, screen against the palm (at the ear).
        this.phone.visible = true;
        this.phone.position.copy(pos);
        this.phone.quaternion.copy(q);
        this.phone.translateY(0.09);
        this.phone.translateZ(0.025);
        continue;
      }
      const obj = what === 'can' ? this.can : this.handBag;
      obj.visible = true;
      obj.position.copy(pos);
      obj.quaternion.copy(q);
      // Offset into the palm.
      obj.translateY(what === 'can' ? 0.12 : 0.18);
      obj.translateZ(what === 'can' ? 0.03 : 0);
    }
  }

  update(dt) {
    const keep = [];
    for (const it of this.items) {
      it.age += dt;
      const k = it.age / it.life;
      if (k >= 1) { this.scene.remove(it.obj); it.obj.material.dispose(); continue; }
      const s = it.size * (0.4 + (it.grow - 0.4) * Math.min(1, k * 3));
      it.obj.scale.set(s * it.aspect, s, 1);
      it.obj.material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      it.obj.material.rotation = it.rot;
      if (it.vel) it.obj.position.addScaledVector(it.vel, dt);
      keep.push(it);
    }
    this.items = keep;
    const kk = [];
    for (const p of this.kibble) {
      p.age += dt;
      if (p.age > p.life) { this.scene.remove(p.obj); continue; }
      if (p.obj.position.y > 0.05 || p.vel.y > 0) {
        p.vel.y -= 12 * dt;
        p.obj.position.addScaledVector(p.vel, dt);
        p.obj.rotation.x += dt * 10;
        if (p.obj.position.y <= 0.05) {
          p.obj.position.y = 0.05;
          p.vel.y = Math.abs(p.vel.y) > 1.5 ? -p.vel.y * 0.35 : 0;
          p.vel.x *= 0.5; p.vel.z *= 0.5;
        }
      }
      if (p.life - p.age < 0.6) p.obj.scale.setScalar(Math.max(0.01, (p.life - p.age) / 0.6));
      kk.push(p);
    }
    this.kibble = kk;
  }
}

// Green glow around a fighter under the GARRA buff.
export class Aura {
  constructor(scene, tex) {
    this.group = new THREE.Group();
    this.sprites = [];
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.sprites.push(s);
      this.group.add(s);
    }
    this.light = new THREE.PointLight(0x7dff1a, 0, 4);
    this.light.position.y = 1;
    this.group.add(this.light);
    this.group.visible = false;
    scene.add(this.group);
  }

  update(on, x, y, T, strength = 1) {
    this.group.visible = on;
    if (!on) return;
    this.group.position.set(x, y, 0);
    this.light.intensity = 3 * strength;
    this.sprites.forEach((s, i) => {
      const a = T * 2 + i * 0.63;
      const h = ((T * 0.8 + i * 0.37) % 1);
      s.position.set(Math.cos(a) * 0.45, 0.2 + h * 1.8, Math.sin(a) * 0.3);
      s.scale.setScalar(0.5 + 0.3 * Math.sin(T * 6 + i));
      s.material.opacity = (1 - h) * 0.9 * strength;
    });
  }
}

// Fading ribbon that follows a fist or foot during strong attacks.
export class Trail {
  constructor(scene, color) {
    this.n = 14;
    this.points = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 2 * 3);
    this.col = new Float32Array(this.n * 2 * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    const idx = [];
    for (let i = 0; i < this.n - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.color = new THREE.Color(color);
    scene.add(this.mesh);
  }

  setColor(c) { this.color.set(c); }

  // p: world position of the limb, or null when no strong attack is active.
  update(p, width = 0.13) {
    if (p) this.points.unshift(p.clone());
    else if (this.points.length) this.points.pop();
    if (this.points.length > this.n) this.points.length = this.n;
    const pts = this.points;
    for (let i = 0; i < this.n; i++) {
      const q = pts[Math.min(i, pts.length - 1)];
      const o = i * 6, c = i * 8;
      if (!q || pts.length < 2) {
        this.col.fill(0, c, c + 8);
        continue;
      }
      const last = pts.length - 1;
      const prev = pts[Math.min(last, Math.max(0, i - 1))], next = pts[Math.min(last, i + 1)];
      // Ribbon width goes across the direction of motion, in the screen plane.
      let dx = next.x - prev.x, dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const k = 1 - i / this.n;
      const w = width * k;
      const nx = (-dy / len) * w, ny = (dx / len) * w;
      this.pos[o] = q.x + nx; this.pos[o + 1] = q.y + ny; this.pos[o + 2] = q.z + 0.05;
      this.pos[o + 3] = q.x - nx; this.pos[o + 4] = q.y - ny; this.pos[o + 5] = q.z + 0.05;
      const a = i < pts.length ? k * 0.9 : 0;
      for (const off of [0, 4]) {
        this.col[c + off] = this.color.r; this.col[c + off + 1] = this.color.g; this.col[c + off + 2] = this.color.b; this.col[c + off + 3] = a;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}
