// Combat: bullets, fists, explosions, and the pickups scattered around the city.
// Bullets are hitscan with a tracer line; explosions hurt everything nearby.

import { WEAPONS } from './config.js';

export function createCombat() {
  return {
    bullets: [],
    tracers: [],
    booms: [],
    pickups: [],
  };
}

export function fireBullet(combat, x, y, angle, weapon, owner) {
  const range = weapon.range;
  combat.bullets.push({
    x, y, angle, owner,
    damage: weapon.damage,
    left: range,
    speed: 1500,
  });
  combat.tracers.push({ x, y, angle, len: 0, life: 0.08, max: range });
}

export function explode(combat, x, y, radius, damage, audio) {
  combat.booms.push({ x, y, radius, life: 0.5, max: 0.5 });
  if (audio) audio.explosion();
  return { x, y, radius, damage };
}

/**
 * Advance bullets: move them, stop at buildings, and report the first thing each one hits.
 * `targets` is a list of {x, y, radius, kind, ref} the shot can strike.
 */
export function stepBullets(combat, city, targets, dt) {
  const hits = [];
  for (const b of combat.bullets) {
    const step = b.speed * dt;
    let nx = b.x + Math.cos(b.angle) * step;
    let ny = b.y + Math.sin(b.angle) * step;
    b.left -= step;
    if (city.collidesBuilding(nx, ny, 2) || city.inWater(nx, ny) || b.left <= 0) {
      b.dead = true;
      continue;
    }
    for (const t of targets) {
      if (t.dead) continue;
      const d = Math.hypot(t.x - nx, t.y - ny);
      if (d < t.radius) {
        hits.push({ bullet: b, target: t });
        b.dead = true;
        break;
      }
    }
    if (!b.dead) {
      b.x = nx;
      b.y = ny;
    }
  }
  combat.bullets = combat.bullets.filter((b) => !b.dead);
  for (const t of combat.tracers) {
    t.life -= dt;
    t.len = Math.min(t.max, t.len + 2600 * dt);
  }
  combat.tracers = combat.tracers.filter((t) => t.life > 0);
  for (const boom of combat.booms) boom.life -= dt;
  combat.booms = combat.booms.filter((boom) => boom.life > 0);
  return hits;
}

export function spawnPickup(combat, kind, x, y) {
  combat.pickups.push({ kind, x, y, bob: Math.random() * 6 });
}

export function weaponFor(player) {
  return player.weapon === 'pistol' && player.ammo > 0 ? WEAPONS.pistol : WEAPONS.fists;
}
