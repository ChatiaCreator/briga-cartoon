// Menus, match lifecycle and the main loop (fixed 60 Hz simulation, render every frame).
import * as THREE from 'three';
import { createRenderer } from './render/scene.js';
import { GameView, canImage, sharedClips, isFinalKO } from './render/view.js';
import { initTouch, buzz, goFullscreen, isTouchDevice, setVibration, isVibration } from './touch.js';
import { Character, loadGLTF } from './render/character.js';
import { poseFor } from './render/poses.js';
import { createGame, step, checksum } from './sim/game.js';
import { createFighter } from './sim/fighter.js';
import { CHARACTERS } from './sim/moves.js';
import { readInput, attachKeyboard } from './input.js';
import { Cpu } from './cpu.js';
import { Rollback } from './net/rollback.js';
import { OnlineSession, normalizeCode } from './net/online.js';
import { Hud } from './ui.js';
import { sfx, announce, unlockAudio, setMuted, isMuted, setVoice, isVoice } from './audio.js';

const STEP = 1 / 60;
const $ = (id) => document.getElementById(id);
const renderer = createRenderer($('stage'));
const hud = new Hud();
attachKeyboard();
const touch = initTouch({ onPause: () => openPause() });
const SUPER_NAMES = { hotmonster: 'CHUVA DE RAÇÃO!', flash: 'GARRA ENERGY!', genildo: 'TOLERÂNCIA ZERO!', anderon: 'ARMADA FATAL!' };
const canFull = !!document.documentElement.requestFullscreen;
if (canFull) {
  $('fullBtn').classList.remove('hidden');
  $('fullBtn').onclick = goFullscreen;
}
$('optFull').disabled = !canFull;
$('optFull').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen?.(); else goFullscreen();
};
document.addEventListener('fullscreenchange', () => renderOptions());

let attract = null;      // background scene behind the menus
let match = null;        // the running fight
let session = null;      // online session
const sel = { mode: 'local', chars: ['hotmonster', 'flash'], stage: 'street' };
export const STAGES = ['street', 'beach'];
// "random" is picked when the match starts (by the host, online).
function resolveStage(s) {
  return STAGES.includes(s) ? s : STAGES[Math.floor(Math.random() * STAGES.length)];
}

const DESCR = {
  hotmonster: 'Especial: arremessa um saco de RAÇÃO. Super: chuva de ração do céu! Combo: SOCO, SOCO, SOCO+ → ESPECIAL.',
  flash: 'Especial: investida relâmpago. Super: bebe GARRA Energy (+50% dano, +20% velocidade). Combo: SOCO+, SOCO+ → pula e chuta.',
  genildo: 'Policial militar. Especial: atira com a pistola. Super: rajada TOLERÂNCIA ZERO! Combo: CHUTE, CHUTE, SOCO+ → ESPECIAL.',
  anderon: 'Capoeira e boxe. Especial: LIGANDO PRA CASADA, pega o celular e recupera vida (se não apanhar). Super: ARMADA FATAL, 5 golpes. Combo: SOCO+, CHUTE+.',
};

// ---------- Screens ----------
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
}
function hideScreens() {
  for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
}

function openSelect(mode) {
  sel.mode = mode;
  const solo = mode === 'online';
  document.querySelector('.picker[data-p="1"]').classList.toggle('hidden', solo);
  document.querySelector('#select .vs-badge').classList.toggle('hidden', solo);
  $('cpuLevelRow').classList.toggle('hidden', mode !== 'cpu');
  $('selLabel0').textContent = mode === 'local' ? 'Jogador 1' : 'Você';
  $('selLabel1').textContent = mode === 'cpu' ? 'Computador' : 'Jogador 2';
  $('selTitle').textContent = solo ? 'Escolha seu lutador' : 'Escolha os lutadores';
  $('fightTxt').textContent = solo ? 'CONTINUAR ▶' : 'LUTAR!';
  $('stageHint').classList.toggle('hidden', !solo);
  renderCards();
  renderStages();
  show('select');
}

