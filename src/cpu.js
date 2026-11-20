// Simple computer opponent. Produces an input bitmask from the game state, like a player.
// Runs only on the local machine (never online), so it may use its own random numbers.
import { UP, DOWN, LEFT, RIGHT, LP, HP, LK, HK, SUP, EX1, EX2 } from './sim/bits.js';
import { CHARACTERS } from './sim/moves.js';

export class Cpu {
  constructor(index, level = 0.6) {
    this.i = index;
    this.level = level; // 0 easy … 1 hard
    this.queue = [];
    this.wait = 0;
    this.seed = (Date.now() & 0xffff) + 1;
  }

  rnd() {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0;
    return (this.seed >>> 8) / 16777216;
  }

  input(g) {
    if (g.phase !== 'fight') { this.queue = []; return 0; }
    // Grabbed: sometimes escapes (more often on harder levels).
    const me = g.f[this.i];
    if (me.st === 'thrown') {
      if (me.sf === 2) this.techTry = this.rnd() < 0.15 + this.level * 0.45;
      this.queue = [];
      return this.techTry && me.sf === 3 ? HP : 0;
    }
    if (this.queue.length) return this.queue.shift();
    if (this.wait > 0) { this.wait--; return this.hold; }
    this.decide(g);
    return this.queue.length ? this.queue.shift() : this.hold;
  }

  plan(seq, holdAfter = 0, wait = 0) {
    this.queue = seq.slice();
    this.hold = holdAfter;
    this.wait = wait;
  }

  decide(g) {
    const me = g.f[this.i], o = g.f[1 - this.i];
    const fwd = me.facing > 0 ? RIGHT : LEFT, back = me.facing > 0 ? LEFT : RIGHT;
    const dist = Math.abs(o.x - me.x);
    const r = this.rnd();
    const lv = this.level;
    const react = Math.round(14 - lv * 10); // frames of "thinking"
    const char = CHARACTERS[me.char];

    // Defend against attacks and incoming bags.
    const threatened = (o.st === 'attack' && dist < 1500) || g.proj.some((p) => p.owner !== this.i && Math.abs(p.x - me.x) < 1800);
    // Sometimes slip a close attack with the ESQUIVA (double tap back) instead of blocking.
    if (threatened && o.st === 'attack' && dist < 1500 && r < 0.06 + lv * 0.1) {
      this.plan([back, 0, 0, back, 0], 0, 24);
      return;
    }
    if (threatened && r < 0.35 + lv * 0.45) {
      const low = o.mv && (o.mv === 'clk' || o.mv === 'chk');
      this.plan([], back | (low ? DOWN : 0), react + 6);
      return;
    }
    if (me.meter >= 1000 && (me.char === 'anderon' || me.char === 'davidson' ? me.hp < me.maxHp * 0.75 : me.char !== 'hotmonster' || dist < 3000) && r < 0.5) {
      this.plan([SUP, 0], 0, 20);
      return;
    }
    if (dist > 2400) {
      if (char.moves.special.projectile && r < 0.3) { this.plan([DOWN, DOWN | fwd, fwd, fwd | LP, 0], 0, 25); return; }
      if (me.char === 'flash' && dist < 3000 && r < 0.25) { this.plan([DOWN, DOWN | fwd, fwd, fwd | LP, 0], 0, 20); return; }
      if (r < 0.12) { this.plan([UP | fwd], 0, 30); return; }
      this.plan([], fwd, react + 10);
      return;
    }
    if (dist > 950) {
      if (r < 0.15) { this.plan([UP | fwd, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, HK], 0, 25); return; }
      if (r < 0.25 && char.moves.special.projectile) { this.plan([DOWN, DOWN | fwd, fwd, fwd | HP, 0], 0, 20); return; }
      // VOADORA and ESTRELA travel forward, so they reach from mid range.
      if (me.char === 'davidson' && dist < 1500 && r < 0.3) { this.plan([LP | HP, 0], 0, 35); return; } // CHAPA
      if (me.char === 'hgl' && dist < 1700 && r < 0.3) { this.plan([LP | HP, 0], 0, 35); return; } // CARRINHO
      if (me.char === 'anderon' && dist < 1500 && r < 0.3) { this.plan([LP | HP, 0], 0, 30); return; } // ARMADA
      if (dist < 1900 && r < 0.4) { this.plan([r < 0.32 ? EX1 : EX2, 0], 0, 30); return; }
      this.plan([], fwd, react);
      return;
    }
    // Close range: pick an attack or a combo.
    const combos = [
      [LP, 0, 0, 0, 0, 0, LP, 0, 0, 0, 0, HP],
      [LP, 0, 0, 0, 0, 0, LP, 0, 0, 0, 0, 0, LP, 0, 0, 0, 0, 0, LP],  // four-punch string
      [LP, 0, 0, 0, 0, 0, LP, 0, 0, 0, 0, EX2],
      [LK, 0, 0, 0, 0, 0, 0, HP],
      [DOWN | LK, DOWN, DOWN, DOWN, DOWN, DOWN, DOWN | HK],
      [LP, DOWN, DOWN | fwd, fwd, fwd | LP],
      [HP], [HK], [DOWN | HP], [DOWN | HK], [LP], [LK],
    ];
    // Each fighter's own sequence, and the crouching uppercut launcher with an air kick.
    const z = (n, v = 0) => new Array(n).fill(v);
    const own = {
      hotmonster: [LP, ...z(7), LP, ...z(7), HP, ...z(14), LP | HP],
      flash: [HP, ...z(18), HP, ...z(8), ...z(22, UP | fwd), 0, HK],
      genildo: [LK, ...z(8), LK, ...z(8), HP, ...z(24), LP | HP],
      anderon: [HP, ...z(16), HK, ...z(14), ...z(16, UP | fwd), 0, HK],
      hgl: [LK, ...z(8), HP, ...z(16), ...z(16, UP | fwd), 0, HK],
      davidson: [LK, ...z(10), HK, ...z(16), ...z(16, UP | fwd), 0, HK],
    }[me.char];
    if (own) combos.push(own, own);
    // Second string: the heavy kick finisher (see CHARACTERS[*].targets).
    const t2 = (CHARACTERS[me.char].targets || [])[1];
    if (t2) {
      const B = { LP, HP, LK, HK };
      const first = Array(Math.max(1, t2.minChain + 1)).fill(0).flatMap(() => [B[t2.from.toUpperCase()], ...z(8)]);
      combos.push([...first, B[t2.btn]]);
    }
    // Low game: crouching jab into the sweep.
    combos.push([DOWN | LP, ...z(8, DOWN), DOWN | HK, ...z(6, DOWN)]);
    // AGARRÃO when right next to the opponent (and they are not jumping).
    if (dist < 700 && o.y === 0) combos.push([fwd | HP], [fwd | HP]);
    combos.push([LP, ...z(14), DOWN | HP, ...z(20, DOWN), ...z(16, UP | fwd), 0, HK]);
    if (r < 0.25 + lv * 0.5) {
      const c = combos[Math.floor(this.rnd() * combos.length)];
      this.plan(c, 0, 18 - Math.round(lv * 8));
    } else if (r < 0.85) {
      this.plan([], back, react);
    } else {
      this.plan([UP | back], 0, 30);
    }
  }
}
