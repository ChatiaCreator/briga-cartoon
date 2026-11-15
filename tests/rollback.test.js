import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, checksum } from '../src/sim/game.js';
import { Rollback } from '../src/net/rollback.js';

// Two players over a simulated network: each message arrives `latency` ticks later, plus
// random jitter. Each side presses random buttons. Both sides must end with the same
// confirmed states as a plain simulation of the same inputs.
function play({ latency, jitter, ticks, delay, seed, slowB = 0 }) {
  let s = seed;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) >>> 16);
  const queue = [];
  let now = 0;
  const peers = [];
  const transport = (to) => ({ send: (msg) => queue.push({ at: now + latency + (rnd() % (jitter + 1)), to, msg: JSON.parse(JSON.stringify(msg)) }) });
  peers[0] = new Rollback(transport(1), 0, delay, createGame(['hotmonster', 'genildo']));
  peers[1] = new Rollback(transport(0), 1, delay, createGame(['hotmonster', 'genildo']));
  // Inputs are held for a few frames like a real player, so predictions are often right.
  const held = [0, 0], left = [0, 0];
  const press = (i) => {
    if (left[i]-- <= 0) { held[i] = rnd() & 2047; left[i] = 3 + (rnd() % 20); }
    return held[i];
  };
  const results = { ok: [0, 0], stall: [0, 0], wait: [0, 0] };
  for (; now < ticks; now++) {
    // Deliver in arrival order (the real data channel is ordered).
    queue.sort((a, b) => a.at - b.at);
    while (queue.length && queue[0].at <= now) { const q = queue.shift(); peers[q.to].onMessage(q.msg); }
    for (let i = 0; i < 2; i++) {
      if (i === 1 && slowB && now % slowB === 0) continue; // a slower device skips frames
      results[peers[i].tick(press(i))][i]++;
    }
  }
  return { peers, results };
}

for (const net of [
  { name: 'good connection', latency: 3, jitter: 2, delay: 2 },
  { name: 'laggy connection with jitter', latency: 8, jitter: 6, delay: 3 },
  { name: 'one device slower than the other', latency: 5, jitter: 3, delay: 2, slowB: 7 },
]) {
  test(`rollback: ${net.name} stays in sync`, () => {
    const { peers, results } = play({ ...net, ticks: 1500, seed: 99 });
    assert.equal(peers[0].desync, null);
    assert.equal(peers[1].desync, null);
    const common = [...peers[0].localHashes.keys()].filter((f) => peers[1].localHashes.has(f));
    assert.ok(common.length >= 8, `compared ${common.length} checkpoints`);
    for (const f of common) assert.equal(peers[0].localHashes.get(f), peers[1].localHashes.get(f), `frame ${f}`);
    // It keeps moving: few stalls, and the latency is hidden by rollbacks instead.
    // A slower device makes the faster one slow down to its pace (that keeps them close).
    const pace = net.slowB ? 1500 * (1 - 1 / net.slowB) : 1500;
    assert.ok(results.ok[0] > pace - 80, `P1 simulated ${results.ok[0]} frames (pace ${pace})`);
    assert.ok(Math.abs(peers[0].frame - peers[1].frame) <= 12, `frames ${peers[0].frame} / ${peers[1].frame}`);
    assert.ok(results.stall[0] + results.stall[1] < 60, `stalls ${results.stall}`);
    if (net.latency > net.delay) assert.ok(peers[0].rollbacks > 0, 'some predictions were corrected');
  });
}

test('rollback states match a plain simulation of the same inputs', () => {
  // Keep every input: replay the whole match without network and compare checkpoints.
  const all = [new Map(), new Map()];
  const orig = Rollback.prototype.addLocal;
  Rollback.prototype.addLocal = function (bits) { const before = this.sentUpTo; orig.call(this, bits); if (this.sentUpTo !== before) all[this.me].set(this.sentUpTo, bits); };
  try {
    const { peers } = play({ latency: 7, jitter: 5, delay: 2, ticks: 1300, seed: 5 });
    const g = createGame(['hotmonster', 'genildo']);
    let checked = 0;
    for (let f = 0; f < 1200; f++) {
      step(g, [all[0].get(f) ?? 0, all[1].get(f) ?? 0]);
      const k = f + 1;
      if (peers[0].localHashes.has(k)) { assert.equal(peers[0].localHashes.get(k), checksum(g), `frame ${k}`); checked++; }
    }
    assert.ok(checked >= 10, `checked ${checked}`);
    assert.ok(peers[0].rollbacks > 10, `rollbacks ${peers[0].rollbacks}`);
  } finally {
    Rollback.prototype.addLocal = orig;
  }
});
