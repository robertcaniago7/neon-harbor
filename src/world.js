// World: builds the whole game (renderer, city, physics, player, traffic, police,
// combat, missions, HUD) and steps it every frame. Screens and the camera live in
// main.js; this module owns the simulation.

import * as THREE from 'three';
import {
  PLAYER, CAR_MODELS, WEAPONS, WANTED, START_TIME, DAY_LENGTH, QUALITY,
  ROAD_XS, ROAD_ZS,
} from './config.js';
import { makeRng } from './random.js';
import { createCity } from './city.js';
import { createPhysics, createPlayerCar } from './physics.js';
import { buildPlayerCar, buildTrafficCar } from './vehicle3d.js';
import { buildCharacter } from './character.js';
import { createDayNight } from './daynight.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_ENTER, ACTION_INTERACT } from './input.js';
import { createTraffic, stepTraffic, createPeds, stepPeds, edgePoint } from './traffic.js';
import { createPolice, addWanted, stepPolice, disguiseDrop } from './police.js';
import { createCombat, spawnPickup, playerShoot, stepCombat } from './combat.js';
import {
  createMissionState, startMission, stepMissions, noteKill, objectiveText, currentMission,
} from './missions.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, clearSave, readBest, saveBest } from './save.js';

// Steering sign: flip after the driving playtest if D turns the car left.
// Positive steering value in cannon-es turns the front wheels left, so D (right)
// needs a negative value.
export const STEER_SIGN = -1;

const PIER_XS = [[146, 154], [181, 189], [211, 219]];

