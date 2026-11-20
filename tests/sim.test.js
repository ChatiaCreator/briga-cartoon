import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, checksum } from '../src/sim/game.js';
import { LP, HP, LK, HK, SUP, EX1, EX2, LEFT, RIGHT, DOWN, UP } from '../src/sim/bits.js';
import * as moves from '../src/sim/moves.js';
import { RULES } from '../src/sim/fighter.js';

// AGARRÃO is switched off in the game for now; its tests switch it on while they run.
function throwsOn(t) { RULES.throws = true; t.after(() => { RULES.throws = false; }); }

function run(g, frames, fn) {
  for (let i = 0; i < frames; i++) step(g, fn ? fn(g.frame, g) : [0, 0]);
}
function toFight(g) { while (g.phase !== 'fight') step(g, [0, 0]); }
// Walk P1 into range of P2.
function approach(g, dist = 700) {
  let n = 0;
  while (g.f[1].x - g.f[0].x > dist && n++ < 300) step(g, [RIGHT, 0]);
}
// Press a button for one frame then release, then idle for `after` frames.
function tap(g, bits, p = 0, after = 30) {
  const ins = [0, 0]; ins[p] = bits; step(g, ins);
  run(g, after);
}

test('intro then fight, timer counts down', () => {
  const g = createGame(['hotmonster', 'flash']);
  assert.equal(g.phase, 'intro');
  toFight(g);
  const t = g.timer;
  run(g, 61);
  assert.equal(g.timer, t - 1);
});

test('jab hits in range and deals damage', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g); approach(g);
  const hp = g.f[1].hp;
  tap(g, LP);
  assert.equal(g.f[1].hp, hp - 40);
  assert.ok(g.f[0].meter > 0);
});

test('holding back blocks', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g); approach(g);
  const hp = g.f[1].hp;
  // P2 faces left, so "back" for P2 is RIGHT.
  step(g, [HP, RIGHT]);
  run(g, 30, () => [0, RIGHT]);
  assert.equal(g.f[1].hp, hp);
});

test('low attack must be crouch-blocked', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g); approach(g);
  const hp = g.f[1].hp;
  step(g, [DOWN | LK, RIGHT]);
  run(g, 30, () => [DOWN, RIGHT]);
  assert.ok(g.f[1].hp < hp, 'standing block should not stop a low');
});

test('combo: jab cancels into special, damage scales', () => {
  const g = createGame(['flash', 'hotmonster']);
  toFight(g); approach(g, 600);
  const hp = g.f[1].hp;
  step(g, [LP, 0]);
  // Inputs during the jab: quarter circle forward + punch.
  const seq = [DOWN, DOWN, DOWN | RIGHT, RIGHT, RIGHT | LP];
  for (const s of seq) step(g, [s, 0]);
  run(g, 60);
  assert.equal(g.f[0].mv === '' || g.f[0].st !== 'attack', true);
  const dealt = hp - g.f[1].hp;
  assert.ok(dealt > 40 + 50, `combo dealt ${dealt}`);
});

test('Hotmonster special throws a dog food bag that hits', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g);
  const hp = g.f[1].hp;
  const seq = [DOWN, DOWN | RIGHT, RIGHT, RIGHT | LP];
  for (const s of seq) step(g, [s, 0]);
  let sawProj = false;
  for (let i = 0; i < 80; i++) { step(g, [0, 0]); if (g.proj.length) sawProj = true; }
  assert.ok(sawProj);
  assert.ok(g.f[1].hp < hp, 'bag should hit at mid range');
});

test('LP+HP shortcut also does the special', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g);
  step(g, [LP | HP, 0]);
  assert.equal(g.f[0].mv, 'special');
});

test('Flash super needs full meter and gives the GARRA buff', () => {
  const g = createGame(['flash', 'hotmonster']);
  toFight(g);
  step(g, [SUP, 0]);
  assert.notEqual(g.f[0].mv, 'super');
  run(g, 10);
  g.f[0].meter = 1000;
  step(g, [SUP, 0]);
  assert.equal(g.f[0].mv, 'super');
  assert.equal(g.f[0].meter, 0);
  run(g, 110);
  assert.ok(g.f[0].buff > 0);
  // Buffed jab does 50% more.
  approach(g);
  const hp = g.f[1].hp;
  tap(g, LP);
  assert.equal(hp - g.f[1].hp, 60);
});

