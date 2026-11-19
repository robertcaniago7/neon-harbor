// Low-poly cars: one vertex-coloured merged body per car (one draw call), plus
// separate spinning/steering wheels for the player car. All original designs.

import * as THREE from 'three';
import { box, cyl, mergeGeometries, paint, place } from './merge.js';

const WHEEL_R = 0.36;

/** Build a car body (merged, vertex colours). Nose faces -Z. */
export function buildCarBody(color, opts = {}) {
  const geos = [];
  const c = opts.police ? 0x22303e : color;
  // lower body
  geos.push(box(1.9, 0.55, 4.4, c, 0, 0.55, 0));
  // cabin (dark glass)
  geos.push(box(1.7, 0.5, 2.1, 0x1a2530, 0, 1.05, 0.2));
  // hood + trunk hints
  geos.push(box(1.86, 0.18, 0.9, c, 0, 0.85, -1.7));
  geos.push(box(1.86, 0.18, 0.7, c, 0, 0.85, 1.75));
  // headlights / taillights
  geos.push(box(0.35, 0.14, 0.08, 0xfff2c0, -0.6, 0.62, -2.21));
  geos.push(box(0.35, 0.14, 0.08, 0xfff2c0, 0.6, 0.62, -2.21));
  geos.push(box(0.35, 0.14, 0.08, 0xff3b30, -0.6, 0.62, 2.21));
  geos.push(box(0.35, 0.14, 0.08, 0xff3b30, 0.6, 0.62, 2.21));
  if (opts.taxi) {
    geos.push(box(0.9, 0.22, 0.5, 0xf2c94c, 0, 1.42, 0.2));
    geos.push(box(0.5, 0.16, 0.3, 0x111111, 0, 1.6, 0.2));
  }
  if (opts.truck) {
    geos.push(box(1.9, 0.9, 1.6, 0x5f7280, 0, 1.15, 1.3));
  }
  const geo = mergeGeometries(geos);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

/** A wheel mesh (spins around X, steers around Y via its parent pivot). */
function makeWheel() {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.26, 10),
    new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 }),
  );
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.28, 8),
    new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 0.35, metalness: 0.6 }),
  );
  hub.rotation.z = Math.PI / 2;
  g.add(tire, hub);
  return g;
}

/**
 * Full player car: merged body + 4 steerable/spinning wheels.
 * Nose faces -Z (matches the physics chassis forward).
 */
export function buildPlayerCar(color, opts = {}) {
  const group = new THREE.Group();
  const body = buildCarBody(color, opts);
  group.add(body);
  const wheels = [];
  const positions = [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]];
  for (const [x, z] of positions) {
    const pivot = new THREE.Group();
    pivot.position.set(x, WHEEL_R, z);
    const wheel = makeWheel();
    pivot.add(wheel);
    group.add(pivot);
    wheels.push({ pivot, wheel });
  }
  let lightBar = null;
  if (opts.police) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 1 }));
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x000033, emissive: 0x2266ff, emissiveIntensity: 1 }));
    red.position.set(-0.28, 1.38, 0.2);
    blue.position.set(0.28, 1.38, 0.2);
    lightBar.add(red, blue);
    lightBar.userData = { red, blue };
    group.add(lightBar);
  }
  return { group, body, wheels, lightBar };
}

/** Traffic / police car: a single merged mesh (wheels baked in, no spin). */
export function buildTrafficCar(color, opts = {}) {
  const geos = [];
  const c = opts.police ? 0x22303e : color;
  geos.push(box(1.9, 0.55, 4.4, c, 0, 0.55, 0));
  geos.push(box(1.7, 0.5, 2.1, 0x1a2530, 0, 1.05, 0.2));
  geos.push(box(0.35, 0.14, 0.08, 0xfff2c0, -0.6, 0.62, -2.21));
  geos.push(box(0.35, 0.14, 0.08, 0xfff2c0, 0.6, 0.62, -2.21));
  geos.push(box(0.35, 0.14, 0.08, 0xff3b30, -0.6, 0.62, 2.21));
  geos.push(box(0.35, 0.14, 0.08, 0xff3b30, 0.6, 0.62, 2.21));
  // baked wheels (cylinders rotated so the axle runs along X)
  for (const [x, z] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const w = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.26, 8);
    paint(w, 0x14161a);
    place(w, x, WHEEL_R, z, 0, 0, Math.PI / 2);
    geos.push(w);
  }
  const geo = mergeGeometries(geos);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}