export function groundHeight(x, z) {
  for (const [x0, x1] of PIER_XS) {
    if (x >= x0 && x <= x1 && z >= 180 && z <= 232) return 0.3;
  }
  return 0;
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

export function createGame(canvas, opts = {}) {
  const seed = opts.seed ?? 20261119;
  const quality = QUALITY[opts.quality ?? 'high'] ?? QUALITY.high;
  const saved = opts.save ?? loadGame();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 900);

  const city = createCity(seed);
  scene.add(city.group);
  const physics = createPhysics(city.buildings);
  const daynight = createDayNight(scene, quality);
  const audio = createAudio();
  const input = createInput(canvas);
  const hud = createHud(city);
  const rng = makeRng(seed + 99);

  // --- player ---
  const char = buildCharacter({ shirt: 0x2a9d8f, pants: 0x22303e, hair: 0x1a1a1a });
  scene.add(char.group);
  const player = {
    pos: new THREE.Vector3(-25, 0, 25),
    heading: 0,
    health: PLAYER.health,
    armor: 0,
    cash: 150,
    weapon: 'fists',
    ammo: 0,
    ownsPistol: false,
    char,
    walkPhase: 0,
    punchCool: 0,
    shootCool: 0,
  };
  if (saved) {
    player.cash = saved.cash ?? 150;
    player.health = saved.health ?? 100;
    player.armor = saved.armor ?? 0;
    player.weapon = saved.weapon ?? 'fists';
    player.ammo = saved.ammo ?? 0;
    player.ownsPistol = saved.ownsPistol ?? false;
    if (saved.pos) player.pos.set(saved.pos.x, 0, saved.pos.z);
  }

  const ctx = {
    renderer, scene, camera, canvas, city, physics, daynight, audio, input, hud,
    player, rng, quality,
    parkedCars: [],
    playerCar: null, // {state, visual, model}
    traffic: null,
    peds: null,
    police: createPolice(),
    combat: createCombat(scene),
    missions: createMissionState(),
    time: 0,
    dayT: saved?.dayT ?? START_TIME,
    events: [],
    stats: { cashEarned: 0, kills: 0 },
    over: null,
    shake: 0,
    saveTimer: 0,
    camYaw: Math.PI * 0.75,
    camPitch: 0.35,
    camDist: 9,
    promptText: '',
    shotMode: false,
    best: readBest(),
  };
  if (saved?.missionIndex) ctx.missions.index = Math.min(saved.missionIndex, 5);

  ctx.traffic = createTraffic(city, scene, quality.traffic, seed + 11);
  ctx.peds = createPeds(city, scene, quality.peds, seed + 23);

  // --- parked cars around the city ---
  function spawnParkedCar(modelName, x, z, heading) {
    const model = CAR_MODELS.find((m) => m.name === modelName)
      ?? rng.pick(CAR_MODELS);
    // parked cars use the single merged mesh (no spinning wheels needed)
    const mesh = buildTrafficCar(model.color, { taxi: model.name === 'Neon Taxi' });
    const h = heading ?? rng.range(0, Math.PI * 2);
    mesh.position.set(x, groundHeight(x, z), z);
    mesh.rotation.y = h;
    scene.add(mesh);
    const car = { model, visual: mesh, pos: new THREE.Vector3(x, 0, z), heading: h };
    ctx.parkedCars.push(car);
    return car;
  }
  ctx.spawnParkedCar = spawnParkedCar;

  for (let i = 0; i < 10; i++) {
    const edge = rng.pick(city.roadGraph.edges);
    const dir = rng.chance(0.5) ? 1 : -1;
    const len = Math.hypot(edge.bx - edge.ax, edge.bz - edge.az);
    const p = edgePoint(edge, rng.range(5, len - 5), dir, 4.0);
    spawnParkedCar(rng.pick(CAR_MODELS).name, p.x, p.z, p.heading);
  }

  // --- pickups scattered around the map ---
  spawnPickup(ctx.combat, 'pistol', -20, 20);
  spawnPickup(ctx.combat, 'ammo', 30, -120);
  spawnPickup(ctx.combat, 'health', 75, 75);
  spawnPickup(ctx.combat, 'armor', -75, 25);
  spawnPickup(ctx.combat, 'cash', 175, 125);

  // --- helpers ---
  ctx.objectiveText = () => objectiveText(ctx.missions);
  ctx.hurtPlayer = (amount) => {
    if (ctx.over) return;
    const absorbed = Math.min(ctx.player.armor, amount);
    ctx.player.armor -= absorbed;
    ctx.player.health -= (amount - absorbed);
    ctx.shake = Math.max(ctx.shake, 0.35);
    if (ctx.player.health <= 0) {
      ctx.player.health = 0;
      gameOver(ctx, 'wasted');
    }
  };

  ctx.nearestParkedCar = (maxDist) => {
    let best = null;
    let bestD = maxDist;
    for (const car of ctx.parkedCars) {
      const d = Math.hypot(car.pos.x - ctx.player.pos.x, car.pos.z - ctx.player.pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  };

  function collideCircle(pos, r) {
    // buildings
    for (const b of city.buildings) {
      if (pos.x > b.minX - r && pos.x < b.maxX + r && pos.z > b.minZ - r && pos.z < b.maxZ + r) {
        const dxl = pos.x - (b.minX - r);
        const dxr = (b.maxX + r) - pos.x;
        const dzl = pos.z - (b.minZ - r);
        const dzr = (b.maxZ + r) - pos.z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) pos.x = b.minX - r;
        else if (m === dxr) pos.x = b.maxX + r;
        else if (m === dzl) pos.z = b.minZ - r;
        else pos.z = b.maxZ + r;
      }
    }
    // cars (parked + traffic + police) as circles
    const pushOut = (cx, cz, cr) => {
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d = Math.hypot(dx, dz);
      const min = cr + r;
      if (d < min && d > 0.001) {
        pos.x = cx + (dx / d) * min;
        pos.z = cz + (dz / d) * min;
      }
    };
    for (const car of ctx.parkedCars) pushOut(car.pos.x, car.pos.z, 2.2);
    for (const car of ctx.traffic.cars) pushOut(car.mesh.position.x, car.mesh.position.z, 2.2);
    for (const car of ctx.police.cars) pushOut(car.mesh.position.x, car.mesh.position.z, 2.2);
    // world bounds: beach at z<=204, piers to z<=230
    const onPier = PIER_XS.some(([x0, x1]) => pos.x >= x0 && pos.x <= x1);
    pos.x = Math.max(-238, Math.min(238, pos.x));
    pos.z = Math.max(-188, Math.min(onPier ? 230 : 204, pos.z));
  }

  function enterCar(parked) {
    const idx = ctx.parkedCars.indexOf(parked);
    if (idx >= 0) ctx.parkedCars.splice(idx, 1);
    scene.remove(parked.visual);
    const state = createPlayerCar(physics, parked.model, parked.pos.x, parked.pos.z, parked.heading);
    const visual = buildPlayerCar(parked.model.color, {
      taxi: parked.model.name === 'Neon Taxi',
      truck: parked.model.name === 'Mackerel Truck',
    });
    scene.add(visual.group);
    ctx.playerCar = { state, visual, model: parked.model };
    ctx.player.char.group.visible = false;
    // crime / disguise: stealing is a crime, but a fresh car can shake a tail
    const wasWanted = ctx.police.wanted;
    if (wasWanted > 0) {
      let nearest = Infinity;
      for (const car of ctx.police.cars) {
        nearest = Math.min(nearest, Math.hypot(
          car.mesh.position.x - ctx.player.pos.x, car.mesh.position.z - ctx.player.pos.z));
      }
      if (nearest > 50) {
        if (disguiseDrop(ctx.police, 'car')) hud.toast('They lost the car — heat dropping.');
      } else {
        addWanted(ctx.police, 1, { car: { model: parked.model.name, color: parked.model.color } });
        hud.toast('They saw you steal that car!');
      }
    } else {
      addWanted(ctx.police, 1, { car: { model: parked.model.name, color: parked.model.color } });
      hud.toast('You stole a car — the cops know it!');
    }
    audio.pickup();
  }

  function exitCar() {
    const car = ctx.playerCar;
    if (!car) return;
    const p = car.state.position();
    const h = car.state.heading();
    car.state.destroy();
    scene.remove(car.visual.group);
    ctx.playerCar = null;
    ctx.player.char.group.visible = true;
    const rightX = -Math.sin(h + Math.PI / 2);
    const rightZ = -Math.cos(h + Math.PI / 2);
    ctx.player.pos.set(p.x + rightX * 2.4, 0, p.z + rightZ * 2.4);
    collideCircle(ctx.player.pos, PLAYER.radius);
    ctx.player.pos.y = groundHeight(ctx.player.pos.x, ctx.player.pos.z);
    ctx.player.heading = h;
    spawnParkedCar(car.model.name, p.x, p.z, h);
    audio.engineOff();
  }
  ctx.enterCar = enterCar;
  ctx.exitCar = exitCar;

  function gameOver(ctx2, kind) {
    if (ctx2.over) return;
    ctx2.over = kind;
    saveBest(ctx2.player.cash);
    clearSave();
    ctx2.audio.siren(false);
    ctx2.audio.pad(false);
    ctx2.audio.engineOff();
    ctx2.audio.fail();
  }
  ctx.gameOver = (kind) => gameOver(ctx, kind);

  ctx.resetGame = () => {
    // in-place reset: fresh run, same renderer
    if (ctx.playerCar) {
      ctx.playerCar.state.destroy();
      scene.remove(ctx.playerCar.visual.group);
      ctx.playerCar = null;
    }
    for (const car of ctx.police.cars) scene.remove(car.mesh);
    for (const o of ctx.police.foot) scene.remove(o.char.group);
    ctx.police = createPolice();
    for (const e of ctx.combat.enemies) scene.remove(e.char.group);
    for (const p of ctx.combat.pickups) scene.remove(p.mesh);
    for (const t of ctx.combat.tracers) scene.remove(t.line);
    ctx.combat.enemies = [];
    ctx.combat.pickups = [];
    ctx.combat.tracers = [];
    if (ctx.missions.beacon) scene.remove(ctx.missions.beacon);
    ctx.missions = createMissionState();
    ctx.player.pos.set(-25, 0, 25);
    ctx.player.heading = 0;
    ctx.player.health = PLAYER.health;
    ctx.player.armor = 0;
    ctx.player.cash = 150;
    ctx.player.weapon = 'fists';
    ctx.player.ammo = 0;
    ctx.player.ownsPistol = false;
    ctx.player.char.group.visible = true;
    ctx.player.char.group.position.copy(ctx.player.pos);
    ctx.stats = { cashEarned: 0, kills: 0 };
    ctx.events = [];
    ctx.over = null;
    ctx.dayT = START_TIME;
    ctx.camYaw = Math.PI * 0.75;
    ctx.camPitch = 0.35;
    ctx.camDist = 9;
    spawnPickup(ctx.combat, 'pistol', -20, 20);
    spawnPickup(ctx.combat, 'ammo', 30, -120);
    spawnPickup(ctx.combat, 'health', 75, 75);
    spawnPickup(ctx.combat, 'armor', -75, 25);
  };

  ctx.saveNow = () => {
    saveGame({
      cash: Math.floor(ctx.player.cash),
      missionIndex: ctx.missions.index,
      health: ctx.player.health,
      armor: ctx.player.armor,
      weapon: ctx.player.weapon,
      ammo: ctx.player.ammo,
      ownsPistol: ctx.player.ownsPistol,
      pos: { x: ctx.player.pos.x, z: ctx.player.pos.z },
      dayT: ctx.dayT,
    });
  };

  return ctx;
}

// ---------------------------------------------------------------------------
// Per-frame step (only while playing)
// ---------------------------------------------------------------------------

export function stepGame(ctx, dt, acts) {
  const { input, audio } = ctx;
  ctx.time += dt;
  ctx.dayT = (ctx.dayT + dt / DAY_LENGTH) % 1;
  const focus = ctx.playerCar
    ? new THREE.Vector3(ctx.playerCar.state.position().x, 0, ctx.playerCar.state.position().z)
    : ctx.player.pos;
  const { nightFactor } = ctx.daynight.update(ctx.dayT, focus);
  ctx.city.facadeMat.emissiveIntensity = nightFactor * 0.9;
  ctx.city.neonPinkMat.emissiveIntensity = 0.4 + nightFactor * 2.2;
  ctx.city.neonCyanMat.emissiveIntensity = 0.4 + nightFactor * 2.2;
  ctx.city.neonAmberMat.emissiveIntensity = 0.4 + nightFactor * 2.2;
  ctx.city.lampMat.emissiveIntensity = 0.15 + nightFactor * 1.6;
  ctx.daynight.setSeaColor(ctx.city.seaMat, nightFactor);
  ctx.city.update(dt);

  // --- actions (consumed once) ---
  const actions = acts?.actions ?? 0;
  if (actions & ACTION_ENTER) {
    if (ctx.playerCar) ctx.exitCar();
    else {
      const near = ctx.nearestParkedCar(4.5);
      if (near) ctx.enterCar(near);
    }
  }
  if (actions & ACTION_CONFIRM) {
    if (!ctx.playerCar && !ctx.missions.active && currentMission(ctx.missions)) {
      startMission(ctx.missions, ctx);
    }
  }

  // --- camera look / zoom ---
  const look = input.takeLook();
  ctx.camYaw -= look.dx * 0.004;
  ctx.camPitch = THREE.MathUtils.clamp(ctx.camPitch + look.dy * 0.003, 0.08, 1.0);
  // pistol out = aim stance: flatten the camera so the crosshair (screen centre)
  // actually points at a standing enemy instead of the ground in front of Juno
  if (ctx.player.weapon === 'pistol' && !ctx.playerCar) {
    ctx.camPitch = THREE.MathUtils.lerp(ctx.camPitch, 0.12, Math.min(1, dt * 2));
  }
  const zoom = input.takeZoom();
  ctx.camDist = THREE.MathUtils.clamp(ctx.camDist + zoom * 0.01, 6, 16);

  // --- physics ---
  ctx.physics.world.step(1 / 60, dt, 3);

  // --- player: on foot or driving ---
  if (ctx.playerCar) stepDriving(ctx, dt);
  else stepOnFoot(ctx, dt, actions);

  // --- world life ---
  stepTraffic(ctx.traffic, ctx.city, dt, ctx.player.pos);
  stepPeds(ctx.peds, ctx.city, dt, ctx.player.pos);
  stepPolice(ctx.police, ctx, dt);
  stepCombat(ctx.combat, ctx, dt);
  stepMissions(ctx.missions, ctx, dt);

  // --- events ---
  drainEvents(ctx);

  // --- prompt ---
  if (ctx.playerCar) ctx.promptText = 'F — exit car';
  else {
    const near = ctx.nearestParkedCar(4.5);
    if (near) ctx.promptText = `F — steal ${near.model.name}`;
    else if (!ctx.missions.active && currentMission(ctx.missions)) {
      ctx.promptText = `Enter — start job: ${currentMission(ctx.missions).title}`;
    } else ctx.promptText = '';
  }

  // --- siren + save ---
  let nearestCop = Infinity;
  for (const car of ctx.police.cars) {
    nearestCop = Math.min(nearestCop, Math.hypot(
      car.mesh.position.x - ctx.player.pos.x, car.mesh.position.z - ctx.player.pos.z));
  }
  audio.siren(ctx.police.wanted > 0 && nearestCop < 45);
  ctx.saveTimer += dt;
  if (ctx.saveTimer > 5) {
    ctx.saveTimer = 0;
    ctx.saveNow();
  }

  ctx.hud.update(ctx, dt);
}

function stepOnFoot(ctx, dt, actions) {
  const { player, input, audio } = ctx;
  const mv = input.moveVector();
  const sprint = input.sprint;
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (mv.x !== 0 || mv.y !== 0) {
    const fx = -Math.sin(ctx.camYaw);
    const fz = -Math.cos(ctx.camYaw);
    const rx = -fz;
    const rz = fx;
    let mx = fx * mv.y + rx * mv.x;
    let mz = fz * mv.y + rz * mv.x;
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    player.heading = angleLerp(player.heading, Math.atan2(-mx, -mz), dt * 12);
    player.pos.x += mx * speed * dt;
    player.pos.z += mz * speed * dt;
    player.walkPhase += dt * speed * 2.4;
    player.char.setWalk(player.walkPhase, 1);
    // camera follows behind the walk direction
    ctx.camYaw = angleLerp(ctx.camYaw, player.heading, dt * 0.9);
  } else {
    player.char.setWalk(player.walkPhase, 0);
  }
  collideCircleAt(ctx, player.pos, PLAYER.radius);
  const gy = groundHeight(player.pos.x, player.pos.z);
  player.pos.y += (gy - player.pos.y) * Math.min(1, dt * 10);
  player.char.group.position.copy(player.pos);
  player.char.group.rotation.y = player.heading;
  player.char.setArmed(player.weapon === 'pistol');

  // punch
  player.punchCool -= dt;
  if ((actions & ACTION_INTERACT) && player.punchCool <= 0) {
    player.punchCool = PLAYER.punchCooldown;
    audio.punch();
    const fx = -Math.sin(player.heading);
    const fz = -Math.cos(player.heading);
    for (const e of [...ctx.combat.enemies]) {
      const dx = e.pos.x - player.pos.x;
      const dz = e.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < PLAYER.punchRange && (dx * fx + dz * fz) / (d || 1) > 0.2) {
        e.health -= PLAYER.punchDamage;
        if (e.health <= 0) {
          ctx.combat.scene.remove(e.char.group);
          ctx.combat.enemies.splice(ctx.combat.enemies.indexOf(e), 1);
          spawnPickup(ctx.combat, 'cash', e.pos.x, e.pos.z);
          ctx.stats.kills += 1;
          ctx.events.push('enemyDown');
        }
      }
    }
  }

  // shoot (hold mouse / SHOOT button)
  player.shootCool -= dt;
  if (player.weapon === 'pistol' && input.mouse.down && player.shootCool <= 0) {
    if (player.ammo <= 0) {
      player.shootCool = 0.4;
      ctx.hud.toast('Out of ammo — find ammo');
    } else {
      player.shootCool = WEAPONS.pistol.cooldown;
      player.ammo -= 1;
      audio.shoot();
      const ndcX = (input.mouse.x / ctx.canvas.clientWidth) * 2 - 1;
      const ndcY = -(input.mouse.y / ctx.canvas.clientHeight) * 2 + 1;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), ctx.camera);
      const origin = player.pos.clone().setY(1.5);
      const dir = ray.ray.direction.clone();
      const target = origin.clone().addScaledVector(dir, WEAPONS.pistol.range);
      player.heading = Math.atan2(-dir.x, -dir.z);
      playerShoot(ctx.combat, ctx, origin, target);
      ctx.shake = Math.max(ctx.shake, 0.12);
    }
  }
}

