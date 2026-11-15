// Loads a Mixamo-rigged GLB and poses it each frame, either from an animation clip or from
// procedural pose parameters (hand/foot IK targets, spine and head rotation, body tilt).
// Pose coordinates are in "model space": +Z forward, +Y up, +X the character's left,
// in model units (the models are 1 unit tall).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const HEIGHT = 1.8; // metres on screen
const IN_PLACE = new Set(['run', 'Short_Step_Forward']);

const loader = new GLTFLoader();
const bufferCache = new Map();

export async function loadGLTF(url) {
  if (!bufferCache.has(url)) {
    // Hosts that can't serve .glb get a base64 copy (see the "briga-b64" meta tag).
    const b64 = !!document.querySelector('meta[name="briga-b64"]');
    bufferCache.set(url, fetch(b64 ? `${url}.b64.txt` : url).then(async (r) => {
      if (!r.ok) throw new Error(`Não foi possível carregar ${url} (${r.status})`);
      if (!b64) return r.arrayBuffer();
      const bin = atob((await r.text()).trim());
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes.buffer;
    }));
  }
  const buf = await bufferCache.get(url);
  // Parse a fresh copy each time so two fighters can use the same character.
  return loader.parseAsync(buf.slice(0), '');
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _e = new THREE.Euler();

function boneByName(root, name) {
  return root.getObjectByName('mixamorig' + name) || root.getObjectByName('mixamorig:' + name);
}

function setWorldQuaternion(bone, qWorld) {
  bone.parent.getWorldQuaternion(_q3).invert();
  bone.quaternion.copy(_q3.multiply(qWorld));
  bone.updateMatrixWorld(true);
}

// Rotate `bone` (in world space) so the direction bone→from points towards bone→to.
function aim(bone, from, to) {
  const p = bone.getWorldPosition(_v3);
  const a = _v1.subVectors(from, p).normalize();
  const b = _v2.subVectors(to, p).normalize();
  if (a.lengthSq() < 1e-8 || b.lengthSq() < 1e-8) return;
  _q1.setFromUnitVectors(a, b);
  bone.getWorldQuaternion(_q2);
  setWorldQuaternion(bone, _q1.multiply(_q2));
}

const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _C = new THREE.Vector3();
const _T = new THREE.Vector3(), _K = new THREE.Vector3(), _dir = new THREE.Vector3(), _pole = new THREE.Vector3();

// Analytic two-bone IK: upper→mid→end reaches for `target`, bending towards `pole`.
function twoBoneIK(upper, mid, end, target, pole) {
  upper.getWorldPosition(_A); mid.getWorldPosition(_B); end.getWorldPosition(_C);
  const la = _A.distanceTo(_B), lb = _B.distanceTo(_C);
  _dir.subVectors(target, _A);
  let d = _dir.length();
  if (d < 1e-5) return;
  _dir.divideScalar(d);
  d = Math.min(Math.max(d, Math.abs(la - lb) + 1e-4), la + lb - 1e-4);
  _T.copy(_A).addScaledVector(_dir, d);
  const cosA = (la * la + d * d - lb * lb) / (2 * la * d);
  const along = la * cosA;
  const h = Math.sqrt(Math.max(0, la * la - along * along));
  _pole.copy(pole).addScaledVector(_dir, -pole.dot(_dir));
  if (_pole.lengthSq() < 1e-8) _pole.set(0, -1, 0);
  _pole.normalize();
  _K.copy(_A).addScaledVector(_dir, along).addScaledVector(_pole, h);
  aim(upper, _B, _K);
  mid.getWorldPosition(_B); end.getWorldPosition(_C);
  aim(mid, _C, _T);
}

const _UP = new THREE.Vector3(0, 1, 0);
const GRIP_R = new THREE.Vector3(0, -0.12, 1).normalize();     // right hand: forward, wrist cocked a bit
const GRIP_L = new THREE.Vector3(-0.5, -0.05, 1).normalize();  // left hand: forward and across, under the right
// Rotation whose +Z is `f` and +Y is `t` (made orthogonal to f).
function basisQ(f, t) {
  const z = f.clone().normalize();
  const y = t.clone().addScaledVector(z, -t.dot(z)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function makeOutline(mesh, thickness) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n transformed += normalize(objectNormal) * ${thickness.toFixed(4)};`,
    );
  };
  const outline = new THREE.SkinnedMesh(mesh.geometry, mat);
  outline.bind(mesh.skeleton, mesh.bindMatrix);
  outline.frustumCulled = false;
  outline.castShadow = false;
  return outline;
}

// Reference rig: the skeleton every clip was authored or converted for (Hotmonster's).
// Other models with the same bone names but differently rolled bones get their clips
// corrected on the fly (see Character.retarget).
let REF_REST = null;
export function setReferenceRig(root) {
  REF_REST = new Map();
  root.traverse((o) => { if (o.isBone) REF_REST.set(o.name, o.quaternion.clone()); });
}

// The models carry a "neutral_bone" outside the body hierarchy. Vertices weighted to it stay
// behind when the body travels (lying down, lunging) and show up as long thin spikes, so
// their weight goes to the strongest other bone of that vertex (or the hips).
function fixStrayWeights(mesh) {
  const bones = mesh.skeleton.bones;
  const stray = bones.findIndex((b) => /neutral_bone/i.test(b.name));
  if (stray < 0) return;
  const hips = bones.findIndex((b) => /Hips$/.test(b.name));
  const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
  for (let v = 0; v < si.count; v++) {
    let lost = 0, best = -1, bestW = 0;
    for (let k = 0; k < 4; k++) {
      const i = si.getComponent(v, k), w = sw.getComponent(v, k);
      if (i === stray && w > 0) { lost += w; sw.setComponent(v, k, 0); }
      else if (w > bestW) { bestW = w; best = k; }
    }
    if (!lost) continue;
    if (best >= 0) sw.setComponent(v, best, sw.getComponent(v, best) + lost);
    else { si.setComponent(v, 0, hips); sw.setComponent(v, 0, 1); }
  }
  si.needsUpdate = true; sw.needsUpdate = true;
}

export class Character {
  constructor(gltf, { tint = null, extraClips = [] } = {}) {
    this.root = new THREE.Group();
    this.tilt = new THREE.Group();
    this.root.add(this.tilt);
    this.model = gltf.scene;
    this.model.scale.setScalar(HEIGHT);
    this.tilt.add(this.model);

    this.model.traverse((o) => {
      if (o.isSkinnedMesh) {
        this.mesh = o;
        o.frustumCulled = false;
        o.castShadow = true;
        if (tint) {
          o.material = o.material.clone();
          o.material.color.multiply(new THREE.Color(tint));
        }
      }
    });
    if (this.mesh) {
      fixStrayWeights(this.mesh);
      // The outline is a sibling of the mesh so it shares the skeleton.
      this.mesh.parent.add(makeOutline(this.mesh, 0.006));
    }

    const names = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
      'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
      'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
    this.b = {};
    for (const n of names) {
      const bone = boneByName(this.model, n);
      if (!bone) throw new Error(`Osso ${n} não encontrado no modelo`);
      this.b[n] = bone;
    }
    this.bones = [];
    this.model.traverse((o) => { if (o.isBone) this.bones.push(o); });
    this.rest = this.bones.map((o) => [o.position.clone(), o.quaternion.clone(), o.scale.clone()]);
    this.retarget = this.makeRetarget();

    // Rest joint positions in model space.
    this.model.updateMatrixWorld(true);
    const toModel = (bone) => this.model.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
    this.restPos = {};
    for (const n of names) this.restPos[n] = toModel(this.b[n]);
    // Foot orientation relative to the model, to keep feet flat after leg IK.
    const mq = this.model.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.restFootQ = {
      LeftFoot: mq.clone().multiply(this.b.LeftFoot.getWorldQuaternion(new THREE.Quaternion())),
      RightFoot: mq.clone().multiply(this.b.RightFoot.getWorldQuaternion(new THREE.Quaternion())),
    };

    // Rest frame of each hand in model space (orientation, finger direction, thumb side),
    // used to turn the hands into a pistol grip (see gripPistol).
    this.handRest = {};
    for (const side of ['Right', 'Left']) {
      const hand = this.b[side + 'Hand'];
      const mid = boneByName(this.model, side + 'HandMiddle1'), thumb = boneByName(this.model, side + 'HandThumb1');
      if (!mid || !thumb) continue;
      const h = toModel(hand);
      const f = toModel(mid).sub(h).normalize();
      const t = toModel(thumb).sub(h);
      t.addScaledVector(f, -t.dot(f)).normalize();
      const q = mq.clone().multiply(hand.getWorldQuaternion(new THREE.Quaternion()));
      // Palm normal: fingers × thumb side points out of the back of the right hand.
      const palm = new THREE.Vector3().crossVectors(f, t).multiplyScalar(side === 'Right' ? -1 : 1);
      this.handRest[side] = { q, f, t, palmLocal: palm.applyQuaternion(q.clone().invert()) };
    }
    this.fingerBones = this.bones.filter((o) => /Hand(Thumb|Index|Middle|Ring|Pinky)\d/.test(o.name));

    // Clips are sampled directly (no AnimationMixer, which skips writes when it thinks a
    // value hasn't changed). Only rotations are used, so clips from another model with the
    // same Mixamo skeleton play correctly.
    this.clips = {};
    for (const clip of [...gltf.animations, ...extraClips]) this.addClip(clip);
  }

  // For a bone whose rest frame differs from the reference rig's, a clip rotation q (made for
  // the reference) becomes inv(O_parent) * q * O_self, where O is the accumulated offset
  // between the two rest frames. Bones already matching get no entry (no extra cost).
  makeRetarget() {
    if (!REF_REST) return null;
    const O = new Map(), out = new Map();
    let any = false;
    for (const b of this.bones) {
      const ref = REF_REST.get(b.name);
      const op = O.get(b.parent) || new THREE.Quaternion();
      if (!ref) { O.set(b, op.clone()); continue; }
      const o = ref.clone().invert().multiply(op).multiply(b.quaternion);
      O.set(b, o);
      const ip = op.clone().invert();
      if (2 * Math.acos(Math.min(1, Math.abs(o.w))) > 0.02 || 2 * Math.acos(Math.min(1, Math.abs(op.w))) > 0.02) {
        out.set(b, { ip, o });
        any = true;
      }
    }
    return any ? out : null;
  }

  addClip(clip) {
    const samplers = [];
    let hips = null;
    for (const track of clip.tracks) {
      const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(track.name);
      const bone = this.model.getObjectByName(nodeName);
      if (!bone) continue;
      if (propertyName === 'quaternion') samplers.push({ bone, interp: track.createInterpolant() });
      // Hips height comes from the clip too (crouching, falling). Other bones keep their own
      // lengths so clips work across characters.
      else if (propertyName === 'position' && bone === this.b.Hips) {
        const v = track.values, n = v.length / 3;
        // Clips in IN_PLACE travel forward; take that travel out (the game moves the fighter).
        const inPlace = IN_PLACE.has(clip.name);
        hips = {
          interp: track.createInterpolant(), x0: v[0], z0: v[2],
          dx: inPlace ? v[(n - 1) * 3] - v[0] : 0, dz: inPlace ? v[(n - 1) * 3 + 2] - v[2] : 0,
        };
      }
    }
    this.clips[clip.name] = { duration: clip.duration, samplers, hips };
  }

  resetPose() {
    for (let i = 0; i < this.bones.length; i++) {
      const [p, q, s] = this.rest[i];
      this.bones[i].position.copy(p);
      this.bones[i].quaternion.copy(q);
      this.bones[i].scale.copy(s);
    }
  }

  // opts.lockXZ: keep the hips over the feet spot (no travel); opts.clampUp: never let the
  // hips rise above standing height (airborne clips, where the game already lifts the fighter).
  playClipAt(name, time, opts = null) {
    const clip = this.clips[name];
    if (!clip) return false;
    const t = Math.min(Math.max(time, 0), clip.duration);
    for (const { bone, interp } of clip.samplers) {
      bone.quaternion.fromArray(interp.evaluate(t));
      const r = this.retarget?.get(bone);
      if (r) bone.quaternion.premultiply(r.ip).multiply(r.o);
    }
    const h = clip.hips;
    if (h) {
      const v = h.interp.evaluate(t);
      const k = clip.duration > 0 ? t / clip.duration : 0;
      const rest = this.rest[this.bones.indexOf(this.b.Hips)][0];
      // Keep the clip's sway around the rest spot, minus its overall drift.
      this.b.Hips.position.set(rest.x + (v[0] - h.x0 - h.dx * k), v[1], rest.z + (v[2] - h.z0 - h.dz * k));
      if (opts?.lockXZ) { this.b.Hips.position.x = rest.x; this.b.Hips.position.z = rest.z; }
      if (opts?.clampUp) this.b.Hips.position.y = Math.min(v[1], rest.y);
    }
    return true;
  }

  hasClip(name) { return !!this.clips[name]; }

  // Close the hands: finger rotations taken from a clip where the fighter makes fists.
  makeFists(clipName = 'box_01', time = 1.5) {
    const clip = this.clips[clipName];
    if (!clip) return;
    for (const { bone, interp } of clip.samplers) {
      if (!this.fingerBones.includes(bone)) continue;
      bone.quaternion.fromArray(interp.evaluate(time));
      const r = this.retarget?.get(bone);
      if (r) bone.quaternion.premultiply(r.ip).multiply(r.o);
    }
  }

  // Pistol grip: right hand with the fingers forward, thumb up and palm inward; the left hand
  // wraps around it from the side. Directions are in model space (+Z forward, +Y up).
  gripPistol() {
    const mq = this.model.getWorldQuaternion(new THREE.Quaternion());
    for (const side of ['Right', 'Left']) {
      const R = this.handRest[side];
      if (!R) continue;
      const f = side === 'Right' ? GRIP_R : GRIP_L;
      const D = basisQ(f, _UP).multiply(basisQ(R.f, R.t).invert());
      setWorldQuaternion(this.b[side + 'Hand'], mq.clone().multiply(D).multiply(R.q));
      this.curlFingers(side);
    }
  }

  // Close one hand around a grip: every finger joint bends towards the palm.
  curlFingers(side, amount = 1) {
    const R = this.handRest[side];
    if (!R) return;
    const hand = this.b[side + 'Hand'];
    const palm = R.palmLocal.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
    const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), axis = new THREE.Vector3(), q = new THREE.Quaternion();
    for (const bone of this.fingerBones) {
      if (!bone.name.includes(side + 'Hand')) continue;
      const child = bone.children.find((c) => c.isBone);
      if (!child) continue;
      const thumb = bone.name.includes('Thumb');
      bone.getWorldPosition(p0); child.getWorldPosition(p1);
      axis.crossVectors(p1.sub(p0).normalize(), palm);
      if (axis.lengthSq() < 1e-6) continue;
      q.setFromAxisAngle(axis.normalize(), amount * (thumb ? 0.55 : 1.25));
      setWorldQuaternion(bone, q.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
    }
  }

  // Where the pistol sits in the right hand (world space), or null.
  pistolTransform(pos, quat) {
    if (!this.handRest.Right) return false;
    const mq = this.model.getWorldQuaternion(new THREE.Quaternion());
    const fwd = GRIP_R.clone().applyQuaternion(mq), up = _UP.clone().applyQuaternion(mq);
    quat.copy(mq).multiply(basisQ(GRIP_R, _UP));
    this.b.RightHand.getWorldPosition(pos).addScaledVector(fwd, 0.075).addScaledVector(up, 0.03);
    return true;
  }

  // Model space → world.
  mw(x, y, z, out = new THREE.Vector3()) {
    return this.model.localToWorld(out.set(x, y, z));
  }
  mdir(x, y, z, out = new THREE.Vector3()) {
    return out.set(x, y, z).applyQuaternion(this.model.getWorldQuaternion(_q1)).normalize();
  }

  rotateModelSpace(bone, pitch, yaw, roll) {
    if (!pitch && !yaw && !roll) return;
    const mq = this.model.getWorldQuaternion(new THREE.Quaternion());
    const r = new THREE.Quaternion().setFromEuler(_e.set(pitch, yaw, roll, 'YXZ'));
    const w = mq.clone().multiply(r).multiply(mq.clone().invert());
    bone.getWorldQuaternion(_q2);
    setWorldQuaternion(bone, w.multiply(_q2));
  }

  // Apply a pose (see poses.js). Call after setting root position/rotation.
  // Inside one action the pose is shown exactly (crisp punches). When the action changes
  // (P.key) the old pose crossfades into the new one over P.blend seconds, so nothing pops.
  applyPose(P, dt = 1 / 60) {
    this.solvePose(P);
    const objs = this.blendObjs || (this.blendObjs = [this.tilt, this.model, ...this.bones]);
    if (!this.shown) {
      this.shown = objs.map((o) => [o.quaternion.clone(), o.position.clone()]);
      this.key = P.key;
      return;
    }
    // A new action, or the same one restarting (a second hit while already reeling).
    const restarted = P.key === this.key && P.t != null && this.lastT != null && P.t + 0.5 < this.lastT;
    if (P.key !== this.key || restarted) {
      this.key = P.key;
      this.from = this.shown.map(([q, p]) => [q.clone(), p.clone()]);
      this.fadeT = 0;
      this.fadeDur = P.blend ?? 0.1;
    }
    this.lastT = P.t;
    let w = 1;
    if (this.from) {
      this.fadeT += dt;
      const k = this.fadeT / this.fadeDur;
      if (k >= 1) this.from = null;
      else w = k * k * (3 - 2 * k);
    }
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i], [sq, sp] = this.shown[i];
      if (this.from) {
        const [fq, fp] = this.from[i];
        sq.copy(fq).slerp(o.quaternion, w);
        sp.copy(fp).lerp(o.position, w);
        o.quaternion.copy(sq);
        o.position.copy(sp);
      } else {
        sq.copy(o.quaternion);
        sp.copy(o.position);
      }
    }
    this.root.updateMatrixWorld(true);
  }

  solvePose(P) {
    this.resetPose();
    // body = [pitch, yaw, roll, lift, pivotHeight] in radians / metres.
    const pivot = P.body[4] || 0;
    this.tilt.rotation.set(P.body[0], P.body[1], P.body[2]);
    this.tilt.position.set(0, pivot + (P.body[3] || 0), 0);
    this.model.position.set(0, -pivot, 0);
    if (P.clip) this.playClipAt(P.clip, P.clipTime, P);
    this.root.updateMatrixWorld(true);
    // Play the clip turned around (P.clipYaw): the hips turn and their sway is mirrored.
    // Done on the hips bone (not the whole model) so blending in and out stays smooth.
    if (P.clip && P.clipYaw) {
      const hb = this.b.Hips, rh = this.restPos.Hips;
      const lp = this.model.worldToLocal(hb.getWorldPosition(new THREE.Vector3()));
      lp.x = 2 * rh.x - lp.x; lp.z = 2 * rh.z - lp.z;
      hb.position.copy(hb.parent.worldToLocal(this.model.localToWorld(lp)));
      hb.updateMatrixWorld(true);
      this.rotateModelSpace(hb, 0, P.clipYaw, 0);
    }

    // Feet planted where the clip puts them (legs then bend with IK when the hips move).
    let clipFeet = null;
    if (P.clip && P.legsIK) {
      const mq = this.model.getWorldQuaternion(new THREE.Quaternion()).invert();
      clipFeet = {};
      for (const n of ['LeftFoot', 'RightFoot']) {
        clipFeet[n] = {
          p: this.model.worldToLocal(this.b[n].getWorldPosition(new THREE.Vector3())),
          q: mq.clone().multiply(this.b[n].getWorldQuaternion(new THREE.Quaternion())),
        };
      }
    }

    const rp = this.restPos;
    const hip = P.hip;
    // Hips offset.
    const hb = this.b.Hips;
    // Offset from the clip's hips position (or the rest position without a clip).
    hb.updateMatrixWorld(true);
    const base = P.clip ? this.model.worldToLocal(hb.getWorldPosition(new THREE.Vector3())) : rp.Hips;
    const target = this.mw(base.x + hip[0], base.y + hip[1], base.z + hip[2]);
    hb.position.copy(hb.parent.worldToLocal(target));
    hb.updateMatrixWorld(true);
    if (P.hipRot) this.rotateModelSpace(hb, P.hipRot[0], P.hipRot[1], P.hipRot[2]);

    // Spine, spread over three bones; then neck/head.
    const [sp, sy, sr] = P.spine;
    for (const n of ['Spine', 'Spine1', 'Spine2']) this.rotateModelSpace(this.b[n], sp / 3, sy / 3, sr / 3);
    this.rotateModelSpace(this.b.Head, P.head[0], P.head[1], 0);

    if (P.clip && !P.armsIK) {
      // Arms come from the clip.
    } else {
      const lh = P.lh, rh = P.rh;
      // Hand targets are offsets from the shoulders: their rest position moved with the hips,
      // or (P.armsFromShoulder) where the clip put them, for clips that lower the body a lot.
      let sl, sr;
      if (P.armsFromShoulder) {
        this.root.updateMatrixWorld(true);
        sl = this.model.worldToLocal(this.b.LeftArm.getWorldPosition(new THREE.Vector3()));
        sr = this.model.worldToLocal(this.b.RightArm.getWorldPosition(new THREE.Vector3()));
      } else {
        sl = { x: rp.LeftArm.x + hip[0], y: rp.LeftArm.y + hip[1], z: rp.LeftArm.z + hip[2] };
        sr = { x: rp.RightArm.x + hip[0], y: rp.RightArm.y + hip[1], z: rp.RightArm.z + hip[2] };
      }
      twoBoneIK(this.b.LeftArm, this.b.LeftForeArm, this.b.LeftHand,
        this.mw(sl.x + lh[0], sl.y + lh[1], sl.z + lh[2]), this.mdir(0.5, -1, -0.6));
      twoBoneIK(this.b.RightArm, this.b.RightForeArm, this.b.RightHand,
        this.mw(sr.x + rh[0], sr.y + rh[1], sr.z + rh[2]), this.mdir(-0.5, -1, -0.6));
    }

    if (P.grip) this.gripPistol();
    // Closed fists for procedural guards (the clip's own fingers are left open).
    if (P.fists) { this.root.updateMatrixWorld(true); this.curlFingers('Left', 1.4); this.curlFingers('Right', 1.4); }

    if (!P.clip || P.legsIK) {
      const lf = P.lf, rf = P.rf;
      const baseL = clipFeet ? clipFeet.LeftFoot.p : rp.LeftFoot, baseR = clipFeet ? clipFeet.RightFoot.p : rp.RightFoot;
      twoBoneIK(this.b.LeftUpLeg, this.b.LeftLeg, this.b.LeftFoot,
        this.mw(baseL.x + lf[0], baseL.y + lf[1], baseL.z + lf[2]),
        this.mdir(0.15, 0, 1));
      twoBoneIK(this.b.RightUpLeg, this.b.RightLeg, this.b.RightFoot,
        this.mw(baseR.x + rf[0], baseR.y + rf[1], baseR.z + rf[2]),
        this.mdir(-0.15, 0, 1));
      const mq = this.model.getWorldQuaternion(new THREE.Quaternion());
      for (const n of ['LeftFoot', 'RightFoot']) {
        const fq = clipFeet ? clipFeet[n].q : this.restFootQ[n];
        // Toes tip up a little while the foot is in the air (P.toe = [left, right]).
        const toe = P.toe ? P.toe[n === 'LeftFoot' ? 0 : 1] : 0;
        const tq = mq.clone();
        if (toe) tq.multiply(_q1.setFromAxisAngle(_v1.set(1, 0, 0), -toe));
        setWorldQuaternion(this.b[n], tq.multiply(fq));
      }
    }
  }

  // White flash when hit (k = 0..1).
  setFlash(k) {
    const mat = this.mesh?.material;
    if (!mat || !mat.emissive || this.flashK === k) return;
    this.flashK = k;
    mat.emissive.setRGB(k, k, k);
    mat.emissiveIntensity = k ? 0.8 : 1;
  }

  handWorld(side = 'Right', out = new THREE.Vector3()) {
    return this.b[side + 'Hand'].getWorldPosition(out);
  }
}
