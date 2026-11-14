// Fighter state machine. Everything here is integer maths so both players' browsers
// compute exactly the same result from the same inputs (needed for online lockstep).
import { CHARACTERS, BUFF_SPEED, moveTotal } from './moves.js';
import { dirOf, LP, HP, LK, HK, SUP, BUTTONS } from './bits.js';
import { qcf, HIST } from './motion.js';

export const WALL = 4200;          // stage half-width (mm)
export const MAX_DIST = 5600;      // farthest the two fighters may be apart
export const BODY_W = 520;         // push-box width
export const BUFFER = 5;           // frames a button press stays buffered
export const METER_MAX = 1000;
export const SUPER_FREEZE = 45; // frames everything stops while a super starts

const NEUTRAL = new Set(['idle', 'walk', 'crouch', 'land']);

export function createFighter(id, char, x) {
  const c = CHARACTERS[char];
  return {
    id, char, x, y: 0, vx: 0, vy: 0, pv: 0, facing: id === 0 ? 1 : -1,
    hp: c.hp, maxHp: c.hp, meter: 0,
    st: 'idle', sf: 0, mv: '', hit: false, stun: 0, inv: 0, buff: 0,
    combo: 0, guard: false, airAtk: false, ko: false, jumpDir: 0, hitKind: 'head',
    hist: new Array(HIST).fill(5), prev: 0, press: [99, 99, 99, 99, 99],
  };
}

export function resetFighterForRound(f, x) {
  const c = CHARACTERS[f.char];
  Object.assign(f, {
    x, y: 0, vx: 0, vy: 0, pv: 0, facing: f.id === 0 ? 1 : -1, hp: c.hp,
    st: 'idle', sf: 0, mv: '', hit: false, stun: 0, inv: 0, buff: 0,
    combo: 0, guard: false, airAtk: false, ko: false, jumpDir: 0,
  });
}

export function isNeutral(f) { return NEUTRAL.has(f.st); }
export function isCrouching(f) {
  if (f.st === 'crouch') return true;
  if (f.st === 'block' && f.guardLow) return true;
  if (f.st === 'attack' && f.mv && f.mv[0] === 'c') return true;
  return false;
}
export function speedPct(f) { return f.buff > 0 ? BUFF_SPEED : 100; }
export function getMove(f) { return f.mv ? CHARACTERS[f.char].moves[f.mv] : null; }

export function moveActive(f) {
  const m = getMove(f);
  if (!m || f.st !== 'attack') return false;
  return f.sf >= m.startup && f.sf < m.startup + m.active;
}

// Record this frame's input: direction history and buffered button presses.
// During hit-stop (`frozen`) presses are still caught but don't age, so a button pressed
// in the freeze is still buffered when the action resumes.
export function recordInput(f, input, frozen = false) {
  const dir = dirOf(input, f.facing);
  f.hist.shift();
  f.hist.push(dir);
  const pressed = input & ~f.prev;
  f.prev = input;
  for (let i = 0; i < BUTTONS.length; i++) {
    if (pressed & BUTTONS[i]) f.press[i] = 0;
    else if (!frozen && f.press[i] < 99) f.press[i]++;
  }
}

function buffered(f, bit) {
  return f.press[BUTTONS.indexOf(bit)] <= BUFFER;
}
function consume(f, bit) {
  f.press[BUTTONS.indexOf(bit)] = 99;
}

// Pick the move the player is asking for, or '' if none.
function chooseMove(f, dir, air, minRank) {
  const moves = CHARACTERS[f.char].moves;
  const ok = (id) => moves[id] && moves[id].rank >= minRank;
  if (!air) {
    if (buffered(f, SUP) && f.meter >= METER_MAX && ok('super')) { consume(f, SUP); return 'super'; }
    const lp = buffered(f, LP), hp = buffered(f, HP);
    // Special: quarter circle forward + punch, or the shortcut LP+HP together.
    if ((lp || hp) && ok('special') && (qcf(f.hist) || (lp && hp))) {
      consume(f, LP); consume(f, HP); return 'special';
    }
  }
  const crouch = !air && (dir === 1 || dir === 2 || dir === 3);
  const prefix = air ? 'j' : crouch ? 'c' : '';
  const order = [[HK, 'hk'], [HP, 'hp'], [LK, 'lk'], [LP, 'lp']];
  for (const [bit, id] of order) {
    if (buffered(f, bit) && ok(prefix + id)) {
      consume(f, bit);
      return prefix + id;
    }
  }
  return '';
}

function startMove(f, id, g) {
  const m = CHARACTERS[f.char].moves[id];
  f.st = 'attack'; f.mv = id; f.sf = 0; f.hit = false; f.guard = false;
  if (m.invuln) f.inv = m.invuln;
  if (m.rank === 4) { f.meter = 0; g.hitstop = SUPER_FREEZE; }
  if (m.air) f.airAtk = true;
  if (!m.air) f.vx = 0;
  g.events.push({ t: 'move', f: f.id, mv: id });
}

function toNeutral(f) {
  f.st = 'idle'; f.sf = 0; f.mv = ''; f.vx = 0; f.combo = 0; f.guard = false;
}

function applyGravity(f) {
  f.vy -= CHARACTERS[f.char].gravity;
  f.x += f.vx;
  f.y += f.vy;
}