function renderCards() {
  for (const picker of document.querySelectorAll('.picker')) {
    const p = Number(picker.dataset.p);
    const box = picker.querySelector('.cards');
    box.innerHTML = '';
    for (const [id, c] of Object.entries(CHARACTERS)) {
      const b = document.createElement('button');
      b.className = 'card' + (sel.chars[p] === id ? ' on' : '');
      b.setAttribute('aria-label', c.name);
      b.innerHTML = `<img alt="" src="${portraits[id] || ''}"><span class="cn">${c.name}</span>`;
      b.onclick = () => { sel.chars[p] = id; sfx('block'); renderCards(); };
      box.appendChild(b);
    }
    // The chosen fighter's name and moves under the cards.
    picker.querySelector('.pname').textContent = CHARACTERS[sel.chars[p]].name;
    picker.querySelector('.pdesc').textContent = DESCR[sel.chars[p]];
  }
}

function renderStages() {
  for (const b of document.querySelectorAll('#stageRow [data-stage]')) b.classList.toggle('on', b.dataset.stage === sel.stage);
}
for (const b of document.querySelectorAll('#stageRow [data-stage]')) {
  b.onclick = () => { sel.stage = b.dataset.stage; sfx('block'); renderStages(); };
}

document.addEventListener('click', (e) => {
  unlockAudio();
  const go = e.target.closest('[data-go]')?.dataset.go;
  if (!go) return;
  if (go === 'menu') show('menu');
  else if (go === 'controls') show('controls');
  else if (go === 'options') { renderOptions(); show('options'); }
  else openSelect(go);
});

// ---------- Options (sound, announcer, vibration), remembered in this browser ----------
const PREFS_KEY = 'fightfriends-prefs';
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ muted: isMuted(), voice: isVoice(), vibe: isVibration() })); } catch { /* storage blocked */ }
}
try {
  const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  if (typeof p.muted === 'boolean') setMuted(p.muted);
  if (typeof p.voice === 'boolean') setVoice(p.voice);
  if (typeof p.vibe === 'boolean') setVibration(p.vibe);
} catch { /* storage blocked */ }
function renderOptions() {
  const set = (id, on, yes, no) => {
    $(id).classList.toggle('off', !on);
    $(id).querySelector('b').textContent = on ? yes : no;
  };
  set('optSound', !isMuted(), 'ligado', 'desligado');
  set('optVoice', isVoice(), 'ligado', 'desligado');
  set('optVibe', isVibration(), 'ligada', 'desligada');
  set('optFull', !!document.fullscreenElement, 'ligada', canFull ? 'desligada' : 'indisponível');
  $('mute').classList.toggle('off', isMuted());
  $('mute').setAttribute('aria-label', isMuted() ? 'Som desligado' : 'Som ligado');
}
const toggleSound = () => { setMuted(!isMuted()); savePrefs(); renderOptions(); if (!isMuted()) sfx('block'); };
$('mute').onclick = toggleSound;
$('optSound').onclick = toggleSound;
$('optVoice').onclick = () => { setVoice(!isVoice()); savePrefs(); renderOptions(); if (isVoice()) announce('Luta!'); };
$('optVibe').onclick = () => { setVibration(!isVibration()); savePrefs(); renderOptions(); buzz(40); };
renderOptions();

$('fightBtn').onclick = () => {
  if (sel.mode === 'online') { openOnline(); return; }
  startMatch(sel.mode, sel.chars.slice(), { cpuLevel: Number($('cpuLevel').value), stage: resolveStage(sel.stage) });
};

// ---------- Online lobby ----------
function netStatus(text, err = false) {
  $('netStatus').textContent = text;
  $('netStatus').classList.toggle('err', err);
}

function openOnline() {
  show('online');
  netStatus('');
  $('roomCode').textContent = '';
  delete $('copyBtn').dataset.code;
  $('hostBtn').disabled = false;
  $('joinBtn').disabled = false;
  const fromLink = normalizeCode((location.hash.match(/sala=([A-Za-z0-9]+)/) || [])[1]);
  if (fromLink) $('joinCode').value = fromLink;
}

