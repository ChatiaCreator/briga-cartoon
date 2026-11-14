// Loads a Mixamo-rigged GLB and poses it each frame, either from an animation clip or from
// procedural pose parameters (hand/foot IK targets, spine and head rotation, body tilt).
// Pose coordinates are in "model space": +Z forward, +Y up, +X the character's left,
// in model units (the models are 1 unit tall).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const HEIGHT = 1.8; // metres on screen

const loader = new GLTFLoader();
const bufferCache = new Map();

export async function loadGLTF(url) {
  if (!bufferCache.has(url)) {
    bufferCache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Não foi possível carregar ${url} (${r.status})`);
      return r.arrayBuffer();
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

    // Clips are sampled directly (no AnimationMixer, which skips writes when it thinks a
    // value hasn't changed). Only rotations are used, so clips from another model with the
    // same Mixamo skeleton play correctly.
    this.clips = {};
    for (const clip of [...gltf.animations, ...extraClips]) this.addClip(clip);
  }

  addClip(clip) {
    const samplers = [];
    for (const track of clip.tracks) {
      if (!track.name.endsWith('.quaternion')) continue;
      const { nodeName } = THREE.PropertyBinding.parseTrackName(track.name);
      const bone = this.model.getObjectByName(nodeName);
      if (bone) samplers.push({ bone, interp: track.createInterpolant() });
    }
    this.clips[clip.name] = { duration: clip.duration, samplers };
  }

  resetPose() {
    for (let i = 0; i < this.bones.length; i++) {
      const [p, q, s] = this.rest[i];
      this.bones[i].position.copy(p);
      this.bones[i].quaternion.copy(q);
      this.bones[i].scale.copy(s);
    }
  }

  playClipAt(name, time) {
    const clip = this.clips[name];
    if (!clip) return false;
    const t = Math.min(Math.max(time, 0), clip.duration);
    for (const { bone, interp } of clip.samplers) bone.quaternion.fromArray(interp.evaluate(t));
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
  // The result is blended with the previous frame so state changes don't pop.
  applyPose(P, dt = 1 / 60) {
    this.solvePose(P);
    const a = 1 - Math.pow(1 - Math.min(1, P.alpha ?? 0.5), dt * 60);
    if (!this.prev) {
      this.prev = this.bones.map((o) => [o.quaternion.clone(), o.position.clone()]);
      return;
    }
    for (let i = 0; i < this.bones.length; i++) {
      const o = this.bones[i], [pq, pp] = this.prev[i];
      pq.slerp(o.quaternion, a);
      pp.lerp(o.position, a);
      o.quaternion.copy(pq);
      o.position.copy(pp);
    }
    this.model.updateMatrixWorld(true);
  }

  solvePose(P) {
    this.resetPose();
    // body = [pitch, yaw, roll, lift, pivotHeight] in radians / metres.
    const pivot = P.body[4] || 0;
    this.tilt.rotation.set(P.body[0], P.body[1], P.body[2]);
    this.tilt.position.set(0, pivot + (P.body[3] || 0), 0);
    this.model.position.set(0, -pivot, 0);
    if (P.clip) this.playClipAt(P.clip, P.clipTime);
    this.root.updateMatrixWorld(true);

    const rp = this.restPos;
    const hip = P.hip;
    // Hips offset.
    const hb = this.b.Hips;
    const target = this.mw(rp.Hips.x + hip[0], rp.Hips.y + hip[1], rp.Hips.z + hip[2]);
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
      twoBoneIK(this.b.LeftArm, this.b.LeftForeArm, this.b.LeftHand,
        this.mw(rp.LeftArm.x + hip[0] + lh[0], rp.LeftArm.y + hip[1] + lh[1], rp.LeftArm.z + hip[2] + lh[2]),
        this.mdir(0.5, -1, -0.6));
      twoBoneIK(this.b.RightArm, this.b.RightForeArm, this.b.RightHand,
        this.mw(rp.RightArm.x + hip[0] + rh[0], rp.RightArm.y + hip[1] + rh[1], rp.RightArm.z + hip[2] + rh[2]),
        this.mdir(-0.5, -1, -0.6));
    }

    if (!P.clip || P.legsIK) {
      const lf = P.lf, rf = P.rf;
      twoBoneIK(this.b.LeftUpLeg, this.b.LeftLeg, this.b.LeftFoot,
        this.mw(rp.LeftFoot.x + lf[0], rp.LeftFoot.y + lf[1], rp.LeftFoot.z + lf[2]),
        this.mdir(0.15, 0, 1));
      twoBoneIK(this.b.RightUpLeg, this.b.RightLeg, this.b.RightFoot,
        this.mw(rp.RightFoot.x + rf[0], rp.RightFoot.y + rf[1], rp.RightFoot.z + rf[2]),
        this.mdir(-0.15, 0, 1));
      const mq = this.model.getWorldQuaternion(new THREE.Quaternion());
      for (const n of ['LeftFoot', 'RightFoot']) {
        setWorldQuaternion(this.b[n], mq.clone().multiply(this.restFootQ[n]));
      }
    }
  }

  handWorld(side = 'Right', out = new THREE.Vector3()) {
    return this.b[side + 'Hand'].getWorldPosition(out);
  }
}