test('Hotmonster super rains bags on the opponent', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g);
  g.f[0].meter = 1000;
  const hp = g.f[1].hp;
  step(g, [SUP, 0]);
  run(g, 200);
  assert.ok(hp - g.f[1].hp >= 200, `rain dealt ${hp - g.f[1].hp}`);
});

test('crouching CHUTE+ is a strong low kick (the spinning sweep is off for now)', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g); approach(g);
  const hp = g.f[1].hp;
  step(g, [DOWN | HK, 0]);
  let fell = false;
  for (let i = 0; i < 40; i++) { step(g, [DOWN, 0]); if (g.f[1].st === 'fall' || g.f[1].st === 'down') fell = true; }
  assert.ok(g.f[1].hp < hp, 'it hits');
  assert.ok(!fell, 'it does not knock down');
});

test('AGARRÃO is off: forward + SOCO+ up close is a normal strong punch', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g); approach(g, 600);
  step(g, [RIGHT | HP, 0]);
  assert.equal(g.f[0].mv, 'hp');
  run(g, 8);
  assert.notEqual(g.f[1].st, 'thrown');
});

test('jumping works and lands', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g);
  step(g, [UP, 0]);
  let maxY = 0;
  for (let i = 0; i < 80; i++) { step(g, [0, 0]); maxY = Math.max(maxY, g.f[0].y); }
  assert.ok(maxY > 1500);
  assert.equal(g.f[0].y, 0);
  assert.equal(g.f[0].st, 'idle');
});

test('KO ends the round and best of 3 ends the match', () => {
  const g = createGame(['hotmonster', 'flash']);
  for (let r = 0; r < 2; r++) {
    toFight(g);
    g.f[1].hp = 1;
    approach(g);
    tap(g, LP, 0, 5);
    assert.equal(g.phase, 'ko');
    run(g, 400);
  }
  assert.equal(g.wins[0], 2);
  assert.equal(g.phase, 'matchEnd');
  assert.equal(g.matchWinner, 0);
});

test('time over gives the round to who has more health', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g);
  g.f[0].hp -= 10;
  run(g, 99 * 60 + 200);
  assert.equal(g.wins[1], 1);
});

test('fighters cannot walk through each other or off the stage', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g);
  run(g, 200, () => [RIGHT, 0]);
  assert.ok(g.f[1].x - g.f[0].x >= 500);
  run(g, 400, () => [LEFT, LEFT]);
  assert.ok(g.f[0].x >= -4200);
});

test('determinism: same random inputs give the same checksum', () => {
  function sim(seed) {
    let s = seed;
    const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) >>> 16);
    const g = createGame(['hotmonster', 'flash']);
    const hashes = [];
    for (let i = 0; i < 6000; i++) {
      step(g, [rnd() & 511, rnd() & 511]);
      if (i % 100 === 0) hashes.push(checksum(g));
    }
    return { hashes, g };
  }
  const a = sim(42), b = sim(42), c = sim(7);
  assert.deepEqual(a.hashes, b.hashes);
  assert.notDeepEqual(a.hashes, c.hashes);
  // Every number in the state must be an integer (floats could desync between browsers).
  const check = (o, path) => {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number') assert.ok(Number.isInteger(v), `${path}.${k} = ${v}`);
      else if (v && typeof v === 'object') check(v, `${path}.${k}`);
    }
  };
  check(a.g, 'g');
});

test('Genildo special fires a bullet that crosses the stage and hits', () => {
  const g = createGame(['genildo', 'flash']);
  toFight(g);
  const hp = g.f[1].hp;
  step(g, [LP | HP, 0]);
  assert.equal(g.f[0].mv, 'special');
  let bullet = null;
  for (let i = 0; i < 80; i++) {
    step(g, [0, 0]);
    bullet = bullet || g.proj.find((p) => p.kind === 'bullet');
  }
  assert.ok(bullet, 'a bullet was fired');
  assert.equal(bullet.vy, 0, 'bullets fly straight');
  assert.ok(g.f[1].hp < hp, 'the shot should hit from full screen');
});

test('Genildo super fires a five-shot burst', () => {
  const g = createGame(['genildo', 'flash']);
  toFight(g);
  g.f[0].meter = 1000;
  const shots = new Set();
  step(g, [SUP, 0]);
  for (let i = 0; i < 200; i++) { step(g, [0, 0]); for (const p of g.proj) shots.add(p.id); }
  assert.equal(shots.size, 5);
});

