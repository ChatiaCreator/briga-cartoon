// Draws a game state: fighters, projectiles, effects and camera. Read-only on the sim.
import * as THREE from 'three';
import { Character, loadGLTF, setReferenceRig } from './character.js';
import { poseFor } from './poses.js';
import { Arena } from './scene.js';
import { Effects, Aura, Trail } from './effects.js';
import { shadowTexture, loadImage } from './textures.js';
import { CHARACTERS } from '../sim/moves.js';

const FACE_ANGLE = 1.15; // radians: side-on, turned a little towards the camera
const TRAIL_COLORS = { hotmonster: 0xff7a1a, flash: 0xffe14a, genildo: 0x3da5ff, anderon: 0xff3d6e, hgl: 0xff9a2e, davidson: 0x5fd35f, trump: 0xff3b3b };
const LIMBS = ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot'];
const FLIP_FRAMES = 30; // frames the forward-jump somersault takes

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

// All animations live in one compressed file (tools/optimize/build.mjs): each model's own clips
// as "<model>:<clip>" and the Mixamo ones as "mixamo:<clip>". Every fighter uses the Mixamo
// skeleton, so a clip made on one plays on the others. Its bare node tree is Hotmonster's
// skeleton, the reference rig the clips were made for.
export const ANIMS_URL = 'assets/models/anims.glb';
const ORDER = ['hotmonster', 'flash', 'anderon', 'hgl', 'davidson', 'trump', 'mixamo']; // first one wins for shared clips
let sharedPromise = null;
export function sharedClips() {
  if (!sharedPromise) sharedPromise = loadShared();
  return sharedPromise;
}
async function loadShared() {
  const gltf = await loadGLTF(ANIMS_URL);
  setReferenceRig(gltf.scene);
  const own = {}, shared = new Map();
  const named = (clip, name) => { const c = clip.clone(); c.name = name; return c; };
  const byPrefix = (pre) => gltf.animations.filter((a) => a.name.startsWith(pre + ':'));
  for (const pre of ORDER) {
    own[pre] = [];
    for (const a of byPrefix(pre)) {
      const name = a.name.slice(pre.length + 1);
      own[pre].push(named(a, name));
      if (!shared.has(name)) shared.set(name, named(a, name));
    }
  }
  return { own, shared: [...shared.values()] };
}

// The clips a fighter plays: its own model's first, then the shared ones.
export async function fighterClips(char) {
  const { own, shared } = await sharedClips();
  const mine = own[char] || [];
  const names = new Set(mine.map((a) => a.name));
  return [...mine, ...shared.filter((a) => !names.has(a.name))];
}

// Files a match needs (for the loading bar).
export function matchFiles(chars) {
  return [ANIMS_URL, ...new Set(chars.map((c) => CHARACTERS[c].model))];
}

