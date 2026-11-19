// Wanted system: stars 1-5, police cars that chase along the road graph and ram,
// foot officers at 3+ stars, and the "what they know" disguise system — change
// to an unseen car or outfit and the heat drops.

import * as THREE from 'three';
import { WANTED } from './config.js';
import { makeRng } from './random.js';
import { buildTrafficCar } from './vehicle3d.js';
import { buildCharacter } from './character.js';
import { edgePoint } from './traffic.js';

function edgeLen(e) {
  return Math.hypot(e.bx - e.ax, e.bz - e.az);
}

export function createPolice() {
  return {
    wanted: 0,
    knownCar: null, // {model, color} the police are looking for
    knownOutfit: null, // shirt colour the police are looking for
    losTimer: 0, // seconds with no police line of sight
    cars: [], // {mesh, edge, s, dir, speed, lightT}
    foot: [], // {char, pos, speed}
    rng: makeRng(1234),
  };
}

export function addWanted(police, n, known) {
  const before = police.wanted;
  police.wanted = Math.min(WANTED.max, police.wanted + n);
  if (known?.car) police.knownCar = known.car;
  if (known?.outfit) police.knownOutfit = known.outfit;
  if (police.wanted > before) police.losTimer = 0;
  return police.wanted;
}

/** Player changes car unseen, or changes outfit: the heat drops. */
export function disguiseDrop(police, kind) {
  if (kind === 'car' && police.knownCar) {
    police.knownCar = null;
    police.wanted = Math.max(0, police.wanted - WANTED.disguiseDrop);
    return true;
  }
  if (kind === 'outfit' && police.knownOutfit) {
    police.knownOutfit = null;
    police.wanted = Math.max(0, police.wanted - WANTED.disguiseDrop);
    return true;
  }
  return false;
}

function nearestNode(graph, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const n of graph.nodes.values()) {
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function spawnPoliceCar(police, city, scene, playerPos) {
  const rng = police.rng;
  // spawn at a node 60-110 m from the player
  let node = null;
  for (let tries = 0; tries < 20 && !node; tries++) {
    const cand = rng.pick([...city.roadGraph.nodes.values()]);
    const d = Math.hypot(cand.x - playerPos.x, cand.z - playerPos.z);
    if (d > 60 && d < 120) node = cand;
  }
  if (!node) node = nearestNode(city.roadGraph, playerPos.x, playerPos.z);
  const edges = city.roadGraph.edges.filter((e) =>
    (e.ax === node.x && e.az === node.z) || (e.bx === node.x && e.bz === node.z));
  const edge = edges.length ? rng.pick(edges) : city.roadGraph.edges[0];
  const mesh = buildTrafficCar(0x22303e, { police: true });
  // light bar (two small emissive boxes, toggled in step)
  const barMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2222, emissiveIntensity: 1.5 });
  const barMat2 = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2266ff, emissiveIntensity: 1.5 });
  const barL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4), barMat);
  const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4), barMat2);
  barL.position.set(-0.28, 1.38, 0.2);
  barR.position.set(0.28, 1.38, 0.2);
  mesh.add(barL, barR);
  scene.add(mesh);
  const car = {
    mesh, edge, dir: 1, s: 0, speed: 13, lightT: 0,
    barMat, barMat2, mode: 'graph',
  };
  police.cars.push(car);
  return car;
}

function spawnFootOfficer(police, scene, x, z) {
  const char = buildCharacter({ shirt: 0x1c2f45, pants: 0x1c2f45, hair: 0x111111 });
  char.group.position.set(x, 0, z);
  scene.add(char.group);
  const o = { char, pos: new THREE.Vector3(x, 0, z), speed: 5.2, phase: 0 };
  police.foot.push(o);
  return o;
}