function stepDriving(ctx, dt) {
  const car = ctx.playerCar;
  const { input, audio } = ctx;
  const mv = input.moveVector();
  const fwd = car.state.forward();
  const v = car.state.chassis.velocity;
  const forwardSpeed = v.x * fwd.x + v.y * fwd.y + v.z * fwd.z;
  let throttle = mv.y;
  let brake = 0;
  if (input.brake) {
    brake = 1;
    throttle = 0;
  } else if (throttle < 0 && forwardSpeed > 1) {
    // S while moving forward = brake first
    brake = 1;
    throttle = 0;
  }
  car.state.setInput(throttle, mv.x * STEER_SIGN, brake);
  car.state.update();
  // sync the visual car to the physics chassis
  const p = car.state.chassis.position;
  const q = car.state.chassis.quaternion;
  car.visual.group.position.set(p.x, p.y, p.z);
  car.visual.group.quaternion.set(q.x, q.y, q.z, q.w);
  // wheels: front pivots steer, all spin with the road
  const steer = car.state.steer;
  car.visual.wheels[2].pivot.rotation.y = steer;
  car.visual.wheels[3].pivot.rotation.y = steer;
  const spin = (forwardSpeed * dt) / 0.36;
  for (const w of car.visual.wheels) w.wheel.rotation.x -= spin;
  // player state follows the car
  ctx.player.pos.set(p.x, p.y, p.z);
  ctx.player.heading = car.state.heading();
  audio.engine(Math.min(1, Math.abs(forwardSpeed) / 30));
  // camera swings behind the car
  ctx.camYaw = angleLerp(ctx.camYaw, ctx.player.heading, dt * 2.2);
  ctx.camDist = THREE.MathUtils.lerp(ctx.camDist, 12, dt * 1.5);
}