export class GameView {
  static async create(chars, stage = 'street') {
    const canImg = await canImage();
    const [g0, g1] = await Promise.all(chars.map((c) => loadGLTF(CHARACTERS[c].model)));
    const fighters = [];
    for (let i = 0; i < 2; i++) {
      const tint = i === 1 && chars[0] === chars[1] ? 0x9fc6ff : null; // mirror match: tint P2
      fighters.push(new Character(i ? g1 : g0, { tint, extraClips: await fighterClips(chars[i]) }));
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
        this.flash[ev.f] = ev.big ? 0.2 : ev.heavy ? 0.14 : 0.08;
        this.arena.shake = Math.max(this.arena.shake, ev.ko ? 0.35 : ev.big ? 0.26 : ev.heavy ? 0.14 : 0.05);
        this.arena.cheer(ev.ko ? 1.5 : ev.big ? 1 : ev.heavy ? 0.5 : 0.15);
      } else if (ev.t === 'block') this.fx.block(ev);
      else if (ev.t === 'splash' && ev.kind === 'racao') this.fx.splash(ev.x, ev.air ? 1200 : 0);
      else if (ev.t === 'splash' && ev.kind === 'screwdriver') this.fx.sparks(ev.x, ev.air ? 1400 : 100);
      else if (ev.t === 'thud') { this.fx.dust(ev.x); this.arena.shake = Math.max(this.arena.shake, 0.1); }
      else if (ev.t === 'bounce') { this.fx.dust(ev.x); this.fx.dust(ev.x); this.arena.shake = Math.max(this.arena.shake, 0.22); }
      else if (ev.t === 'shot') {
        // Muzzle flash at the gun (in front of the shooter's hands).
        const c = this.chars[ev.f];
        const pos = c.b.RightHand.getWorldPosition(new THREE.Vector3());
        pos.add(new THREE.Vector3(0, 0, 0.3).applyQuaternion(c.model.getWorldQuaternion(new THREE.Quaternion())));
        this.fx.muzzle(pos);
        this.arena.shake = Math.max(this.arena.shake, 0.05);
      } else if (ev.t === 'land') this.fx.dust(this.lastState?.f[ev.f].x ?? 0);
      else if (ev.t === 'heal') {
        const c = this.chars[ev.f];
        this.fx.heal(c.b.Head.getWorldPosition(new THREE.Vector3()), ev.amount);
        this.flash[ev.f] = 0;
      }
    }
  }

  render(renderer, g, dt, frac = 1) {
    this.T += dt;
    this.lastState = g;
    // Only interpolate from the frame right before this one (not across round resets).
    const prev = this.prev && this.prev.frame === g.frame - 1 ? this.prev : null;
    const lk = prev ? frac : 1;
    const poses = [];
    const pos = g.f.map((f, i) => {
      const [px, py] = prev ? prev.f[i] : [f.x, f.y];
      return [(px + (f.x - px) * lk) / 1000, (py + (f.y - py) * lk) / 1000];
    });
    for (let i = 0; i < 2; i++) {
      const f = g.f[i];
      const c = this.chars[i];
      // Being thrown: drawn on the thrower's spot (the paired clip places the body).
      const thrown = f.st === 'thrown' && CHARACTERS[g.f[1 - i].char].moves.throw.throw.kind === 'behind';
      const [x, y] = pos[thrown ? 1 - i : i];
      c.root.position.set(x, y, 0);
      (this.posX ||= [0, 0])[i] = x;
      // Whoever gets hit shakes in place during the hit-stop.
      if (g.hitstop > 0 && (f.st === 'hit' || f.st === 'block' || f.st === 'fall') && g.phase !== 'intro') {
        c.root.position.x += Math.sin(this.T * 95) * (f.st === 'block' ? 0.015 : 0.035);
      }
      // Turning around goes through facing the camera instead of popping.
      const want = (thrown ? g.f[1 - i].facing : f.facing) * FACE_ANGLE;
      if (this.yaw[i] === null) this.yaw[i] = want;
      if (thrown) this.yaw[i] = this.yaw[1 - i] ?? want;
      else this.yaw[i] += (want - this.yaw[i]) * (1 - Math.pow(0.0005, dt));
      c.root.rotation.y = this.yaw[i];
      // Animation time runs between sim frames too (except while the hit-stop freezes it).
      const sub = g.hitstop > 0 || !prev ? 0 : frac;
      // Leaving a crouch (render only): play the stand-up for a moment.
      const low = f.st === 'crouch' || (f.st === 'block' && f.guardLow) || (f.st === 'attack' && f.mv[0] === 'c');
      this.standT ||= [null, null]; this.wasLow ||= [false, false];
      if (low) this.standT[i] = null;
      else if (this.wasLow[i] && (f.st === 'idle' || f.st === 'walk')) this.standT[i] = 0;
      else if (this.standT[i] != null) this.standT[i] = f.st === 'idle' || f.st === 'walk' ? this.standT[i] + dt : null;
      this.wasLow[i] = low;
      const view = { ...f, x: x * 1000, sf: f.sf + sub, standT: this.standT[i], flip: this.somersault(i, f, g, dt) };
      const P = poseFor(view, g, this.T + i * 0.37);
      poses.push(P);
      c.root.updateMatrixWorld(true);
      c.applyPose(P, dt);
      const sh = this.shadows[i];
      sh.position.set(x, 0.012, 0);
      const k = Math.max(0.3, 1 - y / 2.5);
      sh.scale.set(k, k, k);
      // Flash's GARRA buff, and Davidson's chill while his super heals him.
      const chill = f.char === 'davidson' && f.st === 'attack' && f.mv === 'super' && f.sf >= 30;
      this.auras[i].update(f.buff > 0 || chill, x, y, this.T, chill ? 0.7 : f.buff < 90 ? (f.buff % 20 < 10 ? 0.4 : 1) : 1);
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

  // Forward jumps do a cartoon somersault (render only). Decided at take-off: not when jumping
  // after a launched opponent (f.chase). It turns in FLIP_FRAMES; an air attack thrown halfway
  // speeds it up to finish the turn instead of snapping upright.
  somersault(i, f, g, dt) {
    const S = (this.flips ||= [null, null]);
    const airborne = f.y > 0 && (f.st === 'air' || (f.st === 'attack' && CHARACTERS[f.char].moves[f.mv]?.air));
    if (!airborne) { S[i] = null; return 0; }
    if (!S[i]) S[i] = { on: f.vx !== 0 && Math.sign(f.vx) === f.facing && !f.chase, k: 0 };
    const s = S[i];
    if (!s.on || s.k >= 1) return 0;
    if (g.hitstop === 0) s.k = Math.min(1, s.k + (dt * 60 * (f.st === 'attack' ? 3 : 1)) / FLIP_FRAMES);
    const e = s.k * s.k * (3 - 2 * s.k);
    return e >= 1 ? 0 : e * Math.PI * 2;
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
