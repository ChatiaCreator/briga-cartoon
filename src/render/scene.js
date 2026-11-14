// Renderer, side camera and the cartoon street arena.
import * as THREE from 'three';
import {
  skyTexture, groundTexture, buildingTexture, billboardTexture, sidewalkTexture, shopTexture, awningTexture,
  neonTexture, skylineTexture, sunTexture, cloudTexture, stripeTexture, glowTexture, flameTexture,
} from './textures.js';
import { WALL } from '../sim/fighter.js';

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  return renderer;
}

const SHOPS = [
  ['PADARIA', '#c96f4a', '#e8402e'], ['BARBEARIA', '#5b6fa8', '#1e6fd9'], ['PET AU-AU', '#b8894a', '#3b8c6b'],
  ['LANCHONETE', '#a8505f', '#ff8a00'], ['ACADEMIA', '#6a5b8c', '#1b1b1b'], ['BAR DO TONHO', '#8c6b3b', '#8c3b5b'],
  ['FARMÁCIA', '#5d8c7a', '#2f9e5f'], ['SORVETERIA', '#c47aa0', '#e84393'], ['OFICINA', '#7a7a8c', '#444466'],
  ['PASTELARIA', '#c9a24a', '#e8402e'],
];
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a1e, 0xffdbac];
const SHIRTS = [0x2e86de, 0xe8402e, 0x3b8c6b, 0xffd23f, 0x8c3b5b, 0x5b3b8c, 0xff8a00, 0x1b1b1b, 0xeeeeee, 0x16a085];
const SHOP_Z = -7.5, CROWD_ROWS = [-4.5, -5.5];

