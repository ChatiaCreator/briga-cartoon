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

    // Kibble pieces scattered on the ground.
    this.kibbleGeo = new THREE.DodecahedronGeometry(0.05, 0);
    this.kibbleMat = new THREE.MeshToonMaterial({ color: 0x7a4419 });
    this.kibble = [];
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
    this.items.push({ obj: s, life, age: 0, size, grow: opts.grow ?? 1, vel: opts.vel || null, rot: opts.rot || 0 });
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

  syncProjectiles(proj, dt) {
    const seen = new Set();
    for (const p of proj) {
      seen.add(p.id);
      let m = this.projMeshes.get(p.id);
      if (!m) {
        m = this.makeBag();
        this.scene.add(m);
        this.projMeshes.set(p.id, m);
      }
      m.position.set(p.x / 1000, p.y / 1000, 0);
      m.rotation.z -= dt * 8 * Math.sign(p.vx || 1);
      m.rotation.y = 0.5;
    }
    for (const [id, m] of this.projMeshes) {
      if (!seen.has(id)) { this.scene.remove(m); this.projMeshes.delete(id); }
    }
  }

  // Item held in a fighter's hand this frame ('racao' bag, 'can', or nothing).
  holdItems(chars, poses) {
    this.handBag.visible = false;
    this.can.visible = false;
    for (let i = 0; i < chars.length; i++) {
      const what = poses[i]?.hand;
      if (!what) continue;
      const c = chars[i];
      const hand = c.b.RightHand;
      const pos = hand.getWorldPosition(new THREE.Vector3());
      const q = hand.getWorldQuaternion(new THREE.Quaternion());
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
      it.obj.scale.setScalar(s);
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