function newSession() {
  if (session) session.close();
  session = new OnlineSession({
    status: ({ code, text, error }) => {
      if (code) {
        $('roomCode').textContent = code;
        $('copyBtn').dataset.code = code;
      }
      if (error) { netStatus(error, true); $('hostBtn').disabled = false; $('joinBtn').disabled = false; }
      else if (text) netStatus(text);
    },
    start: (info) => startMatch('online', info.chars, { me: info.me, delay: info.delay, stage: info.stage, matchNo: info.matchNo }),
    message: (msg) => {
      if (msg.t === 'rematch' && match?.ended) endMsg('Seu amigo quer revanche!');
      else if (match?.lock) match.lock.onMessage(msg);
    },
    closed: (reason) => {
      const wasPlaying = !!match;
      endMatch();
      openOnline();
      netStatus(reason, true);
      if (!wasPlaying) $('hostBtn').disabled = false;
    },
  });
  return session;
}

$('hostBtn').onclick = () => {
  try {
    $('hostBtn').disabled = true;
    netStatus('Criando sala…');
    newSession().host(sel.chars[0], () => resolveStage(sel.stage));
  } catch (e) { netStatus(e.message, true); $('hostBtn').disabled = false; }
};

$('joinBtn').onclick = () => {
  const code = normalizeCode($('joinCode').value);
  if (code.length !== 6) { netStatus('O código tem 6 letras/números.', true); return; }
  try {
    $('joinBtn').disabled = true;
    newSession().join(code, sel.chars[0]);
  } catch (e) { netStatus(e.message, true); $('joinBtn').disabled = false; }
};

$('copyBtn').onclick = async () => {
  const code = $('copyBtn').dataset.code;
  if (!code) { netStatus('Primeiro aperte CRIAR SALA.'); return; }
  const link = `${location.origin}${location.pathname}#sala=${code}`;
  try { await navigator.clipboard.writeText(link); netStatus('Link copiado! Mande para o seu amigo.'); }
  catch { netStatus(`Link: ${link}`); }
};

$('onlineBack').onclick = () => {
  if (session) { session.close(); session = null; }
  show('menu');
};

// ---------- Match ----------
async function startMatch(mode, chars, opts = {}) {
  hideScreens();
  $('loading').textContent = 'Carregando luta…';
  if (match) disposeMatch();
  const view = await GameView.create(chars, STAGES.includes(opts.stage) ? opts.stage : 'street');
  view.arena.resize(innerWidth, innerHeight);
  const game = createGame(chars);
  const me = opts.me ?? 0;
  const tags = mode === 'local' ? ['P1', 'P2'] : mode === 'cpu' ? ['VOCÊ', 'CPU'] : me === 0 ? ['VOCÊ', 'AMIGO'] : ['AMIGO', 'VOCÊ'];
  match = {
    mode, chars, opts, game, view, me, paused: false, ended: false, acc: 0,
    cpu: mode === 'cpu' ? new Cpu(1, opts.cpuLevel ?? 0.6) : null,
    lock: null, frame: 0, stall: 0, hold: true,
  };
  hud.setup(game, tags, chars.map((c) => portraits[c]));
  if (mode === 'online') {
    match.lock = new Rollback({ send: (m) => session.send(m) }, me, opts.delay, game, opts.matchNo || 0);
    hud.net(netLabel());
  }
  hud.show(true);
  touch.show(true);
  showVersus(match);
}

// "HOTMONSTER VS FLASH" splash; the fight starts when it closes.
function showVersus(m) {
  const g = m.game;
  for (let i = 0; i < 2; i++) {
    $(`vsImg${i + 1}`).src = portraits[g.f[i].char] || '';
    $(`vsName${i + 1}`).textContent = CHARACTERS[g.f[i].char].name.toUpperCase();
  }
  const vs = $('vs');
  vs.classList.remove('hidden');
  // Restart the CSS animations.
  for (const el of vs.querySelectorAll('.vs-side, .vs-mid')) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
  sfx('heavy');
  announce(`${CHARACTERS[g.f[0].char].name} contra ${CHARACTERS[g.f[1].char].name}!`);
  setTimeout(() => {
    if (window.__keepVs) return; // automated screenshots
    vs.classList.add('hidden');
    if (match !== m) return;
    m.hold = false;
    handleEvents(g.events);
  }, 2400);
}

