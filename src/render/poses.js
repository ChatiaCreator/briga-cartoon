// Turns a fighter's simulation state into a pose for Character.applyPose().
// Clips: idle stance and the jab come from box_01, the strong punch from box_02.
// Everything else is procedural (IK targets in model units, see character.js).
import { CHARACTERS } from '../sim/moves.js';

const lerp = (a, b, k) => a + (b - a) * k;
const lerpArr = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const ease = (k) => k * k * (3 - 2 * k);

const KEYS = ['hip', 'hipRot', 'spine', 'head', 'lh', 'rh', 'lf', 'rf', 'body', 'toe'];

export function basePose() {
  return {
    clip: null, clipTime: 0, armsIK: false, legsIK: false,
    hip: [0, -0.06, -0.01], hipRot: [0, 0, 0], spine: [0.08, -0.15, 0], head: [0, 0.15, 0],
    lh: [-0.07, 0.07, 0.15], rh: [0.07, 0.05, 0.12],
    lf: [0.03, 0, 0.13], rf: [-0.03, 0, -0.11],
    body: [0, 0, 0, 0, 0], toe: [0, 0],
    alpha: 0.45, hand: null,
  };
}

export function mixPose(a, b, k) {
  const out = { ...a };
  for (const key of KEYS) out[key] = lerpArr(a[key], b[key], k);
  return out;
}

function withP(base, patch) {
  const p = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (KEYS.includes(k)) p[k] = base[k].map((x, i) => x + (v[i] || 0));
    else p[k] = v;
  }
  return p;
}

const STANCE = basePose();
// Base for clip-driven poses: no extra hip/spine/head offsets on top of the clip.
const CLIP = { ...STANCE, hip: [0, 0, 0], spine: [0, 0, 0], head: [0, 0, 0] };
// Locomotion: upper body from the boxing stance clip (same guard as idle, so moving and
// standing blend seamlessly), feet planted where the clip has them and moved by IK.
const LOCO = { ...CLIP, clip: 'box_01', legsIK: true, lf: [0, 0, 0], rf: [0, 0, 0], toe: [0, 0] };
const CROUCH = withP(STANCE, { hip: [0, -0.17, -0.03], spine: [0.22, 0, 0], lh: [0, -0.12, 0.02], rh: [0, -0.12, 0.02], lf: [0.02, 0, 0.03], rf: [-0.02, 0, -0.04] });
// Crouch from Mixamo "Crouch Idle" (low squat), with the guard held up by arm IK anchored at
// the clip's shoulders and the head up, looking at the opponent.
const KNEEL = { ...CLIP, clip: 'Crouch_Idle', clipTime: 0.5, armsIK: true, armsFromShoulder: true, fists: true,
  spine: [-0.14, 0, 0], head: [-0.3, 0, 0], lh: [-0.03, 0.03, 0.13], rh: [0.05, 0.01, 0.11] };
const KNEEL_GUARD = { ...KNEEL, spine: [-0.08, 0.12, 0], lh: [-0.06, 0.05, 0.17], rh: [0.03, 0.03, 0.16] };
const kneelTime = (T) => T % 1.66;
const AIR = withP(STANCE, { hip: [0, 0.06, 0], lf: [0, 0.16, 0.08], rf: [0, 0.24, 0.02], spine: [0.1, 0, 0] });

