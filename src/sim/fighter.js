// Fighter state machine. Everything here is integer maths so both players' browsers
// compute exactly the same result from the same inputs (needed for online play: rollback re-simulates frames).
import { CHARACTERS, BUFF_SPEED, moveTotal } from './moves.js';
import { dirOf, LP, HP, LK, HK, SUP, EX1, EX2, BUTTONS } from './bits.js';
import { qcf, doubleBack, HIST } from './motion.js';

export const WALL = 4200;          // stage half-width (mm)
export const MAX_DIST = 5600;      // farthest the two fighters may be apart
export const BODY_W = 520;         // push-box width
export const BUFFER = 8;           // frames a button press stays buffered (lenient: combos come out easily)
export const JAB_CHAIN = 4;        // most light attacks in a row (the jab string has four punches)
const REACH_SLACK = 60;            // combo step-in aims this far inside the move's reach (mm)
const MAX_STEP = 380;              // longest combo step-in (mm)
export const METER_MAX = 1000;
// AGARRÃO is off until it has better animations (all its code stays; tests switch it on).
export const RULES = { throws: false };
export const SUPER_FREEZE = 45; // frames everything stops while a super starts

const NEUTRAL = new Set(['idle', 'walk', 'crouch', 'land']);

export function createFighter(id, char, x) {
  const c = CHARACTERS[char];
  return {
    id, char, x, y: 0, vx: 0, vy: 0, pv: 0, facing: id === 0 ? 1 : -1,
    hp: c.hp, maxHp: c.hp, meter: 0,
    st: 'idle', sf: 0, mv: '', hit: false, stun: 0, inv: 0, buff: 0,
    combo: 0, guard: false, airAtk: false, ko: false, jumpDir: 0, hitKind: 'head', hitRank: 1, chain: 0,
    jug: 0, bounce: 0, grab: 0, // juggle hits left while falling; ground bounce pending; throw connected
    step: 0, stepPer: 0, chase: 0, // combo step-in left (mm) and per frame; jumped after a launched opponent
    hist: new Array(HIST).fill(5), prev: 0, press: [99, 99, 99, 99, 99, 99, 99],
  };
}

export function resetFighterForRound(f, x) {
  const c = CHARACTERS[f.char];
  Object.assign(f, {
    x, y: 0, vx: 0, vy: 0, pv: 0, facing: f.id === 0 ? 1 : -1, hp: c.hp,
    st: 'idle', sf: 0, mv: '', hit: false, stun: 0, inv: 0, buff: 0,
    combo: 0, guard: false, airAtk: false, ko: false, jumpDir: 0, jug: 0, bounce: 0, chain: 0, grab: 0,
    step: 0, stepPer: 0, chase: 0,
  });
}

