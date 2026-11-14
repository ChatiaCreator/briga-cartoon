// Projectiles (dog food bags). Integer physics, millimetres per frame.
import { WALL } from './fighter.js';

export function spawnProjectile(g, owner, p) {
  g.proj.push({
    id: g.nextProjId++, owner, kind: p.kind,
    x: p.x, y: p.y, vx: p.vx, vy: p.vy, g: p.g,
    move: p.move, age: 0,
  });
}

export function stepProjectiles(g) {
  const keep = [];
  for (const p of g.proj) {
    p.age++;
    p.x += p.vx;
    p.y += p.vy;
    p.vy -= p.g;
    if (p.y <= 0) {
      g.events.push({ t: 'splash', x: p.x, kind: p.kind });
      continue;
    }
    if (Math.abs(p.x) > WALL + 1500) continue;
    keep.push(p);
  }
  g.proj = keep;
}

export function projectileBox(p) {
  return [p.x - 180, p.y - 180, p.x + 180, p.y + 180];
}
