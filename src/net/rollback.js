// Rollback netcode for two players (the technique fighting games use online).
//
// The game never waits for the other player's input: it predicts it (the last input it
// received) and keeps going. When the real input for an earlier frame arrives and differs
// from the prediction, the game goes back to the state saved before that frame and
// re-simulates up to now with the right inputs. The simulation is deterministic and cheap,
// so this takes well under a millisecond.
//
// A small input delay (2-4 frames) keeps rollbacks short. Both sides also keep their
// clocks in step: the one running ahead pauses for a frame now and then.
import { step, checksum } from '../sim/game.js';

export const MAX_ROLLBACK = 12;   // frames we may run ahead of the last confirmed remote input
const KEEP = 90;                  // saved states / inputs kept behind the confirmed frame

const clone = typeof structuredClone === 'function'
  ? structuredClone
  : (o) => JSON.parse(JSON.stringify(o));

export class Rollback {
  // transport: { send(msg) }. game: the freshly created game state (frame 0).
  // matchNo: messages from another match (before a rematch) are ignored.
  constructor(transport, localIndex, delay, game, matchNo = 0) {
    this.matchNo = matchNo;
    this.t = transport;
    this.me = localIndex;
    this.delay = delay;
    this.game = game;
    this.frame = 0;                     // next frame to simulate
    this.local = new Map();
    this.remote = new Map();            // confirmed remote inputs
    this.used = new Map();              // remote input each simulated frame actually used
    this.states = new Map();            // state before frame f
    for (let f = 0; f < delay; f++) { this.local.set(f, 0); this.remote.set(f, 0); }
    this.sentUpTo = delay - 1;
    this.remoteMax = delay - 1;         // every remote input up to here is known
    this.acked = delay - 1;             // the other side has all our inputs up to here
    this.rollbackFrom = Infinity;
    this.remoteFrame = 0;               // their frame when they last sent
    this.remoteLag = 0;                 // how far behind them we looked, from their side
    this.lastWait = -100;
    this.rollbacks = 0;                 // stats (tests, debug)
    this.localHashes = new Map();
    this.remoteHashes = new Map();
    this.nextHash = 60;
    this.desync = null;
  }

  // Our input for the frame about to be simulated; it is scheduled for frame + delay.
  addLocal(bits) {
    const target = this.frame + this.delay;
    if (target <= this.sentUpTo) return;
    this.sentUpTo = target;
    this.local.set(target, bits);
    this.send();
  }

  // Sends every input the other side hasn't confirmed yet (up to 30), so a late or lost
  // message is covered by the next one.
  send() {
    const from = Math.max(this.acked + 1, this.sentUpTo - 29);
    const d = [];
    for (let f = from; f <= this.sentUpTo; f++) d.push(this.local.get(f) ?? 0);
    this.t.send({ t: 'i', m: this.matchNo, s: from, d, a: this.remoteMax, f: this.frame, l: this.frame - this.remoteFrame });
  }

  onMessage(msg) {
    if ((msg.t === 'i' || msg.t === 'cs') && (msg.m ?? 0) !== this.matchNo) return true;
    if (msg.t === 'i') {
      msg.d.forEach((bits, k) => {
        const f = msg.s + k;
        if (this.remote.has(f)) return;
        this.remote.set(f, bits);
        // We already simulated this frame with a guess that turned out wrong.
        if (this.used.has(f) && this.used.get(f) !== bits) this.rollbackFrom = Math.min(this.rollbackFrom, f);
      });
      while (this.remote.has(this.remoteMax + 1)) this.remoteMax++;
      if (msg.a > this.acked) this.acked = msg.a;
      if (msg.f > this.remoteFrame) { this.remoteFrame = msg.f; this.remoteLag = msg.l; }
      return true;
    }
    if (msg.t === 'cs') {
      this.remoteHashes.set(msg.f, msg.h);
      this.compare(msg.f);
      return true;
    }
    return false;
  }

  remoteInput(f) {
    if (this.remote.has(f)) return this.remote.get(f);
    return this.remote.get(this.remoteMax) ?? 0; // prediction: they keep doing the same
  }

  inputs(f) {
    const r = this.remoteInput(f);
    this.used.set(f, r);
    const l = this.local.get(f) ?? 0;
    return this.me === 0 ? [l, r] : [r, l];
  }

  // Re-simulates from the first frame whose remote input was guessed wrong.
  applyRollback() {
    if (this.rollbackFrom >= this.frame) { this.rollbackFrom = Infinity; return false; }
    const from = this.rollbackFrom;
    this.rollbackFrom = Infinity;
    const saved = this.states.get(from);
    if (!saved) return false; // too old (cannot happen within MAX_ROLLBACK)
    let g = clone(saved);
    for (let f = from; f < this.frame; f++) {
      if (f > from) this.states.set(f, clone(g));
      step(g, this.inputs(f));
    }
    this.game = g;
    this.rollbacks++;
    return true;
  }

  // How many frames we are ahead of the other player (half the difference of what each
  // side sees, which cancels the network latency).
  advantage() {
    const myLag = this.frame - this.remoteFrame;
    return (myLag - this.remoteLag) / 2;
  }

  // One simulation frame. Returns 'ok' (stepped; events in this.game.events), 'wait' (we
  // are ahead: skip this frame so the other side catches up) or 'stall' (too far ahead of
  // the last input we received: the connection is lagging).
  tick(localBits) {
    this.addLocal(localBits);
    const rolled = this.applyRollback();
    if (this.frame - this.remoteMax > MAX_ROLLBACK) return 'stall';
    const adv = this.advantage();
    if ((adv >= 2 && this.frame - this.lastWait > 10) || adv >= 4) { this.lastWait = this.frame; return 'wait'; }
    this.states.set(this.frame, clone(this.game));
    step(this.game, this.inputs(this.frame));
    this.frame++;
    this.afterStep();
    this.rolled = rolled;
    return 'ok';
  }

  afterStep() {
    // Checksums only for frames whose inputs are all confirmed (no rollback can change them).
    const confirmed = Math.min(this.remoteMax + 1, this.frame);
    while (this.nextHash <= confirmed) {
      const f = this.nextHash;
      const g = f === this.frame ? this.game : this.states.get(f);
      if (g) {
        const h = checksum(g);
        this.localHashes.set(f, h);
        this.t.send({ t: 'cs', m: this.matchNo, f, h });
        this.compare(f);
      }
      this.nextHash += 60;
    }
    const old = Math.min(this.remoteMax, this.frame) - KEEP;
    for (let f = (this.pruned ?? -1) + 1; f <= old; f++) {
      for (const map of [this.states, this.used, this.local, this.remote]) map.delete(f);
      this.localHashes.delete(f - 600);
      this.remoteHashes.delete(f - 600);
    }
    if (old > (this.pruned ?? -1)) this.pruned = old;
  }

  compare(f) {
    if (this.localHashes.has(f) && this.remoteHashes.has(f)
      && this.localHashes.get(f) !== this.remoteHashes.get(f) && this.desync == null) {
      this.desync = f;
    }
  }
}

// Input delay for a measured round trip: enough to hide part of the latency without
// making the controls feel slow; rollback hides the rest.
export function delayFor(rttMs) {
  return rttMs < 90 ? 2 : rttMs < 180 ? 3 : rttMs < 300 ? 4 : 5;
}