export function isNeutral(f) { return NEUTRAL.has(f.st); }
export function isCrouching(f) {
  if (f.st === 'crouch') return true;
  if (f.st === 'block' && f.guardLow) return true;
  if (f.st === 'attack' && f.mv && f.mv[0] === 'c') return true;
  if (f.st === 'attack' && getMove(f)?.lowBody) return true;
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
  // Extra buttons: standing moves only.
  if (!air) {
    for (const [bit, id] of [[EX2, 'cw'], [EX1, 'fk']]) {
      if (buffered(f, bit) && ok(id)) { consume(f, bit); return id; }
    }
  }
  // ESQUIVA: only from neutral (never as a combo cancel).
  if (!air && minRank === 0 && doubleBack(f.hist) && ok('dodge')) return 'dodge';
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

// Combo step-in: a move cancelled out of a hit closes the gap the pushback opened, so a
// combo that connects keeps connecting (otherwise short finishers like the uppercuts whiff
// after a jab or two). Only for strikes that don't already move or shoot.
function stepIn(f, m, o) {
  f.step = 0; f.stepPer = 0;
  if (!o || !m.box || m.air || m.travel || m.dash || m.projectile || m.startup < 2) return;
  if (o.st !== 'hit' && !(o.st === 'fall' && o.jug > 0)) return;
  // Where the opponent will be once their pushback slide ends (it shrinks by 1/5 a frame).
  const ahead = Math.abs(o.x - f.x) + Math.abs(o.pv) * 4;
  const gap = ahead - (m.box[2] + 260 - REACH_SLACK);
  if (gap <= 0) return;
  f.step = Math.min(gap, MAX_STEP);
  f.stepPer = Math.ceil(f.step / m.startup);
}

function startMove(f, id, g, o = null) {
  const m = CHARACTERS[f.char].moves[id];
  // How many times in a row this same move was chained (the animation alternates).
  f.chain = f.st === 'attack' && f.mv === id ? f.chain + 1 : 0;
  // `o` is given only for cancels out of a hit (see stepAttack).
  stepIn(f, m, o);
  f.st = 'attack'; f.mv = id; f.sf = 0; f.hit = false; f.guard = false;
  if (m.invuln) f.inv = m.invuln;
  if (m.rank === 4) { f.meter = 0; g.hitstop = SUPER_FREEZE; }
  if (m.air) f.airAtk = true;
  if (!m.air) f.vx = 0;
  g.events.push({ t: 'move', f: f.id, mv: id });
}

function toNeutral(f) {
  f.st = 'idle'; f.sf = 0; f.mv = ''; f.vx = 0; f.combo = 0; f.guard = false; f.jug = 0; f.bounce = 0;
  f.step = 0; f.stepPer = 0;
}

const GRABBABLE = new Set(['idle', 'walk', 'crouch', 'land', 'jumpsquat', 'attack']);
function canGrab(f, o) {
  if (o.y !== 0 || o.inv > 0 || !GRABBABLE.has(o.st)) return false;
  if (o.st === 'attack' && (getMove(o)?.air || o.mv === 'throw')) return false;
  return Math.abs(o.x - f.x) <= CHARACTERS[f.char].moves.throw.throw.range;
}

// The throw: reach (startup), grab if the opponent is still there, then each fighter's own
// finish (moves.js, normals.throw): carried over the shoulder and slammed down behind, dumped
// on the floor in front, or struck into the air. A whiff leaves the thrower open.
function stepThrow(f, m, o, g) {
  const t = m.throw;
  const clampX = (x) => Math.max(-WALL, Math.min(WALL, x));
  if (f.sf === m.startup) {
    if (canGrab(f, o)) {
      f.grab = 1; f.inv = t.land + t.after;
      o.st = 'thrown'; o.sf = 0; o.mv = ''; o.vx = 0; o.pv = 0; o.guard = false; o.combo = 0;
      if (t.kind !== 'behind') {
        // Held at arm's length, facing the thrower (the animations are lined up for this).
        // Against a wall the thrower steps back instead.
        o.x = clampX(f.x + f.facing * t.hold);
        f.x = o.x - f.facing * t.hold;
        o.facing = -f.facing;
      }
      g.events.push({ t: 'grab', f: f.id, x: (f.x + o.x) >> 1, name: t.name });
    } else f.grab = 0;
  }
  const scaled = (d) => (f.buff > 0 ? Math.trunc((d * 150) / 100) : d);
  // Blows landed while holding (knees in the clinch). They never finish the opponent.
  if (f.grab && t.hits && o.st === 'thrown') {
    t.hits.forEach(([at, d], k) => {
      if (f.sf !== m.startup + at) return;
      const dmg = scaled(d);
      o.hp = Math.max(1, o.hp - dmg);
      f.meter = Math.min(METER_MAX, f.meter + Math.trunc(d / 2));
      g.hitstop = 6;
      g.events.push({ t: 'hit', x: o.x, y: 1000, f: o.id, by: f.id, dmg, combo: k + 1, heavy: false });
    });
  }
  if (f.grab && f.sf === m.startup + t.land && o.st === 'thrown') {
    const dmg = scaled(m.dmg);
    o.hp = Math.max(0, o.hp - dmg);
    f.meter = Math.min(METER_MAX, f.meter + Math.trunc(m.dmg / 2));
    o.meter = Math.min(METER_MAX, o.meter + Math.trunc(m.dmg / 4));
    if (o.hp === 0) o.ko = true;
    o.vy = 0; o.sf = 0; o.inv = t.inv; o.jug = 0; o.bounce = 0;
    g.hitstop = 10;
    const combo = (t.hits ? t.hits.length : 0) + 1;
    if (t.kind === 'launch') {
      // Struck into the air: falls (state 'fall') and lands on the floor further away.
      o.st = 'fall'; o.y = 1; o.vy = t.launch[0]; o.vx = f.facing * t.launch[1]; o.facing = -f.facing;
      g.events.push({ t: 'hit', x: o.x, y: 1300, f: o.id, by: f.id, dmg, combo, heavy: true, ko: o.ko, big: true });
    } else {
      // Slammed down: lies behind the thrower (shoulder throw) or in front, facing them.
      if (t.kind === 'behind') { o.x = clampX(f.x - f.facing * t.back); o.facing = f.facing; }
      o.y = 0; o.st = o.hp === 0 ? 'ko' : 'down';
      g.events.push({ t: 'hit', x: o.x, y: 300, f: o.id, by: f.id, dmg, combo, heavy: true, ko: o.ko, big: true, slam: true });
      g.events.push({ t: 'thud', f: o.id, x: o.x });
    }
  }
  const total = m.startup + (f.grab ? t.land + t.after : m.recovery);
  if (f.sf >= total) { f.grab = 0; toNeutral(f); }
}

function startJump(f, dir, chase = false) {
  f.st = 'jumpsquat'; f.sf = 0; f.mv = ''; f.guard = false; f.step = 0; f.stepPer = 0;
  f.jumpDir = dir === 7 ? -f.facing : dir === 9 ? f.facing : 0;
  f.chase = chase ? 1 : 0; // after a launcher: straight up after them (no somersault)
}

const BTN = { LP, HP, LK, HK };

function applyGravity(f) {
  // Launched fighters float a little (juggles are easier to follow up).
  const gr = CHARACTERS[f.char].gravity;
  f.vy -= f.st === 'fall' && f.jug > 0 ? Math.trunc((gr * 3) / 4) : gr;
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
      // AGARRÃO: forward or back + SOCO+ right next to an opponent who can be grabbed.
      if (RULES.throws && (dir === 6 || dir === 4) && buffered(f, HP) && canGrab(f, o)) { consume(f, HP); startMove(f, 'throw', g); break; }
      const mv = chooseMove(f, dir, false, 0);
      if (mv) { startMove(f, mv, g); break; }
      if (dir >= 7) { startJump(f, dir); break; }
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
      // Smashed into the ground: bounces back up once and can be hit again.
      if (f.y <= 0 && f.bounce > 0 && !f.ko) {
        f.bounce = 0; f.y = 1; f.vy = 125; f.vx = Math.trunc(f.vx / 4); f.jug = 2; f.sf = 0;
        g.events.push({ t: 'bounce', f: f.id, x: f.x });
        break;
      }
      if (f.y <= 0) {
        f.jug = 0;
        f.y = 0; f.vx = 0; f.vy = 0;
        f.st = f.ko ? 'ko' : 'down'; f.sf = 0; f.inv = 70;
        g.events.push({ t: 'thud', f: f.id, x: f.x });
      }
      break;
    case 'down':
      if (f.sf >= 40) { f.st = 'rise'; f.sf = 0; f.inv = 20; }
      break;
    case 'thrown': {
      const t = CHARACTERS[o.char].moves.throw.throw;
      // The thrower was interrupted: let go.
      if (o.st !== 'attack' || o.mv !== 'throw') { f.st = 'fall'; f.sf = 0; f.y = 1; f.vy = 60; f.vx = 0; break; }
      // Escape: SOCO+ pressed just before or right after being grabbed.
      if (f.sf <= t.tech && buffered(f, HP)) {
        consume(f, HP);
        const away = f.x === o.x ? -o.facing : Math.sign(f.x - o.x);
        for (const [who, dirn] of [[f, away], [o, -away]]) {
          who.st = 'block'; who.sf = 0; who.stun = 16; who.mv = ''; who.guardLow = false; who.pv = 40 * dirn; who.inv = 0;
        }
        g.events.push({ t: 'tech', f: f.id, x: (f.x + o.x) >> 1 });
      }
      break;
    }
    case 'rise':
      if (f.sf >= 18) toNeutral(f);
      break;
    default: // ko, win, lose: nothing to do
      break;
  }
}

