// Tiny synthesized sound effects (no audio files).
let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() { ac(); }
export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }
let voice = true; // announcer lines ("Round 1", "Luta!")
export function setVoice(v) { voice = v; }
export function isVoice() { return voice; }

function noise(c, dur) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource();
  s.buffer = buf;
  return s;
}

function tone(c, type, f0, f1, dur, vol, when = 0) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  const t = c.currentTime + when;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur);
}

function burst(c, dur, vol, freq) {
  const n = noise(c, dur), f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'lowpass'; f.frequency.value = freq;
  g.gain.value = vol;
  n.connect(f).connect(g).connect(c.destination);
  n.start();
}

// k: how many hits into a combo; each hit sounds a little higher.
export function sfx(name, k = 0) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const up = 1 + 0.08 * Math.min(10, Math.max(0, k - 1));
  switch (name) {
    case 'hit': burst(c, 0.12, 0.5, 2500 * up); tone(c, 'sine', 160 * up, 60 * up, 0.12, 0.5); break;
    case 'heavy': burst(c, 0.2, 0.7, 1800 * up); tone(c, 'sine', 120 * up, 40 * up, 0.22, 0.8); break;
    case 'launch': tone(c, 'triangle', 220, 1100, 0.35, 0.25); burst(c, 0.25, 0.25, 1500); break;
    case 'bounce': tone(c, 'sine', 140, 40, 0.3, 0.8); burst(c, 0.25, 0.5, 900); break;
    case 'block': tone(c, 'square', 900, 500, 0.06, 0.12); burst(c, 0.05, 0.2, 5000); break;
    case 'whoosh': burst(c, 0.1, 0.12, 900); break;
    case 'throw': tone(c, 'triangle', 300, 700, 0.15, 0.2); break;
    case 'splash': burst(c, 0.3, 0.35, 1200); for (let i = 0; i < 5; i++) tone(c, 'square', 600 + Math.random() * 900, 300, 0.05, 0.05, i * 0.04); break;
    case 'glug': for (let i = 0; i < 4; i++) tone(c, 'sine', 220, 110, 0.12, 0.35, i * 0.16); break;
    case 'power': tone(c, 'sawtooth', 200, 900, 0.5, 0.18); tone(c, 'square', 300, 1200, 0.5, 0.08); break;
    case 'ko': tone(c, 'sawtooth', 300, 40, 0.9, 0.35); burst(c, 0.5, 0.6, 800); break;
    case 'thud': tone(c, 'sine', 90, 35, 0.25, 0.6); break;
    case 'bell': tone(c, 'sine', 880, 870, 0.8, 0.25); tone(c, 'sine', 1320, 1300, 0.6, 0.1); break;
    case 'shot': burst(c, 0.14, 0.9, 3500); tone(c, 'square', 220, 45, 0.12, 0.35); break;
    case 'clank': tone(c, 'square', 1800, 1200, 0.08, 0.2); tone(c, 'triangle', 2600, 2000, 0.25, 0.12, 0.03); burst(c, 0.12, 0.3, 6000); break;
    case 'spin': tone(c, 'sawtooth', 400, 1400, 0.25, 0.06); break;
    case 'ring': for (let i = 0; i < 4; i++) tone(c, 'square', i % 2 ? 1320 : 1480, i % 2 ? 1320 : 1480, 0.08, 0.12, i * 0.1); break;
    case 'heal': tone(c, 'sine', 660, 990, 0.18, 0.18); tone(c, 'sine', 990, 1320, 0.14, 0.1, 0.06); break;
    case 'jump': tone(c, 'sine', 300, 600, 0.12, 0.12); break;
    default: break;
  }
}

// ---------- Announcer ----------
// Recorded lines (assets/voice/<key>.mp3, listed in assets/voice/voices.json) are always played
// when present; the other lines are said by the device's speech engine with the chosen voice.
const STYLES = [
  { name: 'Locutor', pitch: 0.7, rate: 1.0 },
  { name: 'Grave', pitch: 0.35, rate: 0.9 },
  { name: 'Animado', pitch: 1.15, rate: 1.2 },
];
let voicePick = 0;            // index into voiceOptions()
let recorded = new Set();     // keys that have a recorded file
const clips = new Map();

export function loadRecordedVoices() {
  fetch('assets/voice/voices.json').then((r) => (r.ok ? r.json() : [])).then((list) => {
    recorded = new Set(Array.isArray(list) ? list : []);
    // Fetch them now so they play without delay.
    for (const k of recorded) { const a = new Audio(`assets/voice/${k}.mp3`); a.preload = 'auto'; clips.set(k, a); }
  }).catch(() => {});
}

// Every choice the device offers: each Portuguese voice (or the default one) in each style.
export function voiceOptions() {
  const all = window.speechSynthesis?.getVoices?.() || [];
  let pt = all.filter((v) => /^pt/i.test(v.lang));
  pt.sort((a, b) => (/BR/i.test(b.lang) ? 1 : 0) - (/BR/i.test(a.lang) ? 1 : 0));
  if (!pt.length) pt = [null];
  const out = [];
  for (const v of pt.slice(0, 4)) for (const st of STYLES) out.push({ voice: v, ...st });
  return out;
}
export function setVoicePick(i) { voicePick = i; }
export function getVoicePick() { return voicePick; }
if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => {};

export function announce(text, key = null) {
  if (muted || !voice) return;
  const opts = voiceOptions();
  const pick = opts[Math.min(voicePick, opts.length - 1)] || opts[0];
  // A recorded line, if the player recorded this one.
  if (key && recorded.has(key)) {
    let a = clips.get(key);
    if (!a) { a = new Audio(`assets/voice/${key}.mp3`); clips.set(key, a); }
    try { window.speechSynthesis?.cancel(); a.currentTime = 0; a.volume = 1; a.play().catch(() => {}); } catch { /* not playable */ }
    return;
  }
  if (!window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const st = pick || { ...STYLES[0], voice: null };
    u.lang = st.voice?.lang || 'pt-BR';
    if (st.voice) u.voice = st.voice;
    u.rate = st.rate; u.pitch = st.pitch; u.volume = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* speech not available */ }
}