test('VOADORA travels forward and ESTRELA knocks down', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g);
  const x0 = g.f[0].x;
  step(g, [EX1, 0]);
  assert.equal(g.f[0].mv, 'fk');
  run(g, 12);
  assert.ok(g.f[0].x - x0 > 300, 'VOADORA should move forward');
  run(g, 60);
  approach(g, 1200);
  step(g, [EX2, 0]);
  let fell = false;
  for (let i = 0; i < 60; i++) { step(g, [0, 0]); if (g.f[1].st === 'fall' || g.f[1].st === 'down') fell = true; }
  assert.ok(fell, 'ESTRELA should knock down');
});

test('ESQUIVA: double tap back slips back and a jab passes through', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g); approach(g, 650);
  // A single tap back is just a step back.
  step(g, [LEFT, 0]); step(g, [0, 0]);
  assert.notEqual(g.f[0].mv, 'dodge');
  run(g, 20);
  const x0 = g.f[0].x, hp = g.f[0].hp;
  // P2 jabs while P1 taps back twice.
  step(g, [LEFT, LP]); step(g, [0, 0]); step(g, [0, 0]); step(g, [LEFT, 0]);
  assert.equal(g.f[0].mv, 'dodge');
  assert.ok(g.f[0].inv > 0, 'untouchable while slipping');
  run(g, 30);
  assert.equal(g.f[0].hp, hp, 'the jab should whiff during the dodge');
  assert.ok(x0 - g.f[0].x > 400, `dodge moved ${x0 - g.f[0].x} mm back`);
  assert.equal(g.f[0].st, 'idle');
});

// Presses `bits` once, then waits `wait` frames (inputs held in `hold` meanwhile).
function seq(g, steps) {
  for (const [bits, wait, hold = 0] of steps) { step(g, [bits, 0]); run(g, wait, () => [hold, 0]); }
}
const comboHits = (g) => g.f[1].combo;

test('Hotmonster FÚRIA DO MONSTRO: SOCO, SOCO, SOCO+ smashes, bounces, special follows up', () => {
  const g = createGame(['hotmonster', 'genildo']);
  toFight(g); approach(g, 650);
  const hp = g.f[1].hp, seen = new Set();
  const watch = (bits) => { step(g, [bits, 0]); for (const e of g.events) seen.add(e.t); };
  for (const [bits, wait] of [[LP, 7], [LP, 7], [HP, 14], [LP | HP, 70]]) {
    watch(bits);
    for (let i = 0; i < wait; i++) watch(0);
  }
  assert.ok(seen.has('target'), 'SOCO, SOCO, SOCO+ goes into the finisher');
  assert.ok(seen.has('bounce'), 'the smash bounces off the ground');
  assert.ok(hp - g.f[1].hp >= 230, `dealt ${hp - g.f[1].hp}`);
});

test('Flash UPPER RELÂMPAGO: SOCO+, SOCO+ launches, jump and air kick juggle', () => {
  const g = createGame(['flash', 'genildo']);
  toFight(g); approach(g, 650);
  seq(g, [[HP, 18], [HP, 8]]);
  assert.equal(g.f[0].mv, 'tc');
  run(g, 10);
  assert.equal(g.f[1].st, 'fall');
  assert.equal(g.f[1].jug, 3);
  const hp = g.f[1].hp;
  run(g, 22, () => [UP | RIGHT, 0]);
  assert.ok(g.f[0].st === 'air', 'jumped after the launch');
  seq(g, [[HK, 40]]);
  assert.ok(g.f[1].hp < hp, 'air kick juggles the falling opponent');
});

test('Genildo ENQUADRO: CHUTE, CHUTE, SOCO+ launches into a shot', () => {
  const g = createGame(['genildo', 'flash']);
  toFight(g); approach(g, 650);
  const hp = g.f[1].hp;
  seq(g, [[LK, 8], [LK, 8], [HP, 24], [LP | HP, 60]]);
  assert.ok(hp - g.f[1].hp >= 220, `dealt ${hp - g.f[1].hp}`);
});

test('juggles are limited: no hits left means attacks pass through', () => {
  const g = createGame(['genildo', 'flash']);
  toFight(g);
  const d = g.f[1];
  Object.assign(d, { st: 'fall', y: 600, vy: 0, jug: 0 });
  const hp = d.hp;
  step(g, [LP | HP, 0]);
  for (let i = 0; i < 40 && d.st === 'fall'; i++) { d.vy = 0; d.y = 600; step(g, [0, 0]); }
  assert.equal(d.hp, hp, 'shot passes through a fighter with no juggle hits left');
});

