// Cars: arcade top-down driving, traffic that follows the road graph, and police
// interceptors that hunt the player. One file, three jobs, all driven by the world step.

import { CAR, CAR_MODELS, POLICE_CAR, ROAD } from './config.js';
import { createRandom } from './random.js';

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** A car: model, pose, speed along its heading, health, and who drives it. */
export function makeCar(x, y, angle, model, driver) {
  return {
    x, y, angle, speed: 0,
    model, driver,
    health: CAR.health,
    target: null,
    stuck: 0,
    smoke: 0,
    dead: false,
    id: Math.floor(Math.random() * 1e9),
  };
}

export function pickModel(rng) {
  const bag = [];
  for (const m of CAR_MODELS) for (let i = 0; i < m.common; i += 1) bag.push(m);
  return bag[Math.floor(rng.next() * bag.length)];
}

/**
 * Arcade car physics: throttle adds speed along the heading, steering turns harder with
 * speed, and lateral velocity is gripped away so the car feels planted but can slide.
 */
export function driveCar(car, throttle, steer, brake, dt, gripScale = 1) {
  const maxSpeed = CAR.maxSpeed * car.model.speed;
  if (throttle > 0) car.speed += CAR.accel * car.model.speed * throttle * dt;
  if (throttle < 0) car.speed += CAR.reverseAccel * throttle * dt;
  if (brake) car.speed -= Math.sign(car.speed) * CAR.brake * dt;
  car.speed = clamp(car.speed, -CAR.maxReverse, maxSpeed);
  if (throttle === 0 && !brake) car.speed *= Math.pow(0.4, dt);
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  const turn = steer * CAR.steer * gripScale * clamp(Math.abs(car.speed) / 120, 0, 1) * Math.sign(car.speed || 1);
  car.angle += turn * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

/** Push two cars apart and trade a little damage when they touch. */
export function collideCars(a, b, audio) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = (a.model.w + b.model.w) / 2 - 6;
  if (dist >= min || dist === 0) return;
  const push = (min - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const impact = Math.abs(a.speed - b.speed);
  if (impact > 120) {
    a.health -= impact * 0.02;
    b.health -= impact * 0.02;
    a.speed *= 0.6;
    b.speed *= 0.6;
    if (audio) audio.crash();
  }
}

/** Traffic: pick a neighbouring intersection, drive to it, pick the next, forever. */
export function stepTraffic(car, city, cars, dt, rng) {
  if (car.driver !== 'traffic') return;
  if (!car.target || Math.hypot(car.target.x - car.x, car.target.y - car.y) < 26) {
    const node = city.nearestRoadPoint(car.x, car.y);
    car.target = node && node.next.length ? node.next[Math.floor(rng.next() * node.next.length)] : null;
    if (!car.target) return;
  }
  const want = angleTo(car.x, car.y, car.target.x, car.target.y);
  const diff = angleDiff(want, car.angle);
  let throttle = 0.55;
  let steer = clamp(diff * 2.2, -1, 1);
  // Slow down for the car ahead so traffic does not pile up.
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 26) {
      throttle = 0;
      break;
    }
  }
  driveCar(car, throttle, steer, false, dt, 0.8);
  car.speed = clamp(car.speed, 0, 240);
}

/** A police interceptor: steer at the player, ram to stop them, give up when far away. */
export function stepPoliceCar(car, playerPos, dt) {
  if (car.driver !== 'police') return;
  const dist = Math.hypot(playerPos.x - car.x, playerPos.y - car.y);
  if (dist > 1400) {
    // Too far: fall back to cruising the roads until the trail is hot again.
    car.speed *= Math.pow(0.5, dt);
    return;
  }
  const want = angleTo(car.x, car.y, playerPos.x, playerPos.y);
  const diff = angleDiff(want, car.angle);
  const steer = clamp(diff * 2.6, -1, 1);
  driveCar(car, dist > 90 ? 1 : 0.4, steer, false, dt, 1.1);
}

/** Keep a car out of buildings and water: slide along walls, stop at the shore. */
export function collideWorldCar(car, city) {
  const r = Math.max(car.model.w, car.model.h) / 2 - 2;
  const b = city.collidesBuilding(car.x, car.y, r);
  if (b) {
    const cx = Math.max(b.x, Math.min(car.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(car.y, b.y + b.h));
    const dx = car.x - cx;
    const dy = car.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    car.x = cx + (dx / d) * r;
    car.y = cy + (dy / d) * r;
    car.speed *= 0.4;
    car.health -= 1.5;
  }
  if (city.inWater(car.x, car.y)) {
    car.y = Math.min(car.y, 2080 + 40 - r);
    car.speed *= 0.5;
  }
  car.x = clamp(car.x, 40, 3160);
  car.y = clamp(car.y, 40, 2360);
}
