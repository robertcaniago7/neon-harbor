// The screenshot scenes behind ?shot=cover|city|mission|combat. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed
// always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_PLAY } from './render.js';
import {
  resetWorld, stepWorld, spawnParkedCar, spawnPoliceCar, spawnEnemy, playerPos,
} from './world.js';
import { giveWeapon } from './player.js';

const COVER_SECONDS = 9;
const CITY_SECONDS = 8;
const MISSION_SECONDS = 6;
const COMBAT_SECONDS = 5;

/** Silent audio stand-in: screenshots never need sound. */
const SILENT = {
  shoot() {}, crash() {}, explosion() {}, pickup() {}, cash() {},
  missionDone() {}, missionStart() {}, wantedUp() {}, busted() {},
  engine() {}, siren() {}, music() {},
};

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function heldInput(up, down, left, right) {
  return { up, down, left, right, sprint: false, brake: false };
}

/** Drive down the road ahead: throttle on, steer at the next intersection. */
function driveAutopilot(world) {
  const car = world.player.inCar;
  if (!car) return heldInput(false, false, false, false);
  const node = world.city.nearestRoadPoint(car.x + Math.cos(car.angle) * 260, car.y + Math.sin(car.angle) * 260);
  const want = Math.atan2(node.y - car.y, node.x - car.x);
  const diff = angleDiff(want, car.angle);
  return heldInput(true, false, diff < -0.08, diff > 0.08);
}

/** Walk toward the road ahead. */
function walkAutopilot(world) {
  const p = world.player;
  const node = world.city.nearestRoadPoint(p.x + 200, p.y + 60);
  const want = Math.atan2(node.y - p.y, node.x - p.x);
  return heldInput(Math.sin(want) < -0.3, Math.sin(want) > 0.3, Math.cos(want) < -0.3, Math.cos(want) > 0.3);
}

function stepFor(world, seconds, pilot, mouseDown) {
  const input = {
    held: heldInput(false, false, false, false),
    mouse: { down: false, x: 0, y: 0 },
    punch: false,
    mouseWorldX: 0,
    mouseWorldY: 0,
  };
  for (let i = 0; i < seconds / STEP; i += 1) {
    input.held = pilot(world, i);
    const pos = playerPos(world);
    input.mouse.down = !!mouseDown;
    input.mouseWorldX = pos.x + 200;
    input.mouseWorldY = pos.y;
    stepWorld(world, input, SILENT, STEP);
  }
}

/**
 * Set `world` to the named scene (cover, city, mission or combat) and return the
 * screen to draw over it and the best cash to show.
 */
export function stageShot(name, world) {
  resetWorld(world);

  if (name === 'city') {
    world.player.x = 1500;
    world.player.y = 200;
    stepFor(world, CITY_SECONDS, walkAutopilot, false);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'mission') {
    // On the road x=2400 down by the docks, facing the Vultures up the same road.
    world.player.x = 2400;
    world.player.y = 1700;
    giveWeapon(world.player, 'pistol', 24);
    world.mission.index = 2;
    world.mission.active = true;
    world.mission.step = 1;
    world.mission.kills = 0;
    world.mission.banner = 'Kestrel: "Vultures are shaking down my dock crew. Handle it."';
    world.mission.bannerTime = 6;
    for (const [ex, ey] of [[2400, 1800], [2380, 1860], [2420, 1920], [2400, 1980]]) {
      spawnEnemy(world, ex, ey);
    }
    stepFor(world, MISSION_SECONDS, (_w, i) => (i < 120 ? heldInput(false, true, false, false) : heldInput(false, false, false, false)), false);
    return { screen: SCREEN_PLAY, best: 650 };
  }
  if (name === 'combat') {
    // A shootout on the same dock road: the player holds the line and fires north.
    world.player.x = 2400;
    world.player.y = 1850;
    giveWeapon(world.player, 'pistol', 24);
    for (const [ex, ey] of [[2400, 1750], [2380, 1700], [2420, 1650]]) {
      spawnEnemy(world, ex, ey);
    }
    spawnPoliceCar(world);
    world.wanted = 2;
    const input = {
      held: heldInput(false, false, false, false),
      mouse: { down: true, x: 0, y: 0 },
      punch: false,
      mouseWorldX: 2400,
      mouseWorldY: 1700,
    };
    for (let i = 0; i < COMBAT_SECONDS / STEP; i += 1) {
      stepWorld(world, input, SILENT, STEP);
    }
    return { screen: SCREEN_PLAY, best: 900 };
  }
  // Default: the cover — a high-speed chase through Downtown at three stars.
  const car = spawnParkedCar(world, 1600, 200, 'Harbor Coupe');
  world.player.x = 1600;
  world.player.y = 200;
  world.player.inCar = car;
  car.driver = 'player';
  world.wanted = 3;
  spawnPoliceCar(world);
  spawnPoliceCar(world);
  world.mission.index = 5;
  world.mission.active = true;
  world.mission.step = 1;
  world.mission.timer = 12;
  world.mission.banner = 'Kestrel: "Shake them, Juno. The boat leaves at dawn."';
  world.mission.bannerTime = 6;
  stepFor(world, COVER_SECONDS, driveAutopilot, false);
  return { screen: SCREEN_PLAY, best: 2500 };
}
