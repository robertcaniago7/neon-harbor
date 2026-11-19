// Neon Harbor's world: one state, one step. It owns the player, the traffic, the peds,
// the police, the gang, the missions and the wanted level, and turns input into events
// the main loop announces and the renderer draws.

import { STEP, WORLD, CAR, CAR_MODELS, POLICE_CAR, WANTED, MISSION_REWARD, PLAYER } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { makeCar, pickModel, driveCar, collideCars, stepTraffic, stepPoliceCar, collideWorldCar } from './vehicles.js';
import { makePed, stepPeds, makeOfficer, stepOfficers, wantedFootCount } from './peds.js';
import { createCombat, fireBullet, explode, stepBullets, spawnPickup } from './combat.js';
import { createPlayer, stepPlayerOnFoot, aimAt, hurtPlayer, healPlayer, giveWeapon, weaponOf } from './player.js';
import { createMissionState, currentMission, currentStep, missionLabel } from './missions.js';
import { MISSIONS } from './missions.js';

const TRAFFIC_TARGET = 14;
const PED_TARGET = 26;
const ENEMY_SPEED = 150;

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = createCity(seed);
  const player = createPlayer(1500, 200);
  const combat = createCombat();
  const state = {
    seed, rng, city, player, combat,
    cars: [],
    peds: [],
    officers: [],
    enemies: [],
    particles: [],
    mission: createMissionState(),
    wanted: 0,
    wantedTimer: 0,
    crimeTimer: 0,
    time: 0,
    cashEarned: 0,
    kills: 0,
    fare: null,
    fareTimer: 0,
    events: [],
    over: null,
    stepCount: 0,
  };
  resetWorld(state);
  return state;
}

export function resetWorld(state) {
  const { city, rng, player } = state;
  state.cars = [];
  state.peds = [];
  state.officers = [];
  state.enemies = [];
  state.particles = [];
  state.combat.bullets = [];
  state.combat.tracers = [];
  state.combat.booms = [];
  state.combat.pickups = [];
  state.mission = createMissionState();
  state.wanted = 0;
  state.wantedTimer = 0;
  state.crimeTimer = 0;
  state.time = 0;
  state.cashEarned = 0;
  state.kills = 0;
  state.fare = null;
  state.over = null;
  player.x = 1500;
  player.y = 200;
  player.health = PLAYER.health;
  player.armor = 0;
  player.cash = 150;
  player.weapon = 'fists';
  player.ammo = 0;
  player.inCar = null;
  player.dead = false;
  // A few parked cars and a pistol pickup near the start, so the first minutes teach everything.
  spawnParkedCar(state, 1560, 240, 'Driftwood Sedan');
  spawnParkedCar(state, 1440, 240, 'Neon Taxi');
  spawnPickup(state.combat, 'pistol', 1560, 300);
  spawnPickup(state.combat, 'health', 1440, 300);
  spawnPickup(state.combat, 'armor', 1620, 300);
  for (let i = 0; i < 6; i += 1) spawnTrafficCar(state);
  for (let i = 0; i < 14; i += 1) spawnPed(state);
}

export function spawnParkedCar(state, x, y, modelName) {
  const model = CAR_MODELS.find((m) => m.name === modelName) || CAR_MODELS[0];
  const car = makeCar(x, y, state.rng.range(0, Math.PI * 2), model, 'none');
  state.cars.push(car);
  return car;
}

export function spawnTrafficCar(state) {
  const spot = state.city.randomRoadSpot();
  const car = makeCar(spot.x, spot.y, state.rng.range(0, Math.PI * 2), pickModel(state.rng), 'traffic');
  car.target = state.city.nearestRoadPoint(spot.x, spot.y);
  state.cars.push(car);
  return car;
}

export function spawnPoliceCar(state) {
  const p = playerPos(state);
  let spot = state.city.randomRoadSpot();
  for (let i = 0; i < 8; i += 1) {
    const d = Math.hypot(spot.x - p.x, spot.y - p.y);
    if (d > 500 && d < 1000) break;
    spot = state.city.randomRoadSpot();
  }
  const car = makeCar(spot.x, spot.y, 0, POLICE_CAR, 'police');
  state.cars.push(car);
  return car;
}