function collideCircleAt(ctx, pos, r) {
  // same collision as the module-level helper, bound to this ctx
  for (const b of ctx.city.buildings) {
    if (pos.x > b.minX - r && pos.x < b.maxX + r && pos.z > b.minZ - r && pos.z < b.maxZ + r) {
      const dxl = pos.x - (b.minX - r);
      const dxr = (b.maxX + r) - pos.x;
      const dzl = pos.z - (b.minZ - r);
      const dzr = (b.maxZ + r) - pos.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) pos.x = b.minX - r;
      else if (m === dxr) pos.x = b.maxX + r;
      else if (m === dzl) pos.z = b.minZ - r;
      else pos.z = b.maxZ + r;
    }
  }
  const pushOut = (cx, cz, cr) => {
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d = Math.hypot(dx, dz);
    const min = cr + r;
    if (d < min && d > 0.001) {
      pos.x = cx + (dx / d) * min;
      pos.z = cz + (dz / d) * min;
    }
  };
  for (const car of ctx.parkedCars) pushOut(car.pos.x, car.pos.z, 2.2);
  for (const car of ctx.traffic.cars) pushOut(car.mesh.position.x, car.mesh.position.z, 2.2);
  for (const car of ctx.police.cars) pushOut(car.mesh.position.x, car.mesh.position.z, 2.2);
  const onPier = PIER_XS.some(([x0, x1]) => pos.x >= x0 && pos.x <= x1);
  pos.x = Math.max(-238, Math.min(238, pos.x));
  pos.z = Math.max(-188, Math.min(onPier ? 230 : 204, pos.z));
}

