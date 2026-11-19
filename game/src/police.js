// Neon Harbor 3D — wanted level, police interceptors (pursuit + ram), foot
// officers, arrest. Police cars chase along the road graph; officers join at
// three stars and arrest you up close.

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { buildCarMesh } from './vehicle3d.js';
import { buildOfficerMesh } from './character.js';
import { nodeIJ, nodePos, nearestNode, bfsPath } from './city.js';

const W = CONFIG.world;

/** Create the police state: wanted level, cars, officers. */
export function createPolice(game) {
  return {
    wanted: 0,
    noSightTimer: 0,
    cars: [],
    officers: [],
    sirenOn: false,
  };
}

/** Raise the wanted level (clamped to the max). */
export function addWanted(game, n) {
  const p = game.police;
  const before = p.wanted;
  p.wanted = Math.min(CONFIG.wanted.max, p.wanted + n);
  if (p.wanted !== before) game.hud.flashWanted();
  syncPolice(game);
}

/** Drop stars (laying low, or changing to an unseen car/outfit). */
export function dropWanted(game, n) {
  const p = game.police;
  p.wanted = Math.max(0, p.wanted - n);
  syncPolice(game);
}

/** Make sure the spawned police match the current wanted level. */
export function syncPolice(game) {
  const p = game.police;
  const wantCars = CONFIG.wanted.policeCarsPerStar[p.wanted] ?? 0;
  const wantOfficers = CONFIG.wanted.footOfficersPerStar[p.wanted] ?? 0;
  // spawn / remove police cars
  while (p.cars.length < wantCars) spawnPoliceCar(game);
  while (p.cars.length > wantCars) {
    const car = p.cars.pop();
    game.scene.remove(car.mesh);
  }
  // spawn / remove foot officers
  while (p.officers.length < wantOfficers) spawnOfficer(game);
  while (p.officers.length > wantOfficers) {
    const off = p.officers.pop();
    game.scene.remove(off.mesh);
  }
  p.sirenOn = p.wanted > 0;
}

function spawnPoliceCar(game) {
  const p = game.police;
  const model = CONFIG.policeCar;
  const mesh = buildCarMesh(model, { police: true });
  // spawn a couple of blocks away from the player, on a road
  const px = game.player.pos.x;
  const pz = game.player.pos.z;
  const node = nearestNode(px + (Math.random() < 0.5 ? -1 : 1) * 100, pz + (Math.random() < 0.5 ? -1 : 1) * 100);
  const pos = nodePos(node.ix, node.iz);
  mesh.position.set(pos.x, 0, pos.z);
  game.scene.add(mesh);
  p.cars.push({
    mesh,
    node: node.id,
    path: [],
    pathI: 0,
    speed: 13 * model.speed,
    ramCooldown: 0,
    lightPhase: Math.random() * Math.PI * 2,
  });
}

function spawnOfficer(game) {
  const p = game.police;
  const mesh = buildOfficerMesh();
  const a = Math.random() * Math.PI * 2;
  const d = 14 + Math.random() * 10;
  const x = game.player.pos.x + Math.cos(a) * d;
  const z = game.player.pos.z + Math.sin(a) * d;
  mesh.position.set(x, 0, z);
  game.scene.add(mesh);
  p.officers.push({ mesh, x, z, speed: 3.4, arrestTimer: 0 });
}

/** Distance from a police car to the player, and whether it can see the player. */
function policeSeesPlayer(game, car) {
  const dx = game.player.pos.x - car.mesh.position.x;
  const dz = game.player.pos.z - car.mesh.position.z;
  return Math.hypot(dx, dz) < 90;
}

/** Update police pursuit, ramming, officers, and wanted decay. */
export function updatePolice(game, dt) {
  const p = game.police;
  if (p.wanted === 0) {
    // cruise: police cars slowly return to the station area and despawn handled by sync
    return;
  }
  const playerNode = nearestNode(game.player.pos.x, game.player.pos.z);
  let anySight = false;
  for (const car of p.cars) {
    // staged (screenshot) cars hold their pose; they do not pursue
    if (car.staged) continue;
    if (policeSeesPlayer(game, car)) anySight = true;
    // re-path every couple of seconds toward the player's node
    car.repath = (car.repath ?? 0) - dt;
    if (car.repath <= 0 || car.path.length === 0) {
      const from = nearestNode(car.mesh.position.x, car.mesh.position.z);
      car.path = bfsPath(game.city.graph, from.id, playerNode.id);
      car.pathI = 0;
      car.repath = 2 + Math.random();
    }
    // follow the path
    const targetId = car.path[Math.min(car.pathI + 1, car.path.length - 1)];
    const tij = nodeIJ(targetId);
    const tx = W.roadX[tij.ix];
    const tz = W.roadZ[tij.iz];
    const dx = tx - car.mesh.position.x;
    const dz = tz - car.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 6) {
      car.pathI = Math.min(car.pathI + 1, car.path.length - 1);
    }
    // close to the player: ram straight at them
    const pdx = game.player.pos.x - car.mesh.position.x;
    const pdz = game.player.pos.z - car.mesh.position.z;
    const pdist = Math.hypot(pdx, pdz);
    let mx;
    let mz;
    if (pdist < 26) {
      mx = pdx / (pdist || 1);
      mz = pdz / (pdist || 1);
    } else {
      mx = dx / (dist || 1);
      mz = dz / (dist || 1);
    }
    const speed = car.speed * (pdist < 26 ? 1.25 : 1);
    car.mesh.position.x += mx * speed * dt;
    car.mesh.position.z += mz * speed * dt;
    car.mesh.rotation.y = Math.atan2(mx, mz);
    // ram: damage + push the player when very close
    car.ramCooldown -= dt;
    if (pdist < 3.2 && car.ramCooldown <= 0) {
      car.ramCooldown = 1.2;
      game.player.health = Math.max(0, game.player.health - 8);
      game.audio.playHit();
      game.hud.flashDamage();
      if (game.player.health <= 0) game.die('Busted by Harbor PD.');
    }
    // light bar flash (swap emissive via a cheap scale pulse on the bar is skipped;
    // the siren sound carries it)
    car.lightPhase += dt * 10;
  }
  // foot officers walk at the player; arrest up close
  for (const off of p.officers) {
    const dx = game.player.pos.x - off.x;
    const dz = game.player.pos.z - off.z;
    const d = Math.hypot(dx, dz) || 1;
    off.x += (dx / d) * off.speed * dt;
    off.z += (dz / d) * off.speed * dt;
    off.mesh.position.set(off.x, 0, off.z);
    off.mesh.rotation.y = Math.atan2(dx, dz);
    if (d < 2.0) {
      off.arrestTimer += dt;
      if (off.arrestTimer > 1.2) {
        game.die('Arrested by Harbor PD.');
        off.arrestTimer = 0;
      }
    } else {
      off.arrestTimer = 0;
    }
  }
  // wanted decay: no police line of sight for decaySec -> lose one star
  if (!anySight) {
    p.noSightTimer += dt;
    if (p.noSightTimer >= CONFIG.wanted.decaySec) {
      p.noSightTimer = 0;
      dropWanted(game, 1);
    }
  } else {
    p.noSightTimer = 0;
  }
  // siren ambience
  if (p.sirenOn) game.audio.siren(dt);
}
