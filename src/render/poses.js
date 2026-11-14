// Turns a fighter's simulation state into a pose for Character.applyPose().
// Clips: idle stance and the jab come from box_01, the strong punch from box_02.
// Everything else is procedural (IK targets in model units, see character.js).
import { CHARACTERS } from '../sim/moves.js';

const lerp = (a, b, k) => a + (b - a) * k;
const lerpArr = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const ease = (k) => k * k * (3 - 2 * k);

const KEYS = ['hip', 'hipRot', 'spine', 'head', 'lh', 'rh', 'lf', 'rf', 'body'];

export function basePose() {
  return {
    clip: null, clipTime: 0, armsIK: false, legsIK: false,
    hip: [0, -0.06, -0.01], hipRot: [0, 0, 0], spine: [0.08, -0.15, 0], head: [0, 0.15, 0],
    lh: [-0.07, 0.07, 0.15], rh: [0.07, 0.05, 0.12],
    lf: [0.03, 0, 0.13], rf: [-0.03, 0, -0.11],
    body: [0, 0, 0, 0, 0],
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
const CROUCH = withP(STANCE, { hip: [0, -0.17, -0.03], spine: [0.22, 0, 0], lh: [0, -0.12, 0.02], rh: [0, -0.12, 0.02], lf: [0.02, 0, 0.03], rf: [-0.02, 0, -0.04] });
const GUARD = withP(STANCE, { lh: [0.01, 0.07, -0.02], rh: [-0.03, 0.08, 0.02], spine: [-0.04, 0.1, 0], head: [0.15, 0, 0] });
const CROUCH_GUARD = withP(CROUCH, { lh: [0.01, 0.1, -0.02], rh: [-0.03, 0.1, 0.02] });
const AIR = withP(STANCE, { hip: [0, 0.06, 0], lf: [0, 0.16, 0.08], rf: [0, 0.24, 0.02], spine: [0.1, 0, 0] });

// Procedural attack poses: W = wind-up, S = strike. Deltas on top of the base pose.
const ATTACKS = {
  clp: { base: CROUCH, W: { rh: [0, 0, -0.04] }, S: { lh: [-0.02, 0.0, 0.25], spine: [0, -0.3, 0] } },
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

// Clip-driven attacks: [clip, startupFrom, activeAt, activeTo, recoveryTo].
const CLIP_ATTACKS = {
  lp: ['box_01', 0.4, 0.58, 0.62, 1.0],
  hp: ['box_02', 1.95, 2.25, 2.4, 2.79],
  lk: ['front_kick_02', 0.62, 0.88, 0.98, 1.3],
  hk: ['front_kick_01', 0.45, 0.98, 1.15, 1.75],
};

function attackPose(f, m, t) {
  const ca = CLIP_ATTACKS[f.mv];
  if (ca) {
    const [clip, s0, a0, a1, r1] = ca;
    let time;
    if (f.sf < m.startup) time = lerp(s0, a0, f.sf / m.startup);
    else if (f.sf < m.startup + m.active) time = lerp(a0, a1, (f.sf - m.startup) / Math.max(1, m.active));
    else time = lerp(a1, r1, (f.sf - m.startup - m.active) / Math.max(1, m.recovery));
    const p = { ...CLIP, clip, clipTime: time, alpha: 0.8 };
    // front_kick_02 kicks behind the character, so it becomes a spinning back kick:
    // half a turn during start-up, the other half during recovery (ends facing forward).
    if (clip === 'front_kick_02') {
      const spin = f.sf < m.startup ? ease(f.sf / m.startup)
        : f.sf < m.startup + m.active ? 1 : 1 + ease(clamp01((f.sf - m.startup - m.active) / Math.max(1, m.recovery)));
      p.body = [0, Math.PI * spin, 0, 0, 0];
    }
    return p;
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

function idleTime(T) {
  // Ping-pong through the boxing stance part of box_01 (no punches between 1.0 and 2.2 s).
  const span = 1.2;
  const x = (T % (2 * span));
  return 1.0 + (x < span ? x : 2 * span - x);
}

export function poseFor(f, g, T) {
  const t = f.sf;
  switch (f.st) {
    case 'idle': case 'jumpsquat': case 'land': {
      if (f.st !== 'idle') return { ...withP(STANCE, { hip: [0, -0.08, 0] }), alpha: 0.6 };
      // Before the fight starts each character shows off.
      if (g && g.phase === 'intro') {
        const secs = g.phaseF / 60;
        if (f.char === 'hotmonster') return { ...CLIP, clip: 'angry_01', clipTime: Math.min(3.4, secs * 1.7), alpha: 0.3 };
        return { ...CLIP, clip: 'fold_arms', clipTime: 1.2 + secs, alpha: 0.3 };
      }
      return { ...CLIP, clip: 'box_01', clipTime: idleTime(T), alpha: 0.25 };
    }
    case 'walk': {
      if (f.guard) return GUARD;
      const fwd = f.hist[f.hist.length - 1] === 6 ? 1 : -1;
      const ph = T * 9 * fwd;
      return withP(STANCE, {
        lf: [0, Math.max(0, Math.cos(ph)) * 0.06, Math.sin(ph) * 0.07],
        rf: [0, Math.max(0, -Math.cos(ph)) * 0.06, -Math.sin(ph) * 0.07],
        hip: [0, Math.abs(Math.sin(ph)) * 0.015, 0],
        spine: [0, Math.sin(ph) * 0.05, 0],
        alpha: 0.4,
      });
    }
    case 'crouch':
      return f.guard ? CROUCH_GUARD : { ...CROUCH, alpha: 0.4 };
    case 'air': {
      // Forward jumps do a cartoon somersault around the waist.
      const flip = f.vx !== 0 && Math.sign(f.vx) === f.facing && !f.airAtk;
      const k = ease(clamp01(t / 32));
      return { ...AIR, body: [flip ? k * Math.PI * 2 : 0, 0, 0, 0, 0.9], alpha: 0.5 };
    }
    case 'attack': {
      const m = CHARACTERS[f.char].moves[f.mv];
      if (f.mv === 'special' || f.mv === 'super') return specialPose(f, m);
      return attackPose(f, m, T);
    }
    case 'block':
      return f.guardLow ? CROUCH_GUARD : GUARD;
    case 'hit': {
      // Reaction clip stretched over the hit-stun: head snaps back, or doubles over.
      const k = clamp01(t / Math.max(1, t + f.stun));
      if (f.hitKind === 'body') return { ...CLIP, clip: 'hit_to_body_02', clipTime: 0.25 + k * 1.1, alpha: 0.7 };
      return { ...CLIP, clip: 'hit_to_head', clipTime: 0.05 + k * 1.0, alpha: 0.7 };
    }
    case 'fall':
      return { ...CLIP, clip: 'fall', clipTime: 1.05 + clamp01(t / 26) * 0.65, alpha: 0.5 };
    case 'down':
      return { ...CLIP, clip: 'fall', clipTime: 1.7 + clamp01(t / 40) * 1.3, alpha: 0.5 };
    case 'ko':
      return { ...CLIP, clip: 'fall', clipTime: Math.min(3, 1.7 + t / 40), alpha: 0.4 };
    case 'rise':
      // The fall played backwards: a quick cartoon pop back up.
      return { ...CLIP, clip: 'fall', clipTime: 1.6 - ease(clamp01(t / 16)) * 0.6, alpha: 0.6 };
    case 'win':
      if (f.char === 'hotmonster') return { ...CLIP, clip: 'dance_05', clipTime: (t / 60) % 2.88, alpha: 0.35 };
      return { ...CLIP, clip: 'fold_arms', clipTime: 1.2 + ((t / 60) % 15), alpha: 0.3 };
    case 'lose':
      return { ...CLIP, clip: 'defeat_02', clipTime: (t / 60) % 8.4, alpha: 0.3 };
    default:
      return STANCE;
  }
}