// Procedural attack poses: W = wind-up, S = strike. Deltas on top of the base pose.
const ATTACKS = {
  clp: { base: KNEEL, W: { rh: [0, 0, -0.04] }, S: { lh: [0.02, -0.02, 0.3], spine: [0, -0.35, 0] } },
  chp: { base: CROUCH, W: { rh: [0.02, -0.1, -0.02], hip: [0, -0.02, 0] }, S: { rh: [-0.06, 0.38, 0.12], hip: [0, 0.14, 0.02], spine: [-0.2, 0.5, 0], head: [-0.3, 0, 0] } },
  lk: { base: STANCE, W: { lf: [0, 0.18, 0.02] }, S: { lf: [-0.02, 0.24, 0.36], spine: [-0.18, 0, 0], hip: [0, 0, -0.04] } },
  hk: { base: STANCE, W: { rf: [0.04, 0.25, 0.05], spine: [0, 0.3, 0] }, S: { rf: [0.05, 0.56, 0.48], spine: [-0.35, 0.8, 0.15], hipRot: [0, 0.7, 0], hip: [0, 0.02, -0.04], lh: [0.08, -0.02, -0.08], rh: [-0.04, -0.12, -0.05] } },
  clk: { base: CROUCH, W: {}, S: { lf: [0, 0.03, 0.34], hip: [0, 0, -0.05] } },
  chk: { base: CROUCH, W: { hip: [0, 0.02, 0] }, S: { rf: [0.06, 0.0, 0.8], lf: [0.02, 0, -0.02], spine: [-0.1, 0.35, 0], hip: [0, -0.02, 0.02], lh: [0.05, -0.15, 0.05] } },
  jlp: { base: AIR, W: {}, S: { lh: [-0.04, -0.06, 0.32], spine: [0.15, -0.3, 0] } },
  jhp: { base: AIR, W: { rh: [0, 0.12, -0.08] }, S: { rh: [-0.05, -0.12, 0.33], spine: [0.3, 0.4, 0] } },
  jlk: { base: AIR, W: {}, S: { lf: [0, -0.12, 0.34], spine: [-0.1, 0, 0] } },
  jhk: { base: AIR, W: { rf: [0, 0.1, 0] }, S: { rf: [0.04, 0.02, 0.62], lf: [0, 0.05, -0.05], spine: [-0.2, 0.5, 0], body: [0.2, 0, 0, 0, 0] } },
};

