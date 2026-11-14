// Delay-based lockstep for two players. Each side sends its input for frame N + delay;
// a frame is simulated only when both inputs are known, so both simulations stay identical.
export class Lockstep {
  constructor(transport, localIndex, delay) {
    this.t = transport;
    this.me = localIndex;
    this.delay = delay;
    this.inputs = [new Map(), new Map()];
    this.sentUpTo = -1;
    this.remoteMax = delay - 1;
    this.localHashes = new Map();
    this.remoteHashes = new Map();
    this.desync = null;
    for (let f = 0; f < delay; f++) { this.inputs[0].set(f, 0); this.inputs[1].set(f, 0); }
    this.sentUpTo = delay - 1;
    this.recent = [];
  }

  // Call once per local frame `frame` (the frame about to be simulated) with the current
  // local input. It is scheduled for frame + delay.
  addLocal(frame, bits) {
    const target = frame + this.delay;
    if (target <= this.sentUpTo) return;
    this.sentUpTo = target;
    this.inputs[this.me].set(target, bits);
    // Send the last few inputs each time; duplicates are harmless.
    this.recent.push([target, bits]);
    if (this.recent.length > 4) this.recent.shift();
    this.t.send({ t: 'i', d: this.recent });
  }

  onMessage(msg) {
    if (msg.t === 'i') {
      const rm = this.inputs[1 - this.me];
      for (const [f, b] of msg.d) {
        if (!rm.has(f)) rm.set(f, b);
        if (f > this.remoteMax) this.remoteMax = f;
      }
      return true;
    }
    if (msg.t === 'cs') {
      this.remoteHashes.set(msg.f, msg.h);
      this.compare(msg.f);
      return true;
    }
    return false;
  }

  ready(frame) {
    return this.inputs[0].has(frame) && this.inputs[1].has(frame);
  }

  take(frame) {
    const v = [this.inputs[0].get(frame), this.inputs[1].get(frame)];
    this.inputs[0].delete(frame - 120);
    this.inputs[1].delete(frame - 120);
    return v;
  }

  // How many frames the other side is ahead of us (used to catch up when we lag).
  lead(frame) {
    return this.remoteMax - this.delay - frame;
  }

  reportHash(frame, hash) {
    this.localHashes.set(frame, hash);
    this.t.send({ t: 'cs', f: frame, h: hash });
    this.compare(frame);
    this.localHashes.delete(frame - 600);
    this.remoteHashes.delete(frame - 600);
  }

  compare(frame) {
    if (this.localHashes.has(frame) && this.remoteHashes.has(frame)
      && this.localHashes.get(frame) !== this.remoteHashes.get(frame) && !this.desync) {
      this.desync = frame;
    }
  }
}

// In-memory transport pair (for tests and a "fake online" debug mode).
export function memoryPair(latencyMs = 0) {
  const a = { handlers: [], send: null }, b = { handlers: [], send: null };
  const deliver = (to, msg) => {
    const copy = JSON.parse(JSON.stringify(msg));
    const run = () => to.handlers.forEach((h) => h(copy));
    if (latencyMs > 0) setTimeout(run, latencyMs); else queueMicrotask(run);
  };
  a.send = (m) => deliver(b, m);
  b.send = (m) => deliver(a, m);
  a.onMessage = (h) => a.handlers.push(h);
  b.onMessage = (h) => b.handlers.push(h);
  return [a, b];
}
