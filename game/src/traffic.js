// Neon Harbor 3D — parked cars + moving traffic on the road graph.
// Traffic cars are kinematic waypoint followers (no physics bodies).

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { makeRng } from './random.js';
import { buildCarMesh } from './vehicle3d.js';
import { nodeId, nodePos, nodeIJ, nearestNode } from './city.js';

const W = CONFIG.world;

/** Pick a weighted-random car model from the spec list. */
function pickModel(rng) {
  const pairs = CONFIG.carModels.map((m) => [m, m.weight]);
  return rng.weighted(pairs);
}

/** A point on a road edge, offset into a lane (+/- laneOffset). */
function edgePoint(a, b, f, lane) {
  const ax = W.roadX[a.ix];
  const az = W.roadZ[a.iz];
  const bx = W.roadX[b.ix];
  const bz = W.roadZ[b.iz];
  const x = ax + (bx - ax) * f;
  const z = az + (bz - az) * f;
  // lane offset perpendicular to travel
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const px = -dz / len;
  const pz = dx / len;
  return { x: x + px * lane, z: z + pz * lane, heading: Math.atan2(dx, dz) };
}

/** Create parked cars (10) and moving traffic (16). Returns the traffic state. */
export function createTraffic(game, seed = 7) {
  const rng = makeRng(seed);
  const { graph } = game.city;
  const parked = [];
  const moving = [];

  // ---- parked cars: along road edges, in a lane, facing the road ----
  for (let i = 0; i < CONFIG.counts.parked; i++) {
    const model = pickModel(rng);
    const horizontal = rng.chance(0.5);
    let x;
    let z;
    let heading;
    if (horizontal) {
      const rz = rng.pick(W.roadZ);
      const rx = rng.pick(W.roadX);
      x = rx + rng.range(-30, 30);
      z = rz + (rng.chance(0.5) ? 1 : -1) * (W.roadWidth / 2 - 1.2);
      heading = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const rx = rng.pick(W.roadX);
      const rz = rng.pick(W.roadZ);
      x = rx + (rng.chance(0.5) ? 1 : -1) * (W.roadWidth / 2 - 1.2);
      z = rz + rng.range(-30, 30);
      heading = rng.chance(0.5) ? 0 : Math.PI;
    }
    const mesh = buildCarMesh(model, { taxi: model.name === 'Neon Taxi' });
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    game.scene.add(mesh);
    parked.push({ model, mesh, x, z, heading, stolen: false });
  }

  // ---- moving traffic: waypoint followers on the road graph ----
  for (let i = 0; i < CONFIG.counts.traffic; i++) {
    const model = pickModel(rng);
    const start = nearestNode(rng.range(W.xMin, W.xMax), rng.range(W.zMin, W.zMax));
    const mesh = buildCarMesh(model, { taxi: model.name === 'Neon Taxi' });
    game.scene.add(mesh);
    const car = {
      model,
      mesh,
      node: start.id,
      next: null,
      f: 0,
      speed: rng.range(6, 11) * model.speed,
      lane: rng.chance(0.5) ? W.laneOffset : -W.laneOffset,
      wait: 0,
    };
    // pick a first neighbour
    const nbs = graph.neighbours.get(car.node) ?? [];
    car.next = nbs.length > 0 ? rng.pick(nbs) : car.node;
    moving.push(car);
  }
  return { parked, moving, rng };
}

/** Advance traffic cars along the road graph. */
export function updateTraffic(game, dt) {
  const { graph } = game.city;
  for (const car of game.traffic.moving) {
    if (car.wait > 0) {
      car.wait -= dt;
      continue;
    }
    const a = nodeIJ(car.node);
    const b = nodeIJ(car.next);
    const ax = W.roadX[a.ix];
    const az = W.roadZ[a.iz];
    const bx = W.roadX[b.ix];
    const bz = W.roadZ[b.iz];
    const edgeLen = Math.hypot(bx - ax, bz - az) || 1;
    car.f += (car.speed * dt) / edgeLen;
    if (car.f >= 1) {
      car.node = car.next;
      car.f = 0;
      const nbs = graph.neighbours.get(car.node) ?? [];
      // keep going straight when possible, else turn
      const straight = nbs.find((n) => {
        const ij = nodeIJ(n);
        const pa = nodeIJ(car.node);
        return ij.ix - pa.ix === (b.ix - a.ix) && ij.iz - pa.iz === (b.iz - a.iz);
      });
      car.next = straight !== undefined && Math.random() < 0.75 ? straight : (nbs.length > 0 ? nbs[Math.floor(Math.random() * nbs.length)] : car.node);
      // brief pause at some intersections
      if (Math.random() < 0.08) car.wait = 0.6 + Math.random() * 1.2;
    }
    const p = edgePoint(a, b, Math.min(1, car.f), car.lane);
    car.mesh.position.set(p.x, 0, p.z);
    car.mesh.rotation.y = p.heading;
  }
}

/** Nearest parked car within range of a point (for stealing with F). */
export function nearestParkedCar(game, x, z, maxDist = 4) {
  let best = null;
  let bestD = maxDist;
  for (const car of game.traffic.parked) {
    if (car.stolen) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