function drainEvents(ctx) {
  const { audio, hud } = ctx;
  while (ctx.events.length) {
    const ev = ctx.events.shift();
    if (ev === 'ram') {
      ctx.shake = Math.max(ctx.shake, 0.5);
      audio.punch();
    } else if (ev === 'busted') {
      ctx.gameOver('busted');
    } else if (ev === 'cooled') {
      hud.toast('Heat cooling off — one star lost.');
    } else if (ev === 'enemyDown') {
      noteKill(ctx.missions);
    } else if (ev === 'shotCar') {
      addWanted(ctx.police, 1);
      hud.toast('Witnesses called the cops!');
    } else if (ev === 'shotPolice') {
      addWanted(ctx.police, 2);
      hud.toast('You shot a cop!');
    } else if (ev.startsWith('pickup:')) {
      const kind = ev.slice(7);
      if (kind === 'cash') audio.cash();
      else audio.pickup();
      if (kind === 'pistol') hud.toast('Got the HK-9 pistol — press 2 to equip, click to shoot.');
    } else if (ev.startsWith('missionStart:')) {
      const m = currentMission(ctx.missions);
      hud.toast(m ? m.briefing : ev.slice(13));
    } else if (ev.startsWith('missionDone:')) {
      const [, title, reward] = ev.split(':');
      hud.toast(`Job done: ${title} — $${reward}`);
    } else if (ev === 'storyDone') {
      hud.toast('Story complete — Neon Harbor is yours, Juno.');
      saveBest(ctx.player.cash);
    }
  }
}

// re-export for main.js / shots.js
export { loadGame, clearSave };