// Clip-driven attacks: [clip, startupFrom, activeAt, activeTo, recoveryTo], per character.
const AIRCLIP = { lockXZ: true, clampUp: true };
// [clip, startupFrom, activeAt, activeTo, recoveryTo, yaw, rampYaw, opts]: the clip time at
// the start of the move, at the hit, at the end of the hit and at the end of the recovery.
// Both fighters use the Mixamo moves (converted with tools/mixamo/convert.cjs).
const TRAVEL = { lockXZ: true };   // the game moves the fighter; the clip's own travel is removed
const MIXAMO_ATTACKS = {
  // Jab string from "Quad Punch": pressing LP again chains to the next of its four punches.
  lp: ['Quad_Punch', 0.36, 0.5, 0.56, 0.66],
  lp2: ['Quad_Punch', 0.58, 0.7, 0.75, 0.86],
  lp3: ['Quad_Punch', 0.8, 0.92, 0.98, 1.06],
  lp4: ['Quad_Punch', 1.04, 1.2, 1.26, 1.5],
  hp: ['Boxing', 0.2, 0.6, 0.72, 1.6],                        // lunging straight
  lk: ['Martelo_2', 0.22, 0.45, 0.58, 1.25],                  // capoeira "martelo"
  hk: ['Inside_Crescent_Kick', 0.95, 1.32, 1.45, 2.3],        // hop and spinning crescent
  fk: ['Kicking', 0.45, 1.18, 1.36, 1.75, 0, false, TRAVEL],  // VOADORA: run-up jumping kick
  cw: ['Martelo_Do_Chau_Sem_Mao', 0.3, 1.12, 1.3, 2.1, 0, false, TRAVEL], // ESTRELA
  // Rising punch out of the crouch.
  chp: ['box_02', 1.0, 1.75, 1.95, 2.35],
  // ESQUIVA: the deep duck from Mixamo "Dodging" (the game slides the fighter back).
  dodge: ['Dodging', 0.05, 0.55, 0.55, 0.75, 0, false, TRAVEL],
  // Air kicks: only the airborne part, with the clip's own travel and height taken out.
  jlk: ['Kicking', 0.95, 1.2, 1.32, 1.42, 0, false, AIRCLIP],
  jhk: ['Inside_Crescent_Kick', 1.12, 1.32, 1.45, 1.58, 0, false, AIRCLIP],
};
// Each fighter swaps a few moves for their own (Mixamo clips the player picked).
const PEC = 'Punch_To_Elbow_Combo';
const FFA = 'Fist_Fight_A', KJU = 'Knee_Jabs_To_Uppercut', UJ = 'Uppercut_Jab', EUC = 'Elbow_Uppercut_Combo';
// Uppercut out of the crouch, from Mixamo "Uppercut Jab".
const UPPERCUT = [UJ, 0.5, 0.86, 0.95, 1.3, 0, false, TRAVEL];
const CLIP_ATTACKS = {
  hotmonster: {
    ...MIXAMO_ATTACKS,
    // Jab string mixes in the hooks from "Fist Fight A".
    lp2: [FFA, 1.35, 1.55, 1.62, 1.85, 0, false, TRAVEL],
    lp3: [FFA, 2.55, 2.7, 2.76, 2.95, 0, false, TRAVEL],
    lk: [FFA, 3.38, 3.6, 3.72, 3.95, 0, false, TRAVEL],     // snap kick from "Fist Fight A"
    hk: ['Martelo_2', 0.1, 0.45, 0.62, 1.3],
    hp: [UJ, 1.7, 1.98, 2.06, 2.45, 0, false, TRAVEL],    // long straight from "Uppercut Jab"
    chp: UPPERCUT,
    tc: ['Boxing', 0.2, 0.6, 0.72, 1.5, 0, false, TRAVEL],  // FÚRIA DO MONSTRO: lunging haymaker
  },
  flash: {
    ...MIXAMO_ATTACKS,
    fk: ['Flying_Kick', 0.0, 0.42, 0.56, 1.1, 0, false, TRAVEL], // VOADORA: flying kick
    // "Elbow Uppercut Combo": the elbow is his strong punch, the uppercut his crouching one.
    hp: [EUC, 0.35, 0.7, 0.8, 1.05, 0, false, TRAVEL],
    chp: [EUC, 1.0, 1.33, 1.43, 1.9, 0, false, TRAVEL],
    tc: [EUC, 0.95, 1.33, 1.43, 1.9, 0, false, TRAVEL],   // UPPER RELÂMPAGO: the uppercut after the elbow
  },
  hgl: {
    ...MIXAMO_ATTACKS,
    hp: ['Illegal_Headbutt', 0.4, 0.84, 0.92, 1.4, 0, false, TRAVEL],    // headbutt
    tc: ['Illegal_Headbutt', 0.2, 0.84, 0.92, 1.45, 0, false, TRAVEL],
    jhk: ['Flying_Bicycle_Kick', 0.0, 0.3, 0.45, 0.66, 0, false, AIRCLIP], // bicycle kick in the air
    special: ['Running_Slide', 0.05, 0.3, 0.75, 1.3, 0, false, TRAVEL],   // CARRINHO
    dodge: ['Long_Right_Side_Step', 0.05, 0.4, 0.4, 0.8, 0, false, TRAVEL],
  },
  anderon: {
    ...MIXAMO_ATTACKS,
    // Mixamo "Punching" opens the jab string, then the hooks of "Punch To Elbow Combo".
    lp: ['Punching', 0.2, 0.4, 0.46, 0.7],
    lp2: [PEC, 0.85, 1.08, 1.14, 1.4, 0, false, TRAVEL],
    lp3: [PEC, 1.6, 1.86, 1.92, 2.1, 0, false, TRAVEL],
    lp4: [PEC, 2.1, 2.34, 2.4, 2.6, 0, false, TRAVEL],
    hp: [PEC, 2.65, 2.94, 3.02, 3.4, 0, false, TRAVEL],     // elbow
    hk: ['Armada', 0.55, 1.22, 1.32, 1.63, 0, false, TRAVEL], // capoeira "armada"
    tc: ['Armada', 0.3, 1.22, 1.32, 1.63, 0, false, TRAVEL],
    special: ['Armada', 0.25, 1.22, 1.32, 1.63, 0, false, TRAVEL],
  },
  genildo: {
    ...MIXAMO_ATTACKS,
    // Clinch knees and the uppercut from "Knee Jabs To Uppercut".
    lk: [KJU, 1.38, 1.6, 1.72, 1.95, 0, false, TRAVEL],
    lk2: [KJU, 1.95, 2.15, 2.25, 2.45, 0, false, TRAVEL],
    hp: [KJU, 3.15, 3.55, 3.66, 4.25, 0, false, TRAVEL],
    chp: UPPERCUT,
    tc: [KJU, 3.1, 3.55, 3.66, 4.25, 0, false, TRAVEL],   // ENQUADRO: the uppercut after the knees
  },
};

