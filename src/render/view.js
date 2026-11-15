// Draws a game state: fighters, projectiles, effects and camera. Read-only on the sim.
import * as THREE from 'three';
import { Character, loadGLTF, setReferenceRig } from './character.js';
import { poseFor } from './poses.js';
import { Arena } from './scene.js';
import { Effects, Aura, Trail } from './effects.js';
import { shadowTexture, loadImage } from './textures.js';
import { CHARACTERS } from '../sim/moves.js';

const FACE_ANGLE = 1.15; // radians: side-on, turned a little towards the camera
const TRAIL_COLORS = { hotmonster: 0xff7a1a, flash: 0xffe14a, genildo: 0x3da5ff };
const LIMBS = ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot'];

// The K.O. that ends the match: played in slow motion with the camera zoomed in.
export function isFinalKO(g) {
  const w = g.roundWinner;
  return g.phase === 'ko' && g.timer > 0 && (w === 0 || w === 1) && g.wins[w] + 1 >= 2 && g.phaseF < 80;
}

let canImgPromise = null;
export function canImage() {
  if (!canImgPromise) canImgPromise = loadImage('assets/can/garra.svg');
  return canImgPromise;
}

// Every animation from every model. Both characters use the Mixamo skeleton, so a clip
// made on one plays on the other.
let sharedPromise = null;
export function sharedClips() {
  if (!sharedPromise) sharedPromise = loadShared();
  return sharedPromise;
}
// Older clips the current models no longer carry (Flash's dash, Hotmonster's intro), and the
// Mixamo animations converted with tools/mixamo/convert.cjs.
const EXTRA_ANIMS = ['assets/models/extra_anims.glb', 'assets/models/mixamo_anims.glb'];
async function loadShared() {
  const all = new Map();
  setReferenceRig((await loadGLTF(CHARACTERS.hotmonster.model)).scene);
  for (const url of [...Object.values(CHARACTERS).map((c) => c.model), ...EXTRA_ANIMS]) {
    for (const a of (await loadGLTF(url)).animations) if (!all.has(a.name)) all.set(a.name, a);
  }
  return [...all.values()];
}

export async function preloadModels() {
  await Promise.all(Object.values(CHARACTERS).map((c) => loadGLTF(c.model)));
}

export class GameView {
  static async create(chars, stage = 'street') {
    const canImg = await canImage();
    const shared = await sharedClips();
    const fighters = [];
    for (let i = 0; i < 2; i++) {
      const gltf = await loadGLTF(CHARACTERS[chars[i]].model);
      const own = new Set(gltf.animations.map((a) => a.name));
      const tint = i === 1 && chars[0] === chars[1] ? 0x9fc6ff : null; // mirror match: tint P2
      fighters.push(new Character(gltf, { tint, extraClips: shared.filter((a) => !own.has(a.name)) }));
    }
    return new GameView(fighters, canImg, stage);
  }

  constructor(fighters, canImg, stage) {
    this.arena = new Arena(canImg, stage);
    this.scene = this.arena.scene;
    this.chars = fighters;
    this.fx = new Effects(this.scene, canImg);
    const shadowTex = shadowTexture();
    this.shadows = fighters.map((c) => {
      this.scene.add(c.root);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      s.rotation.x = -Math.PI / 2;
      s.renderOrder = 1;
      this.scene.add(s);
      return s;
    });
    this.auras = fighters.map(() => new Aura(this.scene, this.fx.glowGreen));
    this.trails = fighters.map(() => new Trail(this.scene, 0xffffff));
    this.flash = [0, 0];
    this.T = 0;
    this.prev = null;           // fighter/projectile positions one sim frame ago
    this.yaw = [null, null];    // displayed facing angle (turns smoothly)
  }

  // Called right before each sim step, so render() can draw between two frames.
  snapshot(g) {
    this.prev = {
      f: g.f.map((f) => [f.x, f.y]),
      p: new Map(g.proj.map((p) => [p.id, [p.x, p.y]])),
      frame: g.frame,
    };
  }

  handleEvents(events) {
    for (const ev of events) {
      if (ev.t === 'hit') {
        this.fx.hit(ev);
        this.flash[ev.f] = ev.heavy ? 0.14 : 0.08;
        this.arena.shake = Math.max(this.arena.shake, ev.ko ? 0.35 : ev.heavy ? 0.14 : 0.05);
        this.arena.cheer(ev.ko ? 1.5 : ev.heavy ? 0.5 : 0.15);
      } else if (ev.t === 'block') this.fx.block(ev);
      else if (ev.t === 'splash' && ev.kind !== 'bullet') this.fx.splash(ev.x, ev.air ? 1200 : 0);
      else if (ev.t === 'thud') { this.fx.dust(ev.x); this.arena.shake = Math.max(this.arena.shake, 0.1); }
      else if (ev.t === 'shot') {
        // Muzzle flash at the gun (in front of the shooter's hands).
        const c = this.chars[ev.f];
        const pos = c.b.RightHand.getWorldPosition(new THREE.Vector3());
        pos.add(new THREE.Vector3(0, 0, 0.3).applyQuaternion(c.model.getWorldQuaternion(new THREE.Quaternion())));
        this.fx.muzzle(pos);
        this.arena.shake = Math.max(this.arena.shake, 0.05);
      } else if (ev.t === 'land') this.fx.dust(this.lastState?.f[ev.f].x ?? 0);
    }
  }

