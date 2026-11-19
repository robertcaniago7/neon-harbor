// Traffic cars and pedestrians: kinematic waypoint followers on the road graph.
// No physics bodies — they are cheap state machines that look alive.

import * as THREE from 'three';
import { CAR_MODELS } from './config.js';
import { makeRng } from './random.js';
import { buildTrafficCar } from './vehicle3d.js';
import { buildCharacter } from './character.js';

function edgeLen(e) {
  return Math.hypot(e.bx - e.ax, e.bz - e.az);
}

function edgeDir(e) {
  const l = edgeLen(e);
  return { dx: (e.bx - e.ax) / l, dz: (e.bz - e.az) / l, len: l };
}

/** Point on an edge at distance s, offset to the right of travel (dir +1 = a->b). */
export function edgePoint(e, s, dir, lane) {
  const d = edgeDir(e);
  const px = e.ax + d.dx * s;
  const pz = e.az + d.dz * s;
  // right of travel direction (facing (dx,dz), right is (-dz, dx))
  const rx = -d.dz * dir;
  const rz = d.dx * dir;
  // rotation.y that points the model's nose (-Z local) along the travel direction
  const heading = Math.atan2(-d.dx * dir, -d.dz * dir);
  return { x: px + rx * lane, z: pz + rz * lane, heading };
}

function randomEdge(rng, graph, near, radius) {
  const edges = graph.edges.filter((e) => {
    if (!near) return true;
    const mx = (e.ax + e.bx) / 2;
    const mz = (e.az + e.bz) / 2;
    return Math.hypot(mx - near.x, mz - near.z) < radius;
  });
  return edges.length ? rng.pick(edges) : rng.pick(graph.edges);
}

function nextEdge(rng, graph, edge, nodeX, nodeZ) {
  const outs = graph.edges.filter((e) =>
    (e.ax === nodeX && e.az === nodeZ) || (e.bx === nodeX && e.bz === nodeZ));
  if (!outs.length) return null;
  // avoid immediate U-turn when possible
  const forward = outs.filter((e) => !(e.ax === edge.bx && e.az === edge.bz && e.bx === edge.ax && e.bz === edge.az)
    && !(e.ax === edge.ax && e.az === edge.az && e.bx === edge.bx && e.bz === edge.bz));
  return rng.pick(forward.length ? forward : outs);
}

export function createTraffic(city, scene, count, seed) {
  const rng = makeRng(seed);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const model = rng.pick(CAR_MODELS);
    const mesh = buildTrafficCar(model.color, { taxi: model.name === 'Neon Taxi' });
    scene.add(mesh);
    const edge = randomEdge(rng, city.roadGraph);
    const dir = rng.chance(0.5) ? 1 : -1;
    cars.push({
      mesh, model, edge, dir,
      s: rng.range(0, edgeLen(edge)),
      speed: rng.range(7, 11),
      targetSpeed: rng.range(7, 11),
      stuck: 0,
    });
  }
  return { cars, rng };
}

export function stepTraffic(traffic, city, dt, playerPos) {
  const { cars, rng } = traffic;
  for (const car of cars) {
    // slow for the car ahead on the same edge
    let want = car.targetSpeed;
    for (const other of cars) {
      if (other === car || other.edge !== car.edge || other.dir !== car.dir) continue;
      const ahead = (other.s - car.s) * car.dir;
      if (ahead > 0 && ahead < 8) want = Math.min(want, 0);
    }
    car.speed += (want - car.speed) * Math.min(1, dt * 1.5);
    car.s += car.speed * car.dir * dt;
    const len = edgeLen(car.edge);
    if (car.s >= len || car.s <= 0) {
      const nodeX = car.s >= len ? car.edge.bx : car.edge.ax;
      const nodeZ = car.s >= len ? car.edge.bz : car.edge.az;
      const next = nextEdge(rng, city.roadGraph, car.edge, nodeX, nodeZ);
      if (!next) {
        car.dir *= -1;
        car.s = Math.max(0, Math.min(len, car.s));
      } else {
        const atB = next.ax === nodeX && next.az === nodeZ;
        car.edge = next;
        car.dir = atB ? 1 : -1;
        car.s = atB ? 0 : edgeLen(next);
      }
    }
    const p = edgePoint(car.edge, Math.max(0, Math.min(edgeLen(car.edge), car.s)), car.dir, 2.2);
    car.mesh.position.set(p.x, 0, p.z);
    car.mesh.rotation.y = p.heading;
    // respawn far cars near the player so the streets stay alive
    if (playerPos && Math.hypot(p.x - playerPos.x, p.z - playerPos.z) > 170) {
      const edge = randomEdge(rng, city.roadGraph, playerPos, 130);
      car.edge = edge;
      car.dir = rng.chance(0.5) ? 1 : -1;
      car.s = rng.range(0, edgeLen(edge));
    }
  }
}

export function createPeds(city, scene, count, seed) {
  const rng = makeRng(seed + 7);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const char = buildCharacter();
    scene.add(char.group);
    const edge = randomEdge(rng, city.roadGraph);
    peds.push({
      char, edge, dir: rng.chance(0.5) ? 1 : -1,
      s: rng.range(0, edgeLen(edge)),
      speed: rng.range(1.0, 1.6),
      phase: rng.range(0, Math.PI * 2),
      pause: 0,
    });
  }
  return { peds, rng };
}

export function stepPeds(pedState, city, dt, playerPos) {
  const { peds, rng } = pedState;
  for (const ped of peds) {
    if (ped.pause > 0) {
      ped.pause -= dt;
      ped.char.setWalk(ped.phase, 0);
      continue;
    }
    ped.s += ped.speed * ped.dir * dt;
    ped.phase += dt * 5;
    const len = edgeLen(ped.edge);
    if (ped.s >= len || ped.s <= 0) {
      const nodeX = ped.s >= len ? ped.edge.bx : ped.edge.ax;
      const nodeZ = ped.s >= len ? ped.edge.bz : ped.edge.az;
      const next = nextEdge(rng, city.roadGraph, ped.edge, nodeX, nodeZ);
      if (!next) {
        ped.dir *= -1;
        ped.s = Math.max(0, Math.min(len, ped.s));
      } else {
        const atB = next.ax === nodeX && next.az === nodeZ;
        ped.edge = next;
        ped.dir = atB ? 1 : -1;
        ped.s = atB ? 0 : edgeLen(next);
      }
      if (rng.chance(0.25)) ped.pause = rng.range(1, 4);
    }
    const p = edgePoint(ped.edge, Math.max(0, Math.min(len, ped.s)), ped.dir, 6);
    ped.char.group.position.set(p.x, 0, p.z);
    ped.char.group.rotation.y = p.heading;
    ped.char.setWalk(ped.phase, 1);
    if (playerPos && Math.hypot(p.x - playerPos.x, p.z - playerPos.z) > 170) {
      const edge = randomEdge(rng, city.roadGraph, playerPos, 130);
      ped.edge = edge;
      ped.dir = rng.chance(0.5) ? 1 : -1;
      ped.s = rng.range(0, edgeLen(edge));
    }
  }
}
