// Draws a game state: fighters, projectiles, effects and camera. Read-only on the sim.
import * as THREE from 'three';
import { Character, loadGLTF } from './character.js';
import { poseFor } from './poses.js';
import { Arena } from './scene.js';
import { Effects, Aura } from './effects.js';
import { shadowTexture, loadImage } from './textures.js';
import { CHARACTERS } from '../sim/moves.js';

const FACE_ANGLE = 1.15; // radians: side-on, turned a little towards the camera

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
async function loadShared() {
  const all = new Map();
  for (const c of Object.values(CHARACTERS)) {
    for (const a of (await loadGLTF(c.model)).animations) if (!all.has(a.name)) all.set(a.name, a);
  }
  return [...all.values()];
}

export async function preloadModels() {
  await Promise.all(Object.values(CHARACTERS).map((c) => loadGLTF(c.model)));
}

export class GameView {
  static async create(chars) {
    const canImg = await canImage();
    const shared = await sharedClips();
    const fighters = [];
    for (let i = 0; i < 2; i++) {
      const gltf = await loadGLTF(CHARACTERS[chars[i]].model);
      const own = new Set(gltf.animations.map((a) => a.name));
      const tint = i === 1 && chars[0] === chars[1] ? 0x9fc6ff : null; // mirror match: tint P2
      fighters.push(new Character(gltf, { tint, extraClips: shared.filter((a) => !own.has(a.name)) }));
    }
    return new GameView(fighters, canImg);
  }

  constructor(fighters, canImg) {
    this.arena = new Arena(canImg);
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
    this.T = 0;
  }

  handleEvents(events) {
    for (const ev of events) {
      if (ev.t === 'hit') {
        this.fx.hit(ev);
        this.arena.shake = Math.max(this.arena.shake, ev.ko ? 0.35 : ev.heavy ? 0.14 : 0.05);
      } else if (ev.t === 'block') this.fx.block(ev);
      else if (ev.t === 'splash') this.fx.splash(ev.x, ev.air ? 1200 : 0);
      else if (ev.t === 'thud') { this.fx.dust(ev.x); this.arena.shake = Math.max(this.arena.shake, 0.1); }
      else if (ev.t === 'land') this.fx.dust(this.lastState?.f[ev.f].x ?? 0);
    }
  }

  render(renderer, g, dt) {
    this.T += dt;
    this.lastState = g;
    const poses = [];
    for (let i = 0; i < 2; i++) {
      const f = g.f[i];
      const c = this.chars[i];
      const x = f.x / 1000, y = f.y / 1000;
      c.root.position.set(x, y, 0);
      c.root.rotation.y = f.facing * FACE_ANGLE;
      const P = poseFor(f, g, this.T + i * 0.37);
      poses.push(P);
      c.root.updateMatrixWorld(true);
      c.applyPose(P, dt);
      const sh = this.shadows[i];
      sh.position.set(x, 0.012, 0);
      const k = Math.max(0.3, 1 - y / 2.5);
      sh.scale.set(k, k, k);
      this.auras[i].update(f.buff > 0, x, y, this.T, f.buff < 90 ? (f.buff % 20 < 10 ? 0.4 : 1) : 1);
    }
    this.fx.holdItems(this.chars, poses);
    this.fx.syncProjectiles(g.proj, dt);
    this.fx.update(dt);
    this.arena.updateCamera(g.f[0].x / 1000, g.f[1].x / 1000, dt);
    renderer.render(this.scene, this.arena.camera);
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}