function attackPose(f, m, t) {
  const set = CLIP_ATTACKS[f.char] || CLIP_ATTACKS.flash;
  // Chained repeats of the same move cycle through its variants (lp, lp2, lp3…).
  const variants = [set[f.mv], set[f.mv + '2'], set[f.mv + '3'], set[f.mv + '4']].filter(Boolean);
  const ca = variants[f.chain % Math.max(1, variants.length)];
  if (ca) {
    const [clip, s0, a0, a1, r1, yaw = 0, ramp = false, opts = null] = ca;
    let time, k = 1;
    if (f.sf < m.startup) { time = lerp(s0, a0, f.sf / m.startup); k = ease(f.sf / m.startup); }
    else if (f.sf < m.startup + m.active) time = lerp(a0, a1, (f.sf - m.startup) / Math.max(1, m.active));
    else {
      const r = clamp01((f.sf - m.startup - m.active) / Math.max(1, m.recovery));
      time = lerp(a1, r1, r); k = 1 - ease(r);
    }
    return { ...CLIP, clip, clipTime: time, clipYaw: ramp ? yaw * k : yaw, ...opts };
  }
  const def = ATTACKS[f.mv];
  if (!def) return STANCE;
  const W = withP(def.base, def.W), S = withP(def.base, def.S);
  let p;
  if (f.sf < m.startup) p = mixPose(W, S, ease(clamp01(f.sf / m.startup) ** 2));
  else if (f.sf < m.startup + m.active || m.air) p = S;
  else p = mixPose(S, def.base, ease(clamp01((f.sf - m.startup - m.active) / Math.max(1, m.recovery))));
  p.alpha = 0.75;
  return p;
}

