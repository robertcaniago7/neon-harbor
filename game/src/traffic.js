// Neon Harbor 3D — traffic.js
// Parked cars + moving traffic on the road graph. Traffic cars are kinematic
// waypoint followers: they cruise along roads, slow for corners, and wrap
// around the city. Parked cars are stealable (the player takes the nearest).

import * as THREE from '../vendor/three.module.min.js';
import { ROADS_X, ROADS_Z, CAR_MODELS, COUNTS } from './config.js';
import { makeRng } from './random.js';
import { buildCarMesh } from './vehicle3d.js';

function roadPoints() {
  // Every intersection of a road X and a road Z.
  const pts = [];
  for (const x of ROADS_X) {
    for (const z of ROADS_Z) {
      pts.push({ x, z });
    }
  }
  return pts;
}

export function createTraffic(scene) {
  const rng = makeRng(4242);
  const group = new THREE.Group();
  group.name = 'traffic';
  scene.add(group);

  // --- parked cars (10): along road edges, fixed spots ---
  const parked = [];
  const parkedSpots = [];
  for (let i = 0; i < COUNTS.parkedCars; i++) {
    const onXRoad = i % 2 === 0;
    const road = onXRoad ? ROADS_X[i % ROADS_X.length] : ROADS_Z[i % ROADS_Z.length];
    const along = -150 + i * 30;
    const x = onXRoad ? road + 3.4 : along;
    const z = onXRoad ? along : road + 3.4;
    const yaw = onXRoad ? 0 : Math.PI / 2;
    parkedSpots.push({ x, z, yaw });
  }
  // the special Harbor Coupe for mission 2 sits near the garage
  parkedSpots[2] = { x: 78, z: 28, yaw: Math.PI / 2 };

  const modelBag = [];
  for (const m of CAR_MODELS) {
    for (let i = 0; i < m.common; i++) modelBag.push(m);
  }
  for (let i = 0; i < COUNTS.parkedCars; i++) {
    const model = i === 2 ? CAR_MODELS[2] : modelBag[rng.int(0, modelBag.length - 1)];
    const mesh = buildCarMesh(model);
    const spot = parkedSpots[i];
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.yaw;
    group.add(mesh);
    parked.push({ mesh, model, x: spot.x, z: spot.z, yaw: spot.yaw, taken: false, special: i === 2 });
  }

  // --- moving traffic (16): loop around the road graph ---
  const moving = [];
  const intersections = roadPoints();
  for (let i = 0; i < COUNTS.trafficCars; i++) {
    const model = modelBag[rng.int(0, modelBag.length - 1)];
    const mesh = buildCarMesh(model);
    group.add(mesh);
    const start = intersections[rng.int(0, intersections.length - 1)];
    const speed = rng.range(7, 12) * model.speed;
    moving.push({
      mesh, model, speed,
      x: start.x, z: start.z,
      dir: rng.pick([{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]),
      yaw: 0,
      wait: 0,
    });
  }

  function nearestParked(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of parked) {
      if (p.taken) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function update(dt, playerPos) {
    for (const car of moving) {
      if (car.wait > 0) { car.wait -= dt; continue; }
      car.x += car.dir.x * car.speed * dt;
      car.z += car.dir.z * car.speed * dt;
      // turn at intersections, otherwise wrap at the city edge
      const onRoadX = ROADS_X.some((rx) => Math.abs(car.x - rx) < 1.2);
      const onRoadZ = ROADS_Z.some((rz) => Math.abs(car.z - rz) < 1.2);
      if (onRoadX && onRoadZ && rng.chance(dt * 0.25)) {
        const dirs = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
        car.dir = dirs[rng.int(0, 3)];
      }
      if (car.x > 232 || car.x < -232 || car.z > 182 || car.z < -182) {
        car.x = THREE.MathUtils.clamp(car.x, -225, 225);
        car.z = THREE.MathUtils.clamp(car.z, -175, 175);
        car.dir = { x: -car.dir.x, z: -car.dir.z };
      }
      car.yaw = Math.atan2(car.dir.x, car.dir.z);
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.yaw;
      // don't run the player over: pause if very close
      if (playerPos && Math.hypot(car.x - playerPos.x, car.z - playerPos.z) < 6) {
        car.wait = 0.6;
      }
    }
  }

  return { group, parked, moving, nearestParked, update };
}
