// Neon Harbor 3D — wires everything: scene, loop, update order, game state.

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { createSky, updateDayNight } from './daynight.js';
import { createPhysicsWorld, addBuildingBody, createPlayerVehicle, drivePlayerCar, syncCarMesh } from './physics.js';
import { createInput } from './input.js';
import { createTraffic, updateTraffic, nearestParkedCar } from './traffic.js';
import { createPolice, updatePolice, addWanted, dropWanted } from './police.js';
import { createCombat, updateCombat, tryShoot, tryPunch, spawnGang } from './combat.js';
import { createMissions, startMission, updateMissions } from './missions.js';
import { createHud, updateHud, bindHudHelpers } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame, saveBest, loadBest } from './save.js';
import { buildPlayerMesh, buildCharacterMesh } from './character.js';
import { buildCarMesh } from './vehicle3d.js';

const W = CONFIG.world;

/** Create 14 pedestrians wandering the sidewalks. */
function createPeds(game, seed = 11) {
  const rng = makeRng(seed);
  const peds = [];
  const shirts = [0xd96a5f, 0x5f8fd9, 0x7ac74f, 0xe8b13f, 0x9b7ede, 0xd9a066, 0x6ec6c6, 0xc77e6a];
  const pants = [0x2f333a, 0x3a3f47, 0x4a3f35, 0x2b2f36];
  for (let i = 0; i < CONFIG.counts.peds; i++) {
    const mesh = buildCharacterMesh({
      shirt: rng.pick(shirts),
      pants: rng.pick(pants),
      skin: rng.pick([0xd9a066, 0xc98d5f, 0x8a5a3b, 0xe8b88a]),
      hair: rng.pick([0x2b2118, 0x14100c, 0x4a3a28, 0x6b6b6b]),
    });
    // start on a sidewalk near a road
    const rx = rng.pick(W.roadX);
    const rz = rng.pick(W.roadZ);
    const x = rx + (rng.chance(0.5) ? 1 : -1) * (W.roadWidth / 2 + 1.5);
    const z = rz + rng.range(-40, 40);
    mesh.position.set(x, 0, z);
    game.scene.add(mesh);
    peds.push({
      mesh,
      x, z,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.0, 1.8),
      turnTimer: rng.range(2, 6),
      bob: rng.range(0, Math.PI * 2),
    });
  }
  return peds;
}

/** Advance pedestrians: wander the sidewalks, turn at random. */
function updatePeds(game, dt) {
  for (const ped of game.peds) {
    ped.turnTimer -= dt;
    if (ped.turnTimer <= 0) {
      ped.turnTimer = 2 + Math.random() * 5;
      ped.heading += (Math.random() - 0.5) * Math.PI * 1.2;
    }
    let nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
    let nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
    // keep inside the world and out of buildings (cheap AABB push-out)
    nx = Math.max(W.xMin + 2, Math.min(W.xMax - 2, nx));
    nz = Math.max(W.zMin + 2, Math.min(W.zMax - 2, nz));
    let blocked = false;
    for (const b of game.city.buildings) {
      if (nx > b.minX - 0.5 && nx < b.maxX + 0.5 && nz > b.minZ - 0.5 && nz < b.maxZ + 0.5) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      ped.heading += Math.PI / 2;
    } else {
      ped.x = nx;
      ped.z = nz;
    }
    ped.bob += dt * ped.speed * 4;
    ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.bob)) * 0.05, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}

/** True when a point (x, z) is inside a building AABB (expanded by radius). */
function hitsBuilding(game, x, z, radius) {
  for (const b of game.city.buildings) {
    if (x > b.minX - radius && x < b.maxX + radius && z > b.minZ - radius && z < b.maxZ + radius) return true;
  }
  return false;
}

/**
 * Create the game. opts: { canvas, seed, quality ('high'|'low'), shot }.
 * Returns the game object (also exposed as window.__neonHarbor for debugging).
 */
