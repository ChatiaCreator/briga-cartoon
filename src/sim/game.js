// Match simulation: rounds, timer, hits, pushing, projectiles. Pure and deterministic:
// step(g, [inputP1, inputP2]) always produces the same state from the same inputs.
import { CHARACTERS, BUFF_DMG } from './moves.js';
import {
  createFighter, resetFighterForRound, recordInput, stepFighter, getMove, moveActive,
  isCrouching, isNeutral, WALL, MAX_DIST, BODY_W, METER_MAX,
} from './fighter.js';
import { spawnProjectile, stepProjectiles, projectileBox } from './projectile.js';
import { dirOf } from './bits.js';

export const ROUND_SECONDS = 99;
export const WINS_NEEDED = 2;
export const START_X = 1300;
const INTRO_FRAMES = 110;
const KO_FRAMES = 100;
const ROUND_END_FRAMES = 150;
const MAX_ROUNDS = 5;

export function createGame(chars) {
  const g = {
    frame: 0, phase: 'intro', phaseF: 0, round: 1, timer: ROUND_SECONDS, timerF: 0,
    hitstop: 0, wins: [0, 0], roundWinner: -1, matchWinner: -1,
    f: [createFighter(0, chars[0], -START_X), createFighter(1, chars[1], START_X)],
    proj: [], nextProjId: 1, events: [],
  };
  g.events.push({ t: 'round', round: 1 });
  return g;
}

export function step(g, inputs) {
  g.events = [];
  g.frame++;
  const live = g.phase === 'fight';
  const [a, b] = g.f;
  const inA = live ? inputs[0] : 0;
  const inB = live ? inputs[1] : 0;
  recordInput(a, inA, g.hitstop > 0);
  recordInput(b, inB, g.hitstop > 0);

  if (g.hitstop > 0) { g.hitstop--; return; }

  g.phaseF++;
  if (g.phase === 'intro' && g.phaseF >= INTRO_FRAMES) setPhase(g, 'fight');
  if (g.phase === 'fight') {
    if (++g.timerF >= 60) {
      g.timerF = 0;
      g.timer--;
      if (g.timer <= 0) timeOver(g);
    }
  }

  const spawn = (owner, p) => spawnProjectile(g, owner, p);
  g.spawn = spawn;
  stepFighter(a, inA, b, g);
  stepFighter(b, inB, a, g);
  delete g.spawn;
  stepProjectiles(g);

  resolveHits(g);
  separate(g);
  updateFacing(a, b);
  updateFacing(b, a);

  if (g.phase === 'fight' && (a.hp <= 0 || b.hp <= 0)) {
    g.roundWinner = a.hp <= 0 && b.hp <= 0 ? 2 : a.hp <= 0 ? 1 : 0;
    setPhase(g, 'ko');
  } else if (g.phase === 'ko' && g.phaseF >= KO_FRAMES) {
    endRound(g);
  } else if (g.phase === 'roundEnd' && g.phaseF >= ROUND_END_FRAMES) {
    nextRound(g);
  }
}

function setPhase(g, phase) {
  g.phase = phase;
  g.phaseF = 0;
  g.events.push({ t: phase });
}

function timeOver(g) {
  const [a, b] = g.f;
  const pa = (a.hp * 1000) / a.maxHp, pb = (b.hp * 1000) / b.maxHp;
  g.roundWinner = pa > pb ? 0 : pb > pa ? 1 : 2;
  g.events.push({ t: 'timeover' });
  setPhase(g, 'ko');
}

function endRound(g) {
  const w = g.roundWinner;
  if (w === 0 || w === 1) g.wins[w]++;
  for (const f of g.f) {
    if (f.st === 'ko' || f.ko) continue;
    const winner = f.id === w;
    if (f.y === 0) { f.st = winner ? 'win' : 'lose'; f.sf = 0; f.mv = ''; f.vx = 0; }
  }
  if (g.wins[0] >= WINS_NEEDED || g.wins[1] >= WINS_NEEDED || g.round >= MAX_ROUNDS) {
    g.matchWinner = g.wins[0] > g.wins[1] ? 0 : g.wins[1] > g.wins[0] ? 1 : 2;
    setPhase(g, 'matchEnd');
  } else {
    setPhase(g, 'roundEnd');
  }
}

