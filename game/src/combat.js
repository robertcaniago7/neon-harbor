// Neon Harbor 3D — combat.js
// Fists / HK-9 pistol, tracers, hit detection, pickups, gang shootouts.
// Enemies are Vultures gang members with simple health; shooting them raises
// wanted heat. Pickups restore health, armor and ammo.

import * as THREE from '../vendor/three.module.min.js';
import { WEAPONS } from './config.js';
import { makeRng } from './random.js';
import { buildCharacterMesh } from './character.js';

export function createCombat(scene) {
  const rng = makeRng(31337);
  const group = new THREE.Group();
  group.name = 'combat';
  scene.add(group);

  const enemies = [];
  const pickups = [];
  const tracers = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });

  function spawnEnemy(x, z, hp = 60) {
    const mesh = buildCharacterMesh({ shirt: 0x8a1f2d, pants: 0x22303e, skin: rng.pick([0xf2c9a0, 0xc98d5f]) });
    mesh.position.set(x, 0, z);
    group.add(mesh);
    const e = { mesh, x, z, hp, maxHp: hp, alive: true, shootCd: rng.range(1, 2.5) };
    enemies.push(e);
    return e;
  }

  function spawnPickup(kind, x, z) {
    const colors = { health: 0x2ecc71, armor: 0x3498db, ammo: 0xf2c94c, cash: 0xffb020 };
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshLambertMaterial({ color: colors[kind] || 0xffffff })
    );
    mesh.position.set(x, 0.6, z);
    mesh.rotation.y = Math.PI / 4;
    group.add(mesh);
    const p = { mesh, kind, x, z, taken: false, bob: rng.range(0, 6) };
    pickups.push(p);
    return p;
  }

  function fireTracer(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const geo = new THREE.BoxGeometry(0.06, 0.06, len);
    const mesh = new THREE.Mesh(geo, tracerMat);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.lookAt(to);
    group.add(mesh);
    tracers.push({ mesh, life: 0.12 });
  }

  // Hitscan shot from `from` along `dir`. Returns the enemy hit, if any.
  function shoot(from, dir, range) {
    const end = new THREE.Vector3().copy(from).addScaledVector(dir, range);
    let best = null;
    let bestD = range;
    for (const e of enemies) {
      if (!e.alive) continue;
      const toE = new THREE.Vector3(e.x - from.x, 1.2 - from.y, e.z - from.z);
      const along = toE.dot(dir);
      if (along < 0 || along > bestD) continue;
      const perp = toE.clone().addScaledVector(dir, -along).length();
      if (perp < 1.4) { best = e; bestD = along; }
    }
    if (best) {
      end.copy(from).addScaledVector(dir, bestD);
      best.hp -= WEAPONS.pistol.damage;
      if (best.hp <= 0) {
        best.alive = false;
        group.remove(best.mesh);
      }
    }
    fireTracer(from, end);
    return best;
  }

  function punch(from, dir) {
    let best = null;
    let bestD = WEAPONS.fists.range;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - from.x;
      const dz = e.z - from.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const dot = (dx * dir.x + dz * dir.z) / (d || 1);
      if (dot > 0.3) { best = e; bestD = d; }
    }
    if (best) {
      best.hp -= WEAPONS.fists.damage;
      if (best.hp <= 0) {
        best.alive = false;
        group.remove(best.mesh);
      }
    }
    return best;
  }

  function update(dt, playerPos, onEnemyShot) {
    // tracers fade fast
    for (let i = tracers.length - 1; i >= 0; i--) {
      tracers[i].life -= dt;
      if (tracers[i].life <= 0) {
        group.remove(tracers[i].mesh);
        tracers.splice(i, 1);
      }
    }
    // pickups bob and spin
    for (const p of pickups) {
      if (p.taken) continue;
      p.bob += dt * 2;
      p.mesh.position.y = 0.6 + Math.sin(p.bob) * 0.15;
      p.mesh.rotation.y += dt;
      if (playerPos && Math.hypot(p.x - playerPos.x, p.z - playerPos.z) < 1.6) {
        p.taken = true;
        group.remove(p.mesh);
        if (p.onTake) p.onTake(p.kind);
      }
    }
    // enemies shoot back when the player is near
    if (playerPos) {
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - playerPos.x, e.z - playerPos.z);
        e.shootCd -= dt;
        if (d < 45 && e.shootCd <= 0) {
          e.shootCd = rng.range(1.2, 2.4);
          const from = new THREE.Vector3(e.x, 1.4, e.z);
          const to = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);
          fireTracer(from, to);
          if (onEnemyShot) onEnemyShot(8, e);
        }
      }
    }
  }

  function clearEnemies() {
    for (const e of enemies) group.remove(e.mesh);
    enemies.length = 0;
  }

  function aliveCount() {
    return enemies.filter((e) => e.alive).length;
  }

  return { group, enemies, pickups, spawnEnemy, spawnPickup, shoot, punch, update, clearEnemies, aliveCount };
}