export function spawnPed(state) {
  const spot = state.city.randomSidewalkSpot();
  state.peds.push(makePed(spot.x, spot.y, state.rng));
}

export function spawnEnemy(state, x, y) {
  state.enemies.push({
    x: x + state.rng.range(-60, 60), y: y + state.rng.range(-60, 60),
    angle: 0, health: 60, speed: ENEMY_SPEED, shootCool: state.rng.range(0.5, 1.5), dead: false,
  });
}

export function playerPos(state) {
  const p = state.player;
  return p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
}

export function addWanted(state, n, audio) {
  const before = state.wanted;
  state.wanted = Math.min(WANTED.max, state.wanted + n);
  state.crimeTimer = 0;
  if (state.wanted > before && audio) audio.wantedUp();
}

function addCash(state, amount) {
  state.player.cash += amount;
  state.cashEarned += amount;
}

function burst(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const s = state.rng.range(speed * 0.3, speed);
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: state.rng.range(0.25, 0.6), max: 0.6, color, size: state.rng.range(2, 5) });
  }
}

/** Enter the nearest car, or step out of the one being driven. Returns what happened. */
export function toggleCar(state, audio) {
  const p = state.player;
  if (p.inCar) {
    const car = p.inCar;
    car.driver = 'none';
    car.speed = 0;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    p.inCar = null;
    return 'exit';
  }
  let best = null;
  let bestD = 80;
  for (const car of state.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return null;
  if (best.driver === 'traffic') {
    // Jack it: the driver bails and runs, and the law notices.
    const spot = state.city.randomSidewalkSpot();
    state.peds.push(makePed(best.x, best.y, state.rng));
    const ped = state.peds[state.peds.length - 1];
    ped.target = spot;
    ped.fear = 4;
    addWanted(state, 1, audio);
    state.events.push('Car jacked! The driver ran — the cops noticed.');
  }
  best.driver = 'player';
  p.inCar = best;
  p.x = best.x;
  p.y = best.y;
  return 'enter';
}

function startStep(state, audio) {
  const step = currentStep(state.mission);
  if (!step) return;
  if (step.type === 'steal') {
    spawnParkedCar(state, step.x, step.y, step.model);
  }
  if (step.type === 'kill') {
    state.mission.kills = 0;
    for (let i = 0; i < step.count; i += 1) spawnEnemy(state, step.x, step.y);
  }
  if (step.wanted) addWanted(state, step.wanted, audio);
}

export function startMission(state, audio) {
  const m = currentMission(state.mission);
  if (!m || state.mission.active) return;
  state.mission.active = true;
  state.mission.step = 0;
  state.mission.timer = 0;
  state.mission.banner = m.briefing;
  state.mission.bannerTime = 6;
  if (audio) audio.missionStart();
  startStep(state, audio);
}

function completeMission(state, audio) {
  const m = currentMission(state.mission);
  if (!m) return;
  addCash(state, m.reward);
  state.events.push(`Mission complete: ${m.title} — $${m.reward} earned.`);
  if (audio) audio.cash();
  if (audio) audio.missionDone();
  state.mission.index += 1;
  state.mission.active = false;
  state.mission.step = 0;
  if (state.mission.index >= MISSIONS.length) {
    state.mission.done = true;
    state.events.push('Story complete! Neon Harbor is yours — free roam forever.');
  }
}

function advanceMission(state, audio) {
  const m = currentMission(state.mission);
  if (!m) return;
  state.mission.step += 1;
  if (state.mission.step >= m.steps.length) completeMission(state, audio);
  else startStep(state, audio);
}

function stepMission(state, dt, audio) {
  const ms = state.mission;
  if (!ms.active) return;
  if (ms.bannerTime > 0) ms.bannerTime -= dt;
  const step = currentStep(ms);
  if (!step) return;
  const pos = playerPos(state);
  if (step.type === 'goto') {
    const needCar = step.needCar && !state.player.inCar;
    if (!needCar && Math.hypot(step.x - pos.x, step.y - pos.y) < (step.radius || 70)) {
      advanceMission(state, audio);
    }
  } else if (step.type === 'steal') {
    const car = state.player.inCar;
    if (car && car.model.name === step.model) advanceMission(state, audio);
  } else if (step.type === 'kill') {
    if (ms.kills >= step.count) advanceMission(state, audio);
  } else if (step.type === 'survive') {
    ms.timer += dt;
    if (ms.timer >= step.seconds) advanceMission(state, audio);
  }
}

/** One fixed step of the whole world. `input` carries held keys and the mouse. */
export function stepWorld(state, input, audio, dt) {
  state.time += dt;
  state.stepCount += 1;
  const p = state.player;
  const city = state.city;

  // --- player ---
  if (!p.dead) {
    if (p.inCar) {
      const car = p.inCar;
      const throttle = (input.held.up ? 1 : 0) - (input.held.down ? 1 : 0);
      const steer = (input.held.left ? -1 : 0) + (input.held.right ? 1 : 0);
      driveCar(car, throttle, steer, input.held.brake, dt);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      if (audio) audio.engine(Math.abs(car.speed) / (CAR.maxSpeed * car.model.speed), true);
      if (Math.abs(car.speed) > 420 && input.held.brake) {
        burst(state, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, '#8b93a3', 1, 40);
      }
    } else {
      stepPlayerOnFoot(p, input.held, city, dt);
      if (audio) audio.engine(0, false);
    }
    if (input.mouse.down && p.shootCool <= 0 && !p.inCar) {
      aimAt(p, input.mouseWorldX, input.mouseWorldY);
      if (p.weapon === 'pistol' && p.ammo > 0) {
        const weapon = weaponOf(p);
        fireBullet(state.combat, p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, p.angle, weapon, 'player');
        p.ammo -= 1;
        p.shootCool = weapon.cooldown;
        if (audio) audio.shoot();
        burst(state, p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, '#ffd76a', 3, 120);
        if (p.ammo === 0) p.weapon = 'fists';
      }
    }
    if (input.punch && p.punchCool <= 0 && !p.inCar) {
      p.punchCool = PLAYER.punchCooldown;
      if (audio) audio.punch();
      const w = weaponOf(p);
      for (const e of state.enemies) {
        if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < PLAYER.punchRange + 12) {
          e.health -= w.damage;
          burst(state, e.x, e.y, '#e5534b', 5, 140);
        }
      }
    }
  }

  // --- cars ---
  for (const car of state.cars) {
    if (car.dead) continue;
    if (car.driver === 'traffic') stepTraffic(car, city, state.cars, dt, state.rng);
    else if (car.driver === 'police') stepPoliceCar(car, playerPos(state), dt);
    collideWorldCar(car, city);
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      const boom = explode(state.combat, car.x, car.y, 90, 80, audio);
      burst(state, car.x, car.y, '#ff8a5c', 24, 260);
      burst(state, car.x, car.y, '#3a3a3a', 14, 120);
      damageAround(state, boom.x, boom.y, boom.radius, boom.damage, audio);
      if (car.driver === 'player') {
        p.inCar = null;
        hurtPlayer(p, 40);
      }
    }
    if (car.health < 40) car.smoke = 1;
  }
  for (let i = 0; i < state.cars.length; i += 1) {
    for (let j = i + 1; j < state.cars.length; j += 1) {
      const a = state.cars[i];
      const b = state.cars[j];
      if (!a.dead && !b.dead) collideCars(a, b, audio);
    }
  }
  // Player car hitting peds is a crime; a fast car hitting a ped is a worse one.
  if (p.inCar && Math.abs(p.inCar.speed) > 60) {
    for (const ped of state.peds) {
      if (!ped.dead && Math.hypot(ped.x - p.inCar.x, ped.y - p.inCar.y) < 30) {
        ped.dead = true;
        burst(state, ped.x, ped.y, '#e5534b', 8, 160);
        addWanted(state, 1, audio);
        state.events.push('You hit a pedestrian! Wanted level up.');
      }
    }
  }

  // --- peds & officers ---
  const threats = [{ x: playerPos(state).x, y: playerPos(state).y, radius: 200 }];
  for (const boom of state.combat.booms) threats.push({ x: boom.x, y: boom.y, radius: 320 });
  stepPeds(state.peds, city, threats, dt, state.rng);
  stepOfficers(state.officers, playerPos(state), !p.inCar, dt);
  // An officer up close arrests the player.
  if (!p.inCar && !p.dead && state.wanted > 0) {
    for (const o of state.officers) {
      if (Math.hypot(o.x - p.x, o.y - p.y) < 26) {
        state.over = 'busted';
        if (audio) audio.busted();
        break;
      }
    }
  }

  // --- enemies ---
  for (const e of state.enemies) {
    if (e.dead) continue;
    const pos = playerPos(state);
    const d = Math.hypot(pos.x - e.x, pos.y - e.y);
    if (d > 700) continue;
    e.angle = Math.atan2(pos.y - e.y, pos.x - e.x);
    if (d > 240) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else if (e.shootCool <= 0) {
      e.shootCool = state.rng.range(0.9, 1.6);
      fireBullet(state.combat, e.x, e.y, e.angle + state.rng.range(-0.08, 0.08), { damage: 9, range: 420 }, 'enemy');
      if (audio) audio.shoot();
    }
    if (e.shootCool > 0) e.shootCool -= dt;
    if (e.health <= 0) {
      e.dead = true;
      state.mission.kills += 1;
      state.kills += 1;
      burst(state, e.x, e.y, '#e5534b', 10, 180);
      if (state.rng.chance(0.5)) spawnPickup(state.combat, 'cash', e.x, e.y);
    }
  }

  // --- bullets ---
  const targets = [];
  for (const e of state.enemies) if (!e.dead) targets.push({ x: e.x, y: e.y, radius: 16, kind: 'enemy', ref: e });
  for (const o of state.officers) targets.push({ x: o.x, y: o.y, radius: 14, kind: 'officer', ref: o });
  for (const car of state.cars) {
    if (!car.dead && car.driver !== 'player') targets.push({ x: car.x, y: car.y, radius: 24, kind: 'car', ref: car });
  }
  if (!p.inCar && !p.dead) targets.push({ x: p.x, y: p.y, radius: 14, kind: 'player', ref: p });
  const hits = stepBullets(state.combat, city, targets, dt);
  for (const hit of hits) {
    const t = hit.target;
    if (hit.bullet.owner === 'player') {
      if (t.kind === 'enemy') {
        t.ref.health -= hit.bullet.damage;
        burst(state, t.x, t.y, '#e5534b', 4, 120);
      } else if (t.kind === 'officer') {
        t.ref.x += 4000;
        addWanted(state, 2, audio);
        state.events.push('You shot a cop! Wanted level way up.');
      } else if (t.kind === 'car') {
        t.ref.health -= hit.bullet.damage;
        burst(state, t.x, t.y, '#ffd76a', 4, 120);
      }
    } else if (hit.bullet.owner === 'enemy' && t.kind === 'player') {
      hurtPlayer(p, hit.bullet.damage);
    }
  }

  // --- pickups ---
  for (const pk of state.combat.pickups) {
    if (Math.hypot(pk.x - posX(state), pk.y - posY(state)) < 30 && !p.dead) {
      if (pk.kind === 'health') healPlayer(p, 40);
      if (pk.kind === 'armor') p.armor = Math.min(PLAYER.armor, p.armor + 25);
      if (pk.kind === 'pistol') giveWeapon(p, 'pistol', 24);
      if (pk.kind === 'ammo') giveWeapon(p, 'pistol', 12);
      if (pk.kind === 'cash') {
        const amount = 25 + Math.floor(state.rng.next() * 50);
        addCash(state, amount);
        if (audio) audio.cash();
      }
      if (audio && pk.kind !== 'cash') audio.pickup();
      pk.dead = true;
    }
  }
  state.combat.pickups = state.combat.pickups.filter((pk) => !pk.dead);

  // --- wanted: police numbers follow the stars, stars fade when the trail goes cold ---
  const wantCars = WANTED.carsPerStar[state.wanted] || 0;
  const policeCars = state.cars.filter((c) => c.driver === 'police' && !c.dead).length;
  for (let i = policeCars; i < wantCars; i += 1) spawnPoliceCar(state);
  const wantFoot = wantedFootCount(state.wanted);
  while (state.officers.length < wantFoot) {
    const pos = playerPos(state);
    state.officers.push(makeOfficer(pos.x + state.rng.range(-300, 300), pos.y + state.rng.range(-300, 300)));
  }
  if (state.wanted > 0) {
    state.crimeTimer += dt;
    const nearestCop = nearestPoliceDist(state);
    if (nearestCop > 520) {
      state.wantedTimer += dt;
      if (state.wantedTimer > WANTED.decaySeconds) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        state.events.push('The heat dies down...');
      }
    } else {
      state.wantedTimer = 0;
    }
  }
  if (audio) audio.siren(policeCars > 0 && state.wanted > 0);

  // --- traffic & peds population ---
  if (state.cars.filter((c) => c.driver === 'traffic').length < TRAFFIC_TARGET && state.rng.chance(0.02)) spawnTrafficCar(state);
  if (state.peds.filter((pd) => !pd.dead).length < PED_TARGET && state.rng.chance(0.05)) spawnPed(state);
  state.cars = state.cars.filter((c) => !c.dead || c.driver === 'player');
  state.peds = state.peds.filter((pd) => !pd.dead);

  // --- taxi fares: driving a Neon Taxi pays for rides ---
  if (p.inCar && p.inCar.model.name === 'Neon Taxi') {
    if (!state.fare) {
      state.fareTimer += dt;
      if (state.fareTimer > 6) {
        state.fareTimer = 0;
        const spot = state.city.randomRoadSpot();
        state.fare = { x: spot.x, y: spot.y };
      }
    } else if (Math.hypot(state.fare.x - p.inCar.x, state.fare.y - p.inCar.y) < 70) {
      const pay = 50 + Math.floor(state.rng.next() * 70);
      addCash(state, pay);
      state.events.push(`Fare delivered: +$${pay}.`);
      if (audio) audio.cash();
      state.fare = null;
    }
  } else {
    state.fare = null;
  }

  // --- particles ---
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);

  // --- missions ---
  stepMission(state, dt, audio);

  // --- end states ---
  if (p.dead && !state.over) state.over = 'wasted';
  if (audio) audio.music(dt);
}

