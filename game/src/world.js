// World: wires everything together — scene, loop, update order, game state.
// Player on foot (character mesh) or in a car (cannon-es RaycastVehicle).
// Pedestrians, missions, wanted, HUD and save all live here.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRng } from './random.js';
import { buildCity } from './city.js';
import { createDayNight } from './daynight.js';
import { createPhysics } from './physics.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHUD } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { buildCharacterMesh, buildPlayerMesh } from './character.js';
import { buildCarMesh } from './vehicle3d.js';
import { loadSave, writeSave } from './save.js';
import { getShotParams, applyShot } from './shots.js';

const P = CONFIG.player;

export function createWorld(canvas, opts = {}) {
  const seed = opts.seed || 1;
  const quality = opts.lowQuality ? CONFIG.quality.low : CONFIG.quality.high;
  const rng = createRng(seed);

  // ---- renderer / scene / camera ------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

  // ---- subsystems ----------------------------------------------------
  const city = buildCity(scene, rng);
  const daynight = createDayNight(scene, renderer);
  const physics = createPhysics();
  const traffic = createTraffic(scene, city.roadGraph, rng, quality);
  const police = createPolice(scene, city.roadGraph, rng);
  const combat = createCombat(scene, rng);
  const missions = createMissions(scene);
  const hud = createHUD();
  const audio = createAudio();
  const input = createInput(canvas, { onAction: handleAction });

  // ---- player --------------------------------------------------------
  const playerMesh = buildPlayerMesh();
  const player = {
    mesh: playerMesh.group,
    parts: playerMesh.parts,
    pos: new THREE.Vector3(P.startX, 0, P.startZ),
    heading: 0,
    vel: new THREE.Vector3(),
    health: P.health,
    armor: P.armor,
    cash: P.startCash,
    weapon: 'pistol',
    inCar: false,
    carRecord: null,
    carMesh: null,
    walkPhase: 0,
    moving: false,
    punchAnim: 0,
    missionIndex: 0,
    hasPackage: false,
    kills: 0,
  };
  player.mesh.position.copy(player.pos);
  scene.add(player.mesh);

  // Restore a save if one exists.
  const saved = loadSave();
  if (saved) {
    player.cash = saved.cash;
    player.health = saved.health;
    player.missionIndex = saved.mission;
  }

  // ---- pedestrians ---------------------------------------------------
  const peds = [];
  function spawnPed() {
    const { group, parts } = buildCharacterMesh({ rng });
    scene.add(group);
    const road = rng.pick(CONFIG.roadX);
    const along = rng.range(-170, 170);
    const side = rng.chance(0.5) ? 1 : -1;
    const vertical = rng.chance(0.5);
    const ped = {
      mesh: group, parts,
      x: vertical ? road + side * 6.2 : rng.pick(CONFIG.roadX) + side * 6.2,
      z: vertical ? along : rng.pick(CONFIG.roadZ) + side * 6.2,
      heading: 0,
      speed: rng.range(1.1, 1.9),
      walkPhase: rng.next() * 6,
      vertical,
      dir: rng.chance(0.5) ? 1 : -1,
      turnTimer: rng.range(4, 12),
    };
    ped.mesh.position.set(ped.x, 0, ped.z);
    peds.push(ped);
    return ped;
  }
  for (let i = 0; i < quality.peds; i++) spawnPed();

  // ---- camera --------------------------------------------------------
  const cam = {
    yaw: Math.PI,
    pitch: 0.32,
    dist: 9,
    height: 3.2,
    shot: null,
  };

  // ---- state ---------------------------------------------------------
  let state = 'title';
  let paused = false;
  let gameOver = false;
  let won = false;
  let saveTimer = 0;
  let elapsed = 0;
  let speedMps = 0;
  const clock = new THREE.Clock();
  let rafId = 0;
  let disposed = false;

  // Mission 2 needs the Harbor Coupe parked at the docks.
  const coupeModel = CONFIG.carModels.find((m) => m.name === 'Harbor Coupe');
  const coupeSpot = traffic.placeSpecial(coupeModel, 178, 118, Math.PI * 0.5);

  // ---- helpers -------------------------------------------------------
  function clampToWorld(v) {
    v.x = Math.max(CONFIG.world.minX + 2, Math.min(CONFIG.world.maxX - 2, v.x));
    v.z = Math.max(CONFIG.world.minZ + 2, Math.min(CONFIG.world.maxZ - 2, v.z));
    return v;
  }

  function damagePlayer(amount) {
    if (state !== 'playing' || gameOver) return;
    let remaining = amount;
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, remaining);
      player.armor -= absorbed;
      remaining -= absorbed;
    }
    player.health -= remaining;
    hud.setHealth(player.health);
    hud.setArmor(player.armor);
    if (player.health <= 0) {
      player.health = 0;
      setGameOver(false);
    }
  }

  function setGameOver(didWin) {
    gameOver = true;
    won = didWin;
    state = 'gameover';
    if (onGameOver) onGameOver(didWin);
  }

  function healPlayer(n) {
    player.health = Math.min(P.health, player.health + n);
    hud.setHealth(player.health);
  }

  function giveArmor(n) {
    player.armor = Math.min(P.armor, player.armor + n);
    hud.setArmor(player.armor);
  }

  // ---- car enter / exit ----------------------------------------------
  function enterCar() {
    if (player.inCar || state !== 'playing') return;
    const near = traffic.nearestParked(player.pos.x, player.pos.z, 4.5);
    if (!near) return;
    near.taken = true;
    player.carRecord = near;
    player.carMesh = near.mesh;
    scene.remove(player.mesh);
    const heading = near.heading;
    physics.createPlayerCar(near.x, near.z, heading);
    player.inCar = true;
    audio.startEngine();
    hud.showMessage('Stole the ' + near.model.name + ' — drive!');
    if (missions.current === 1 && near.special) {
      missions.setStage(1);
      missions.showObjective(125, 75, 0xffb020);
      hud.setMission('Stolen Coupe', 'Bring the coupe to the garage.');
    }
  }

  function exitCar() {
    if (!player.inCar) return;
    const v = new THREE.Vector3();
    physics.carPosition(v);
    const heading = physics.carHeading();
    physics.removePlayerCar();
    audio.stopEngine();
    // Park the car where it stopped.
    if (player.carRecord) {
      player.carRecord.x = v.x;
      player.carRecord.z = v.z;
      player.carRecord.heading = heading;
      player.carRecord.taken = false;
      player.carRecord.mesh.position.set(v.x, 0, v.z);
      player.carRecord.mesh.rotation.y = heading;
    }
    player.carRecord = null;
    player.carMesh = null;
    player.inCar = false;
    // Step out to the side of the car.
    const sideX = v.x + Math.cos(heading) * 2.2;
    const sideZ = v.z - Math.sin(heading) * 2.2;
    player.pos.set(sideX, 0, sideZ);
    player.heading = heading;
    player.mesh.position.copy(player.pos);
    scene.add(player.mesh);
    // Losing the cops' line of sight by switching cars drops heat.
    police.loseTrail();
  }

  function putPlayerInCar(modelName) {
    const model = CONFIG.carModels.find((m) => m.name === modelName) || CONFIG.carModels[0];
    const { group } = buildCarMesh(model);
    scene.add(group);
    group.position.set(player.pos.x, 0, player.pos.z);
    group.rotation.y = player.heading;
    const rec = {
      mesh: group, model, x: player.pos.x, z: player.pos.z,
      heading: player.heading, taken: true, special: false,
    };
    traffic.parked.push(rec);
    player.carRecord = rec;
    player.carMesh = group;
    scene.remove(player.mesh);
    physics.createPlayerCar(player.pos.x, player.pos.z, player.heading);
    player.inCar = true;
  }

  function setPlayerPose(x, z, heading) {
    player.pos.set(x, 0, z);
    player.heading = heading;
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = heading;
  }

  function setWeapon(name) {
    if (name === 'fists' || name === 'pistol') {
      player.weapon = name;
      hud.setWeapon(CONFIG.weapons[name].name, name === 'pistol' ? combat.getAmmo() : Infinity);
    }
  }

  function setCameraShot(shotCam) {
    cam.shot = shotCam;
  }

  // ---- actions -------------------------------------------------------
  function handleAction(action) {
    if (state !== 'playing') return;
    if (action === 'enterCar') {
      if (player.inCar) exitCar();
      else enterCar();
    } else if (action === 'punch') {
      if (!player.inCar) {
        const hit = combat.punch(player.pos, player.heading, () => {});
        if (hit) {
          audio.punch();
          player.punchAnim = 0.25;
          player.kills += 0; // punch kills counted in mission update
        }
      }
    } else if (action === 'shoot') {
      if (!player.inCar && player.weapon === 'pistol') {
        const fired = combat.shoot(player.pos, player.heading, () => {});
        if (fired) {
          audio.gunshot();
          police.addWanted(1, player.pos);
          hud.setWeapon('HK-9 Pistol', combat.getAmmo());
        }
      }
    } else if (action === 'weapon1') setWeapon('fists');
    else if (action === 'weapon2') setWeapon('pistol');
    else if (action === 'mute') audio.setMuted(!audio.isMuted());
    else if (action === 'pause') {
      if (onPause) onPause();
    } else if (action === 'job') {
      startNextMission();
    }
  }

  function startNextMission() {
    if (missions.current >= 0) return;
    if (player.missionIndex >= CONFIG.missions.length) {
      hud.showMessage('All jobs done — you run Neon Harbor now.');
      return;
    }
    const def = missions.start(player.missionIndex);
    if (!def) return;
    hud.setMission(def.name, def.brief);
    hud.showMessage('New job: ' + def.name + ' — ' + def.brief);
    audio.uiClick();
    if (def.kind === 'fight') {
      const spots = def.name === 'Dockside Fight'
        ? [[168, 118], [182, 128], [172, 132], [186, 116]]
        : [[-132, -82], [-118, -68], [-128, -64], [-114, -80]];
      for (const s of spots) combat.spawnGang(s[0], s[1]);
    }
  }

  function completeMission() {
    const reward = missions.complete();
    player.cash += reward;
    player.missionIndex++;
    hud.setCash(player.cash);
    hud.showMessage('Job done! +$' + reward);
    audio.missionDone();
    audio.cashSound();
    writeSave({
      mission: player.missionIndex, cash: player.cash,
      health: player.health, best: player.cash, completed: [],
    });
    if (missions.isDone() || player.missionIndex >= CONFIG.missions.length) {
      hud.setMission('All jobs done', 'Neon Harbor is yours, Juno.');
      setGameOver(true);
    } else {
      hud.setMission('Free roam', 'Press Enter to start the next job.');
    }
  }

  // ---- mission progress ----------------------------------------------
  function updateMissions(dt) {
    const cur = missions.getCurrent();
    if (!cur) return;
    const obj = missions.getObjectivePos();
    if (!obj) return;
    const dx = player.pos.x - obj.x;
    const dz = player.pos.z - obj.z;
    const dist = Math.hypot(dx, dz);
    if (cur.kind === 'drive' || cur.kind === 'escape') {
      if (dist < 6) completeMission();
    } else if (cur.kind === 'steal') {
      if (missions.stage === 1 && dist < 6) completeMission();
    } else if (cur.kind === 'deliver') {
      if (missions.stage === 0 && dist < 5) {
        missions.setStage(1);
        player.hasPackage = true;
        missions.showObjective(175, 205, 0xffb020);
        hud.setMission('Hot Package', 'Deliver the package to the pier — police are watching.');
        police.addWanted(2, player.pos);
      } else if (missions.stage === 1 && dist < 6) {
        player.hasPackage = false;
        completeMission();
      }
    } else if (cur.kind === 'fight') {
      if (combat.aliveEnemies() === 0 && missions.killsNeeded > 0) {
        completeMission();
      }
    }
  }

  // ---- per-frame updates ----------------------------------------------
  function updatePlayerOnFoot(dt) {
    const inputState = input.poll();
    const look = input.consumeLook();
    cam.yaw -= look.dx * 0.004;
    cam.pitch = Math.max(0.05, Math.min(1.1, cam.pitch + look.dy * 0.003));

    const speed = input.state.sprint ? P.sprint : P.walk;
    const mx = inputState.moveX;
    const my = inputState.moveY;
    player.moving = Math.abs(mx) > 0.05 || Math.abs(my) > 0.05;
    if (player.moving) {
      // Movement is relative to the camera yaw.
      const sin = Math.sin(cam.yaw);
      const cos = Math.cos(cam.yaw);
      const wx = (mx * cos - my * sin) * speed * dt;
      const wz = (mx * sin + my * cos) * speed * dt;
      player.pos.x += wx;
      player.pos.z += wz;
      clampToWorld(player.pos);
      const targetHeading = Math.atan2(wx, wz);
      let diff = targetHeading - player.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      player.heading += diff * Math.min(1, dt * 12);
      player.walkPhase += dt * speed * 1.6;
      const swing = Math.sin(player.walkPhase) * (input.state.sprint ? 0.7 : 0.5);
      player.parts.armL.rotation.x = swing;
      player.parts.armR.rotation.x = -swing;
      player.parts.legL.rotation.x = -swing;
      player.parts.legR.rotation.x = swing;
    } else {
      player.parts.armL.rotation.x *= 0.85;
      player.parts.armR.rotation.x *= 0.85;
      player.parts.legL.rotation.x *= 0.85;
      player.parts.legR.rotation.x *= 0.85;
    }
    if (player.punchAnim > 0) {
      player.punchAnim -= dt;
      player.parts.armR.rotation.x = -1.5;
    }
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.heading;
    speedMps = player.moving ? speed : 0;
  }

  function updatePlayerInCar(dt) {
    const inputState = input.poll();
    const look = input.consumeLook();
    cam.yaw -= look.dx * 0.004;
    cam.pitch = Math.max(0.05, Math.min(1.1, cam.pitch + look.dy * 0.003));

    // Steering is relative to the car's heading, not the camera.
    const throttle = inputState.moveY;
    const steer = -inputState.moveX;
    const braking = input.state.brake || (throttle < 0 && speedMps > 1);
    const model = player.carRecord ? player.carRecord.model : CONFIG.carModels[0];
    speedMps = physics.drive(throttle * model.speed, steer * model.grip, braking);
    physics.step(dt);

    const v = new THREE.Vector3();
    physics.carPosition(v);
    const heading = physics.carHeading();
    player.pos.set(v.x, 0, v.z);
    player.heading = heading;
    clampToWorld(player.pos);
    if (player.carMesh) {
      player.carMesh.position.set(v.x, v.y - 0.55, v.z);
      const e = new THREE.Euler();
      const q = physics.chassisBody.quaternion;
      e.setFromQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
      player.carMesh.rotation.set(e.x, e.y, e.z);
      const wheels = player.carMesh.userData.wheels;
      if (wheels) {
        const w = speedMps * dt / 0.36;
        wheels.forEach((wh) => { wh.rotation.x += w; });
        wheels[0].rotation.y = steer * 0.4;
        wheels[1].rotation.y = steer * 0.4;
      }
    }
    audio.setEngine(Math.min(1, Math.abs(speedMps) / CONFIG.car.maxSpeed), true);
  }

  function updatePeds(dt) {
    for (const ped of peds) {
      ped.turnTimer -= dt;
      if (ped.turnTimer <= 0) {
        ped.turnTimer = rng.range(5, 14);
        ped.dir *= -1;
        if (rng.chance(0.3)) {
          ped.vertical = !ped.vertical;
          const road = ped.vertical ? rng.pick(CONFIG.roadX) : rng.pick(CONFIG.roadZ);
          if (ped.vertical) ped.x = road + (ped.dir > 0 ? 6.2 : -6.2);
          else ped.z = road + (ped.dir > 0 ? 6.2 : -6.2);
        }
      }
      const step = ped.speed * dt * ped.dir;
      if (ped.vertical) {
        ped.z += step;
        if (ped.z > 175) { ped.z = 175; ped.dir = -1; }
        if (ped.z < -175) { ped.z = -175; ped.dir = 1; }
        ped.heading = ped.dir > 0 ? 0 : Math.PI;
      } else {
        ped.x += step;
        if (ped.x > 225) { ped.x = 225; ped.dir = -1; }
        if (ped.x < -225) { ped.x = -225; ped.dir = 1; }
        ped.heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      ped.walkPhase += dt * ped.speed * 2.4;
      const swing = Math.sin(ped.walkPhase) * 0.45;
      ped.parts.armL.rotation.x = swing;
      ped.parts.armR.rotation.x = -swing;
      ped.parts.legL.rotation.x = -swing;
      ped.parts.legR.rotation.x = swing;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }

  function updateCamera(dt) {
    if (cam.shot) {
      const s = cam.shot;
      const a = cam.yaw + s.angle;
      const tx = player.pos.x;
      const tz = player.pos.z;
      camera.position.set(
        tx - Math.sin(a) * s.dist,
        s.height,
        tz - Math.cos(a) * s.dist,
      );
      camera.lookAt(tx, 1.4, tz);
      return;
    }
    const targetYaw = cam.yaw;
    const tx = player.pos.x - Math.sin(targetYaw) * cam.dist;
    const tz = player.pos.z - Math.cos(targetYaw) * cam.dist;
    const ty = cam.height + Math.sin(cam.pitch) * cam.dist * 0.5;
    camera.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(1, dt * 8));
    camera.lookAt(player.pos.x, 1.6, player.pos.z);
  }

  function updateHUD() {
    hud.setCash(player.cash);
    hud.setHealth(player.health);
    hud.setArmor(player.armor);
    hud.setWeapon(
      player.weapon === 'pistol' ? 'HK-9 Pistol' : 'Fists',
      player.weapon === 'pistol' ? combat.getAmmo() : Infinity,
    );
    hud.setSpeed(speedMps, player.inCar);
    hud.setWanted(police.wanted);
    const cur = missions.getCurrent();
    if (!cur) {
      hud.setMission('Free roam', 'Press Enter to start the next job.');
    }
    hud.drawMinimap({
      player: { x: player.pos.x, z: player.pos.z, heading: player.heading, inCar: player.inCar },
      objective: missions.getObjectivePos(),
      police: police.cars.map((c) => ({ x: c.x, z: c.z })),
      traffic: traffic.moving.slice(0, 8).map((c) => ({ x: c.x, z: c.z })),
    });
  }

  // ---- main loop ------------------------------------------------------
  function frame() {
    if (disposed) return;
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    elapsed += dt;

    if (state === 'playing' && !paused && !gameOver) {
      const dn = daynight.update(dt, quality);
      city.windowMat.emissiveIntensity = 0.25 + (1 - dn.daylight) * 0.9;
      city.windowMat.color.setHex(dn.daylight > 0.5 ? CONFIG.colors.windowDay : CONFIG.colors.windowNight);
      city.seaMat.color.setHex(dn.seaColor);
      city.neonMat.opacity = 0.55 + dn.neonLevel * 0.45;

      if (player.inCar) updatePlayerInCar(dt);
      else updatePlayerOnFoot(dt);

      traffic.update(dt, player.pos);
      const policeRes = police.update(dt, player.pos, player.inCar, () => setGameOver(false));
      if (policeRes.siren) audio.sirenBlip();
      if (policeRes.rammed) {
        damagePlayer(6);
        audio.crash();
        if (player.inCar) speedMps *= 0.4;
      }
      combat.update(dt, player.pos, player.heading, damagePlayer);

      // Pickups.
      const taken = combat.collect(player.pos);
      for (const t of taken) {
        if (t.kind === 'health') healPlayer(t.value);
        else if (t.kind === 'armor') giveArmor(t.value);
        else if (t.kind === 'ammo') {
          combat.addAmmo(t.value);
          hud.showMessage('Picked up +' + t.value + ' ammo');
        } else if (t.kind === 'cash') {
          player.cash += t.value;
          hud.setCash(player.cash);
          audio.cashSound();
        }
      }

      updateMissions(dt);
      updatePeds(dt);
      updateHUD();

      // Autosave every 10 s.
      saveTimer += dt;
      if (saveTimer > 10) {
        saveTimer = 0;
        writeSave({
          mission: player.missionIndex, cash: player.cash,
          health: player.health, best: player.cash, completed: [],
        });
      }
    } else if (state === 'title') {
      // Slow orbit around downtown behind the title screen.
      const t = elapsed * 0.05;
      camera.position.set(Math.sin(t) * 120, 55, Math.cos(t) * 120);
      camera.lookAt(0, 10, 0);
      daynight.update(dt, quality);
    }

    updateCamera(dt);
    renderer.render(scene, camera);
  }

  // ---- public API -----------------------------------------------------
  let onGameOver = null;
  let onPause = null;

  function start() {
    state = 'playing';
    paused = false;
    gameOver = false;
    audio.resume();
    audio.startAmbient();
    hud.setCash(player.cash);
    hud.setHealth(player.health);
    hud.setArmor(player.armor);
    hud.setWeapon('HK-9 Pistol', combat.getAmmo());
    hud.setWanted(0);
    hud.setMission('Free roam', 'Press Enter to start the next job.');
    clock.getDelta();
    if (!rafId) frame();
  }

  function pause(v) {
    paused = v;
    if (v) audio.stopEngine();
  }

  function getState() {
    return {
      state,
      playerX: Math.round(player.pos.x * 10) / 10,
      playerZ: Math.round(player.pos.z * 10) / 10,
      health: Math.round(player.health),
      cash: Math.round(player.cash),
      wanted: police.wanted,
      mission: player.missionIndex,
      parkedCars: traffic.parked.filter((c) => !c.taken).length,
      trafficCars: traffic.moving.length,
      peds: peds.length,
      inCar: player.inCar,
      time: daynight.getTime(),
    };
  }

  function getPlayer() {
    return player;
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('resize', resize);

  // Shot mode: jump straight into the staged scene (no title screen).
  const shotParams = getShotParams();
  let shotStaging = null;
  if (shotParams.shot) {
    state = 'playing';
    shotStaging = applyShot({
      daynight,
      setPlayerPose,
      putPlayerInCar,
      setWeapon,
      police,
      combat,
      setCameraShot,
    }, shotParams.shot);
  }

  // Start the render loop immediately (title orbit until start() is called).
  frame();

  function dispose() {
    disposed = true;
    cancelAnimationFrame(rafId);
    input.dispose();
    window.removeEventListener('resize', resize);
    renderer.dispose();
  }

  return {
    start, pause, getState, getPlayer, dispose,
    setPlayerPose, putPlayerInCar, setWeapon, setCameraShot,
    scene, camera, renderer, player, police, combat, missions, traffic, hud, audio, daynight,
    get shotStaging() { return shotStaging; },
    set onGameOver(fn) { onGameOver = fn; },
    set onPause(fn) { onPause = fn; },
    get isPaused() { return paused; },
    get isGameOver() { return gameOver; },
    get didWin() { return won; },
  };
}

export default createWorld;
