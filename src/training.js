// Training mode (offline): a dummy to practise combos on. No clock, nobody is knocked out,
// life refills once a combo is over, optional infinite super, and a panel with the numbers
// of the last combo (hits and damage) and the best one.
import { UP, DOWN, LEFT, RIGHT } from './sim/bits.js';
import { resetPositions } from './sim/game.js';
import { METER_MAX } from './sim/fighter.js';

// What the dummy (player 2) does.
const DUMMY = [
  ['stand', 'Parado'],
  ['block', 'Defende em pé'],
  ['low', 'Defende agachado'],
  ['jump', 'Pula'],
  ['cpu', 'Luta (CPU)'],
];
// States in which a fighter is free again (the combo on them is over).
const FREE = new Set(['idle', 'walk', 'crouch', 'air', 'jumpsquat', 'land']);
const REFILL_AFTER = 40; // frames free before the life bar fills back up

export class Training {
  constructor(cpu) {
    this.cpu = cpu;
    this.dummy = 0;
    this.infSuper = true;
    this.hits = 0; this.dmg = 0; this.best = 0; this.bestDmg = 0;
    this.free = [0, 0];
    this.t = 0;
    this.el = document.getElementById('trainPanel');
    this.stats = document.getElementById('trainStats');
    document.getElementById('trainDummy').onclick = () => this.nextDummy();
    document.getElementById('trainSuper').onclick = () => this.toggleSuper();
    document.getElementById('trainReset').onclick = () => { this.resetReq = true; };
    this.render();
    this.show(true);
  }

  show(v) { this.el.classList.toggle('hidden', !v); }
  nextDummy() { this.dummy = (this.dummy + 1) % DUMMY.length; this.render(); }
  toggleSuper() { this.infSuper = !this.infSuper; this.render(); }

  // Keys 1, 2 and 3 (number row) work the panel's buttons.
  key(code) {
    if (code === 'Digit1') this.nextDummy();
    else if (code === 'Digit2') this.toggleSuper();
    else if (code === 'Digit3') this.resetReq = true;
    else return false;
    return true;
  }

  // The dummy's input this frame (directions are absolute: "back" is away from player 1).
  input(g) {
    const f = g.f[1];
    const back = f.facing === 1 ? LEFT : RIGHT;
    switch (DUMMY[this.dummy][0]) {
      case 'block': return back;
      case 'low': return back | DOWN;
      case 'jump': return ++this.t % 55 < 3 ? UP : 0;
      case 'cpu': return this.cpu.input(g);
      default: return 0;
    }
  }

  // Before a step: a requested position reset.
  before(g) {
    if (!this.resetReq) return;
    this.resetReq = false;
    if (g.phase === 'fight') { resetPositions(g); this.free = [0, 0]; }
  }

  // After a step (before its events are shown): keep everybody alive and count the combo.
  after(g) {
    for (const ev of g.events) {
      if (ev.t !== 'hit') continue;
      ev.ko = false; // no knockout effects in training
      if (ev.by !== 0) continue;
      if (ev.combo <= 1) { this.hits = 0; this.dmg = 0; }
      this.hits = Math.max(this.hits + 1, ev.combo);
      this.dmg += ev.dmg;
      if (this.hits > this.best || (this.hits === this.best && this.dmg > this.bestDmg)) { this.best = this.hits; this.bestDmg = this.dmg; }
      this.render();
    }
    g.f.forEach((f, i) => {
      f.ko = false;
      if (f.st === 'ko') { f.st = 'down'; f.sf = 0; }
      if (f.hp <= 0) f.hp = 1;
      this.free[i] = FREE.has(f.st) ? this.free[i] + 1 : 0;
      if (this.free[i] >= REFILL_AFTER && f.hp < f.maxHp) f.hp = f.maxHp;
    });
    if (this.infSuper) g.f[0].meter = METER_MAX;
  }

  render() {
    this.stats.textContent = `Combo: ${this.hits} ${this.hits === 1 ? 'acerto' : 'acertos'} • ${this.dmg} de dano   |   Recorde: ${this.best} (${this.bestDmg})`;
    document.getElementById('trainDummy').textContent = `Boneco: ${DUMMY[this.dummy][1]}`;
    document.getElementById('trainSuper').textContent = `Super infinito: ${this.infSuper ? 'Sim' : 'Não'}`;
  }
}