  render(renderer, g, dt, frac = 1) {
    this.T += dt;
    this.lastState = g;
    // Only interpolate from the frame right before this one (not across round resets).
    const prev = this.prev && this.prev.frame === g.frame - 1 ? this.prev : null;
    const lk = prev ? frac : 1;
    const poses = [];
    for (let i = 0; i < 2; i++) {
      const f = g.f[i];
      const c = this.chars[i];
      const [px, py] = prev ? prev.f[i] : [f.x, f.y];
      const x = (px + (f.x - px) * lk) / 1000, y = (py + (f.y - py) * lk) / 1000;
      c.root.position.set(x, y, 0);
      (this.posX ||= [0, 0])[i] = x;
      // Whoever gets hit shakes in place during the hit-stop.
      if (g.hitstop > 0 && (f.st === 'hit' || f.st === 'block' || f.st === 'fall') && g.phase !== 'intro') {
        c.root.position.x += Math.sin(this.T * 95) * (f.st === 'block' ? 0.015 : 0.035);
      }
      // Turning around goes through facing the camera instead of popping.
      const want = f.facing * FACE_ANGLE;
      if (this.yaw[i] === null) this.yaw[i] = want;
      this.yaw[i] += (want - this.yaw[i]) * (1 - Math.pow(0.0005, dt));
      c.root.rotation.y = this.yaw[i];
      // Animation time runs between sim frames too (except while the hit-stop freezes it).
      const sub = g.hitstop > 0 || !prev ? 0 : frac;
      const view = { ...f, x: x * 1000, sf: f.sf + sub };
      const P = poseFor(view, g, this.T + i * 0.37);
      poses.push(P);
      c.root.updateMatrixWorld(true);
      c.applyPose(P, dt);
      const sh = this.shadows[i];
      sh.position.set(x, 0.012, 0);
      const k = Math.max(0.3, 1 - y / 2.5);
      sh.scale.set(k, k, k);
      this.auras[i].update(f.buff > 0, x, y, this.T, f.buff < 90 ? (f.buff % 20 < 10 ? 0.4 : 1) : 1);
      this.updateTrail(i, f, c);
      this.flash[i] = Math.max(0, this.flash[i] - dt);
      c.setFlash(this.flash[i] > 0 ? 1 : 0);
    }
    this.fx.holdItems(this.chars, poses);
    this.fx.syncProjectiles(g.proj, dt, prev ? prev.p : null, lk);
    this.fx.update(dt);
    this.arena.update(dt, this.T);
    this.arena.updateCamera(this.posX[0], this.posX[1], dt, this.focusFor(g));
    renderer.render(this.scene, this.arena.camera);
  }

  // Strong attacks leave a ribbon behind the limb that is reaching out the most.
  updateTrail(i, f, c) {
    const m = f.st === 'attack' ? CHARACTERS[f.char].moves[f.mv] : null;
    const strong = m && m.rank >= 2 && !m.buff && !m.rain
      && f.sf >= m.startup - 3 && f.sf <= m.startup + Math.max(m.active, 4) + 2;
    // Follow the limb that is moving fastest (the one doing the hitting).
    const now = LIMBS.map((n) => c.b[n].getWorldPosition(new THREE.Vector3()));
    const last = this.limbPrev?.[i];
    let p = null;
    if (strong && last) {
      let best = -1;
      for (let j = 0; j < LIMBS.length; j++) {
        const d = now[j].distanceToSquared(last[j]);
        if (d > best) { best = d; p = now[j]; }
      }
      if (this.trailLimb?.[i] != null && f.sf > m.startup - 3) p = now[this.trailLimb[i]];
      else (this.trailLimb ||= [null, null])[i] = now.indexOf(p);
    } else if (this.trailLimb) this.trailLimb[i] = null;
    (this.limbPrev ||= [null, null])[i] = now;
    this.trails[i].setColor(f.buff > 0 ? 0x7dff1a : TRAIL_COLORS[f.char] || 0xffffff);
    this.trails[i].update(p);
  }

  focusFor(g) {
    if (isFinalKO(g)) {
      const loser = g.f[1 - g.roundWinner];
      return { x: loser.x / 1000, z: 6.2 };
    }
    // Super freeze: zoom on whoever started it.
    if (g.hitstop > 0) {
      const f = g.f.find((x) => x.st === 'attack' && x.mv === 'super' && x.sf <= 1);
      if (f) return { x: f.x / 1000, z: 5.6 };
    }
    return null;
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}
