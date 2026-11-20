// Traffic: parked cars (stealable) and moving traffic on the road graph.
// All kinematic — they follow waypoints, no physics bodies. Each car is a
// mesh from vehicle3d.js plus a small state record.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildCarMesh } from './vehicle3d.js';

// Pick a car model by its commonness weight.
function pickModel(rng) {
  const models = CONFIG.carModels;
  let total = 0;
  for (const m of models) total += m.common;
  let r = rng.next() * total;
  for (const m of models) {
    if (r < m.common) return m;
    r -= m.common;
  }
  return models[0];
}

// A spot on a road: which road, which lane, how far along it.
function roadSpot(rng, roadGraph) {
  const nodeId = roadGraph.randomNode(rng);
  const node = roadGraph.nodes[nodeId];
  const nbrs = roadGraph.adjacency[nodeId];
  const nextId = nbrs[Math.floor(rng.next() * nbrs.length)];
  return { nodeId, nextId, t: rng.next() };
}

export function createTraffic(scene, roadGraph, rng, quality) {
  const count = quality.traffic;
  const parkedCount = CONFIG.counts.parked;
  const moving = [];
  const parked = [];

  function placeOnRoad(mesh, nodeId, nextId, t) {
    const a = roadGraph.nodes[nodeId];
    const b = roadGraph.nodes[nextId];
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    // Offset into the right-hand lane.
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    mesh.position.set(x + nx * CONFIG.laneOffset, 0, z + nz * CONFIG.laneOffset);
    mesh.rotation.y = Math.atan2(dx, dz);
    return { x: mesh.position.x, z: mesh.position.z, heading: mesh.rotation.y };
  }

  // Moving traffic cars.
  for (let i = 0; i < count; i++) {
    const model = pickModel(rng);
    const { group } = buildCarMesh(model);
    scene.add(group);
    const spot = roadSpot(rng, roadGraph);
    const pos = placeOnRoad(group, spot.nodeId, spot.nextId, spot.t);
    moving.push({
      mesh: group,
      model,
      nodeId: spot.nodeId,
      nextId: spot.nextId,
      speed: rng.range(7, 11) * model.speed,
      x: pos.x,
      z: pos.z,
      heading: pos.heading,
      stopped: 0,
    });
  }

  // Parked cars along road edges (stealable with F). We spawn one fewer
  // than the total here: the special Harbor Coupe (placed by the world for
  // mission 2) is the tenth parked car, so the total stays at 10.
  for (let i = 0; i < parkedCount - 1; i++) {
    const model = pickModel(rng);
    const { group } = buildCarMesh(model);
    scene.add(group);
    const spot = roadSpot(rng, roadGraph);
    const a = roadGraph.nodes[spot.nodeId];
    const b = roadGraph.nodes[spot.nextId];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    // Parked on the far edge of the road, facing along it.
    const side = rng.chance(0.5) ? 1 : -1;
    const x = a.x + (b.x - a.x) * spot.t + nx * CONFIG.laneOffset * 2 * side;
    const z = a.z + (b.z - a.z) * spot.t + nz * CONFIG.laneOffset * 2 * side;
    group.position.set(x, 0, z);
    group.rotation.y = Math.atan2(dx, dz) + (side < 0 ? Math.PI : 0);
    parked.push({
      mesh: group,
      model,
      x, z,
      heading: group.rotation.y,
      taken: false,
    });
  }

  // The Harbor Coupe for mission 2 sits at a fixed dock spot.
  function placeSpecial(model, x, z, heading) {
    const { group } = buildCarMesh(model);
    scene.add(group);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    const rec = { mesh: group, model, x, z, heading, taken: false, special: true };
    parked.push(rec);
    return rec;
  }

  function update(dt, playerPos) {
    for (const car of moving) {
      // Brief random stops (traffic lights / congestion feel).
      if (car.stopped > 0) {
        car.stopped -= dt;
        continue;
      }
      if (rng.next() < 0.0015) {
        car.stopped = rng.range(1, 3);
        continue;
      }
      const target = roadGraph.nodes[car.nextId];
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const dist = Math.hypot(dx, dz);
      const step = car.speed * dt;
      if (dist <= step + 0.5) {
        // Arrive: pick the next node (not the one we came from, if possible).
        const nbrs = roadGraph.adjacency[car.nextId].filter((n) => n !== car.nodeId);
        const pick = nbrs.length > 0
          ? nbrs[Math.floor(rng.next() * nbrs.length)]
          : roadGraph.adjacency[car.nextId][0];
        car.nodeId = car.nextId;
        car.nextId = pick;
        car.x = target.x;
        car.z = target.z;
      } else {
        car.x += (dx / dist) * step;
        car.z += (dz / dist) * step;
      }
      // Recompute heading + lane offset for the current leg.
      const a = roadGraph.nodes[car.nodeId];
      const b = roadGraph.nodes[car.nextId];
      const ldx = b.x - a.x;
      const ldz = b.z - a.z;
      const llen = Math.hypot(ldx, ldz) || 1;
      const nx = -ldz / llen;
      const nz = ldx / llen;
      car.heading = Math.atan2(ldx, ldz);
      car.mesh.position.set(car.x + nx * CONFIG.laneOffset, 0, car.z + nz * CONFIG.laneOffset);
      car.mesh.rotation.y = car.heading;
      // Spin wheels.
      const wheels = car.mesh.userData.wheels;
      if (wheels) {
        const w = car.speed * dt / 0.36;
        wheels.forEach((wh) => { wh.rotation.x += w; });
      }
    }
  }

  // Nearest parked (not taken) car within `range` of a point.
  function nearestParked(x, z, range) {
    let best = null;
    let bestD = range * range;
    for (const car of parked) {
      if (car.taken) continue;
      const d = (car.x - x) * (car.x - x) + (car.z - z) * (car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  return {
    moving, parked, update, nearestParked, placeSpecial,
    get parkedCount() { return parked.filter((c) => !c.taken).length; },
  };
}

export default createTraffic;
