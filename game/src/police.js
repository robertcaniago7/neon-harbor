// Wanted system + police: interceptor cars that chase along the road graph
// and ram, foot officers at 3+ stars who arrest up close. Heat fades when the
// police lose sight of you; switching to an unseen car/outfit drops 2 stars.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildCarMesh } from './vehicle3d.js';
import { buildCharacterMesh } from './character.js';

const W = CONFIG.wanted;

export function createPolice(scene, roadGraph, rng) {
  let wanted = 0;
  let unseenTimer = 0;
  let sirenTimer = 0;
  const cars = [];
  const officers = [];
  const tmpV = new THREE.Vector3();

  function policeCount() {
    return W.policePerStar[Math.min(wanted, W.max)];
  }

  function officerCount() {
    return W.officersPerStar[Math.min(wanted, W.max)];
  }

  function spawnCar() {
    const { group, wheels, lightBar } = buildCarMesh(CONFIG.policeCar, { police: true });
    scene.add(group);
    // Start on a road node near the player (set by world on first update).
    const nodeId = roadGraph.randomNode(rng);
    const node = roadGraph.nodes[nodeId];
    group.position.set(node.x, 0, node.z);
    const rec = {
      mesh: group, wheels, lightBar,
      nodeId, nextId: nodeId,
      x: node.x, z: node.z,
      speed: 13 * CONFIG.policeCar.speed,
      flash: rng.next() * 10,
      state: 'chase',
    };
    cars.push(rec);
    return rec;
  }

  function spawnOfficer(x, z) {
    const { group, parts } = buildCharacterMesh({ police: true, rng });
    scene.add(group);
    group.position.set(x, 0, z);
    const rec = {
      mesh: group, parts,
      x, z, heading: 0,
      speed: 3.4,
      walkPhase: rng.next() * 6,
      arrestTimer: 0,
    };
    officers.push(rec);
    return rec;
  }

  function removeCar(rec) {
    scene.remove(rec.mesh);
    const i = cars.indexOf(rec);
    if (i >= 0) cars.splice(i, 1);
  }

  function removeOfficer(rec) {
    scene.remove(rec.mesh);
    const i = officers.indexOf(rec);
    if (i >= 0) officers.splice(i, 1);
  }

  function setWanted(n, playerPos) {
    const target = Math.max(0, Math.min(W.max, Math.round(n)));
    if (target === wanted) return;
    wanted = target;
    unseenTimer = 0;
    // Grow/shrink the fleet to match.
    while (cars.length < policeCount()) spawnCar();
    while (cars.length > policeCount()) removeCar(cars[cars.length - 1]);
    while (officers.length < officerCount()) {
      const a = rng.next() * Math.PI * 2;
      spawnOfficer(
        playerPos.x + Math.cos(a) * rng.range(18, 30),
        playerPos.z + Math.sin(a) * rng.range(18, 30),
      );
    }
    while (officers.length > officerCount()) removeOfficer(officers[officers.length - 1]);
  }

  function addWanted(n, playerPos) {
    setWanted(wanted + n, playerPos);
  }

  // Dropping heat by switching to a car/outfit the police have not seen.
  function loseTrail() {
    setWanted(Math.max(0, wanted - W.unseenDrop), { x: 0, z: 0 });
  }

  function nearestPoliceCar(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const c of cars) {
      const d = (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best ? { car: best, dist: Math.sqrt(bestD) } : null;
  }

  // Chase: drive toward the player's node, then straight at the player when
  // close. Returns 'ram' when a police car touches the player, else null.
  function update(dt, playerPos, playerInCar, onArrest) {
    // Decay: one star fades after `decay` seconds with no police line of sight.
    const anyNear = cars.some((c) => {
      const d = Math.hypot(c.x - playerPos.x, c.z - playerPos.z);
      return d < 60;
    }) || officers.some((o) => Math.hypot(o.x - playerPos.x, o.z - playerPos.z) < 25);
    if (wanted > 0 && !anyNear) {
      unseenTimer += dt;
      if (unseenTimer >= W.decay) {
        unseenTimer = 0;
        setWanted(wanted - 1, playerPos);
      }
    } else {
      unseenTimer = 0;
    }

    // Siren blips while wanted.
    let siren = false;
    if (wanted > 0) {
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 1.4;
        siren = true;
      }
    }

    let rammed = false;
    for (const car of cars) {
      // Flash the light bar.
      car.flash += dt * 6;
      if (car.lightBar) {
        const on = Math.sin(car.flash) > 0;
        car.lightBar.userData.red.material.emissiveIntensity = on ? 2.5 : 0.2;
        car.lightBar.userData.blue.material.emissiveIntensity = on ? 0.2 : 2.5;
      }
      const dx = playerPos.x - car.x;
      const dz = playerPos.z - car.z;
      const dist = Math.hypot(dx, dz);
      // Head for the player's nearest road node when far, straight at the
      // player when close enough to ram.
      let tx = playerPos.x;
      let tz = playerPos.z;
      if (dist > 40) {
        const nodeId = roadGraph.nearestNode(playerPos.x, playerPos.z);
        const node = roadGraph.nodes[nodeId];
        tx = node.x;
        tz = node.z;
      }
      const mx = tx - car.x;
      const mz = tz - car.z;
      const md = Math.hypot(mx, mz) || 1;
      const step = car.speed * dt;
      car.x += (mx / md) * Math.min(step, md);
      car.z += (mz / md) * Math.min(step, md);
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = Math.atan2(mx, mz);
      const wheels = car.mesh.userData.wheels;
      if (wheels) {
        const w = car.speed * dt / 0.36;
        wheels.forEach((wh) => { wh.rotation.x += w; });
      }
      if (dist < 3.2) rammed = true;
    }

    // Foot officers walk at the player; arrest when they get very close.
    for (const o of officers) {
      const dx = playerPos.x - o.x;
      const dz = playerPos.z - o.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.6) {
        const step = o.speed * dt;
        o.x += (dx / dist) * step;
        o.z += (dz / dist) * step;
        o.heading = Math.atan2(dx, dz);
        o.walkPhase += dt * 7;
        const swing = Math.sin(o.walkPhase) * 0.55;
        o.parts.armL.rotation.x = swing;
        o.parts.armR.rotation.x = -swing;
        o.parts.legL.rotation.x = -swing;
        o.parts.legR.rotation.x = swing;
      } else {
        o.arrestTimer += dt;
        o.parts.armL.rotation.x = -1.2;
        o.parts.armR.rotation.x = -1.2;
        if (o.arrestTimer > 1.2 && onArrest) {
          o.arrestTimer = -99; // fire once
          onArrest();
        }
      }
      o.mesh.position.set(o.x, 0, o.z);
      o.mesh.rotation.y = o.heading;
    }

    return { siren, rammed };
  }

  return {
    get wanted() { return wanted; },
    cars, officers,
    setWanted, addWanted, loseTrail, nearestPoliceCar, update,
  };
}

export default createPolice;
