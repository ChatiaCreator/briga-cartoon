// On-screen joystick and buttons for phones/tablets. They press the same virtual keys as
// the keyboard (W A S D, J K U I, L, O), so the rest of the game doesn't need to know.
import { setVirtual } from './input.js';

const $ = (id) => document.getElementById(id);

export function isTouchDevice() {
  return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
}

export function initTouch({ onPause }) {
  const root = $('touch');
  if (!isTouchDevice()) return { show() {}, enabled: false };

  // Joystick: 8 directions with a dead zone; jumping needs a clearer push up.
  const stick = $('stick'), knob = $('knob');
  let stickId = null;
  const dirs = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
  const setDir = (code, on) => { if (dirs[code] !== on) { dirs[code] = on; setVirtual(code, on); } };
  const moveStick = (e) => {
    const r = stick.getBoundingClientRect();
    const R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const len = Math.hypot(dx, dy);
    if (len > R) { dx *= R / len; dy *= R / len; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const dz = R * 0.32;
    setDir('KeyD', dx > dz);
    setDir('KeyA', dx < -dz);
    setDir('KeyS', dy > dz);
    setDir('KeyW', dy < -dz * 1.5);
  };
  const releaseStick = () => {
    stickId = null;
    knob.style.transform = 'translate(-50%, -50%)';
    for (const c of Object.keys(dirs)) setDir(c, false);
  };
  stick.addEventListener('pointerdown', (e) => {
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    moveStick(e);
    e.preventDefault();
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
  stick.addEventListener('pointerup', releaseStick);
  stick.addEventListener('pointercancel', releaseStick);

  // Buttons.
  for (const b of root.querySelectorAll('#tbuttons button')) {
    const code = b.dataset.code;
    const up = () => { b.classList.remove('down'); setVirtual(code, false); };
    b.addEventListener('pointerdown', (e) => {
      b.setPointerCapture(e.pointerId);
      b.classList.add('down');
      setVirtual(code, true);
      e.preventDefault();
    });
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  $('tpause').addEventListener('click', onPause);

  return {
    enabled: true,
    show(on) {
      root.classList.toggle('hidden', !on);
      $('rotate').classList.toggle('hidden', !on);
      document.body.classList.toggle('touching', on);
      if (!on) releaseStick();
    },
  };
}

let vibration = true;
export function setVibration(on) { vibration = on; }
export function isVibration() { return vibration; }
export function buzz(ms) {
  if (!vibration) return;
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}

export async function goFullscreen() {
  try {
    await document.documentElement.requestFullscreen?.();
    await screen.orientation?.lock?.('landscape');
  } catch { /* not allowed here: the game still works */ }
}
