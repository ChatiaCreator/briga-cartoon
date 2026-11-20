// Online rooms over PeerJS (WebRTC data channel, direct between the two browsers).
// The host creates a room code; the guest types it. The host plays on the left (P1).
import { delayFor } from './rollback.js';

const PREFIX = 'briga-cartoon-v1-';
export const NET_VERSION = 9; // 9: AGARRÃO and the spinning sweep off
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeCode() {
  let s = '';
  const a = new Uint32Array(6);
  crypto.getRandomValues(a);
  for (const v of a) s += CODE_CHARS[v % CODE_CHARS.length];
  return s;
}

export function normalizeCode(s) {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

const ERRORS = {
  'peer-unavailable': 'Sala não encontrada. Confira o código.',
  network: 'Sem conexão com o servidor de salas. Verifique sua internet.',
  'server-error': 'O servidor de salas não respondeu. Tente de novo.',
  'browser-incompatible': 'Este navegador não suporta jogo online (WebRTC).',
  disconnected: 'Conexão com o servidor de salas perdida.',
};

export class OnlineSession {
  constructor(handlers) {
    this.h = handlers; // { status(text), start({delay, chars, me, stage}), message(msg), closed(reason) }
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.myChar = null;
    this.remoteChar = null;
    this.delay = 3;
    this.pings = [];
    this.closedByMe = false;
    this.rematch = { me: false, them: false };
  }

  get Peer() {
    if (!window.Peer) throw new Error('PeerJS não carregou.');
    return window.Peer;
  }

  // pickStage() chooses the arena for each match (the host decides for both players).
  host(char, pickStage = () => 'street') {
    this.isHost = true;
    this.myChar = char;
    this.pickStage = pickStage;
    const tryOpen = (attempt) => {
      const code = makeCode();
      const peer = new this.Peer(PREFIX + code, { debug: 0 });
      this.peer = peer;
      peer.on('open', () => this.h.status({ code, text: 'Sala criada! Mande o código para o seu amigo.' }));
      peer.on('connection', (conn) => {
        if (this.conn) { conn.on('open', () => conn.close()); return; }
        this.setup(conn);
      });
      peer.on('error', (e) => {
        if (e.type === 'unavailable-id' && attempt < 3) { peer.destroy(); tryOpen(attempt + 1); return; }
        this.h.status({ error: ERRORS[e.type] || `Erro de conexão (${e.type || e.message}).` });
      });
    };
    tryOpen(0);
  }

  join(code, char) {
    this.isHost = false;
    this.myChar = char;
    const peer = new this.Peer(undefined, { debug: 0 });
    this.peer = peer;
    peer.on('open', () => {
      this.h.status({ text: 'Conectando à sala…' });
      this.setup(peer.connect(PREFIX + code, { reliable: true, serialization: 'json' }));
    });
    peer.on('error', (e) => this.h.status({ error: ERRORS[e.type] || `Erro de conexão (${e.type || e.message}).` }));
    // WebRTC can hang forever on some networks; give feedback.
    this.joinTimer = setTimeout(() => {
      if (!this.started) this.h.status({ error: 'Não foi possível conectar. A rede de um de vocês pode estar bloqueando conexões diretas.' });
    }, 20000);
  }

  setup(conn) {
    this.conn = conn;
    conn.on('open', () => {
      this.h.status({ text: 'Conectado! Preparando a luta…' });
      this.send({ t: 'hello', v: NET_VERSION, char: this.myChar });
    });
    conn.on('data', (msg) => this.onData(msg));
    conn.on('close', () => { if (!this.closedByMe) this.h.closed('O outro jogador saiu da partida.'); });
    conn.on('error', () => { if (!this.closedByMe) this.h.closed('A conexão caiu.'); });
  }

  send(msg) {
    if (this.conn && this.conn.open) this.conn.send(msg);
  }

  onData(msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'hello':
        if (msg.v !== NET_VERSION) {
          this.h.status({ error: 'Vocês estão com versões diferentes do jogo. Recarreguem a página.' });
          return;
        }
        this.remoteChar = msg.char;
        this.h.peerChar?.(msg.char); // lets the game start downloading that fighter
        if (this.isHost) this.measure(0);
        return;
      case 'ping':
        this.send({ t: 'pong', n: msg.n, ts: msg.ts });
        return;
      case 'pong':
        this.pings.push(performance.now() - msg.ts);
        if (msg.n < 6) setTimeout(() => this.measure(msg.n + 1), 60);
        else this.hostStart();
        return;
      case 'start':
        this.delay = msg.delay;
        if (msg.rtt) this.rtt = msg.rtt;
        this.begin({ delay: msg.delay, chars: msg.chars, me: 1, stage: msg.stage });
        return;
      case 'rematch':
        this.rematch.them = true;
        this.checkRematch();
        this.h.message(msg);
        return;
      default:
        this.h.message(msg);
    }
  }

  measure(n) {
    this.send({ t: 'ping', n, ts: performance.now() });
  }

  hostStart() {
    const sorted = this.pings.slice().sort((a, b) => a - b);
    const rtt = sorted[Math.floor(sorted.length / 2)] || 100;
    // One-way time in frames, plus a frame of slack.
    this.delay = delayFor(rtt);
    this.rtt = rtt;
    const chars = [this.myChar, this.remoteChar], stage = this.pickStage();
    this.send({ t: 'start', delay: this.delay, chars, stage, rtt: this.rtt });
    this.begin({ delay: this.delay, chars, me: 0, stage });
  }

  begin(info) {
    this.started = true;
    this.matchNo = (this.matchNo || 0) + 1; // both sides count the matches the same way
    info.matchNo = this.matchNo;
    clearTimeout(this.joinTimer);
    this.rematch = { me: false, them: false };
    this.h.start(info);
  }

  askRematch() {
    this.rematch.me = true;
    this.send({ t: 'rematch' });
    this.checkRematch();
  }

  checkRematch() {
    if (this.isHost && this.rematch.me && this.rematch.them) {
      const chars = [this.myChar, this.remoteChar], stage = this.pickStage();
      this.send({ t: 'start', delay: this.delay, chars, stage, rtt: this.rtt });
      this.begin({ delay: this.delay, chars, me: 0, stage });
    }
  }

  close() {
    this.closedByMe = true;
    clearTimeout(this.joinTimer);
    try { this.conn && this.conn.close(); } catch { /* already closed */ }
    try { this.peer && this.peer.destroy(); } catch { /* already destroyed */ }
  }
}
