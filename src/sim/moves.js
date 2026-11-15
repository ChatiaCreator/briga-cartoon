// Character stats and move frame data. Units: millimetres and frames (60 per second).
// box = [forwardStart, heightStart, forwardEnd, heightEnd], relative to the fighter's feet.
// rank: 1 light, 2 heavy, 3 special, 4 super. A move that connected can be cancelled into
// a move of equal (lights only) or higher rank.
// height: 'mid' (any block), 'low' (crouch block only), 'high' (stand block only).

const normals = {
  lp:  { rank: 1, startup: 4, active: 3, recovery: 7,  dmg: 40, hitstun: 14, blockstun: 10, push: 120, height: 'mid', box: [120, 1200, 680, 1500] },
  hp:  { rank: 2, startup: 7, active: 4, recovery: 15, dmg: 85, hitstun: 20, blockstun: 15, push: 200, height: 'mid', box: [120, 1150, 800, 1500] },
  lk:  { rank: 1, startup: 5, active: 3, recovery: 10, dmg: 50, hitstun: 15, blockstun: 11, push: 140, height: 'mid', box: [150, 450, 780, 850] },
  hk:  { rank: 2, startup: 9, active: 4, recovery: 19, dmg: 95, hitstun: 21, blockstun: 16, push: 240, height: 'mid', box: [150, 900, 900, 1400] },
  clp: { rank: 1, startup: 4, active: 3, recovery: 7,  dmg: 35, hitstun: 13, blockstun: 9,  push: 110, height: 'mid', box: [120, 700, 680, 1000] },
  chp: { rank: 2, startup: 6, active: 5, recovery: 18, dmg: 80, hitstun: 20, blockstun: 14, push: 160, height: 'mid', box: [80, 900, 620, 1800] },
  clk: { rank: 1, startup: 5, active: 3, recovery: 9,  dmg: 40, hitstun: 14, blockstun: 10, push: 120, height: 'low', box: [150, 0, 780, 300] },
  chk: { rank: 2, startup: 8, active: 4, recovery: 22, dmg: 80, hitstun: 0,  blockstun: 14, push: 180, height: 'low', box: [150, 0, 950, 320], kd: true },
  jlp: { rank: 1, startup: 5, active: 8, recovery: 0,  dmg: 50, hitstun: 16, blockstun: 11, push: 100, height: 'high', box: [80, 650, 620, 1100], air: true },
  jhp: { rank: 2, startup: 7, active: 6, recovery: 0,  dmg: 80, hitstun: 19, blockstun: 14, push: 140, height: 'high', box: [80, 550, 680, 1100], air: true },
  jlk: { rank: 1, startup: 5, active: 10, recovery: 0, dmg: 50, hitstun: 16, blockstun: 11, push: 100, height: 'high', box: [100, 150, 700, 650], air: true },
  jhk: { rank: 2, startup: 7, active: 8, recovery: 0,  dmg: 85, hitstun: 19, blockstun: 14, push: 140, height: 'high', box: [100, 150, 820, 650], air: true },
  // Extra buttons. travel = [fromFrame, toFrame, mm per frame] moved forward during the move.
  // VOADORA: run-up and jumping kick. Hits high, so it has to be blocked standing.
  fk:  { rank: 2, startup: 18, active: 6, recovery: 16, dmg: 90, hitstun: 22, blockstun: 16, push: 220, height: 'high', box: [150, 900, 950, 1650], travel: [2, 24, 50] },
  // ESTRELA: cartwheel into a kick that knocks down.
  cw:  { rank: 2, startup: 20, active: 6, recovery: 22, dmg: 100, hitstun: 0, blockstun: 16, push: 200, height: 'mid', box: [100, 700, 900, 1550], travel: [0, 22, 34], kd: true },
  // ESQUIVA (tap back twice): ducks and slips back, untouchable for the first 14 frames.
  // No hitbox (it never becomes active); punishable at the end.
  dodge: { rank: 0, startup: 22, active: 0, recovery: 6, dmg: 0, hitstun: 0, blockstun: 0, push: 0, height: 'mid', invuln: 14, travel: [1, 15, -46] },
};

export const CHARACTERS = {
  hotmonster: {
    name: 'Hotmonster',
    hp: 1000, walk: 38, back: 30, jumpVy: 200, jumpVx: 40, gravity: 11,
    model: 'assets/models/hotmonster.glb',
    moves: {
      ...normals,
      // Special: throws a bag of dog food in an arc.
      special: { rank: 3, startup: 16, active: 0, recovery: 26, dmg: 100, hitstun: 22, blockstun: 16, push: 220, height: 'mid', chip: 10,
        projectile: { at: 16, dx: 350, y: 1350, vx: 75, vy: 70, g: 5, kind: 'racao' } },
      // Super: a rain of dog food bags falls on the opponent.
      super: { rank: 4, startup: 20, active: 0, recovery: 50, dmg: 85, hitstun: 24, blockstun: 14, push: 120, height: 'mid', chip: 10,
        invuln: 30, rain: { frames: [20, 30, 40, 50, 60], offsets: [-450, 0, 450, -220, 220], y: 4200, g: 7, kind: 'racao' } },
    },
  },
  flash: {
    name: 'Flash',
    hp: 950, walk: 48, back: 38, jumpVy: 210, jumpVx: 46, gravity: 11,
    model: 'assets/models/flash.glb',
    moves: {
      ...normals,
      // Special: a fast shoulder dash.
      special: { rank: 3, startup: 8, active: 14, recovery: 16, dmg: 100, hitstun: 22, blockstun: 18, push: 250, height: 'mid', chip: 10,
        dash: 120, box: [60, 700, 620, 1550] },
      // Super: drinks a can of GARRA Energy. +50% damage and +20% speed for 8 seconds.
      super: { rank: 4, startup: 55, active: 0, recovery: 0, dmg: 0, invuln: 55, buff: 480 },
    },
  },
};

CHARACTERS.genildo = {
  name: 'Genildo',
  // Military police officer: sturdier and a bit slower than the others.
  hp: 1050, walk: 34, back: 28, jumpVy: 195, jumpVx: 38, gravity: 11,
  model: 'assets/models/genildo.glb',
  moves: {
    ...normals,
    // Special: draws the pistol and fires one fast, straight shot.
    special: { rank: 3, startup: 16, active: 0, recovery: 24, dmg: 80, hitstun: 20, blockstun: 14, push: 180, height: 'mid', chip: 8,
      projectile: { at: 16, dx: 520, y: 1330, vx: 160, vy: 0, g: 0, kind: 'bullet' } },
    // Super "TOLERÂNCIA ZERO": a burst of five shots.
    super: { rank: 4, startup: 22, active: 0, recovery: 30, dmg: 55, hitstun: 22, blockstun: 12, push: 100, height: 'mid', chip: 8,
      invuln: 30, burst: { frames: [22, 29, 36, 43, 50], ys: [1330, 1250, 1380, 1290, 1340], dx: 520, vx: 170, kind: 'bullet' } },
  },
};

export const BUFF_DMG = 150;   // percent
export const BUFF_SPEED = 120; // percent

export function moveTotal(m) {
  return m.startup + m.active + m.recovery;
}
