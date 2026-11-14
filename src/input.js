// Keyboard and gamepad → input bitmask (see sim/bits.js).
import { UP, DOWN, LEFT, RIGHT, LP, HP, LK, HK, SUP } from './sim/bits.js';

// Physical key positions (event.code), so it works on ABNT and other layouts.
export const KEYMAPS = {
  p1: {
    KeyW: UP, KeyS: DOWN, KeyA: LEFT, KeyD: RIGHT,
    KeyJ: LP, KeyK: HP, KeyU: LK, KeyI: HK, KeyO: SUP, KeyL: LP | HP,
  },
  p2: {
    ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT,
    Numpad1: LP, Numpad2: HP, Numpad4: LK, Numpad5: HK, Numpad3: SUP, Numpad6: LP | HP,
    Comma: LP, Period: HP, KeyM: LK, KeyN: HK, Slash: SUP,
  },
};

const down = new Set();
let attached = false;
let blockKeys = true;

export function attachKeyboard() {
  if (attached) return;
  attached = true;
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    down.add(e.code);
    // Stop arrows/space from scrolling the page during a fight.
    if (blockKeys && (e.code.startsWith('Arrow') || e.code === 'Space')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());
}

export function setBlockKeys(v) { blockKeys = v; }

function readKeys(map) {
  let b = 0;
  for (const code of down) if (map[code]) b |= map[code];
  return b;
}

// Standard gamepad mapping.
function readPad(pad) {
  if (!pad) return 0;
  let b = 0;
  const btn = (i) => pad.buttons[i] && pad.buttons[i].pressed;
  const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
  if (btn(12) || ay < -0.55) b |= UP;
  if (btn(13) || ay > 0.55) b |= DOWN;
  if (btn(14) || ax < -0.55) b |= LEFT;
  if (btn(15) || ax > 0.55) b |= RIGHT;
  if (btn(2)) b |= LP;   // X / Square
  if (btn(3)) b |= HP;   // Y / Triangle
  if (btn(0)) b |= LK;   // A / Cross
  if (btn(1)) b |= HK;   // B / Circle
  if (btn(5) || btn(7)) b |= SUP; // RB / RT
  if (btn(4) || btn(6)) b |= LP | HP; // LB / LT: special shortcut
  return b;
}

function pads() {
  try {
    return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean);
  } catch { return []; }
}

// Opposite directions cancel out (keyboard ghosting / pad noise).
function clean(b) {
  if ((b & LEFT) && (b & RIGHT)) b &= ~(LEFT | RIGHT);
  if ((b & UP) && (b & DOWN)) b &= ~UP;
  return b;
}

// mode 'solo': one player using every keyboard key and the first pad.
// mode 'p1' / 'p2': split keyboard for local two-player, pad 0 → P1, pad 1 → P2.
export function readInput(mode) {
  const ps = pads();
  if (mode === 'solo') return clean(readKeys(KEYMAPS.p1) | readKeys(KEYMAPS.p2) | readPad(ps[0]));
  if (mode === 'p1') return clean(readKeys(KEYMAPS.p1) | readPad(ps[0]));
  return clean(readKeys(KEYMAPS.p2) | readPad(ps[1]));
}

// For on-screen touch buttons.
export function setVirtual(code, on) {
  if (on) down.add(code); else down.delete(code);
}