test('Anderon super LIGANDO PRA CASADA heals; a hit after the safe start hangs up', () => {
  const g = createGame(['anderon', 'flash']);
  toFight(g);
  g.f[0].hp = 500; g.f[0].meter = 1000;
  step(g, [SUP, 0]);
  assert.equal(g.f[0].mv, 'super');
  assert.equal(g.f[0].meter, 0);
  run(g, 200);
  assert.equal(g.f[0].hp, 500 + 13 * 24, 'thirteen heal ticks of 24');
  // Interrupted: P2 hits him after the untouchable part.
  const g2 = createGame(['anderon', 'flash']);
  toFight(g2); approach(g2, 700);
  g2.f[0].hp = 500; g2.f[0].meter = 1000;
  step(g2, [SUP, 0]);
  run(g2, 45 + 55);
  step(g2, [0, HP]);
  run(g2, 80);
  assert.ok(g2.f[0].hp < 500 + 13 * 24 - 85, `hp ${g2.f[0].hp}`);
});

test('Anderon special ARMADA travels and knocks down', () => {
  const g = createGame(['anderon', 'genildo']);
  toFight(g); approach(g, 1300);
  step(g, [LP | HP, 0]);
  assert.equal(g.f[0].mv, 'special');
  let fell = false;
  for (let i = 0; i < 50; i++) { step(g, [0, 0]); if (g.f[1].st === 'fall' || g.f[1].st === 'down') fell = true; }
  assert.ok(fell);
});

test('HGL super throws the screwdriver across the stage and knocks down', () => {
  const g = createGame(['hgl', 'flash']);
  toFight(g);
  g.f[0].meter = 1000;
  const hp = g.f[1].hp;
  step(g, [SUP, 0]);
  let saw = false, fell = false;
  for (let i = 0; i < 140; i++) {
    step(g, [0, 0]);
    if (g.proj.some((p) => p.kind === 'screwdriver')) saw = true;
    if (g.f[1].st === 'fall' || g.f[1].st === 'down') fell = true;
  }
  assert.ok(saw, 'a screwdriver was thrown');
  assert.ok(fell, 'it knocks down');
  assert.ok(hp - g.f[1].hp >= 200, `dealt ${hp - g.f[1].hp}`);
});

test('HGL special CARRINHO slides under a bullet and must be blocked low', () => {
  const g = createGame(['hgl', 'genildo']);
  toFight(g); approach(g, 1800);
  step(g, [0, LP | HP]);         // Genildo fires
  run(g, 8);
  const hp = g.f[0].hp;
  step(g, [LP | HP, 0]);         // HGL slides
  run(g, 20);
  assert.equal(g.f[0].hp, hp, 'the bullet passed over the slide');
  // Standing block does not stop it.
  const g2 = createGame(['hgl', 'flash']);
  toFight(g2); approach(g2, 1200);
  const hp2 = g2.f[1].hp;
  step(g2, [LP | HP, RIGHT]);
  run(g2, 40, () => [0, RIGHT]);
  assert.ok(g2.f[1].hp < hp2, 'standing block should not stop the slide');
});

test('AGARRÃO: forward + SOCO+ up close throws the opponent behind and knocks down', (t) => {
  throwsOn(t);
  const g = createGame(['hotmonster', 'flash']);
  toFight(g); approach(g, 600);
  const hp = g.f[1].hp, x0 = g.f[0].x;
  step(g, [RIGHT | HP, 0]);
  assert.equal(g.f[0].mv, 'throw');
  run(g, 8);
  assert.equal(g.f[1].st, 'thrown');
  run(g, 70);
  assert.equal(g.f[1].hp, hp - 130);
  assert.ok(g.f[1].x < x0, 'landed on the other side of the thrower');
  assert.ok(['down', 'rise'].includes(g.f[1].st), g.f[1].st);
  run(g, 120);
  assert.equal(g.f[0].st, 'idle');
  assert.equal(g.f[0].facing, -1, 'the thrower turns to face the opponent');
});