function posX(state) {
  return playerPos(state).x;
}
function posY(state) {
  return playerPos(state).y;
}

function nearestPoliceDist(state) {
  const pos = playerPos(state);
  let best = Infinity;
  for (const car of state.cars) {
    if (car.driver === 'police' && !car.dead) best = Math.min(best, Math.hypot(car.x - pos.x, car.y - pos.y));
  }
  for (const o of state.officers) best = Math.min(best, Math.hypot(o.x - pos.x, o.y - pos.y));
  return best;
}

function damageAround(state, x, y, radius, damage, audio) {
  const p = state.player;
  if (!p.inCar && Math.hypot(p.x - x, p.y - y) < radius) hurtPlayer(p, damage);
  for (const e of state.enemies) {
    if (!e.dead && Math.hypot(e.x - x, e.y - y) < radius) e.health -= damage;
  }
  for (const car of state.cars) {
    if (!car.dead && Math.hypot(car.x - x, car.y - y) < radius) car.health -= damage * 0.5;
  }
}

export function missionTitle(state) {
  const m = currentMission(state.mission);
  return m ? m.title : 'Free Roam';
}

export function missionObjective(state) {
  if (!state.mission.active) return state.mission.done ? 'Story complete — free roam!' : 'Press Enter to start the next mission.';
  return missionLabel(state.mission);
}
