// Pedestrians and foot police. Peds stroll the sidewalks, flee gunfire and speeding cars,
// and scatter when a car mounts the kerb. Foot officers join the hunt at three stars.

import { WANTED } from './config.js';

const PED_COLORS = ['#e8b4b8', '#a8c8e8', '#e8d8a8', '#b8e8c8', '#d8b8e8', '#e8a878', '#f4f1ea', '#c8c8d8'];

export function makePed(x, y, rng) {
  return {
    x, y, angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 52),
    color: PED_COLORS[Math.floor(rng.next() * PED_COLORS.length)],
    target: null,
    state: 'walk',
    fear: 0,
    dead: false,
  };
}

export function stepPeds(peds, city, threats, dt, rng) {
  for (const ped of peds) {
    if (ped.dead) continue;
    if (ped.fear > 0) ped.fear -= dt;
    let fleeing = ped.fear > 0;
    if (!fleeing) {
      for (const t of threats) {
        const d = Math.hypot(t.x - ped.x, t.y - ped.y);
        if (d < (t.radius || 260)) {
          fleeing = true;
          ped.fear = 2.5;
          ped.target = {
            x: ped.x + (ped.x - t.x) * 2,
            y: ped.y + (ped.y - t.y) * 2,
          };
          break;
        }
      }
    }
    if (fleeing && ped.target) {
      const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      ped.angle = want;
      ped.x += Math.cos(want) * 150 * dt;
      ped.y += Math.sin(want) * 150 * dt;
      if (Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 20) ped.target = null;
    } else {
      if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 14) {
        ped.target = city.randomSidewalkSpot();
      }
      const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      let diff = want - ped.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    ped.x = Math.max(30, Math.min(3170, ped.x));
    ped.y = Math.max(30, Math.min(2370, ped.y));
  }
}

export function makeOfficer(x, y) {
  return { x, y, angle: 0, speed: 235, state: 'chase', cool: 0 };
}

/** Foot officers run the player down and try to arrest them up close. */
export function stepOfficers(officers, playerPos, playerOnFoot, dt) {
  for (const o of officers) {
    const d = Math.hypot(playerPos.x - o.x, playerPos.y - o.y);
    if (d > 900) {
      // Too far to matter: hold position and wait for the cars to do the work.
      continue;
    }
    const want = Math.atan2(playerPos.y - o.y, playerPos.x - o.x);
    o.angle = want;
    o.x += Math.cos(want) * o.speed * dt;
    o.y += Math.sin(want) * o.speed * dt;
    if (o.cool > 0) o.cool -= dt;
  }
  return officers;
}

export function wantedFootCount(stars) {
  return stars >= WANTED.footFromStar ? Math.min(4, stars - 1) : 0;
}