function specialPose(f, m) {
  const t = f.sf;
  if (f.char === 'genildo' && (f.mv === 'special' || f.mv === 'super')) {
    // Mixamo "Pistol Idle": two-handed aim, hands closed on the grip. Each shot kicks the
    // upper body back for a few frames; the pistol is put away at the end of the recovery.
    const shots = f.mv === 'special' ? [m.projectile.at] : m.burst.frames;
    const total = m.startup + m.active + m.recovery;
    let k = 0;
    for (const sh of shots) if (t >= sh && t < sh + 5) k = Math.max(k, 1 - (t - sh) / 5);
    const holding = t < total - 6;
    return { ...CLIP, clip: 'Pistol_Idle', clipTime: 1.0, spine: [-0.12 * k, 0, 0], head: [-0.06 * k, 0, 0],
      hand: holding ? 'gun' : null, grip: holding, blend: 0.14 };
  }
  if (f.char === 'anderon' && f.mv === 'special') return attackPose(f, m, 0); // ARMADA
  if (f.char === 'hgl' && f.mv === 'special') return attackPose(f, m, 0); // CARRINHO
  if (f.char === 'hgl' && f.mv === 'super') {
    // The baseball pitch from his model: wind-up, release at 1.84 s (the frame the
    // screwdriver leaves his hand), follow-through.
    const k = (a, b, x) => a + (b - a) * clamp01(x);
    const at = m.projectile.at;
    const time = t < at ? k(1.0, 1.84, t / at) : k(1.84, 2.6, (t - at) / m.recovery);
    return { ...CLIP, clip: 'pitch_baseball', clipTime: time, lockXZ: true, hand: t < at ? 'screwdriver' : null, blend: 0.1 };
  }
  if (f.char === 'anderon' && f.mv === 'super') {
    // Mixamo "Talking On A Cell Phone": hand up to the ear, a bit of the talk, then lowers it.
    const k = (a, b, x) => a + (b - a) * clamp01(x);
    const time = t < 24 ? k(0, 4.2, t / 24) : t < 104 ? k(4.2, 7.6, (t - 24) / 80) : k(8.0, 10.0, (t - 104) / 16); // 8-10 s = 34.5-36.5 s of the original (see tools/optimize SPLICE)
    return { ...CLIP, clip: 'Talking_On_A_Cell_Phone', clipTime: time, lockXZ: true, blend: 0.12 };
  }
  if (f.char === 'hotmonster' && f.mv === 'special') {
    // Wind up with the bag behind, then throw it overhand.
    const W = withP(STANCE, { rh: [0.02, 0.2, -0.25], spine: [-0.2, -0.5, 0], head: [-0.1, 0, 0] });
    const S = withP(STANCE, { rh: [-0.06, 0.18, 0.35], spine: [0.3, 0.6, 0], hip: [0, -0.04, 0.03] });
    const at = m.projectile.at;
    const wind = at * 0.7;
    if (t < wind) return { ...mixPose(STANCE, W, ease(t / wind)), hand: 'racao', alpha: 0.6 };
    if (t < at) return { ...mixPose(W, S, ease((t - wind) / (at - wind))), hand: 'racao', alpha: 0.7 };
    return { ...mixPose(S, STANCE, ease(clamp01((t - at) / m.recovery))), alpha: 0.4 };
  }
  if (f.char === 'hotmonster' && f.mv === 'super') {
    // Arms up calling the rain, then pointing at the opponent.
    const UP = withP(STANCE, { lh: [0.05, 0.35, 0.02], rh: [-0.05, 0.35, 0.02], head: [-0.4, 0, 0], spine: [-0.15, 0, 0] });
    const POINT = withP(STANCE, { rh: [-0.05, 0.2, 0.33], spine: [0, 0.4, 0] });
    if (t < 20) return { ...mixPose(STANCE, UP, ease(t / 20)), alpha: 0.5 };
    if (t < 40) return { ...UP, hip: [0, -0.06 + Math.sin(t * 0.6) * 0.02, 0], alpha: 0.5 };
    return { ...mixPose(UP, POINT, ease(clamp01((t - 40) / 15))), alpha: 0.5 };
  }
  if (f.char === 'flash' && f.mv === 'special') {
    // Shoulder dash: the run clip at double speed, leaning in.
    return { ...CLIP, clip: 'run', clipTime: ((t / 60) * 2) % 1.25, spine: [0.3, -0.3, 0], alpha: 0.6 };
  }
  if (f.char === 'flash' && f.mv === 'super') {
    // Drink the GARRA can: lift to mouth, head back, gulp, then crush and flex.
    const LIFT = withP(STANCE, { rh: [-0.08, 0.17, 0.08], head: [-0.2, 0, 0] });
    const DRINK = withP(STANCE, { rh: [-0.09, 0.24, 0.06], head: [-0.6, 0, 0], spine: [-0.2, 0, 0], hip: [0, -0.02, 0] });
    const FLEX = withP(STANCE, { lh: [0.12, 0.22, 0.0], rh: [-0.12, 0.22, 0.0], spine: [-0.1, 0, 0], hip: [0, -0.1, 0], head: [-0.2, 0, 0] });
    if (t < 12) return { ...mixPose(STANCE, LIFT, ease(t / 12)), hand: 'can', alpha: 0.5 };
    if (t < 38) return { ...DRINK, head: [-0.6 + Math.sin(t * 0.8) * 0.06, 0, 0], hand: 'can', alpha: 0.5 };
    return { ...mixPose(DRINK, FLEX, ease(clamp01((t - 38) / 10))), alpha: 0.5 };
  }
  return STANCE;
}

