// Combat: free-aim hitscan shooting with tracers, gang enemies that fight back,
// fists, and spinning pickups (health / armor / ammo / cash).

import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { makeRng } from './random.js';
import { buildCharacter } from './character.js';

export function createCombat(scene) {
  return {
    scene,
    enemies: [], // {char, pos, health, shootCool, kind}
    pickups: [], // {kind, mesh, pos}
    tracers: [], // {line, life}
    rng: makeRng(777),
  };
}

export function spawnEnemies(combat, x, z, count, kind = 'vulture') {
  const out = [];
  for (let i = 0; i < count; i++) {
    const char = buildCharacter({
      shirt: kind === 'vulture' ? 0x8a2f2a : 0x1c2f45,
      pants: 0x22303e,
    });
    const px = x + combat.rng.range(-8, 8);
    const pz = z + combat.rng.range(-8, 8);
    char.group.position.set(px, 0, pz);
    char.setArmed(true);
    combat.scene.add(char.group);
    const e = {
      char, kind,
      pos: new THREE.Vector3(px, 0, pz),
      health: 60, shootCool: combat.rng.range(0.5, 1.5), phase: combat.rng.range(0, 6),
    };
    combat.enemies.push(e);
    out.push(e);
  }
  return out;
}

export function spawnPickup(combat, kind, x, z) {
  const colors = { health: 0x2f9e44, armor: 0x3fa7d6, ammo: 0xf2c94c, cash: 0x37b24d, pistol: 0xdddddd };
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.7),
    new THREE.MeshStandardMaterial({
      color: colors[kind] ?? 0xffffff, emissive: colors[kind] ?? 0xffffff,
      emissiveIntensity: 0.7, roughness: 0.4,
    }),
  );
  mesh.position.set(x, 0.8, z);
  combat.scene.add(mesh);
  const p = { kind, mesh, pos: new THREE.Vector3(x, 0, z), spin: 0 };
  combat.pickups.push(p);
  return p;
}

function fireTracer(combat, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 }));
  combat.scene.add(line);
  combat.tracers.push({ line, life: 0.09 });
}

/** Player shoots from `origin` toward `target` (world point). Returns what was hit. */
export function playerShoot(combat, ctx, origin, target) {
  const weapon = WEAPONS[ctx.player.weapon];
  const dir = new THREE.Vector3().subVectors(target, origin);
  const range = weapon.range;
  if (dir.lengthSq() < 0.001) return null;
  dir.normalize();
  const end = origin.clone().addScaledVector(dir, range);
  let best = null;
  let bestD = range;
  // enemies
  for (const e of combat.enemies) {
    const toE = new THREE.Vector3().subVectors(e.pos.clone().setY(1.2), origin);
    const along = toE.dot(dir);
    if (along < 0 || along > bestD) continue;
    const perp = toE.clone().addScaledVector(dir, -along).length();
    if (perp < 1.0) {
      best = { type: 'enemy', ref: e, point: origin.clone().addScaledVector(dir, along) };
      bestD = along;
    }
  }
  // traffic cars and police cars (shooting a car damages it / angers police)
  for (const car of ctx.traffic.cars) {
    const cp = car.mesh.position;
    const toC = new THREE.Vector3(cp.x - origin.x, 1 - origin.y, cp.z - origin.z);
    const along = toC.dot(dir);
    if (along < 0 || along > bestD) continue;
    const perp = toC.clone().addScaledVector(dir, -along).length();
    if (perp < 1.6) {
      best = { type: 'traffic', ref: car, point: origin.clone().addScaledVector(dir, along) };
      bestD = along;
    }
  }
  for (const car of ctx.police.cars) {
    const cp = car.mesh.position;
    const toC = new THREE.Vector3(cp.x - origin.x, 1 - origin.y, cp.z - origin.z);
    const along = toC.dot(dir);
    if (along < 0 || along > bestD) continue;
    const perp = toC.clone().addScaledVector(dir, -along).length();
    if (perp < 1.6) {
      best = { type: 'police', ref: car, point: origin.clone().addScaledVector(dir, along) };
      bestD = along;
    }
  }
  const hitPoint = best ? best.point : end;
  fireTracer(combat, origin.clone(), hitPoint);
  if (!best) return null;
  if (best.type === 'enemy') {
    best.ref.health -= weapon.damage;
    if (best.ref.health <= 0) {
      ctx.events.push('enemyDown');
      spawnPickup(combat, 'cash', best.ref.pos.x, best.ref.pos.z);
      combat.scene.remove(best.ref.char.group);
      combat.enemies.splice(combat.enemies.indexOf(best.ref), 1);
      ctx.stats.kills += 1;
    }
  } else if (best.type === 'traffic') {
    ctx.events.push('shotCar');
  } else if (best.type === 'police') {
    ctx.events.push('shotPolice');
  }
  return best;
}

