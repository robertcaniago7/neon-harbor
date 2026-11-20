// Combat: fists + HK-9 pistol, tracer lines, hit detection, health/armor/
// ammo/cash pickups, and gang shootouts (Rust Vultures who fight back).

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildCharacterMesh } from './character.js';

const PUNCH = CONFIG.weapons.fists;
const PISTOL = CONFIG.weapons.pistol;

export function createCombat(scene, rng) {
  const enemies = [];
  const pickups = [];
  const tracers = [];
  let pistolAmmo = PISTOL.ammo;
  let punchTimer = 0;
  let shootTimer = 0;

  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const tracerGeo = new THREE.BoxGeometry(0.05, 0.05, 1);

  function spawnTracer(from, to) {
    const len = from.distanceTo(to);
    const m = new THREE.Mesh(tracerGeo, tracerMat);
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.lookAt(to);
    m.scale.set(1, 1, len);
    scene.add(m);
    tracers.push({ mesh: m, life: 0.09 });
  }

  function updateTracers(dt) {
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        scene.remove(t.mesh);
        tracers.splice(i, 1);
      }
    }
  }

  // Spawn a gang member at (x,z). He shoots at the player when in range.
  function spawnGang(x, z, health = 60) {
    const { group, parts } = buildCharacterMesh({ gang: true, rng });
    scene.add(group);
    group.position.set(x, 0, z);
    const rec = {
      mesh: group, parts, x, z,
      health, maxHealth: health,
      shootTimer: rng.range(0.5, 1.5),
      walkPhase: rng.next() * 6,
      dead: false,
    };
    enemies.push(rec);
    return rec;
  }

  function clearEnemies() {
    for (const e of enemies) scene.remove(e.mesh);
    enemies.length = 0;
  }

  // Pickups: kind is 'health' | 'armor' | 'ammo' | 'cash'.
  function spawnPickup(kind, x, z, value = 0) {
    const color = kind === 'health' ? 0x37d67a : kind === 'armor' ? 0x3fa7d6
      : kind === 'ammo' ? 0xf2c94c : 0x9b7ede;
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), mat);
    mesh.position.set(x, 0.7, z);
    mesh.castShadow = true;
    scene.add(mesh);
    const rec = {
      mesh, kind, x, z,
      value: value || (kind === 'health' ? 30 : kind === 'armor' ? 25 : kind === 'ammo' ? 12 : 50),
      spin: 0,
    };
    pickups.push(rec);
    return rec;
  }

  function clearPickups() {
    for (const p of pickups) scene.remove(p.mesh);
    pickups.length = 0;
  }

  // Player punch: hits the nearest enemy in range + in front.
  function punch(playerPos, playerHeading, onHit) {
    if (punchTimer > 0) return false;
    punchTimer = PUNCH.cooldown;
    let best = null;
    let bestD = PUNCH.range;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - playerPos.x;
      const dz = e.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const ang = Math.atan2(dx, dz);
      let diff = Math.abs(ang - playerHeading);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > 1.1) continue;
      bestD = d;
      best = e;
    }
    if (best) {
      best.health -= PUNCH.damage;
      if (best.health <= 0) {
        best.dead = true;
        scene.remove(best.mesh);
      }
      if (onHit) onHit(best);
      return true;
    }
    return false;
  }

  // Player shot: raycast-ish — nearest enemy within range and a narrow cone.
  function shoot(playerPos, playerHeading, onHit) {
    if (shootTimer > 0 || pistolAmmo <= 0) return false;
    shootTimer = PISTOL.cooldown;
    pistolAmmo -= 1;
    const from = new THREE.Vector3(playerPos.x, 1.45, playerPos.z);
    const dir = new THREE.Vector3(Math.sin(playerHeading), 0, Math.cos(playerHeading));
    const to = from.clone().addScaledVector(dir, PISTOL.range);
    let best = null;
    let bestD = PISTOL.range;
    for (const e of enemies) {
      if (e.dead) continue;
      const ex = e.x - playerPos.x;
      const ez = e.z - playerPos.z;
      const along = ex * dir.x + ez * dir.z;
      if (along < 0 || along > bestD) continue;
      const perp = Math.abs(ex * dir.z - ez * dir.x);
      if (perp > 1.6) continue;
      bestD = along;
      best = e;
    }
    if (best) {
      to.copy(from).addScaledVector(dir, bestD);
      best.health -= PISTOL.damage;
      if (best.health <= 0) {
        best.dead = true;
        scene.remove(best.mesh);
        spawnPickup('cash', best.x + 1, best.z, 60);
      }
      if (onHit) onHit(best);
    }
    spawnTracer(from, to);
    return true;
  }

  function update(dt, playerPos, playerHeading, damagePlayer) {
    punchTimer = Math.max(0, punchTimer - dt);
    shootTimer = Math.max(0, shootTimer - dt);
    updateTracers(dt);

    // Pickup spin + bob.
    for (const p of pickups) {
      p.spin += dt * 2.4;
      p.mesh.rotation.y = p.spin;
      p.mesh.position.y = 0.7 + Math.sin(p.spin * 1.6) * 0.12;
    }

    // Gang members: shuffle toward the player and shoot.
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = playerPos.x - e.x;
      const dz = playerPos.z - e.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 26) {
        e.shootTimer -= dt;
        e.mesh.rotation.y = Math.atan2(dx, dz);
        if (dist > 9) {
          const step = 2.6 * dt;
          e.x += (dx / dist) * step;
          e.z += (dz / dist) * step;
          e.walkPhase += dt * 6;
          const swing = Math.sin(e.walkPhase) * 0.5;
          e.parts.armL.rotation.x = swing;
          e.parts.armR.rotation.x = -swing;
          e.parts.legL.rotation.x = -swing;
          e.parts.legR.rotation.x = swing;
        } else {
          e.parts.armR.rotation.x = -1.35; // aim
          if (e.shootTimer <= 0) {
            e.shootTimer = rng.range(0.9, 1.7);
            const from = new THREE.Vector3(e.x, 1.45, e.z);
            const to = new THREE.Vector3(playerPos.x, 1.3, playerPos.z);
            spawnTracer(from, to);
            if (damagePlayer && rng.chance(0.45)) damagePlayer(rng.int(4, 9));
          }
        }
        e.mesh.position.set(e.x, 0, e.z);
      }
    }
  }

  // Collect pickups near the player. Returns a list of what was taken.
  function collect(playerPos, range = 1.6) {
    const taken = [];
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      if (d < range) {
        taken.push({ kind: p.kind, value: p.value });
        scene.remove(p.mesh);
        pickups.splice(i, 1);
      }
    }
    return taken;
  }

  function getAmmo() {
    return pistolAmmo;
  }

  function setAmmo(n) {
    pistolAmmo = Math.max(0, n | 0);
  }

  function addAmmo(n) {
    pistolAmmo += n;
  }

  function aliveEnemies() {
    return enemies.filter((e) => !e.dead).length;
  }

  return {
    enemies, pickups,
    spawnGang, clearEnemies, spawnPickup, clearPickups,
    punch, shoot, update, collect,
    getAmmo, setAmmo, addAmmo, aliveEnemies,
  };
}

export default createCombat;