function showCutin(f) {
  const el = $('cutin');
  $('cutImg').src = portraits[f.char] || '';
  $('cutWho').textContent = CHARACTERS[f.char].name.toUpperCase();
  $('cutName').textContent = SUPER_NAMES[f.char] || 'SUPER!';
  el.className = `${f.id === 1 ? 'p2' : ''} ${f.char === 'flash' ? 'green' : f.char === 'genildo' ? 'blue' : ''}`;
  for (const n of el.querySelectorAll('*')) { n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; }
  el.dataset.until = String(performance.now() + 400); // shown at least this long
  clearTimeout(showCutin.t);
  showCutin.t = setTimeout(() => el.classList.add('hidden'), 2500); // safety net
}

// The cut-in lasts as long as the super's freeze in the simulation.
function updateCutin(g) {
  const el = $('cutin');
  if (el.classList.contains('hidden') || performance.now() < Number(el.dataset.until || 0)) return;
  const freezing = g.hitstop > 0 && g.f.some((f) => f.st === 'attack' && f.mv === 'super' && f.sf <= 1);
  if (!freezing) el.classList.add('hidden');
}

function disposeMatch() {
  if (!match) return;
  match.view.dispose();
  match = null;
}

function endMatch() {
  disposeMatch();
  hud.show(false);
  touch.show(false);
  $('vs').classList.add('hidden');
  $('cutin').classList.add('hidden');
  $('pause').classList.add('hidden');
  $('victory').classList.add('hidden');
}

function tick() {
  const m = match, g = m.game;
  if (m.mode === 'online') {
    // Rollback: never waits for the other player's input (predicts it and corrects later).
    const lock = m.lock;
    const res = lock.tick(readInput('solo'));
    m.game = lock.game;
    if (res === 'stall') {
      m.stall++;
      if (m.stall === 45) hud.net('Conexão lenta… esperando o outro jogador', true);
      if (m.stall > 60 * 12) { session?.close(); endMatch(); openOnline(); netStatus('A conexão travou. Tentem de novo.', true); }
      return false;
    }
    if (res === 'wait') return false; // the other side is behind: let it catch up
    if (m.stall >= 45) hud.net(netLabel());
    m.stall = 0;
    m.frame = lock.frame;
    if (lock.desync != null) {
      session?.close(); endMatch(); openOnline();
      netStatus('Os jogos dessincronizaram. Criem a sala de novo (e confiram se os dois recarregaram a página).', true);
      return false;
    }
  } else {
    let p1 = m.mode === 'local' ? readInput('p1') : readInput('solo');
    let p2 = m.mode === 'local' ? readInput('p2') : m.cpu.input(g);
    if (window.__inputOverride) [p1, p2] = window.__inputOverride(g, p1, p2); // automated tests
    step(g, [p1, p2]);
    m.frame++;
    if (window.__pauseAtFrame && g.frame >= window.__pauseAtFrame) { m.paused = true; window.__pauseAtFrame = 0; }
  }
  handleEvents(m.game.events);
  return true;
}

function netLabel() {
  const ping = session?.rtt ? ` • ping ${Math.round(session.rtt)} ms` : '';
  return `online${ping}`;
}

const nameOf = (g, i) => CHARACTERS[g.f[i].char].name.toUpperCase();