// Fighting stance of each fighter: [clip, loop length (s), speed]. Others use box_01.
const IDLES = {
  hotmonster: ['Boxing_2', 2.18],
  flash: ['Bouncing_Fight_Idle', 2.95],
  hgl: ['Bouncing_Fight_Idle', 2.95, 0.9],
  anderon: ['Idle', 3.55, 0.9],
};

export const STAND_TIME = 0.28; // seconds the stand-up from a crouch takes
function standPose(t) {
  return { ...KNEEL, clip: 'Crouch_To_Stand', clipTime: 0.6 + 0.65 * clamp01(t / STAND_TIME), blend: 0.06, key: 'stand' };
}

// Shoulder throw (Mixamo "Shoulder Throw Aggressor / Victim", a paired animation): both clips
// share one space, so both characters are drawn at the thrower's spot and facing.
const THROW_GRAB = 1.9;    // clip time of the grab
const THROW_ROT = Math.PI / 2;
const THROWER = { ...CLIP, clip: 'Shoulder_Throw_Aggressor', anchorClip: 'Shoulder_Throw_Aggressor', anchorAt: THROW_GRAB, clipRot: THROW_ROT, blend: 0.06 };
const THROWN = { ...CLIP, clip: 'Shoulder_Throw_Victim', anchorClip: 'Shoulder_Throw_Aggressor', anchorAt: THROW_GRAB, clipRot: THROW_ROT };
// Sim frame of the throw -> clip time: reach 1.5 -> 1.9 s, then 1.6x speed (slam at 3.5 s).
function throwClipTime(sf, m) {
  if (sf < m.startup) return 1.5 + 0.4 * (sf / m.startup);
  return THROW_GRAB + ((sf - m.startup) / 60) * 1.6;
}

function idleTime(T) {
  // Sway through the boxing stance part of box_01 (no punches between 1.0 and 2.2 s),
  // easing at both ends instead of bouncing.
  return 1.6 + 0.6 * Math.sin(T * Math.PI / 1.3);
}

// How long (seconds) the previous pose takes to blend into each state.
const BLEND = {
  idle: 0.16, walk: 0.12, crouch: 0.09, jumpsquat: 0.05, air: 0.09, land: 0.06, attack: 0.05,
  block: 0.05, hit: 0.035, fall: 0.07, down: 0.15, rise: 0.1, ko: 0.06, win: 0.3, lose: 0.3, thrown: 0.06,
};

export function poseFor(f, g, T) {
  const p = rawPose(f, g, T);
  let key = f.st;
  if (f.st === 'attack') key += ':' + f.mv + f.chain;
  else if (f.st === 'hit') key += ':' + f.hitKind + f.hitRank;
  else if (f.st === 'walk' || f.st === 'crouch') key += f.guard ? ':g' : '';
  else if (f.st === 'idle' && g && g.phase === 'intro') key = 'intro';
  // Getting up from the intro push-ups takes a moment longer.
  const blend = f.st === 'idle' && g && g.phase === 'fight' && g.phaseF < 30 ? 0.35 : BLEND[f.st];
  return { ...p, key: p.key || key, blend: p.blend ?? blend ?? 0.1, t: f.sf };
}