test('AGARRÃO: blocking does not stop it, pressing SOCO+ right away escapes', (t) => {
  throwsOn(t);
  const g = createGame(['hotmonster', 'flash']);
  toFight(g); approach(g, 600);
  const hp = g.f[1].hp;
  step(g, [RIGHT | HP, RIGHT]);            // P2 holds back (block) — still grabbed
  run(g, 6, () => [0, RIGHT]);
  assert.equal(g.f[1].st, 'thrown');
  step(g, [0, HP]);                         // escape
  run(g, 30);
  assert.equal(g.f[1].hp, hp, 'escaped without damage');
  assert.notEqual(g.f[1].st, 'thrown');
  assert.ok(g.f[1].x - g.f[0].x >= 500, 'pushed apart');
});

test('Each fighter has their own AGARRÃO: dumped in front (BAIANA) or struck into the air (CLINCH)', (t) => {
  throwsOn(t);
  // Anderson: double-leg takedown, the opponent goes down in front of him.
  const g = createGame(['anderon', 'flash']);
  toFight(g); approach(g, 600);
  const hp = g.f[1].hp;
  step(g, [RIGHT | HP, 0]);
  run(g, 8);
  assert.equal(g.f[1].st, 'thrown');
  assert.equal(g.f[1].x - g.f[0].x, moves.CHARACTERS.anderon.moves.throw.throw.hold, 'held at arm\'s length');
  run(g, 40);
  assert.equal(g.f[1].hp, hp - 130);
  assert.ok(g.f[1].x > g.f[0].x, 'stays in front of the thrower');
  assert.ok(['down', 'rise'].includes(g.f[1].st), g.f[1].st);
  // Genildo: clinch, two knees (they cannot finish), then the uppercut launches.
  const g2 = createGame(['genildo', 'hotmonster']);
  toFight(g2); approach(g2, 600);
  const hp2 = g2.f[1].hp;
  step(g2, [RIGHT | HP, 0]);
  run(g2, 50);
  assert.equal(g2.f[1].st, 'thrown');
  assert.equal(g2.f[1].hp, hp2 - 60, 'two knees landed');
  run(g2, 60); // the knees' hit-stop holds the clock a little
  assert.equal(g2.f[1].hp, hp2 - 130);
  assert.ok(['fall', 'down'].includes(g2.f[1].st), g2.f[1].st);
  run(g2, 60);
  assert.equal(g2.f[0].st, 'idle');
  assert.ok(['down', 'rise', 'idle'].includes(g2.f[1].st), g2.f[1].st);
  const k = createGame(['genildo', 'hotmonster']);
  toFight(k); approach(k, 600);
  k.f[1].hp = 40;
  step(k, [RIGHT | HP, 0]);
  run(k, 50);
  assert.equal(k.f[1].hp, 1, 'the knees leave them at 1');
  run(k, 120);
  assert.ok(k.f[1].ko, 'the uppercut finishes');
});

test('AGARRÃO: too far away it whiffs and leaves the thrower open', (t) => {
  throwsOn(t);
  const g = createGame(['hotmonster', 'flash']);
  toFight(g); approach(g, 1500);
  step(g, [RIGHT | HP, 0]);
  assert.notEqual(g.f[0].mv, 'throw', 'out of range: a normal strong punch instead');
  const g2 = createGame(['hotmonster', 'flash']);
  toFight(g2); approach(g2, 600);
  step(g2, [UP, 0]); step(g2, [0, UP]); run(g2, 3);     // P2 jumps
  step(g2, [RIGHT | HP, 0]);
  assert.notEqual(g2.f[1].st, 'thrown', 'airborne opponents cannot be grabbed');
});

test('Davidson super BASEADO GIGANTE heals; special CHAPA GIRATÓRIA knocks down', () => {
  const g = createGame(['davidson', 'flash']);
  toFight(g);
  g.f[0].hp = 500; g.f[0].meter = 1000;
  step(g, [SUP, 0]);
  assert.equal(g.f[0].mv, 'super');
  run(g, 200);
  assert.equal(g.f[0].hp, 500 + 16 * 20);
  const g2 = createGame(['davidson', 'genildo']);
  toFight(g2); approach(g2, 1300);
  step(g2, [LP | HP, 0]);
  let fell = false;
  for (let i = 0; i < 50; i++) { step(g2, [0, 0]); if (['fall', 'down'].includes(g2.f[1].st)) fell = true; }
  assert.ok(fell);
});