export function createWorld(opts = {}) {
  const canvas = opts.canvas ?? document.getElementById('game-canvas');
  const quality = CONFIG.quality[opts.quality ?? 'high'] ?? CONFIG.quality.high;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.palette.skyDay);
  scene.fog = new THREE.Fog(CONFIG.palette.fogDay, 60, quality.fogFar);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(-25, 6, 40);

  const game = {
    renderer, scene, camera, canvas,
    state: 'title',
    paused: false,
    time: CONFIG.day.startTime,
    elapsed: 0,
    seed: opts.seed ?? 1,
    quality,
    freezeTime: false,
    shotMode: false,
    shotCamera: null,
    bestCash: loadBest(),
    camYaw: Math.PI,
    camPitch: 0.32,
    camDist: 8,
  };

  // ---- world pieces ----
  game.sky = createSky(scene);
  game.sky.sun.shadow.mapSize.set(quality.shadow, quality.shadow);
  game.city = buildCity(scene, game.seed);
  game.phys = createPhysicsWorld();
  for (const b of game.city.buildings) addBuildingBody(game.phys, b);

  // ---- player ----
  const saved = loadGame();
  game.player = {
    mesh: buildPlayerMesh(),
    pos: new THREE.Vector3(CONFIG.player.startX, 0, CONFIG.player.startZ),
    heading: 0,
    health: saved?.health ?? CONFIG.player.health,
    armor: CONFIG.player.armor,
    cash: saved?.cash ?? CONFIG.player.startCash,
    weapon: 'pistol',
    ammo: CONFIG.weapons.pistol.ammo,
    inCar: false,
    car: null,
    speed: 0,
  };
  game.player.mesh.position.copy(game.player.pos);
  scene.add(game.player.mesh);
  game.playerCar = null;

  // ---- systems ----
  game.traffic = createTraffic(game, game.seed + 6);
  game.peds = createPeds(game, game.seed + 10);
  game.police = createPolice(game);
  game.combat = createCombat(game);
  game.missions = createMissions(game);
  if (saved && saved.missionIndex > 0) {
    game.missions.index = Math.min(saved.missionIndex, CONFIG.missions.length - 1);
    game.missions.label = `Welcome back. Next job: ${CONFIG.missions[game.missions.index].name}. Press Enter.`;
  }
  game.hud = createHud(game);
  bindHudHelpers(game);
  game.audio = createAudio();
  game.input = createInput(canvas);

  // ---- car enter / exit ----
  game.enterCar = (parked) => {
    if (game.player.inCar || !parked) return false;
    const { vehicle, chassisBody } = createPlayerVehicle(game.phys, parked.model);
    chassisBody.position.set(parked.x, 1.0, parked.z);
    chassisBody.quaternion.setFromEuler(0, parked.heading, 0);
    const mesh = parked.mesh;
    game.scene.add(mesh);
    game.playerCar = { vehicle, chassisBody, mesh, model: parked.model };
    game.player.inCar = true;
    game.player.car = parked;
    parked.stolen = true;
    game.player.mesh.visible = false;
    game.audio.playCar();
    // changing to a (possibly unseen) car drops heat
    dropWanted(game, CONFIG.wanted.unseenDrop);
    return true;
  };
  game.exitCar = () => {
    if (!game.player.inCar || !game.playerCar) return;
    const { chassisBody, mesh } = game.playerCar;
    const x = chassisBody.position.x;
    const z = chassisBody.position.z;
    const heading = game.player.heading;
    // put the car back as a parked car where it stopped
    const parked = game.player.car;
    parked.stolen = false;
    parked.x = x;
    parked.z = z;
    parked.heading = heading;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    // place the player beside the car
    game.player.pos.set(x + Math.sin(heading + Math.PI / 2) * 2.2, 0, z + Math.cos(heading + Math.PI / 2) * 2.2);
    game.player.mesh.position.copy(game.player.pos);
    game.player.mesh.visible = true;
    // remove the physics vehicle (this also removes its chassis body)
    game.playerCar.vehicle.removeFromWorld(game.phys.world);
    game.playerCar = null;
    game.player.inCar = false;
    game.player.car = null;
    game.audio.engineStop();
  };

  // ---- death / game over ----
  game.die = (reason) => {
    if (game.state === 'dead') return;
    game.state = 'dead';
    game.deathReason = reason;
    game.audio.engineStop();
    saveGame(game);
    if (game.onDeath) game.onDeath(reason);
  };

  game.save = () => saveGame(game);
  game.saveBest = () => saveBest(game);

  // ---- resize ----
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return game;
}