export function stepPolice(police, ctx, dt) {
  const { city, scene } = ctx;
  const playerPos = ctx.player.pos;
  const wanted = police.wanted;

  // maintain car count
  const wantCars = WANTED.carsPerStar[wanted] || 0;
  while (police.cars.length < wantCars) spawnPoliceCar(police, city, scene, playerPos);
  while (police.cars.length > wantCars) {
    const c = police.cars.pop();
    scene.remove(c.mesh);
  }
  const wantFoot = WANTED.footPerStar[wanted] || 0;
  while (police.foot.length < wantFoot) {
    const a = police.rng.range(0, Math.PI * 2);
    spawnFootOfficer(police, scene, playerPos.x + Math.cos(a) * 25, playerPos.z + Math.sin(a) * 25);
  }
  while (police.foot.length > wantFoot) {
    const o = police.foot.pop();
    scene.remove(o.char.group);
  }

  // chase cars
  for (const car of police.cars) {
    car.lightT += dt;
    const on = Math.floor(car.lightT * 4) % 2 === 0;
    car.barMat.emissiveIntensity = on ? 2.2 : 0.2;
    car.barMat2.emissiveIntensity = on ? 0.2 : 2.2;
    const dx = playerPos.x - car.mesh.position.x;
    const dz = playerPos.z - car.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 26) {
      // close pursuit: steer straight at the player and ram
      car.mode = 'seek';
      const targetHeading = Math.atan2(-dx, -dz);
      let dh = targetHeading - car.mesh.rotation.y;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.mesh.rotation.y += THREE.MathUtils.clamp(dh, -2.4 * dt, 2.4 * dt);
      const fwdX = -Math.sin(car.mesh.rotation.y);
      const fwdZ = -Math.cos(car.mesh.rotation.y);
      const speed = 15 + wanted * 1.2;
      car.mesh.position.x += fwdX * speed * dt;
      car.mesh.position.z += fwdZ * speed * dt;
      if (dist < 3.4) {
        // ram: shove the player (or their car) and hurt them a little
        ctx.events.push('ram');
        if (ctx.playerCar) {
          const ch = ctx.playerCar.state.chassis;
          ch.velocity.x += dx / (dist || 1) * 6;
          ch.velocity.z += dz / (dist || 1) * 6;
        } else {
          ctx.player.pos.x += dx / (dist || 1) * 1.2;
          ctx.player.pos.z += dz / (dist || 1) * 1.2;
          ctx.hurtPlayer(4);
        }
        car.mesh.position.x -= fwdX * 2;
        car.mesh.position.z -= fwdZ * 2;
      }
    } else {
      // graph chase: at each node pick the edge that gets closer to the player
      car.mode = 'graph';
      const speed = 13 + wanted * 1.1;
      car.s += car.speed * car.dir * dt;
      car.speed += (speed - car.speed) * dt;
      const len = edgeLen(car.edge);
      if (car.s >= len || car.s <= 0) {
        const nodeX = car.s >= len ? car.edge.bx : car.edge.ax;
        const nodeZ = car.s >= len ? car.edge.bz : car.edge.az;
        const outs = city.roadGraph.edges.filter((e) =>
          (e.ax === nodeX && e.az === nodeZ) || (e.bx === nodeX && e.bz === nodeZ));
        let best = null;
        let bestD = Infinity;
        for (const e of outs) {
          const nx = e.ax === nodeX && e.az === nodeZ ? e.bx : e.ax;
          const nz = e.ax === nodeX && e.az === nodeZ ? e.bz : e.az;
          const d = Math.hypot(nx - playerPos.x, nz - playerPos.z);
          if (d < bestD) {
            bestD = d;
            best = e;
          }
        }
        if (best) {
          const atB = best.ax === nodeX && best.az === nodeZ;
          car.edge = best;
          car.dir = atB ? 1 : -1;
          car.s = atB ? 0 : edgeLen(best);
        } else {
          car.dir *= -1;
          car.s = Math.max(0, Math.min(len, car.s));
        }
      }
      const p = edgePoint(car.edge, Math.max(0, Math.min(len, car.s)), car.dir, 2.2);
      car.mesh.position.set(p.x, 0, p.z);
      car.mesh.rotation.y = p.heading;
    }
  }

  // foot officers run at the player; catching them on foot = busted
  for (const o of police.foot) {
    const dx = playerPos.x - o.pos.x;
    const dz = playerPos.z - o.pos.z;
    const dist = Math.hypot(dx, dz);
    o.phase += dt * 7;
    if (dist > 0.5) {
      o.pos.x += (dx / dist) * o.speed * dt;
      o.pos.z += (dz / dist) * o.speed * dt;
      o.char.group.position.copy(o.pos);
      o.char.group.rotation.y = Math.atan2(-dx, -dz);
      o.char.setWalk(o.phase, 1);
    }
    if (dist < 1.6 && !ctx.playerCar) {
      ctx.events.push('busted');
    }
    if (dist < 2.2 && ctx.playerCar) {
      // officer yanks at the door: slow the car, small chance to drag Juno out
      ctx.playerCar.state.chassis.velocity.x *= 0.96;
      ctx.playerCar.state.chassis.velocity.z *= 0.96;
    }
  }

  // escape: no police car close for a while -> one star fades
  if (wanted > 0) {
    let nearest = Infinity;
    for (const car of police.cars) {
      const d = Math.hypot(car.mesh.position.x - playerPos.x, car.mesh.position.z - playerPos.z);
      nearest = Math.min(nearest, d);
    }
    for (const o of police.foot) {
      nearest = Math.min(nearest, Math.hypot(o.pos.x - playerPos.x, o.pos.z - playerPos.z));
    }
    if (nearest > 70) {
      police.losTimer += dt;
      if (police.losTimer >= WANTED.decaySeconds) {
        police.losTimer = 0;
        police.wanted = Math.max(0, police.wanted - 1);
        ctx.events.push('cooled');
      }
    } else {
      police.losTimer = 0;
    }
  }
}