function land(f, g) {
  f.y = 0; f.vy = 0; f.vx = 0;
  f.st = 'land'; f.sf = 0; f.mv = ''; f.airAtk = false; f.chase = 0;
  g.events.push({ t: 'land', f: f.id });
}

function opponentThreatens(f, o, g) {
  if (Math.abs(o.x - f.x) > 2600) return g.proj.some((p) => p.owner !== f.id && Math.abs(p.x - f.x) < 2200);
  return o.st === 'attack' || g.proj.some((p) => p.owner !== f.id && Math.abs(p.x - f.x) < 2200);
}

function stepAttack(f, dir, o, g) {
  const m = getMove(f);
  if (m.throw) { stepThrow(f, m, o, g); return; }
  const sp = speedPct(f);
  if (m.air) {
    applyGravity(f);
    if (f.y <= 0) { land(f, g); return; }
    // Air combo: an air attack that connected can be cancelled into another one (a light
    // into anything, a heavy into nothing), e.g. jump after a launcher, CHUTE, CHUTE+.
    if (f.hit && f.sf >= m.startup) {
      const next = chooseMove(f, dir, true, m.rank === 1 ? 1 : m.rank + 1);
      if (next) { startMove(f, next, g); return; }
    }
    if (f.sf >= m.startup + m.active) {
      // Air move finished but still airborne: keep falling in the air state.
      f.st = 'air'; f.mv = '';
    }
    return;
  }
  // Combo step-in (see stepIn): glide forward during the start-up.
  if (f.step > 0 && f.sf <= m.startup) {
    const d = Math.min(f.step, f.stepPer);
    f.x += d * f.facing;
    f.step -= d;
  }
  // Flash's dash moves him forward while active, until it connects.
  if (m.dash) {
    const active = f.sf >= m.startup && f.sf < m.startup + m.active;
    f.vx = active && !f.hit ? Math.trunc((m.dash * sp) / 100) * f.facing : 0;
    f.x += f.vx;
  }
  // Moves that carry the fighter forward (VOADORA, ESTRELA), until they connect.
  if (m.travel) {
    const [a, b, v] = m.travel;
    if (f.sf >= a && f.sf < b && !f.hit) f.x += Math.trunc((v * sp) / 100) * f.facing;
  }
  if (m.projectile && f.sf === m.projectile.at) {
    const p = m.projectile;
    g.spawn(f.id, {
      kind: p.kind, x: f.x + p.dx * f.facing, y: p.y,
      vx: Math.trunc((p.vx * sp) / 100) * f.facing, vy: p.vy, g: p.g, move: f.mv,
    });
  }
  if (m.burst) {
    const k = m.burst.frames.indexOf(f.sf);
    if (k >= 0) {
      g.spawn(f.id, {
        kind: m.burst.kind, x: f.x + m.burst.dx * f.facing, y: m.burst.ys[k],
        vx: Math.trunc((m.burst.vx * sp) / 100) * f.facing, vy: 0, g: 0, move: 'super',
      });
    }
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
  // Phone call: heals in small steps while it lasts (being hit interrupts the move).
  if (m.heal) {
    const h = m.heal;
    if (f.sf >= h.from && f.sf <= h.to && (f.sf - h.from) % h.every === 0 && f.hp > 0 && f.hp < f.maxHp) {
      const amount = Math.min(h.amount, f.maxHp - f.hp);
      f.hp += amount;
      g.events.push({ t: 'heal', f: f.id, amount });
    }
  }
  if (m.buff && f.sf === m.startup - 12) {
    f.buff = m.buff;
    g.events.push({ t: 'buff', f: f.id });
  }
  if (f.hit && f.sf >= m.startup && f.sf < m.startup + m.active + 12) {
    // Special or super asked for (motion or shortcut): it wins over the fighter's own
    // sequence, whose button may be part of the same input (LP+HP has SOCO+ in it).
    if (m.rank < 4) {
      const sp = chooseMove(f, dir, false, Math.max(3, m.rank + 1));
      if (sp) { startMove(f, sp, g, o); return; }
    }
    // The fighter's own sequence (target combo): goes straight into its finisher.
    for (const t of CHARACTERS[f.char].targets || []) {
      if (t.from === f.mv && f.chain >= t.minChain && buffered(f, BTN[t.btn])) {
        consume(f, BTN[t.btn]);
        startMove(f, t.to, g, o);
        g.events.push({ t: 'target', f: f.id });
        return;
      }
    }
    // Launcher connected: hold up to jump after the opponent.
    if (m.jc && dir >= 7 && o.st === 'fall' && o.jug > 0) { startJump(f, dir, true); return; }
  }
  // Combo cancel: once a move connected, a stronger move can interrupt it. Light attacks
  // chain into each other up to JAB_CHAIN hits in a row.
  if (f.hit && f.sf >= m.startup && f.sf < m.startup + m.active + 8) {
    const minRank = m.rank === 1 ? (o.combo >= JAB_CHAIN ? 2 : 1) : m.rank + 1;
    const next = chooseMove(f, dir, false, minRank);
    if (next) { startMove(f, next, g, o); return; }
  }
  if (f.sf >= moveTotal(m)) toNeutral(f);
}
