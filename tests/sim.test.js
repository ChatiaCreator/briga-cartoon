import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, checksum } from '../src/sim/game.js';
import { LP, HP, LK, HK, SUP, EX1, EX2, LEFT, RIGHT, DOWN, UP } from '../src/sim/bits.js';

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

test('sweep knocks down', () => {
  const g = createGame(['hotmonster', 'flash']);
  toFight(g); approach(g);
  step(g, [DOWN | HK, 0]);
  let fell = false;
  for (let i = 0; i < 40; i++) { step(g, [DOWN, 0]); if (g.f[1].st === 'fall' || g.f[1].st === 'down') fell = true; }
  assert.ok(fell);
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
