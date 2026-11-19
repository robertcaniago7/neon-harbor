// Neon Harbor 3D — fists and the HK-9 pistol, tracers, hit detection, pickups
// and gang shootouts.

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { buildPickupMesh } from './vehicle3d.js';
import { buildGangMesh } from './character.js';
import { addWanted } from './police.js';

const W = CONFIG.world;

/** Create the combat state: tracers, pickups, gang members, cooldowns. */
export function createCombat(game) {
  const pickups = [];
  const kinds = ['health', 'armor', 'ammo', 'cash'];
  for (let i = 0; i < 8; i++) {
    const kind = kinds[i % kinds.length];
    const mesh = buildPickupMesh(kind);
    const x = CONFIG.world.roadX[Math.floor(Math.random() * CONFIG.world.roadX.length)] + (Math.random() < 0.5 ? -7 : 7);
    const z = CONFIG.world.roadZ[Math.floor(Math.random() * CONFIG.world.roadZ.length)] + (Math.random() < 0.5 ? -7 : 7);
    mesh.position.set(x, 0.8, z);
    game.scene.add(mesh);
    pickups.push({ kind, mesh, x, z, taken: false, respawn: 0 });
  }
  return {
    pickups,
    gang: [],
    tracers: [],
    shootCooldown: 0,
    punchCooldown: 0,
    muzzle: 0,
  };
}

/** Spawn gang members (Rust Vultures) at a location for a shootout. */
export function spawnGang(game, x, z, n) {
  for (let i = 0; i < n; i++) {
    const mesh = buildGangMesh();
    const gx = x + (Math.random() - 0.5) * 14;
    const gz = z + (Math.random() - 0.5) * 14;
    mesh.position.set(gx, 0, gz);
    game.scene.add(mesh);
    game.combat.gang.push({ mesh, x: gx, z: gz, health: 60, shootTimer: 1 + Math.random() * 2 });
  }
}

/** Remove all gang members (mission cleared). */
export function clearGang(game) {
  for (const g of game.combat.gang) game.scene.remove(g.mesh);
  game.combat.gang = [];
}

/** A short-lived tracer line from the muzzle to a hit point. */
function spawnTracer(game, from, to) {
  const geom = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const line = new THREE.Line(geom, mat);
  game.scene.add(line);
  game.combat.tracers.push({ line, life: 0.09 });
}

/** Player punch: damages the nearest gang member / officer in range. */
export function tryPunch(game) {
  const c = game.combat;
  if (c.punchCooldown > 0 || game.player.inCar) return;
  c.punchCooldown = CONFIG.weapons.fists.cooldown;
  game.audio.playPunch();
  const px = game.player.pos.x;
  const pz = game.player.pos.z;
  const range = CONFIG.weapons.fists.range;
  const hit = (target, tx, tz) => {
    const d = Math.hypot(tx - px, tz - pz);
    if (d > range) return false;
    target.health -= CONFIG.weapons.fists.damage;
    return true;
  };
  for (const g of [...c.gang]) {
    if (hit(g, g.x, g.z) && g.health <= 0) {
      game.scene.remove(g.mesh);
      c.gang.splice(c.gang.indexOf(g), 1);
      game.player.cash += 25;
    }
  }
  for (const off of game.police.officers) {
    if (hit(off, off.x, off.z)) addWanted(game, 1);
  }
}

