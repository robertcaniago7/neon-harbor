// Neon Harbor 3D — world.js
// Wires everything: scene, loop, update order, game state. The player walks
// or drives, police chase, missions advance, and the HUD + minimap follow.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, PLAYER, CAR_PHYSICS, CAR_MODELS, WEAPONS, WANTED, COUNTS, QUALITY, START_TIME, DAY_LENGTH } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { buildCarMesh, animateCarWheels } from './vehicle3d.js';
import { buildCharacterMesh, animateWalk, randomOutfit } from './character.js';
import { createPhysicsWorld, createPlayerVehicle, stepPhysics } from './physics.js';
import { createDayNight } from './daynight.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, loadBest, writeBest } from './save.js';
import { parseShotQuery } from './shots.js';

export function createWorld(opts = {}) {
  const canvas = opts.canvas || document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const quality = opts.lowQuality ? QUALITY.low : QUALITY.high;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ec5f0);
  scene.fog = new THREE.Fog(0xa8c8e8, 60, quality.fogFar);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(PLAYER.startX + 8, 6, PLAYER.startZ + 10);

  const city = buildCity(scene);
  const daynight = createDayNight(scene);
  const traffic = createTraffic(scene);
  const police = createPolice(scene);
  const combat = createCombat(scene);
  const missions = createMissions();
  const hud = createHud();
  const audio = createAudio();
  const beacon = hud.createBeacon(scene);
  const physics = createPhysicsWorld();

  const rng = makeRng(2026);

  // --- player ---
  const playerMesh = buildCharacterMesh({ isPlayer: true, shirt: 0xff2d95 });
  playerMesh.position.set(PLAYER.startX, 0, PLAYER.startZ);
  scene.add(playerMesh);

  const player = {
    x: PLAYER.startX,
    z: PLAYER.startZ,
    yaw: 0,
    health: PLAYER.health,
    armor: PLAYER.armor,
    cash: PLAYER.startCash,
    weapon: 0, // 0 fists, 1 pistol
    ammo: WEAPONS.pistol.ammo,
    inCar: false,
    car: null, // { mesh, model, vehicle }
    carModel: null,
    walkPhase: 0,
    punchCd: 0,
    shootCd: 0,
    dead: false,
    arrested: false,
    onRam(dx, dz) {
      this.x += dx * 1.5;
      this.z += dz * 1.5;
      this.damage(6);
    },
    onArrest() {
      if (this.arrested || this.dead) return;
      this.arrested = true;
      this.cash = Math.max(0, this.cash - 200);
      police.dropStars(2);
      this.arrested = false;
    },
    damage(amount) {
      if (this.dead) return;
      let left = amount;
      if (this.armor > 0) {
        const absorbed = Math.min(this.armor, left * 0.6);
        this.armor -= absorbed;
        left -= absorbed;
      }
      this.health -= left;
      if (this.health <= 0) {
        this.health = 0;
        this.dead = true;
      }
    },
  };

  // --- pedestrians (14): wander the sidewalks ---
  const pedestrians = [];
  for (let i = 0; i < COUNTS.pedestrians; i++) {
    const mesh = buildCharacterMesh(randomOutfit(rng));
    const x = rng.range(-220, 220);
    const z = rng.range(-170, 170);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    pedestrians.push({
      mesh, x, z,
      dir: rng.range(0, Math.PI * 2),
      speed: rng.range(1.0, 1.8),
      phase: rng.range(0, 6),
      retarget: rng.range(2, 6),
    });
  }

  // --- pickups scattered around the city ---
  combat.spawnPickup('health', -75, 75);
  combat.spawnPickup('armor', 125, -25);
  combat.spawnPickup('ammo', -25, -125);
  combat.spawnPickup('cash', 175, 75);
  combat.spawnPickup('health', 25, 125);
  for (const p of combat.pickups) {
    p.onTake = (kind) => {
      if (kind === 'health') player.health = Math.min(100, player.health + 40);
      if (kind === 'armor') player.armor = Math.min(50, player.armor + 25);
      if (kind === 'ammo') player.ammo += 24;
      if (kind === 'cash') { player.cash += 150; audio.cashSound(); }
      if (kind !== 'cash') audio.uiClick();
    };
  }

  // --- time ---
  let timeOfDay = START_TIME;
  let elapsed = 0;

  // --- camera orbit ---
  let camYaw = 0.6;
  let camPitch = 0.32;
  let camDist = 11;

  // --- shot staging (screenshots) ---
  const shot = parseShotQuery(window.location.search);
  let shotMode = false;
  if (shot.def) {
    shotMode = true;
    timeOfDay = shot.def.time;
    player.x = shot.def.player.x;
    player.z = shot.def.player.z;
    player.yaw = shot.def.player.yaw;
    if (shot.def.player.wanted) {
      police.state.stars = shot.def.player.wanted;
    }
    if (shot.def.player.weapon) player.weapon = shot.def.player.weapon;
    if (shot.def.player.enemies) {
      for (let i = 0; i < shot.def.player.enemies; i++) {
        combat.spawnEnemy(player.x + 6 + i * 4, player.z + 4 + i * 3);
      }
    }
    if (shot.def.player.inCar) {
      const model = CAR_MODELS[shot.def.player.carModel || 5];
      enterCarAt(model, player.x, player.z, player.yaw);
    }
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.yaw;
    camera.position.set(shot.def.camera.x, shot.def.camera.y, shot.def.camera.z);
    camera.lookAt(shot.def.camera.lookX, shot.def.camera.lookY, shot.def.camera.lookZ);
    // police cars visible in the cover shot
    if (shot.def.player.wanted >= 3) {
      for (let i = 0; i < 2; i++) {
        const m = buildCarMesh({ color: 0x22303e }, true);
        m.position.set(player.x - 14 - i * 8, 0, player.z + 10 + i * 4);
        m.rotation.y = 0.5;
        scene.add(m);
      }
    }
  }

  function enterCarAt(model, x, z, yaw) {
    const mesh = buildCarMesh(model);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    scene.add(mesh);
    const vehicle = createPlayerVehicle(physics, model);
    vehicle.reset(x, z, yaw);
    player.car = { mesh, model, vehicle };
    player.carModel = model;
    player.inCar = true;
    playerMesh.visible = false;
    audio.engineStart();
  }

  function exitCar() {
    if (!player.car) return;
    const v = player.car.vehicle;
    player.x = v.chassis.position.x + Math.sin(player.yaw) * 2.5;
    player.z = v.chassis.position.z + Math.cos(player.yaw) * 2.5;
    scene.remove(player.car.mesh);
    player.car = null;
    player.carModel = null;
    player.inCar = false;
    playerMesh.visible = true;
    playerMesh.position.set(player.x, 0, player.z);
    audio.engineStop();
  }

  function tryEnterCar() {
    if (player.inCar) { exitCar(); return; }
    const parked = traffic.nearestParked(player.x, player.z, 4.5);
    if (!parked) return;
    parked.taken = true;
    parked.mesh.visible = false;
    const model = parked.model;
    enterCarAt(model, parked.x, parked.z, parked.yaw);
    // stealing a car in front of police raises heat
    if (police.state.stars > 0) police.addHeat(0.4);
    else if (rng.chance(0.3)) police.addHeat(0.34);
    audio.uiClick();
  }

  // --- save / restore ---
  const saved = loadSave();
  if (saved && !shotMode) {
    player.cash = saved.cash;
    player.health = saved.health;
    player.armor = saved.armor;
    timeOfDay = saved.time;
    missions.state.current = saved.mission;
  }
  let bestCash = loadBest();
  let saveTimer = 0;

  function doSave() {
    writeSave({ mission: missions.state.current, cash: player.cash, health: player.health, armor: player.armor, time: timeOfDay });
    bestCash = writeBest(player.cash);
  }

  // --- main loop ---
  let last = performance.now();
  let running = true;
  let paused = false;
  let frameCount = 0;

  function step(now) {
    if (!running) return;
    requestAnimationFrame(step);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (paused) return;
    elapsed += dt;
    frameCount += 1;

    // day/night
    timeOfDay = (timeOfDay + dt / DAY_LENGTH) % 1;
    const dn = daynight.update(timeOfDay, quality.fogFar);

    // input
    const input = opts.input ? opts.input.poll() : null;
    if (input) {
      camYaw -= input.lookDX * 0.004;
      camPitch = THREE.MathUtils.clamp(camPitch + input.lookDY * 0.003, 0.08, 1.1);
      if (input.pause) paused = !paused;
      if (input.mute) audio.setMuted(!audio.muted);
      if (input.enterCar) tryEnterCar();
      if (input.startJob && !missions.state.active) {
        const m = missions.startNext(elapsed);
        if (m) {
          audio.uiClick();
          if (m.type === 'fight') {
            for (let i = 0; i < (m.enemies || 3); i++) {
              combat.spawnEnemy(m.target.x + rng.range(-8, 8), m.target.z + rng.range(-8, 8));
            }
          }
        }
      }
      if (input.weaponSlot !== undefined) player.weapon = input.weaponSlot;
      if (input.punch && player.punchCd <= 0 && !player.inCar) {
        player.punchCd = WEAPONS.fists.cooldown;
        const dir = { x: Math.sin(player.yaw), z: Math.cos(player.yaw) };
        const hit = combat.punch({ x: player.x, z: player.z }, dir);
        audio.punch();
        if (hit && police.state.stars < 2) police.addHeat(0.34);
      }
      if ((input.shoot || input.shootHeld) && player.shootCd <= 0 && !player.inCar && player.weapon === 1 && player.ammo > 0) {
        player.shootCd = WEAPONS.pistol.cooldown;
        player.ammo -= 1;
        const from = new THREE.Vector3(player.x, 1.5, player.z);
        // aim with the player yaw so shooting follows where you face
        const aimYaw = player.yaw;
        const dir = new THREE.Vector3(Math.sin(aimYaw), 0, Math.cos(aimYaw)).normalize();
        const hit = combat.shoot(from, dir, WEAPONS.pistol.range);
        audio.gunshot();
        police.addHeat(0.5);
        if (hit) player.cash += 25;
      }
    }
    player.punchCd = Math.max(0, player.punchCd - dt);
    player.shootCd = Math.max(0, player.shootCd - dt);

    // --- movement ---
    if (!player.dead) {
      if (player.inCar && player.car) {
        const v = player.car.vehicle;
        const fwd = input ? input.throttle : 0;
        const steer = input ? input.steer * CAR_PHYSICS.maxSteer : 0;
        const speed = v.speedMs();
        const engine = fwd * CAR_PHYSICS.maxEngineForce * player.car.model.speed;
        v.drive(engine, steer);
        if (input && input.brake) v.brake(CAR_PHYSICS.maxBrakeForce);
        else v.brake(0);
        // soft speed cap
        if (speed > CAR_PHYSICS.maxSpeed) {
          const s = CAR_PHYSICS.maxSpeed / speed;
          v.chassis.velocity.x *= s;
          v.chassis.velocity.z *= s;
        }
        stepPhysics(physics, dt);
        const pos = v.chassis.position;
        player.x = pos.x;
        player.z = pos.z;
        const f = v.forward();
        player.yaw = f.yaw;
        player.car.mesh.position.set(pos.x, pos.y - 0.35, pos.z);
        player.car.mesh.rotation.y = f.yaw;
        animateCarWheels(player.car.mesh, steer, speed * dt);
        audio.engineSet(Math.min(1, speed / CAR_PHYSICS.maxSpeed), true);
        // waypoint progress while driving
        checkMissionProgress();
      } else {
        const moveSpeed = input && input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
        let mx = 0;
        let mz = 0;
        if (input) {
          const sin = Math.sin(camYaw);
          const cos = Math.cos(camYaw);
          mx = (input.strafe * cos - input.forward * sin) * moveSpeed;
          mz = (input.strafe * sin + input.forward * cos) * moveSpeed;
        }
        player.x += mx * dt;
        player.z += mz * dt;
        player.x = THREE.MathUtils.clamp(player.x, WORLD.xMin, WORLD.xMax);
        player.z = THREE.MathUtils.clamp(player.z, WORLD.zMin, WORLD.zMax);
        if (mx !== 0 || mz !== 0) {
          player.yaw = Math.atan2(mx, mz);
          player.walkPhase += dt * moveSpeed * 1.6;
          animateWalk(playerMesh, player.walkPhase, input && input.sprint ? 1.4 : 1);
        }
        playerMesh.position.set(player.x, 0, player.z);
        playerMesh.rotation.y = player.yaw;
        checkMissionProgress();
      }
    }

    // --- pedestrians wander ---
    for (const ped of pedestrians) {
      ped.retarget -= dt;
      if (ped.retarget <= 0) {
        ped.retarget = rng.range(3, 8);
        ped.dir = rng.range(0, Math.PI * 2);
      }
      ped.x += Math.sin(ped.dir) * ped.speed * dt;
      ped.z += Math.cos(ped.dir) * ped.speed * dt;
      ped.x = THREE.MathUtils.clamp(ped.x, WORLD.xMin, WORLD.xMax);
      ped.z = THREE.MathUtils.clamp(ped.z, WORLD.zMin, WORLD.zMax);
      ped.phase += dt * ped.speed * 1.6;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.dir;
      animateWalk(ped.mesh, ped.phase, 0.7);
    }

    // --- traffic, police, combat ---
    traffic.update(dt, { x: player.x, z: player.z });
    police.update(dt, player, player.inCar);
    combat.update(dt, { x: player.x, z: player.z }, (dmg) => {
      if (!player.inCar) player.damage(dmg);
    });

    // --- missions: waypoint + beacon ---
    const m = missions.currentMission();
    if (m && missions.state.active) {
      beacon.set(m.target.x, m.target.z, true);
    } else {
      beacon.set(0, 0, false);
    }

    // --- autosave ---
    saveTimer += dt;
    if (saveTimer > 10) {
      saveTimer = 0;
      if (!shotMode) doSave();
    }

    // --- camera (third person, not in shot mode) ---
    if (!shotMode) {
      const targetX = player.x - Math.sin(camYaw) * camDist;
      const targetZ = player.z - Math.cos(camYaw) * camDist;
      const targetY = 4.5 + Math.sin(camPitch) * 6;
      camera.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 1 - Math.pow(0.001, dt));
      camera.lookAt(player.x, 1.6, player.z);
    }

    // --- HUD ---
    hud.update({
      cash: player.cash,
      health: player.health,
      armor: player.armor,
      weapon: player.weapon === 1 ? `HK-9 [${player.ammo}]` : 'FISTS',
      speedKmh: player.car ? player.car.vehicle.speedKmh() : 0,
      inCar: player.inCar,
      stars: police.state.stars,
      time: timeOfDay,
      objective: missions.objectiveText(),
      waypoint: m && missions.state.active ? m.target : null,
      police: police.cars.map((c) => ({ x: c.x, z: c.z })),
      player: { x: player.x, z: player.z, yaw: player.yaw },
    });

    renderer.render(scene, camera);
  }

  function checkMissionProgress() {
    const m = missions.currentMission();
    if (!m || !missions.state.active) return;
    const d = Math.hypot(player.x - m.target.x, player.z - m.target.z);
    if (m.type === 'fight') {
      if (combat.aliveCount() === 0 && d < 25) {
        const reward = missions.complete();
        player.cash += reward;
        audio.cashSound();
      }
      return;
    }
    if (m.type === 'steal') {
      if (player.inCar && player.carModel && player.carModel.name === 'Harbor Coupe' && d < 12) {
        const reward = missions.complete();
        player.cash += reward;
        audio.cashSound();
      }
      return;
    }
    if (d < 10) {
      const reward = missions.complete();
      player.cash += reward;
      audio.cashSound();
    }
  }

  function start() {
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    audio.resume();
    audio.startAmbient();
    requestAnimationFrame(step);
  }

  function stop() {
    running = false;
  }

  function getState() {
    return {
      player: { x: player.x, z: player.z, health: player.health, cash: player.cash, inCar: player.inCar },
      stars: police.state.stars,
      mission: missions.state.current,
      time: timeOfDay,
      parked: traffic.parked.length,
      traffic: traffic.moving.length,
      peds: pedestrians.length,
      frames: frameCount,
      shot: shot.name,
    };
  }

  return {
    scene, camera, renderer, player, police, traffic, combat, missions, hud, audio,
    start, stop, getState, enterCarAt, exitCar, doSave,
    get paused() { return paused; },
    set paused(v) { paused = v; },
  };
}