export function stepCombat(combat, ctx, dt) {
  const playerPos = ctx.player.pos;
  // tracers fade
  for (const t of combat.tracers) {
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
    if (t.life <= 0) {
      combat.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
    }
  }
  combat.tracers = combat.tracers.filter((t) => t.life > 0);

  // pickups spin + magnet
  for (const p of combat.pickups) {
    p.spin += dt * 2;
    p.mesh.rotation.y = p.spin;
    p.mesh.position.y = 0.8 + Math.sin(p.spin * 1.5) * 0.15;
    const d = Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z);
    if (d < 2.4) {
      if (p.kind === 'health') ctx.player.health = Math.min(100, ctx.player.health + 30);
      if (p.kind === 'armor') ctx.player.armor = Math.min(50, ctx.player.armor + 25);
      if (p.kind === 'ammo') ctx.player.ammo += 12;
      if (p.kind === 'pistol') {
        ctx.player.ownsPistol = true;
        ctx.player.weapon = 'pistol';
        ctx.player.ammo += 24;
      }
      if (p.kind === 'cash') {
        ctx.player.cash += 50;
        ctx.stats.cashEarned += 50;
      }
      ctx.events.push('pickup:' + p.kind);
      combat.scene.remove(p.mesh);
      combat.pickups.splice(combat.pickups.indexOf(p), 1);
    }
  }

  // enemies: seek the player, shoot with inaccuracy
  for (const e of combat.enemies) {
    const dx = playerPos.x - e.pos.x;
    const dz = playerPos.z - e.pos.z;
    const dist = Math.hypot(dx, dz);
    e.phase += dt * 6;
    if (dist > 30) {
      // idle patrol: stand and look around
      e.char.setWalk(e.phase, 0);
      continue;
    }
    e.char.group.rotation.y = Math.atan2(-dx, -dz);
    if (dist > 8) {
      e.pos.x += (dx / dist) * 3.2 * dt;
      e.pos.z += (dz / dist) * 3.2 * dt;
      e.char.group.position.copy(e.pos);
      e.char.setWalk(e.phase, 1);
    } else {
      e.char.setWalk(e.phase, 0);
    }
    e.shootCool -= dt;
    if (e.shootCool <= 0 && dist < 26) {
      e.shootCool = 1.4;
      ctx.audio.enemyShoot();
      // inaccurate: 45% hit chance at close range, less far away
      const hitChance = Math.max(0.12, 0.5 - dist * 0.012);
      if (combat.rng.rand() < hitChance) {
        const from = e.pos.clone().setY(1.4);
        const to = playerPos.clone().setY(1.2);
        fireTracer(combat, from, to);
        ctx.hurtPlayer(6);
      } else {
        const from = e.pos.clone().setY(1.4);
        const to = playerPos.clone().setY(1.2).add(new THREE.Vector3(combat.rng.range(-3, 3), 0, combat.rng.range(-3, 3)));
        fireTracer(combat, from, to);
      }
    }
  }
}