export class Arena {
  constructor(canImg) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xd7385e, 24, 70);
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
    this.camX = 0; this.camZ = 9; this.shake = 0;
    this.hype = 0;
    const s = this.scene;
    const rnd = (() => { let x = 12345; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296); })();

    s.add(new THREE.HemisphereLight(0xfff1e0, 0x553366, 1.6));
    const sun = new THREE.DirectionalLight(0xffd9b0, 2.5);
    sun.position.set(-4, 9, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -2, near: 1, far: 30 });
    sun.shadow.bias = -0.0005;
    this.sun = sun;
    s.add(sun, sun.target);
    // Pink-orange rim light from the sunset behind.
    const rim = new THREE.DirectionalLight(0xff9a8a, 1.6);
    rim.position.set(3, 4, -6);
    s.add(rim);
    this.scene.background = new THREE.Color(0x2b1055);

    // ---- Sky: gradient, striped sun, drifting clouds, far skyline ----
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshBasicMaterial({ map: skyTexture(), fog: false }));
    sky.position.set(0, 20, -45);
    s.add(sky);
    const sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshBasicMaterial({ map: sunTexture(), transparent: true, fog: false, depthWrite: false }));
    sunDisc.position.set(5, 9, -43);
    const sunGlow = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,190,90,0.55)'), transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    sunGlow.position.set(5, 9, -43.5);
    s.add(sunGlow, sunDisc);
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.5), new THREE.MeshBasicMaterial({ map: cloudTexture(i + 3), transparent: true, fog: false, depthWrite: false }));
      c.position.set(-40 + i * 16 + rnd() * 6, 13 + rnd() * 9, -40 + i * 0.1);
      c.userData.speed = 0.25 + rnd() * 0.35;
      s.add(c);
      this.clouds.push(c);
    }
    const skyline = new THREE.Mesh(new THREE.PlaneGeometry(170, 21), new THREE.MeshBasicMaterial({ map: skylineTexture(), transparent: true }));
    skyline.position.set(0, 10.5, -30);
    s.add(skyline);

    // ---- Ground: the street lane, the sidewalk, the street in front ----
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * WALL / 1000 + 10, 7),
      new THREE.MeshToonMaterial({ map: groundTexture() }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0.3);
    ground.receiveShadow = true;
    s.add(ground);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(140, 16), new THREE.MeshToonMaterial({ color: 0x3f3a4c }));
    apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.005, 11.5);
    apron.receiveShadow = true;
    s.add(apron);
    const swTex = sidewalkTexture(); swTex.repeat.set(30, 2);
    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(140, 0.2, 4.3), [
      new THREE.MeshToonMaterial({ color: 0x7d7090 }), new THREE.MeshToonMaterial({ color: 0x7d7090 }),
      new THREE.MeshToonMaterial({ map: swTex }), new THREE.MeshToonMaterial({ color: 0x7d7090 }),
      new THREE.MeshToonMaterial({ color: 0xc9bedb }), new THREE.MeshToonMaterial({ color: 0x7d7090 }),
    ]);
    sidewalk.position.set(0, 0.1, -3.2 - 2.15);
    sidewalk.receiveShadow = true;
    s.add(sidewalk);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(160, 30), new THREE.MeshToonMaterial({ color: 0x3a3347 }));
    far.rotation.x = -Math.PI / 2; far.position.set(0, -0.01, -22);
    s.add(far);

    // ---- Shops along the sidewalk, tall buildings behind them ----
    const colors = ['#5b3b8c', '#2f6f8f', '#8c3b5b', '#3b8c6b', '#8c6b3b', '#4b4b8c'];
    for (let i = 0; i < 14; i++) {
      const w = 4 + (i * 37 % 5) * 0.6, h = 9 + (i * 53 % 7) * 1.6;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), new THREE.MeshToonMaterial({ map: buildingTexture(i + 11, colors[i % colors.length]) }));
      b.position.set(-30 + i * 4.6, h / 2, -12 - (i % 3) * 2.5);
      s.add(b);
    }
    const SW = 5, SH = 6.25;
    SHOPS.forEach(([name, wall, sign], i) => {
      const x = -22.5 + i * SW;
      const side = new THREE.MeshToonMaterial({ color: new THREE.Color(wall).multiplyScalar(0.7) });
      const front = new THREE.MeshToonMaterial({ map: shopTexture(40 + i, name, wall, sign) });
      const shop = new THREE.Mesh(new THREE.BoxGeometry(SW, SH, 1.2), [side, side, side, side, front, side]);
      shop.position.set(x, SH / 2 + 0.2, SHOP_Z);
      s.add(shop);
      // Striped awning over the shop window.
      const aw = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), new THREE.MeshToonMaterial({ map: awningTexture(sign, '#f5efe6'), side: THREE.DoubleSide }));
      aw.position.set(x - 0.8, 1.95, SHOP_Z + 0.95);
      aw.rotation.x = -0.75;
      s.add(aw);
    });
    // Ads painted on the walls.
    const bb1 = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.9), new THREE.MeshBasicMaterial({ map: billboardTexture('garra', canImg) }));
    bb1.position.set(-5, 3.7, SHOP_Z + 0.62);
    const bb2 = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.9), new THREE.MeshBasicMaterial({ map: billboardTexture('racao') }));
    bb2.position.set(5, 3.7, SHOP_Z + 0.62);
    s.add(bb1, bb2);
    // Neon signs that flicker.
    this.neons = [];
    for (const [text, color, x, y] of [['LUTA!', '#ff3df2', -11, 3.75], ['24H', '#3df2ff', 11, 3.75], ['ABERTO', '#7dff1a', 0, 3.9]]) {
      const n = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshBasicMaterial({ map: neonTexture(text, color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      n.position.set(x, y, SHOP_Z + 0.65);
      n.userData.seed = rnd() * 100;
      s.add(n);
      this.neons.push(n);
    }

    // ---- String lights along the shop fronts ----
    const bulbs = [];
    for (let x = -24; x <= 24; x += 0.55) {
      const u = ((x + 24) % 4) / 4;
      bulbs.push([x, 2.95 - Math.sin(u * Math.PI) * 0.35, SHOP_Z + 1.1]);
    }
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), bulbs.length);
    const BULB_COLORS = [0xffe14a, 0xff5f6d, 0x3df2ff, 0x7dff1a, 0xff8a00];
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    bulbs.forEach((b, i) => {
      this.bulbs.setMatrixAt(i, m4.makeTranslation(b[0], b[1], b[2]));
      this.bulbs.setColorAt(i, col.setHex(BULB_COLORS[i % BULB_COLORS.length]));
    });
    this.bulbColors = bulbs.map((_, i) => BULB_COLORS[i % BULB_COLORS.length]);
    s.add(this.bulbs);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bulbs.map((b) => new THREE.Vector3(b[0], b[1] + 0.06, b[2]))), 400, 0.012, 4),
      new THREE.MeshBasicMaterial({ color: 0x1b1b1b }));
    s.add(wire);

    // ---- Crowd behind a striped barrier ----
    const stripe = stripeTexture(); stripe.repeat.set(30, 1);
    const railMat = new THREE.MeshToonMaterial({ map: stripe });
    for (const y of [0.55, 1.0]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(36, 0.14, 0.05), railMat);
      rail.position.set(0, y, -3.6);
      s.add(rail);
    }
    const postMat = new THREE.MeshToonMaterial({ color: 0x2a2a35 });
    for (let x = -18; x <= 18; x += 2.25) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.0, 0.07), postMat);
      post.position.set(x, 0.6, -3.6);
      s.add(post);
    }
    this.crowd = [];
    for (const [r, z] of CROWD_ROWS.entries()) {
      for (let x = -15 + r * 0.6; x <= 15; x += 1.05 + rnd() * 0.35) {
        this.crowd.push({ x: x + (rnd() - 0.5) * 0.2, z: z + (rnd() - 0.5) * 0.3, s: 0.85 + rnd() * 0.25,
          ph: rnd() * 10, sp: 3 + rnd() * 3, arms: rnd() < 0.5 ? 2 : 1 });
      }
    }
    const N = this.crowd.length;
    const toon = () => new THREE.MeshToonMaterial({ color: 0xffffff });
    this.crowdBody = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.21, 0.5, 4, 10), toon(), N);
    this.crowdHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 12, 10), toon(), N);
    this.crowdArm = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.055, 0.42, 3, 6), toon(), N * 2);
    this.crowd.forEach((p, i) => {
      this.crowdBody.setColorAt(i, col.setHex(SHIRTS[Math.floor(rnd() * SHIRTS.length)]).multiplyScalar(0.8));
      const skin = SKIN[Math.floor(rnd() * SKIN.length)];
      this.crowdHead.setColorAt(i, col.setHex(skin));
      this.crowdArm.setColorAt(i * 2, col.setHex(skin));
      this.crowdArm.setColorAt(i * 2 + 1, col.setHex(skin));
    });
    for (const m of [this.crowdBody, this.crowdHead, this.crowdArm]) { m.frustumCulled = false; s.add(m); }

    // ---- Stage edges: crates and burning oil drums ----
    const crateMat = new THREE.MeshToonMaterial({ color: 0x6e4524 });
    const drumMat = new THREE.MeshToonMaterial({ color: 0x5a3a2a });
    const flameTex = flameTexture();
    const emberTex = glowTexture('rgba(255,140,40,0.7)');
    this.fires = [];
    for (const side of [-1, 1]) {
      const x = side * (WALL / 1000 + 1.6);
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), crateMat);
      crate.position.set(x, 0.5, -1.2); crate.rotation.y = 0.3 * side; crate.castShadow = true;
      const crate2 = crate.clone(); crate2.position.set(x + side * 0.3, 1.5, -1.3); crate2.rotation.y = -0.2;
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.4, 1.1, 16), drumMat);
      drum.position.set(x - side * 0.9, 0.55, -2.4); drum.castShadow = true;
      s.add(crate, crate2, drum);
      const light = new THREE.PointLight(0xff8a2a, 3, 6, 1.6);
      light.position.set(drum.position.x, 1.6, drum.position.z + 0.3);
      s.add(light);
      const flames = [];
      for (let k = 0; k < 4; k++) {
        const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false }));
        f.center.set(0.5, 0.05);
        s.add(f);
        flames.push(f);
      }
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: emberTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.set(drum.position.x, 1.5, drum.position.z + 0.05); halo.scale.setScalar(2.4);
      s.add(halo);
      this.fires.push({ x: drum.position.x, z: drum.position.z, light, flames });
    }
    // Street lamps on the sidewalk.
    const glow = glowTexture('rgba(255,230,160,0.8)');
    for (const x of [-9.5, 9.5]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.6), new THREE.MeshToonMaterial({ color: 0x1e1e2e }));
      pole.position.set(x, 2.5, -6.4);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
      lamp.position.set(x, 4.8, -6.4);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.copy(lamp.position); halo.scale.setScalar(2.2);
      s.add(pole, lamp, halo);
    }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
  }

  // The crowd gets excited on big hits.
  cheer(k) { this.hype = Math.min(1.5, this.hype + k); }

  // Ambient animation: crowd, fire, neon flicker, clouds, twinkling bulbs.
  update(dt, T) {
    this.hype = Math.max(0, this.hype - dt * 0.5);
    const hype = Math.min(1, this.hype);
    const { _m: m, _q: q, _p: p, _s: sc } = this;
    const zAxis = new THREE.Vector3(0, 0, 1);
    this.crowd.forEach((c, i) => {
      // Idle sway, jumping and raised arms when hyped.
      const bounce = Math.max(0, Math.sin(T * c.sp * (1 + hype) + c.ph)) * (0.03 + hype * 0.22);
      const sway = Math.sin(T * 1.3 + c.ph) * 0.06;
      const base = 0.2 + bounce;
      sc.setScalar(c.s);
      q.setFromAxisAngle(zAxis, sway * 0.5);
      p.set(c.x, base + 0.46 * c.s, c.z);
      this.crowdBody.setMatrixAt(i, m.compose(p, q, sc));
      p.set(c.x - sway * 0.6, base + 1.07 * c.s, c.z);
      this.crowdHead.setMatrixAt(i, m.compose(p, q, sc));
      for (let a = 0; a < 2; a++) {
        const sgn = a ? 1 : -1;
        const up = a < c.arms ? hype : 0;
        const wave = Math.sin(T * 8 + c.ph + a) * 0.35 * up;
        const ang = sgn * (0.25 + up * 2.5 + wave);
        q.setFromAxisAngle(zAxis, ang);
        const sx = c.x + sgn * 0.24 * c.s, sy = base + 0.78 * c.s;
        // Capsule hangs from the shoulder: rotate its centre around the shoulder.
        p.set(0, -0.26 * c.s, 0).applyQuaternion(q).add(this._v || (this._v = new THREE.Vector3()).set(sx, sy, c.z));
        this.crowdArm.setMatrixAt(i * 2 + a, m.compose(p, q, sc));
      }
    });
    this.crowdBody.instanceMatrix.needsUpdate = true;
    this.crowdHead.instanceMatrix.needsUpdate = true;
    this.crowdArm.instanceMatrix.needsUpdate = true;

    for (const f of this.fires) {
      f.light.intensity = 3 + Math.sin(T * 17) * 0.7 + Math.sin(T * 29) * 0.5;
      f.flames.forEach((s, k) => {
        // Tongues of fire licking up out of the drum, each on its own beat.
        const life = (T * 2.2 + k / f.flames.length) % 1;
        s.position.set(f.x + (k - 1.5) * 0.15 + Math.sin(T * 6 + k * 2) * 0.05, 1.05 + life * 0.25, f.z + 0.02 * k);
        const h = (0.95 - life * 0.55) * (0.9 + Math.sin(T * 13 + k) * 0.12);
        s.scale.set(h * 0.6, h, 1);
        s.material.opacity = Math.min(1, (1 - life) * 1.6);
      });
    }
    for (const n of this.neons) {
      const t = T + n.userData.seed;
      // Mostly on, with short buzzing flickers.
      const off = (Math.sin(t * 0.7) > 0.93 && Math.sin(t * 40) > 0) ? 0.25 : 1;
      n.material.opacity = off * (0.9 + Math.sin(t * 9) * 0.05);
    }
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 55) c.position.x = -55;
    }
    // Twinkle: a few bulbs dim at a time, more blinking when the crowd is hyped.
    const col = this._c || (this._c = new THREE.Color());
    const step = Math.floor(T * (4 + hype * 10));
    if (step !== this._bulbStep) {
      this._bulbStep = step;
      for (let i = 0; i < this.bulbColors.length; i++) {
        const on = ((i * 7 + step) % 9) !== 0;
        this.bulbs.setColorAt(i, col.setHex(this.bulbColors[i]).multiplyScalar(on ? 1 : 0.3));
      }
      this.bulbs.instanceColor.needsUpdate = true;
    }
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    // Narrow (phone) screens get a wider view so both fighters fit.
    this.camera.fov = w / h < 1.2 ? 48 : 30;
    this.camera.updateProjectionMatrix();
  }

  // Follow the midpoint of the fighters; zoom out as they move apart.
  // focus = { x, z } zooms on one point (super start, final K.O.).
  updateCamera(xa, xb, dt, focus = null) {
    const mid = (xa + xb) / 2;
    const dist = Math.abs(xa - xb);
    const limit = WALL / 1000 - 2.6;
    const targetX = Math.max(-limit, Math.min(limit, focus ? focus.x : mid));
    const targetZ = focus ? focus.z : Math.max(9.4, Math.min(13, 7.4 + dist * 0.85));
    const k = 1 - Math.pow(focus ? 0.0001 : 0.001, dt);
    this.camX += (targetX - this.camX) * k;
    this.camZ += (targetZ - this.camZ) * k;
    this.shake *= Math.pow(0.002, dt);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    this.camera.position.set(this.camX + sx, 1.9 + sy, this.camZ);
    this.camera.lookAt(this.camX, 1.3, 0);
    this.sun.position.set(this.camX - 4, 9, 7);
    this.sun.target.position.set(this.camX, 0, 0);
  }
}
