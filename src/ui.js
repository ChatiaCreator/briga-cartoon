// HUD: health, timer, round pips, super meters, buff timer, combos and banners.
import { CHARACTERS } from './sim/moves.js';
import { METER_MAX } from './sim/fighter.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = $('hud');
    this.banner = $('banner');
    this.bannerTimer = null;
    this.comboTimers = [null, null];
    this.last = {};
  }

  show(on) { this.el.classList.toggle('hidden', !on); }

  // pics: portrait image urls for the two fighters (corners of the screen).
  setup(g, tags, pics = []) {
    for (let i = 0; i < 2; i++) {
      $(`n${i + 1}`).textContent = CHARACTERS[g.f[i].char].name.toUpperCase();
      $(`tag${i + 1}`).textContent = tags[i];
      $(`por${i + 1}`).src = pics[i] || '';
    }
    this.last = {};
    this.flash('', 0);
    this.net('');
  }

  set(id, prop, value) {
    const key = id + prop;
    if (this.last[key] === value) return;
    this.last[key] = value;
    const el = $(id);
    if (prop === 'text') el.textContent = value;
    else el.style[prop] = value;
  }

  update(g) {
    this.set('timer', 'text', String(Math.max(0, g.timer)));
    for (let i = 0; i < 2; i++) {
      const f = g.f[i], n = i + 1;
      const hp = `${(100 * f.hp) / f.maxHp}%`;
      this.set(`hp${n}`, 'width', hp);
      this.set(`hplag${n}`, 'width', hp);
      const m = (100 * f.meter) / METER_MAX;
      this.set(`sup${n}`, 'width', `${m}%`);
      const full = f.meter >= METER_MAX;
      if (this.last[`full${n}`] !== full) {
        this.last[`full${n}`] = full;
        $(`sup${n}`).parentElement.classList.toggle('full', full);
        $(`supt${n}`).classList.toggle('full', full);
      }
      this.set(`buff${n}`, 'width', f.buff > 0 ? `${(100 * f.buff) / 480}%` : '0%');
      const pips = $(`pips${n}`).children;
      for (let k = 0; k < pips.length; k++) {
        const won = g.wins[i] > k;
        if (pips[k].classList.contains('won') !== won) pips[k].classList.toggle('won', won);
      }
    }
  }

  // Combo counter: hits, a word for big combos and the total damage of the combo.
  combo(attacker, hits, dmg = 0) {
    this.comboDmg = this.comboDmg || [0, 0];
    this.comboDmg[attacker] = hits <= 1 ? dmg : this.comboDmg[attacker] + dmg;
    if (hits < 2) return;
    const el = $(`combo${attacker + 1}`);
    const word = hits >= 8 ? 'INSANO!' : hits >= 5 ? 'BRUTAL!' : hits >= 3 ? 'BOM!' : '';
    el.innerHTML = `<b>${hits} HITS!</b><small>${word ? word + ' • ' : ''}${this.comboDmg[attacker]} de dano</small>`;
    el.classList.toggle('big', hits >= 5);
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    el.classList.add('show');
    clearTimeout(this.comboTimers[attacker]);
    this.comboTimers[attacker] = setTimeout(() => el.classList.remove('show'), 1300);
  }

  // kind: '' (fiery text), 'round' (silver plate) or 'fight' (big fiery FIGHT!).
  flash(text, ms = 1200, small = false, kind = '') {
    clearTimeout(this.bannerTimer);
    this.banner.innerHTML = '';
    // <b> carries the tilt, plate and glow; the <span> inside only the gradient letters.
    const box = document.createElement('b'), span = document.createElement('span');
    span.textContent = text;
    box.appendChild(span);
    this.banner.appendChild(box);
    this.banner.classList.toggle('small', small);
    this.banner.dataset.kind = kind;
    this.banner.classList.remove('show'); void this.banner.offsetWidth;
    if (!text) { this.banner.classList.remove('show'); return; }
    this.banner.classList.add('show');
    if (ms > 0) this.bannerTimer = setTimeout(() => this.banner.classList.remove('show'), ms);
  }

  net(text, warn = false) {
    const el = $('netinfo');
    el.textContent = text;
    el.classList.toggle('warn', warn);
  }
}
