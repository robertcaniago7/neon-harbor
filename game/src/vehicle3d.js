// Car meshes: body, cabin, wheels, headlights, tail lights.
// One builder for every car model; police cars get a light bar + livery stripe.

import * as THREE from 'three';

const BODY_MAT_CACHE = new Map();
const DARK_MAT = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.35, metalness: 0.6 });
const GLASS_MAT = new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.1, metalness: 0.9 });
const TYRE_MAT = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
const HUB_MAT = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.3, metalness: 0.85 });
const LIGHT_FRONT_MAT = new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xffedb5, emissiveIntensity: 1.6 });
const LIGHT_REAR_MAT = new THREE.MeshStandardMaterial({ color: 0xff2a22, emissive: 0xd2100a, emissiveIntensity: 1.2 });
const POLICE_WHITE = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.4, metalness: 0.3 });

function bodyMaterial(color) {
  if (!BODY_MAT_CACHE.has(color)) {
    BODY_MAT_CACHE.set(color, new THREE.MeshStandardMaterial({
      color, roughness: 0.32, metalness: 0.55,
    }));
  }
  return BODY_MAT_CACHE.get(color);
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function wheel(r, w) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), TYRE_MAT);
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 10), HUB_MAT);
  hub.rotation.z = Math.PI / 2;
  g.add(tyre, hub);
  return g;
}

// Build a car mesh. `model` is { name, color, speed, grip }.
// Options: { police: true } adds a light bar and white doors.
// Returns { group, wheels: [4 wheel groups], body } — wheels spin by index:
// [front-left, front-right, rear-left, rear-right].
export function buildCarMesh(model, opts = {}) {
  const group = new THREE.Group();
  const isTruck = /Truck|Van/i.test(model.name);
  const len = isTruck ? 5.4 : 4.4;
  const wid = isTruck ? 2.1 : 1.9;
  const bodyH = isTruck ? 0.85 : 0.55;
  const bodyY = isTruck ? 0.78 : 0.55;
  const mat = bodyMaterial(model.color);

  // Main body + nose taper (a slightly smaller front box reads as a hood).
  const body = box(wid, bodyH, len, mat, 0, bodyY, 0);
  group.add(body);
  const hood = box(wid * 0.94, bodyH * 0.62, len * 0.24, mat, 0, bodyY - 0.04, len * 0.4);
  group.add(hood);

  // Cabin / cargo box.
  if (isTruck) {
    const cargo = box(wid * 0.96, 1.05, len * 0.42, mat, 0, bodyY + 0.85, -len * 0.2);
    group.add(cargo);
    const cab = box(wid * 0.92, 0.7, len * 0.26, GLASS_MAT, 0, bodyY + 0.75, len * 0.22);
    group.add(cab);
  } else {
    const cabin = box(wid * 0.82, 0.5, len * 0.46, GLASS_MAT, 0, bodyY + bodyH / 2 + 0.22, -len * 0.06);
    group.add(cabin);
    const roof = box(wid * 0.8, 0.07, len * 0.42, mat, 0, bodyY + bodyH / 2 + 0.5, -len * 0.06);
    group.add(roof);
  }

  // Bumpers.
  group.add(box(wid * 1.02, 0.18, 0.22, DARK_MAT, 0, 0.32, len / 2));
  group.add(box(wid * 1.02, 0.18, 0.22, DARK_MAT, 0, 0.32, -len / 2));

  // Headlights + tail lights.
  const hlZ = len / 2 + 0.02;
  group.add(box(0.34, 0.14, 0.06, LIGHT_FRONT_MAT, -wid * 0.32, 0.62, hlZ));
  group.add(box(0.34, 0.14, 0.06, LIGHT_FRONT_MAT, wid * 0.32, 0.62, hlZ));
  group.add(box(0.34, 0.12, 0.06, LIGHT_REAR_MAT, -wid * 0.32, 0.62, -hlZ));
  group.add(box(0.34, 0.12, 0.06, LIGHT_REAR_MAT, wid * 0.32, 0.62, -hlZ));

  // Wheels.
  const wheelR = 0.36;
  const wheelW = 0.28;
  const fx = len * 0.32;
  const wx = wid / 2 + 0.02;
  const wheels = [
    wheel(wheelR, wheelW), wheel(wheelR, wheelW),
    wheel(wheelR, wheelW), wheel(wheelR, wheelW),
  ];
  wheels[0].position.set(-wx, wheelR, fx);
  wheels[1].position.set(wx, wheelR, fx);
  wheels[2].position.set(-wx, wheelR, -fx);
  wheels[3].position.set(wx, wheelR, -fx);
  wheels.forEach((w) => group.add(w));

  // Police livery: white doors + roof light bar.
  let lightBar = null;
  if (opts.police) {
    const doorL = box(0.04, 0.4, len * 0.34, POLICE_WHITE, -wid / 2 - 0.01, 0.62, -len * 0.04);
    const doorR = box(0.04, 0.4, len * 0.34, POLICE_WHITE, wid / 2 + 0.01, 0.62, -len * 0.04);
    group.add(doorL, doorR);
    lightBar = new THREE.Group();
    const barBase = box(0.9, 0.09, 0.3, DARK_MAT, 0, 0, 0);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.26),
      new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 2 }));
    red.position.x = -0.24;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.26),
      new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x1020ff, emissiveIntensity: 2 }));
    blue.position.x = 0.24;
    lightBar.add(barBase, red, blue);
    lightBar.position.set(0, bodyY + bodyH / 2 + 0.56, -len * 0.06);
    lightBar.userData.red = red;
    lightBar.userData.blue = blue;
    group.add(lightBar);
  }

  group.userData.length = len;
  group.userData.width = wid;
  group.userData.wheels = wheels;
  return { group, wheels, body, lightBar };
}

export default buildCarMesh;
