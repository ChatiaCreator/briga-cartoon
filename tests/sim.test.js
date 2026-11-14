import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, checksum } from '../src/sim/game.js';
import { LP, HP, LK, HK, SUP, LEFT, RIGHT, DOWN, UP } from '../src/sim/bits.js';

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