function nextRound(g) {
  g.round++;
  g.timer = ROUND_SECONDS; g.timerF = 0; g.roundWinner = -1;
  g.proj = [];
  resetFighterForRound(g.f[0], -START_X);
  resetFighterForRound(g.f[1], START_X);
  setPhase(g, 'intro');
  g.events.push({ t: 'round', round: g.round });
}

function hurtbox(f) {
  if (f.st === 'down' || f.st === 'rise' || f.st === 'ko') return null;
  const h = isCrouching(f) ? 1100 : f.y > 0 ? 1450 : 1750;
  return [f.x - 260, f.y, f.x + 260, f.y + h];
}

function attackBox(f) {
  const m = getMove(f);
  if (!m || !m.box) return null;
  const [x0, y0, x1, y1] = m.box;
  const left = f.facing > 0 ? f.x + x0 : f.x - x1;
  const right = f.facing > 0 ? f.x + x1 : f.x - x0;
  return [left, f.y + y0, right, f.y + y1];
}

const overlap = (p, q) => p && q && p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3];

function resolveHits(g) {
  const hits = [];
  for (const att of g.f) {
    const def = g.f[1 - att.id];
    if (att.hit || !moveActive(att)) continue;
    const box = attackBox(att);
    const hb = hurtbox(def);
    if (overlap(box, hb)) {
      hits.push({ att, def, move: getMove(att), x: (Math.max(box[0], hb[0]) + Math.min(box[2], hb[2])) >> 1, y: (Math.max(box[1], hb[1]) + Math.min(box[3], hb[3])) >> 1 });
    }
  }
  const keep = [];
  for (const p of g.proj) {
    const att = g.f[p.owner];
    const def = g.f[1 - p.owner];
    const hb = hurtbox(def);
    if (def.inv === 0 && overlap(projectileBox(p), hb)) {
      hits.push({ att, def, move: CHARACTERS[att.char].moves[p.move], proj: p, x: p.x, y: p.y });
      g.events.push({ t: 'splash', x: p.x, kind: p.kind, air: true });
    } else {
      keep.push(p);
    }
  }
  g.proj = keep;
  for (const h of hits) applyHit(g, h);
}

function holdsBlock(def, height) {
  const dir = dirOf(def.prev, def.facing);
  if (height === 'low') return dir === 1;
  if (height === 'high') return dir === 4;
  return dir === 1 || dir === 4;
}

function applyHit(g, { att, def, move, proj, x, y }) {
  if (!proj) att.hit = true;
  if (def.inv > 0) return;
  const away = def.x === att.x ? att.facing : Math.sign(def.x - att.x);
  const canBlock = (isNeutral(def) || def.st === 'block') && def.y === 0;
  const blocked = canBlock && holdsBlock(def, move.height);
  const pushV = Math.trunc(move.push / 5) * away;
  // At a wall the attacker gets pushed back instead.
  if (Math.abs(def.x) >= WALL - 60 && !proj) att.pv = -pushV;
  else def.pv = pushV;

  if (blocked) {
    def.guardLow = dirOf(def.prev, def.facing) === 1;
    def.st = 'block'; def.sf = 0; def.stun = move.blockstun; def.mv = '';
    const chip = move.chip ? Math.trunc((move.dmg * move.chip) / 100) : 0;
    def.hp = Math.max(0, def.hp - chip);
    if (move.rank < 4) {
      att.meter = Math.min(METER_MAX, att.meter + Math.trunc(move.dmg / 4));
      def.meter = Math.min(METER_MAX, def.meter + Math.trunc(move.dmg / 8));
    }
    if (def.hp === 0) { def.ko = true; def.st = 'fall'; def.sf = 0; def.vy = 110; def.vx = 35 * away; def.y = 1; }
    g.hitstop = 5;
    g.events.push({ t: 'block', x, y, f: def.id });
    return;
  }

  let dmg = move.dmg;
  if (att.buff > 0) dmg = Math.trunc((dmg * BUFF_DMG) / 100);
  dmg = Math.trunc((dmg * Math.max(40, 100 - 10 * def.combo)) / 100);
  def.combo++;
  def.hp = Math.max(0, def.hp - dmg);
  if (move.rank < 4) {
    att.meter = Math.min(METER_MAX, att.meter + Math.trunc((move.dmg * 6) / 10));
    def.meter = Math.min(METER_MAX, def.meter + Math.trunc((move.dmg * 3) / 10));
  }
  def.mv = ''; def.guard = false; def.sf = 0;
  if (def.hp === 0) def.ko = true;
  if (def.ko || move.kd || def.y > 0 || def.st === 'fall') {
    def.st = 'fall'; def.vy = def.ko ? 130 : 110; def.vx = 35 * away; def.y = Math.max(1, def.y);
  } else {
    def.st = 'hit'; def.stun = move.hitstun;
  }
  g.hitstop = def.ko ? 20 : move.rank >= 2 ? 9 : 7;
  g.events.push({ t: 'hit', x, y, f: def.id, by: att.id, dmg, combo: def.combo, heavy: move.rank >= 2, ko: def.ko });
}