/** Move the player on foot (kinematic, with building collision). */
function movePlayerOnFoot(game, dt) {
  const input = game.input;
  const p = game.player;
  const speed = input.sprint ? CONFIG.player.sprintSpeed : CONFIG.player.walkSpeed;
  // movement relative to camera yaw: forward is away from the camera,
  // right is 90 degrees clockwise from forward (facing south, right is west)
  const sin = Math.sin(game.camYaw);
  const cos = Math.cos(game.camYaw);
  const mx = input.moveX;
  const mz = input.moveZ;
  const dx = (-sin * mz + cos * mx) * speed * dt;
  const dz = (-cos * mz - sin * mx) * speed * dt;
  if (dx === 0 && dz === 0) {
    p.speed = 0;
    return;
  }
  const r = CONFIG.player.radius;
  const nx = p.pos.x + dx;
  const nz = p.pos.z + dz;
  // try full move, then slide along each axis
  if (!hitsBuilding(game, nx, nz, r)) {
    p.pos.x = nx;
    p.pos.z = nz;
  } else if (!hitsBuilding(game, nx, p.pos.z, r)) {
    p.pos.x = nx;
  } else if (!hitsBuilding(game, p.pos.x, nz, r)) {
    p.pos.z = nz;
  }
  p.pos.x = Math.max(W.xMin + 1, Math.min(W.xMax - 1, p.pos.x));
  p.pos.z = Math.max(W.zMin + 1, Math.min(W.zMax - 1, p.pos.z));
  p.heading = Math.atan2(dx, dz);
  p.speed = speed;
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.heading;
  // walk bob
  p.mesh.position.y = Math.abs(Math.sin(game.elapsed * 9)) * 0.06;
}

/** Update the third-person camera (or the shot camera when set). */
function updateCamera(game, dt) {
  const cam = game.camera;
  if (game.shotCamera) {
    cam.position.copy(game.shotCamera.pos);
    cam.lookAt(game.shotCamera.lookAt);
    return;
  }
  const input = game.input;
  const { dx, dy } = input.consumeCamera();
  game.camYaw -= dx * 0.004;
  game.camPitch = Math.max(0.08, Math.min(1.1, game.camPitch + dy * 0.003));
  const target = game.player.inCar && game.playerCar
    ? game.playerCar.mesh.position
    : game.player.pos;
  const dist = game.player.inCar ? 11 : 8;
  const height = game.player.inCar ? 4.2 : 3.1;
  const cx = target.x + Math.sin(game.camYaw) * Math.cos(game.camPitch) * dist;
  const cz = target.z + Math.cos(game.camYaw) * Math.cos(game.camPitch) * dist;
  const cy = target.y + height + Math.sin(game.camPitch) * dist * 0.6;
  // smooth follow
  const k = 1 - Math.exp(-10 * dt);
  cam.position.x += (cx - cam.position.x) * k;
  cam.position.y += (cy - cam.position.y) * k;
  cam.position.z += (cz - cam.position.z) * k;
  cam.lookAt(target.x, target.y + 1.4, target.z);
}

/** One fixed update step. */
export function update(game, dt) {
  game.elapsed += dt;
  const input = game.input;
  input.poll();

  if (game.state === 'playing' && !game.paused) {
    // day / night
    if (!game.freezeTime) updateDayNight(game, dt);
    else updateDayNight(game, 0);

    // one-shot actions
    if (input.jobPressed) startMission(game);
    if (input.punchPressed) tryPunch(game);
    if (input.shootHeld) tryShoot(game);
    if (input.interactPressed) {
      if (game.player.inCar) game.exitCar();
      else {
        const car = nearestParkedCar(game, game.player.pos.x, game.player.pos.z, 4);
        if (car) game.enterCar(car);
      }
    }
    if (input.mutePressed) game.audio.setMuted(!game.audio.muted);

    // player
    if (game.player.inCar && game.playerCar) {
      drivePlayerCar(game, dt);
      game.phys.world.step(1 / 60, dt, 3);
      syncCarMesh(game.playerCar.mesh, game.playerCar.chassisBody);
      const v = game.playerCar.vehicle.chassisBody.velocity;
      game.player.pos.set(game.playerCar.mesh.position.x, 0, game.playerCar.mesh.position.z);
      const speed01 = Math.min(1, v.length() / CONFIG.car.maxSpeed);
      game.audio.engine(speed01, true);
    } else {
      movePlayerOnFoot(game, dt);
      game.phys.world.step(1 / 60, dt, 3);
      game.audio.engine(0, false);
    }

    updateTraffic(game, dt);
    updatePeds(game, dt);
    updatePolice(game, dt);
    updateCombat(game, dt);
    updateMissions(game, dt);
  }

  if (input.pausePressed && game.state === 'playing') {
    game.paused = !game.paused;
    if (game.onPause) game.onPause(game.paused);
  }
  input.consumePresses();

  updateHud(game, dt);
  updateCamera(game, dt);
  game.renderer.render(game.scene, game.camera);
}

/** Start the render loop. */
export function run(game) {
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(game, dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// Re-export helpers the shot staging uses.
export { spawnGang };