function rawPose(f, g, T) {
  const t = f.sf;
  switch (f.st) {
    case 'idle': case 'jumpsquat': case 'land': {
      // Mixamo "Jumping": knees bend before take-off (0.25-0.5 s) and on landing (1.1-1.5 s).
      if (f.st === 'jumpsquat') return { ...CLIP, clip: 'Jumping', clipTime: 0.25 + clamp01(t / 3) * 0.25 };
      if (f.st === 'land') return { ...CLIP, clip: 'Jumping', clipTime: 1.1 + clamp01(t / 8) * 0.45 };
      // Before the fight starts each character shows off.
      if (g && g.phase === 'intro') {
        const secs = g.phaseF / 60;
        if (f.char === 'hotmonster') return { ...CLIP, clip: 'angry_01', clipTime: Math.min(3.4, secs * 1.7) };
        // Genildo draws on his opponent: "Parado!"
        if (f.char === 'genildo') return { ...CLIP, clip: 'Pistol_Idle', clipTime: (secs * 0.5) % 3.9, hand: 'gun', grip: true };
        // HGL shows off his screwdriver.
        if (f.char === 'hgl') return { ...CLIP, clip: 'box_01', clipTime: idleTime(T), hand: 'screwdriver' };
        // Anderson makes the "on the phone" gesture (no phone in his hand).
        if (f.char === 'anderon') return { ...CLIP, clip: 'make_a_call_02', clipTime: 6.4 + 1.6 * (1 - Math.abs(((secs / 1.2) % 2) - 1)) };
        // Flash shows off with push-ups, then springs up into his stance.
        return { ...CLIP, clip: 'press-up', clipTime: Math.min(1.9, secs * 1.15) };
      }
      // Getting up from a crouch: Mixamo "Crouch To Stand" (the rising part), guard kept up.
      if (f.standT != null && f.standT < STAND_TIME) return standPose(f.standT);
      const idle = IDLES[f.char];
      if (idle) return { ...CLIP, clip: idle[0], clipTime: (T * (idle[2] || 1)) % idle[1] };
      return { ...CLIP, clip: 'box_01', clipTime: idleTime(T) };
    }
    case 'walk': {
      if (f.standT != null && f.standT < STAND_TIME) return standPose(f.standT);
      // Mixamo "Short Step Forward", looped in place and driven by the distance walked
      // (one cycle = 0.56 m), so the feet stay planted; walking back plays it in reverse.
      const u = ((f.x / 1000) * f.facing) / 0.56;
      return { ...CLIP, clip: 'Short_Step_Forward', clipTime: (u - Math.floor(u)) * 0.99 };
    }
    case 'crouch':
      return { ...(f.guard ? KNEEL_GUARD : KNEEL), clipTime: kneelTime(T) };
    case 'air': {
      // Mixamo "Jumping" airborne part (0.55-1.05 s) following the real jump arc, with the
      // clip's own height taken out. Forward jumps add a cartoon somersault.
      const c = CHARACTERS[f.char];
      const prog = clamp01((c.jumpVy - f.vy) / (2 * c.jumpVy));
      const flip = f.vx !== 0 && Math.sign(f.vx) === f.facing && !f.airAtk;
      const k = ease(clamp01(t / 32));
      return { ...CLIP, clip: 'Jumping', clipTime: 0.55 + prog * 0.5, ...AIRCLIP,
        body: [flip ? k * Math.PI * 2 : 0, 0, 0, 0, 0.9] };
    }
    case 'thrown': {
      // Played on the thrower's spot and timeline (see view.js), with the paired victim clip.
      const o = g?.f[1 - f.id];
      const at = o && o.mv === 'throw' ? throwClipTime(o.sf, CHARACTERS[o.char].moves.throw) : THROW_GRAB;
      return { ...THROWN, clipTime: at, blend: 0.06 };
    }
    case 'attack': {
      const m = CHARACTERS[f.char].moves[f.mv];
      if (f.mv === 'throw') {
        const t = throwClipTime(f.sf, m);
        // Reaching (before the grab) stays on the spot; after it, the paired clip.
        if (f.sf < m.startup || !f.grab) return { ...CLIP, clip: 'Shoulder_Throw_Aggressor', clipTime: Math.min(t, 2.0), lockXZ: true, clipRot: THROW_ROT, blend: 0.06 };
        return { ...THROWER, clipTime: t };
      }
      if (f.mv === 'special' || f.mv === 'super') return specialPose(f, m);
      return attackPose(f, m, T);
    }
    case 'block': {
      if (f.guardLow) return { ...KNEEL_GUARD, clipTime: kneelTime(T) };
      // Mixamo "Center Block": arms snap up and the body rocks back under the impact.
      const k = clamp01(t / Math.max(1, t + f.stun));
      return { ...CLIP, clip: 'Center_Block', clipTime: 0.2 + k * 0.6 };
    }
    case 'hit': {
      // Reaction clip stretched over the hit-stun: head snaps back, or doubles over.
      // A different reaction for each kind of hit: head or body, light or heavy.
      const k = clamp01(t / Math.max(1, t + f.stun));
      const heavy = f.hitRank >= 2;
      if (f.hitKind === 'body' && f.hitRank < 3) {
        if (heavy) return { ...CLIP, clip: 'hit_to_stomach', clipTime: 0.1 + k * 1.2 };   // doubles over
        return { ...CLIP, clip: 'hit_to_body_01', clipTime: 0.1 + k * 1.0 };
      }
      if (f.hitRank >= 3) return { ...CLIP, clip: 'hit_to_body_02', clipTime: 0.15 + k * 1.3 }; // specials
      if (heavy) return { ...CLIP, clip: 'hit_to_head', clipTime: 0.05 + k * 1.0 };      // head snaps back
      return { ...CLIP, clip: 'hit_to_side', clipTime: 0.1 + k * 0.95 };
    }
    case 'fall':
      return { ...CLIP, clip: 'fall', clipTime: 1.05 + clamp01(t / 26) * 0.65, alpha: 0.5 };
    case 'down':
      return { ...CLIP, clip: 'fall', clipTime: 1.7 + clamp01(t / 40) * 1.3 };
    case 'ko':
      return { ...CLIP, clip: 'fall', clipTime: Math.min(3, 1.7 + t / 40), alpha: 0.4 };
    case 'rise':
      // Mixamo "Getting Up", sped up: rolls onto the hands and springs back to the stance.
      return { ...CLIP, clip: 'Getting_Up', clipTime: 4.2 + clamp01(t / 18) * 1.7 };
    case 'win':
      if (f.char === 'hotmonster') return { ...CLIP, clip: 'dance_05', clipTime: (t / 60) % 2.88, alpha: 0.35 };
      // Genildo celebrates with a b-boy uprock (Mixamo "Bboy Uprock", looped).
      if (f.char === 'genildo') return { ...CLIP, clip: 'Bboy_Uprock', clipTime: (t / 60) % 2.25, blend: 0.3 };
      // HGL sings his victory (animation from his model).
      if (f.char === 'hgl') return { ...CLIP, clip: 'sing_02', clipTime: (t / 60) % 15, blend: 0.3 };
      // Anderson calls home to tell about the win.
      if (f.char === 'anderon') return { ...CLIP, clip: 'make_a_call_02', clipTime: 3.6 + Math.min(11, t / 60), blend: 0.3 };
      return { ...CLIP, clip: 'dance_03', clipTime: (t / 60) % 12.7 };
    case 'lose':
      // Lost on time. Hotmonster staggers and collapses; Flash hangs his head.
      if (f.char !== 'flash') return { ...CLIP, clip: 'defeat_03', clipTime: Math.min(5.5, t / 60) };
      return { ...CLIP, clip: 'defeat_02', clipTime: (t / 60) % 8.4 };
    default:
      return STANCE;
  }
}