/** Player shoot: raycast from the camera through the crosshair. */
export function tryShoot(game) {
  const c = game.combat;
  if (c.shootCooldown > 0 || game.player.inCar) return;
  if (game.player.weapon !== 'pistol') return;
  if (game.player.ammo <= 0) {
    game.audio.playEmpty();
    c.shootCooldown = 0.3;
    return;
  }
  c.shootCooldown = CONFIG.weapons.pistol.cooldown;
  game.player.ammo -= 1;
  game.audio.playShot();
  game.combat.muzzle = 0.05;
  // ray from camera centre
  const origin = new THREE.Vector3();
  game.camera.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  game.camera.getWorldDirection(dir);
  const range = CONFIG.weapons.pistol.range;
  const end = origin.clone().add(dir.clone().multiplyScalar(range));
  // test gang members (as vertical capsules) and officers
  const ray = new THREE.Raycaster(origin, dir, 0.1, range);
  const targets = [];
  for (const g of c.gang) targets.push({ obj: g.mesh, kind: 'gang', ref: g });
  for (const off of game.police.officers) targets.push({ obj: off.mesh, kind: 'officer', ref: off });
  const hits = ray.intersectObjects(targets.map((t) => t.obj), true);
  let hitPoint = end;
  if (hits.length > 0) {
    hitPoint = hits[0].point;
    const hitObj = hits[0].object;
    const entry = targets.find((t) => t.obj === hitObj || t.obj.children?.includes(hitObj));
    // walk up to the group root
    let root = hitObj;
    while (root.parent && root.parent !== game.scene) root = root.parent;
    const target = targets.find((t) => t.obj === root);
    if (target) {
      if (target.kind === 'gang') {
        target.ref.health -= CONFIG.weapons.pistol.damage;
        if (target.ref.health <= 0) {
          game.scene.remove(target.ref.mesh);
          c.gang.splice(c.gang.indexOf(target.ref), 1);
          game.player.cash += 40;
        }
      } else {
        addWanted(game, 1);
        game.player.health = Math.max(0, game.player.health - 4);
      }
    }
  }
  spawnTracer(game, origin.clone().add(dir.clone().multiplyScalar(1.2)), hitPoint);
  // shooting in public raises heat
  if (game.police.wanted < 1) addWanted(game, 1);
}

/** Update combat: cooldowns, tracers, pickups, gang behaviour. */
export function updateCombat(game, dt) {
  const c = game.combat;
  c.shootCooldown = Math.max(0, c.shootCooldown - dt);
  c.punchCooldown = Math.max(0, c.punchCooldown - dt);
  c.muzzle = Math.max(0, c.muzzle - dt);
  // tracers fade
  for (const t of [...c.tracers]) {
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
    if (t.life <= 0) {
      game.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      c.tracers.splice(c.tracers.indexOf(t), 1);
    }
  }
  // pickups: spin, bob, collect
  for (const pk of c.pickups) {
    if (pk.taken) {
      pk.respawn -= dt;
      if (pk.respawn <= 0) {
        pk.taken = false;
        pk.mesh.visible = true;
      }
      continue;
    }
    pk.mesh.rotation.y += dt * 2;
    pk.mesh.position.y = 0.8 + Math.sin(game.elapsed * 2 + pk.x) * 0.15;
    const d = Math.hypot(game.player.pos.x - pk.x, game.player.pos.z - pk.z);
    if (d < 1.6 && !game.player.inCar) {
      pk.taken = true;
      pk.mesh.visible = false;
      pk.respawn = 25;
      if (pk.kind === 'health') game.player.health = Math.min(100, game.player.health + 30);
      if (pk.kind === 'armor') game.player.armor = Math.min(50, game.player.armor + 25);
      if (pk.kind === 'ammo') game.player.ammo += 12;
      if (pk.kind === 'cash') game.player.cash += 50;
      game.audio.playPickup();
    }
  }
  // gang members shoot back when the player is near
  for (const g of c.gang) {
    g.shootTimer -= dt;
    const d = Math.hypot(game.player.pos.x - g.x, game.player.pos.z - g.z);
    if (d < 40 && g.shootTimer <= 0) {
      g.shootTimer = 1.2 + Math.random() * 1.4;
      game.audio.playShot(true);
      const from = new THREE.Vector3(g.x, 1.4, g.z);
      const to = new THREE.Vector3(game.player.pos.x, 1.2, game.player.pos.z);
      spawnTracer(game, from, to);
      if (Math.random() < 0.45) {
        game.player.health = Math.max(0, game.player.health - 6);
        game.hud.flashDamage();
        if (game.player.health <= 0) game.die('Taken down by the Rust Vultures.');
      }
    }
    // face the player
    g.mesh.rotation.y = Math.atan2(game.player.pos.x - g.x, game.player.pos.z - g.z);
  }
  void W;
}
