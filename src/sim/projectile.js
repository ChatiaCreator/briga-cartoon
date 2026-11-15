// Projectiles (dog food bags). Integer physics, millimetres per frame.
import { WALL } from './fighter.js';

export function spawnProjectile(g, owner, p) {
  g.proj.push({
    id: g.nextProjId++, owner, kind: p.kind,
    x: p.x, y: p.y, vx: p.vx, vy: p.vy, g: p.g,
    move: p.move, age: 0,
  });
  // Lets the view draw a muzzle flash and play the gunshot.
  if (p.kind === 'bullet') g.events.push({ t: 'shot', f: owner, x: p.x, y: p.y, dir: Math.sign(p.vx) });
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
  if (p.kind === 'bullet') return [p.x - 120, p.y - 90, p.x + 120, p.y + 90];
  if (p.kind === 'screwdriver') return [p.x - 200, p.y - 120, p.x + 200, p.y + 120];
  return [p.x - 180, p.y - 180, p.x + 180, p.y + 180];
}
