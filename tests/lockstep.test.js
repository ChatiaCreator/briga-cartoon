import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, checksum } from '../src/sim/game.js';
import { Lockstep, memoryPair } from '../src/net/lockstep.js';

// Two "browsers" exchanging inputs over a laggy in-memory link. Each runs its own sim and
// ticks at its own pace; they must end with identical states and never deadlock.
async function runPair({ latency, delay, frames, jitterA = 1, jitterB = 1 }) {
  const [ta, tb] = memoryPair(latency);
  const peers = [ta, tb].map((t, me) => {
    const lock = new Lockstep(t, me, delay);
    t.onMessage((m) => lock.onMessage(m));
    let s = 99 + me * 7;
    const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) >>> 16);
    return { me, lock, g: createGame(['hotmonster', 'flash']), frame: 0, sampled: -1, rnd, stalls: 0 };
  });
  const tick = (p) => {
    if (p.sampled !== p.frame) { p.lock.addLocal(p.frame, p.rnd() & 511); p.sampled = p.frame; }
    if (!p.lock.ready(p.frame)) { p.stalls++; return; }
    step(p.g, p.lock.take(p.frame));
    p.frame++;
    if (p.frame % 60 === 0) p.lock.reportHash(p.frame, checksum(p.g));
  };
  const deadline = Date.now() + 20000;
  while ((peers[0].frame < frames || peers[1].frame < frames) && Date.now() < deadline) {
    for (let k = 0; k < jitterA; k++) if (peers[0].frame < frames) tick(peers[0]);
    for (let k = 0; k < jitterB; k++) if (peers[1].frame < frames) tick(peers[1]);
    await new Promise((r) => setTimeout(r, 1));
  }
  await new Promise((r) => setTimeout(r, latency * 3 + 10));
  return peers;
}

test('lockstep keeps both sims identical with latency', async () => {
  const [a, b] = await runPair({ latency: 15, delay: 3, frames: 1500 });
  assert.equal(a.frame, 1500);
  assert.equal(b.frame, 1500);
  assert.equal(checksum(a.g), checksum(b.g));
  assert.equal(a.lock.desync, null);
  assert.equal(b.lock.desync, null);
});

test('lockstep survives one side running faster', async () => {
  const [a, b] = await runPair({ latency: 5, delay: 2, frames: 900, jitterA: 3, jitterB: 1 });
  assert.equal(checksum(a.g), checksum(b.g));
  assert.equal(a.lock.desync, null);
});

test('desync is detected when states differ', async () => {
  const [ta, tb] = memoryPair(0);
  const la = new Lockstep(ta, 0, 2), lb = new Lockstep(tb, 1, 2);
  ta.onMessage((m) => la.onMessage(m));
  tb.onMessage((m) => lb.onMessage(m));
  la.reportHash(60, 111);
  lb.reportHash(60, 222);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(la.desync, 60);
  assert.equal(lb.desync, 60);
});