test('every fighter has a second signature string that knocks down', () => {
  const B = { LP, HP, LK, HK };
  for (const id of ['hotmonster', 'flash', 'genildo', 'anderon', 'hgl', 'davidson']) {
    const g = createGame([id, 'genildo']);
    toFight(g); approach(g, 650);
    const t2 = moves.CHARACTERS[id].targets[1];
    let saw = false, down = false;
    const press = (bits, n) => { step(g, [bits, 0]); for (let i = 0; i < n; i++) { step(g, [0, 0]); if (g.events.some((e) => e.t === 'target')) saw = true; if (['fall', 'down'].includes(g.f[1].st)) down = true; } };
    for (let k = 0; k <= t2.minChain; k++) press(B[t2.from.toUpperCase()], 8);
    press(B[t2.btn], 60);
    assert.ok(saw, `${id}: the finisher came out`);
    assert.ok(down, `${id}: knocked down`);
  }
});

// Presses each button `gap` frames after the previous one (held `hold`), and reports the
// biggest combo the opponent took and whether a signature finisher came out.
function combo(g, presses, gap = 8, hold = 0) {
  let best = 0, target = false;
  const watch = (bits) => {
    step(g, [bits | hold, 0]);
    best = Math.max(best, g.f[1].combo);
    if (g.events.some((e) => e.t === 'target')) target = true;
  };
  for (const bits of presses) { watch(bits); for (let i = 0; i < gap; i++) watch(0); }
  for (let i = 0; i < 70; i++) watch(0);
  return { best, target };
}

test('special wins over a signature string that shares its button (Flash: SOCO+ then LP+HP)', () => {
  const g = createGame(['flash', 'genildo']);
  toFight(g); approach(g, 650);
  step(g, [HP, 0]); run(g, 12);
  step(g, [LP | HP, 0]);
  run(g, 8); // the cancel happens when the hit-stop ends
  assert.equal(g.f[0].mv, 'special', 'the shortcut gives the special, not UPPER RELÂMPAGO');
});

test('combo step-in: every signature string still connects when it starts with a jab', () => {
  const B = { LP, HP, LK, HK };
  for (const id of ['hotmonster', 'flash', 'genildo', 'anderon', 'hgl', 'davidson']) {
    for (const t of moves.CHARACTERS[id].targets) {
      const g = createGame([id, 'genildo']);
      toFight(g); approach(g, 650);
      const presses = [LP, ...Array(t.minChain + 1).fill(B[t.from.toUpperCase()]), B[t.btn]];
      const r = combo(g, presses);
      assert.ok(r.target, `${id} ${t.to}: the finisher came out`);
      assert.equal(r.best, presses.length, `${id} jab > ${t.from}x${t.minChain + 1} > ${t.btn}: every hit connects`);
    }
  }
});

test('jab, strong punch, special connects for everyone (the README combo)', () => {
  for (const id of ['hotmonster', 'flash', 'genildo', 'anderon', 'hgl', 'davidson']) {
    const g = createGame([id, 'genildo']);
    toFight(g); approach(g, 650);
    const r = combo(g, [LP, HP, LP | HP]);
    assert.equal(r.best, 3, `${id}: SOCO > SOCO+ > especial`);
  }
});

test('air combo: launcher, jump after them, then SOCO > CHUTE > CHUTE+ in the air', () => {
  for (const id of ['hotmonster', 'flash', 'genildo', 'anderon', 'hgl', 'davidson']) {
    const g = createGame([id, 'genildo']);
    toFight(g); approach(g, 650);
    step(g, [DOWN | HP, 0]);
    run(g, 6, () => [DOWN, 0]);
    // Hold up-forward through the hit-stop: jumps after the launched opponent.
    run(g, 20, () => [UP | RIGHT, 0]);
    assert.equal(g.f[0].chase, 1, `${id}: chase jump`);
    let best = 0;
    for (const b of [LP, LK, HK]) {
      step(g, [b, 0]);
      for (let i = 0; i < 12; i++) { step(g, [0, 0]); best = Math.max(best, g.f[1].combo); }
    }
    assert.equal(best, 4, `${id}: launcher + three air hits`);
  }
});

test('light attacks chain into each other at most four times', () => {
  const g = createGame(['hotmonster', 'genildo']);
  toFight(g); approach(g, 650);
  let best = 0;
  for (let i = 0; i < 60; i++) { step(g, [i % 3 === 0 ? LP : 0, 0]); best = Math.max(best, g.f[1].combo); }
  assert.ok(best <= 4, `combo of ${best} jabs`);
});