function handleEvents(events) {
  const m = match, g = m.game;
  m.view.handleEvents(events);
  for (const ev of events) {
    switch (ev.t) {
      case 'round':
        hud.flash(g.round === 5 ? 'ROUND FINAL' : `ROUND ${ev.round}`, 1400, false, 'round');
        sfx('bell');
        announce(`Round ${ev.round}`);
        break;
      case 'fight': hud.flash('FIGHT!', 900, false, 'fight'); announce('Luta!'); break;
      case 'hit':
        sfx(ev.heavy ? 'heavy' : 'hit', ev.combo);
        if (ev.big && !ev.ko) sfx('launch');
        if (touch.enabled && ev.f === (m.mode === 'online' ? m.me : 0)) buzz(ev.heavy ? 60 : 25);
        hud.combo(ev.by, ev.combo, ev.dmg);
        break;
      case 'block': sfx('block'); break;
      case 'target': hud.flash(`${CHARACTERS[g.f[ev.f].char].combo}!`, 900, true); break;
      case 'bounce': sfx('bounce'); break;
      case 'move': {
        const f = g.f[ev.f];
        if (ev.mv === 'super') showCutin(f);
        if (f.char === 'flash' && ev.mv === 'super') sfx('glug');
        else if (ev.mv === 'super') { sfx('power'); announce({ genildo: 'Tolerância zero!', anderon: 'Armada fatal!' }[f.char] || 'Chuva de ração!'); }
        else if (f.char === 'anderon' && ev.mv === 'special') { sfx('ring'); hud.flash('LIGANDO PRA CASADA!', 1100, true); announce('Ligando pra casada!'); }
        else if (f.char === 'hotmonster' && ev.mv === 'special') setTimeout(() => sfx('throw'), 200);
        else sfx('whoosh');
        break;
      }
      case 'buff': sfx('power'); hud.flash('GARRA!', 900, true); break;
      case 'splash': if (ev.kind !== 'bullet') sfx('splash'); break;
      case 'shot': sfx('shot'); break;
      case 'heal': sfx('heal'); break;
      case 'thud': sfx('thud'); break;
      case 'timeover': hud.flash('TEMPO!', 1500); announce('Tempo!'); break;
      case 'ko':
        if (g.timer > 0) { hud.flash('K.O.!', 1500, false, 'fight'); sfx('ko'); announce('Nocaute!'); }
        break;
      case 'roundEnd':
        hud.flash(g.roundWinner === 2 ? 'EMPATE' : `${nameOf(g, g.roundWinner)} VENCE!`, 1800, true);
        break;
      case 'matchEnd': {
        const w = g.matchWinner;
        const text = w === 2 ? 'EMPATE!' : `${nameOf(g, w)} VENCEU!`;
        hud.flash(text, 0, true);
        announce(w === 2 ? 'Empate!' : `${CHARACTERS[g.f[w].char].name} venceu!`);
        m.ended = true;
        setTimeout(() => { if (match === m) openEndMenu(text); }, 2600);
        break;
      }
      default: break;
    }
  }
}

// Message on the end-of-match screen (rematch requests online).
function endMsg(text) {
  $('pauseMsg').textContent = text;
  $('winMsg').textContent = text;
}

function openEndMenu(text) {
  const w = match.game.matchWinner;
  if (w === 0 || w === 1) {
    // Victory screen with the winner's portrait in the gold frame.
    const c = match.game.f[w].char;
    $('winImg').src = portraits[c] || '';
    $('winName').textContent = CHARACTERS[c].name.toUpperCase();
    $('winMsg').textContent = '';
    $('winRematch').disabled = false;
    $('victory').classList.remove('hidden');
    return;
  }
  $('pauseTitle').textContent = text;
  $('pauseMsg').textContent = '';
  $('resumeBtn').classList.add('hidden');
  $('rematchBtn').classList.remove('hidden');
  $('rematchBtn').disabled = false;
  $('pause').classList.remove('hidden');
}

function openPause() {
  if (!match || match.ended) return;
  $('pauseTitle').textContent = match.mode === 'online' ? 'Menu (a luta continua!)' : 'Pausa';
  $('pauseMsg').textContent = '';
  $('resumeBtn').classList.remove('hidden');
  $('rematchBtn').classList.add('hidden');
  $('pause').classList.remove('hidden');
  if (match.mode !== 'online') match.paused = true;
}

function closePause() {
  $('pause').classList.add('hidden');
  if (match) match.paused = false;
}

$('resumeBtn').onclick = closePause;
$('quitBtn').onclick = () => {
  const online = match?.mode === 'online';
  if (online && session) { session.close(); session = null; }
  endMatch();
  show('menu');
};
function rematch() {
  if (!match) return;
  if (match.mode === 'online') {
    $('rematchBtn').disabled = true;
    $('winRematch').disabled = true;
    endMsg('Esperando seu amigo aceitar a revanche…');
    session.askRematch();
  } else {
    $('pause').classList.add('hidden');
    $('victory').classList.add('hidden');
    startMatch(match.mode, match.chars, match.opts);
  }
}
$('rematchBtn').onclick = rematch;
$('winRematch').onclick = rematch;
$('winMenu').onclick = () => $('quitBtn').onclick();

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || !match) return;
  if (!$('victory').classList.contains('hidden')) return;
  if ($('pause').classList.contains('hidden')) openPause();
  else if (!match.ended) closePause();
});
window.addEventListener('blur', () => { if (match && match.mode !== 'online') openPause(); });

