// Neon Harbor 3D — police.js
// Wanted level, police interceptors (pursuit + ram), foot officers, arrest.
// The heat is knowledge-based: lay low out of sight and stars fade; change
// to an unseen car and the cops lose the trail.

import * as THREE from '../vendor/three.module.min.js';
import { WANTED, POLICE_CAR } from './config.js';
import { makeRng } from './random.js';
import { buildCarMesh } from './vehicle3d.js';
import { buildCharacterMesh } from './character.js';

export function createPolice(scene) {
  const rng = makeRng(9911);
  const group = new THREE.Group();
  group.name = 'police';
  scene.add(group);

  const state = {
    stars: 0,
    heat: 0, // 0..1 within the current star
    decayTimer: 0,
    lastSeen: 0,
  };

  const cars = [];
  const officers = [];

  function ensureCars(n) {
    while (cars.length < n) {
      const mesh = buildCarMesh(POLICE_CAR, true);
      group.add(mesh);
      cars.push({
        mesh,
        x: rng.range(-200, 200),
        z: rng.range(-150, 150),
        speed: 13 * POLICE_CAR.speed,
        active: true,
      });
    }
    while (cars.length > n) {
      const c = cars.pop();
      group.remove(c.mesh);
    }
  }

  function ensureOfficers(n, px, pz) {
    while (officers.length < n) {
      const mesh = buildCharacterMesh({ shirt: 0x22303e, pants: 0x22303e, skin: 0xc98d5f });
      group.add(mesh);
      officers.push({
        mesh,
        x: px + rng.range(-12, 12),
        z: pz + rng.range(-12, 12),
        speed: 5.2,
        active: true,
      });
    }
    while (officers.length > n) {
      const o = officers.pop();
      group.remove(o.mesh);
    }
  }

  function addHeat(amount) {
    state.heat += amount;
    while (state.heat >= 1 && state.stars < WANTED.maxStars) {
      state.heat -= 1;
      state.stars += 1;
    }
    if (state.stars >= WANTED.maxStars) state.heat = Math.min(state.heat, 0.99);
    state.decayTimer = 0;
  }

  function dropStars(n) {
    state.stars = Math.max(0, state.stars - n);
    state.heat = 0;
    state.decayTimer = 0;
  }

  // line of sight: police see the player if close and roughly facing them
  function policeCanSee(px, pz, dt) {
    if (state.stars === 0) return false;
    for (const c of cars) {
      const d = Math.hypot(c.x - px, c.z - pz);
      if (d < 70) return true;
    }
    for (const o of officers) {
      const d = Math.hypot(o.x - px, o.z - pz);
      if (d < 30) return true;
    }
    return false;
  }

  function update(dt, player, inCar) {
    const px = player.x;
    const pz = player.z;
    const seen = policeCanSee(px, pz, dt);
    if (seen) {
      state.lastSeen = 0;
      state.decayTimer = 0;
    } else {
      state.lastSeen += dt;
      state.decayTimer += dt;
      if (state.decayTimer >= WANTED.decaySeconds && state.stars > 0) {
        state.stars -= 1;
        state.decayTimer = 0;
        state.heat = 0;
      }
    }

    const wantCars = WANTED.policePerStar[state.stars];
    const wantOfficers = WANTED.officersPerStar[state.stars];
    ensureCars(wantCars);
    ensureOfficers(wantOfficers, px, pz);

    // pursuit: interceptors chase and ram
    for (const c of cars) {
      const dx = px - c.x;
      const dz = pz - c.z;
      const d = Math.hypot(dx, dz) || 1;
      const step = Math.min(c.speed * dt, d);
      c.x += (dx / d) * step;
      c.z += (dz / d) * step;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = Math.atan2(dx, dz);
      // ram: bump the player when touching
      if (d < 3.2 && player.onRam) player.onRam(dx / d, dz / d);
    }

    // foot officers close in and arrest up close
    for (const o of officers) {
      const dx = px - o.x;
      const dz = pz - o.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 1.6) {
        o.x += (dx / d) * o.speed * dt;
        o.z += (dz / d) * o.speed * dt;
      } else if (!inCar && player.onArrest) {
        player.onArrest();
      }
      o.mesh.position.set(o.x, 0, o.z);
      o.mesh.rotation.y = Math.atan2(dx, dz);
    }

    return state.stars;
  }

  return { state, cars, officers, addHeat, dropStars, update, policeCanSee };
}