// Movement and state transitions for one frame. `o` is the opponent.
export function stepFighter(f, input, o, g) {
  const c = CHARACTERS[f.char];
  const dir = f.hist[f.hist.length - 1];
  f.sf++;
  if (f.inv > 0) f.inv--;
  if (f.buff > 0) {
    f.buff--;
    if (f.buff === 0) g.events.push({ t: 'buffEnd', f: f.id });
  }
  // Push velocity (from being hit or blocking at a wall) decays every frame.
  if (f.pv !== 0) {
    f.x += f.pv;
    f.pv = Math.trunc((f.pv * 4) / 5);
  }

  switch (f.st) {
    case 'idle': case 'walk': case 'crouch': case 'land': {
      if (f.st === 'land' && f.sf < 4) break;
      const mv = chooseMove(f, dir, false, 0);
      if (mv) { startMove(f, mv, g); break; }
      if (dir >= 7) {
        f.st = 'jumpsquat'; f.sf = 0; f.guard = false;
        f.jumpDir = dir === 7 ? -f.facing : dir === 9 ? f.facing : 0;
        break;
      }
      if (dir <= 3) {
        if (f.st !== 'crouch') { f.st = 'crouch'; f.sf = 0; }
        f.vx = 0;
        f.guard = dir === 1 && opponentThreatens(f, o, g);
        break;
      }
      const sp = speedPct(f);
      if (dir === 6) {
        if (f.st !== 'walk') { f.st = 'walk'; f.sf = 0; }
        f.guard = false;
        f.x += Math.trunc((c.walk * sp) / 100) * f.facing;
      } else if (dir === 4) {
        f.guard = opponentThreatens(f, o, g);
        if (f.st !== 'walk') { f.st = 'walk'; f.sf = 0; }
        if (!f.guard) f.x -= Math.trunc((c.back * sp) / 100) * f.facing;
      } else {
        if (f.st !== 'idle') { f.st = 'idle'; f.sf = 0; }
        f.guard = false;
      }
      break;
    }
    case 'jumpsquat':
      if (f.sf >= 3) {
        const sp = speedPct(f);
        f.st = 'air'; f.sf = 0; f.airAtk = false;
        f.vy = c.jumpVy;
        f.vx = Math.trunc((f.jumpDir * c.jumpVx * sp) / 100);
        f.y = 1;
      }
      break;
    case 'air': {
      if (!f.airAtk) {
        const mv = chooseMove(f, dir, true, 0);
        if (mv) { startMove(f, mv, g); applyGravity(f); break; }
      }
      applyGravity(f);
      if (f.y <= 0) land(f, g);
      break;
    }
    case 'attack':
      stepAttack(f, dir, o, g);
      break;
    case 'hit': case 'block':
      f.stun--;
      if (f.stun <= 0) toNeutral(f);
      break;
    case 'fall':
      applyGravity(f);
      if (f.y <= 0) {
        f.y = 0; f.vx = 0; f.vy = 0;
        f.st = f.ko ? 'ko' : 'down'; f.sf = 0; f.inv = 70;
        g.events.push({ t: 'thud', f: f.id, x: f.x });
      }
      break;
    case 'down':
      if (f.sf >= 40) { f.st = 'rise'; f.sf = 0; f.inv = 20; }
      break;
    case 'rise':
      if (f.sf >= 18) toNeutral(f);
      break;
    default: // ko, win, lose: nothing to do
      break;
  }
}

function land(f, g) {
  f.y = 0; f.vy = 0; f.vx = 0;
  f.st = 'land'; f.sf = 0; f.mv = ''; f.airAtk = false;
  g.events.push({ t: 'land', f: f.id });
}

function opponentThreatens(f, o, g) {
  if (Math.abs(o.x - f.x) > 2600) return g.proj.some((p) => p.owner !== f.id && Math.abs(p.x - f.x) < 2200);
  return o.st === 'attack' || g.proj.some((p) => p.owner !== f.id && Math.abs(p.x - f.x) < 2200);
}

function stepAttack(f, dir, o, g) {
  const m = getMove(f);
  const sp = speedPct(f);
  if (m.air) {
    applyGravity(f);
    if (f.y <= 0) { land(f, g); return; }
    if (f.sf >= m.startup + m.active) {
      // Air move finished but still airborne: keep falling in the air state.
      f.st = 'air'; f.mv = '';
    }
    return;
  }
  // Flash's dash moves him forward while active, until it connects.
  if (m.dash) {
    const active = f.sf >= m.startup && f.sf < m.startup + m.active;
    f.vx = active && !f.hit ? Math.trunc((m.dash * sp) / 100) * f.facing : 0;
    f.x += f.vx;
  }
  if (m.projectile && f.sf === m.projectile.at) {
    const p = m.projectile;
    g.spawn(f.id, {
      kind: p.kind, x: f.x + p.dx * f.facing, y: p.y,
      vx: Math.trunc((p.vx * sp) / 100) * f.facing, vy: p.vy, g: p.g, move: 'special',
    });
  }
  if (m.rain) {
    const k = m.rain.frames.indexOf(f.sf);
    if (k >= 0) {
      g.spawn(f.id, {
        kind: m.rain.kind, x: o.x + m.rain.offsets[k], y: m.rain.y,
        vx: 0, vy: 0, g: m.rain.g, move: 'super',
      });
    }
  }
  if (m.buff && f.sf === m.startup - 12) {
    f.buff = m.buff;
    g.events.push({ t: 'buff', f: f.id });
  }
  // Combo cancel: once a move connected, a stronger move can interrupt it.
  if (f.hit && f.sf >= m.startup && f.sf < m.startup + m.active + 8) {
    const minRank = m.rank === 1 ? 1 : m.rank + 1;
    const next = chooseMove(f, dir, false, minRank);
    if (next) { startMove(f, next, g); return; }
  }
  if (f.sf >= moveTotal(m)) toNeutral(f);
}