// ---------- Main loop ----------
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  match?.view.arena.resize(innerWidth, innerHeight);
  attract?.view.arena.resize(innerWidth, innerHeight);
}
window.addEventListener('resize', resize);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (match) {
    const m = match;
    if (!m.paused && !m.hold) {
      // The match-ending K.O. plays in slow motion.
      m.acc += dt * (isFinalKO(m.game) ? 0.3 : 1);
      let steps = 0;
      while (m.acc >= STEP && steps < 6 && match === m) {
        m.view.snapshot(m.game);
        if (!tick()) { m.acc = Math.min(m.acc, STEP); break; }
        m.acc -= STEP;
        steps++;
      }
      // Online: if the other side is well ahead, run an extra frame to catch up.
      if (match === m && m.lock && m.lock.advantage() <= -3) { m.view.snapshot(m.game); tick(); }
    }
    if (match === m) {
      // frac: how far we are between the last sim frame and the next one (smooth motion
      // on 120/144 Hz screens and in slow motion).
      m.view.render(renderer, m.game, m.paused && !window.__settle ? 0 : dt, Math.min(1, m.acc / STEP)); // __settle: tests
      updateCutin(m.game);
      hud.update(m.game);
    }
  } else if (attract && $('menu').classList.contains('hidden')) {
    // The main menu has its own painted background; the 3D street shows behind the others.
    attract.view.render(renderer, attract.game, dt);
  }
  requestAnimationFrame(frame);
}

// ---------- Boot ----------
const portraits = {};

// Drawn portraits for the select cards, the VS screen and the super cut-in. Characters
// without one get a picture rendered from their 3D model.
const PORTRAIT_FILES = {
  hotmonster: 'assets/portraits/hotmonster.webp',
  flash: 'assets/portraits/flash.webp',
  genildo: 'assets/portraits/genildo.webp',
  anderon: 'assets/portraits/anderon.webp',
};

async function makePortraits() {
  await Promise.all(Object.entries(PORTRAIT_FILES).map(([id, url]) => new Promise((done) => {
    const img = new Image();
    img.onload = () => { portraits[id] = url; done(); };
    img.onerror = () => done(); // fall back to the rendered portrait
    img.src = url;
  })));
  if (Object.keys(CHARACTERS).every((id) => portraits[id])) return;
  const size = 256;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(size, size, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const shared = await sharedClips();
  for (const id of Object.keys(CHARACTERS)) {
    if (portraits[id]) continue;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x664466, 2.2));
    const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(2, 3, 4); scene.add(d);
    const gltf = await loadGLTF(CHARACTERS[id].model);
    const own = new Set(gltf.animations.map((a) => a.name));
    const c = new Character(gltf, { extraClips: shared.filter((a) => !own.has(a.name)) });
    c.root.rotation.y = 0.55;
    scene.add(c.root);
    c.root.updateMatrixWorld(true);
    const f = createFighter(0, id, 0);
    for (let k = 0; k < 30; k++) c.applyPose(poseFor(f, null, 1.4), 1 / 60);
    const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    cam.position.set(0.25, 1.45, 2.6);
    cam.lookAt(0.05, 1.2, 0);
    r.render(scene, cam);
    portraits[id] = r.domElement.toDataURL('image/png');
  }
  r.dispose();
}

async function boot() {
  resize();
  // Hosts without WebRTC (e.g. a claude.ai preview) can't play online.
  if (document.querySelector('meta[name="briga-no-online"]')) {
    const b = document.querySelector('[data-go="online"]');
    b.disabled = true;
    b.textContent = '🌐 Online: só na versão publicada';
  }
  requestAnimationFrame(frame);
  try {
    await canImage();
    const view = await GameView.create(['hotmonster', 'flash']);
    view.arena.resize(innerWidth, innerHeight);
    attract = { view, game: createGame(['hotmonster', 'flash']) };
    await makePortraits();
    $('loading').textContent = '';
  } catch (e) {
    console.error(e);
    $('loading').textContent = `Erro ao carregar: ${e.message}`;
  }
  if (/sala=/.test(location.hash)) openSelect('online');
  window.__ready = true;
}

// Debug hooks for automated tests.
window.__game = {
  get match() { return match; },
  startMatch,
  openEndMenu, // tests
};

boot();