function separate(g) {
  const [a, b] = g.f;
  for (const f of g.f) f.x = Math.max(-WALL, Math.min(WALL, f.x));
  // Keep both on camera.
  const dist = Math.abs(a.x - b.x);
  if (dist > MAX_DIST) {
    const excess = dist - MAX_DIST;
    const left = a.x < b.x ? a : b, right = left === a ? b : a;
    left.x += excess >> 1;
    right.x -= excess - (excess >> 1);
  }
  // Bodies don't overlap unless one is high in the air.
  if (a.y < 900 && b.y < 900 && a.st !== 'down' && b.st !== 'down' && a.st !== 'ko' && b.st !== 'ko') {
    const dx = b.x - a.x;
    if (Math.abs(dx) < BODY_W) {
      const s = dx !== 0 ? Math.sign(dx) : a.facing;
      const over = BODY_W - Math.abs(dx);
      let pa = over >> 1, pb = over - pa;
      // Against a wall the other one takes the whole push.
      if ((s > 0 && a.x - pa < -WALL) || (s < 0 && a.x + pa > WALL)) { pb = over; pa = 0; }
      if ((s > 0 && b.x + pb > WALL) || (s < 0 && b.x - pb < -WALL)) { pa = over; pb = 0; }
      a.x -= s * pa;
      b.x += s * pb;
      a.x = Math.max(-WALL, Math.min(WALL, a.x));
      b.x = Math.max(-WALL, Math.min(WALL, b.x));
    }
  }
}

function updateFacing(f, o) {
  if (f.y !== 0) return;
  if (!(isNeutral(f) || f.st === 'jumpsquat' || f.st === 'win' || f.st === 'lose')) return;
  if (o.x > f.x) f.facing = 1;
  else if (o.x < f.x) f.facing = -1;
}

// 32-bit FNV-1a over the state that matters, used to detect online desyncs.
const ST = ['idle', 'walk', 'crouch', 'land', 'jumpsquat', 'air', 'attack', 'hit', 'block', 'fall', 'down', 'rise', 'ko', 'win', 'lose'];
const PH = ['intro', 'fight', 'ko', 'roundEnd', 'matchEnd'];
export function checksum(g) {
  let h = 0x811c9dc5;
  const mix = (v) => {
    v |= 0;
    for (let i = 0; i < 4; i++) {
      h ^= (v >>> (i * 8)) & 0xff;
      h = Math.imul(h, 0x01000193);
    }
  };
  mix(g.frame); mix(PH.indexOf(g.phase)); mix(g.phaseF); mix(g.timer); mix(g.hitstop);
  mix(g.wins[0]); mix(g.wins[1]); mix(g.round);
  for (const f of g.f) {
    mix(f.x); mix(f.y); mix(f.vx); mix(f.vy); mix(f.pv); mix(f.facing); mix(f.hp); mix(f.meter);
    mix(ST.indexOf(f.st)); mix(f.sf); mix(f.mv.length ? f.mv.charCodeAt(0) * 256 + f.mv.charCodeAt(f.mv.length - 1) : 0);
    mix(f.stun); mix(f.inv); mix(f.buff); mix(f.combo);
  }
  for (const p of g.proj) { mix(p.x); mix(p.y); mix(p.vx); mix(p.vy); }
  return h >>> 0;
}
