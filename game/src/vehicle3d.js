// Neon Harbor 3D — vehicle3d.js
// Builds car meshes: body, cabin, wheels, headlights. One builder per model,
// with a police variant (light bar + dark livery).

import * as THREE from '../vendor/three.module.min.js';
import { CAR_PHYSICS } from './config.js';

export function buildCarMesh(model, isPolice = false) {
  const group = new THREE.Group();
  const bodyColor = isPolice ? 0x22303e : model.color;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.62, 4.4),
    new THREE.MeshLambertMaterial({ color: bodyColor })
  );
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.55, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1c2733 })
  );
  cabin.position.set(0, 1.18, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  // hood + trunk hints
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.18, 1.0),
    new THREE.MeshLambertMaterial({ color: bodyColor })
  );
  hood.position.set(0, 0.98, 1.6);
  group.add(hood);

  // headlights (two bright quads at the front)
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.1), lightMat);
    hl.position.set(sx, 0.72, 2.21);
    group.add(hl);
  }
  // taillights
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2d3a });
  for (const sx of [-0.6, 0.6]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.1), tailMat);
    tl.position.set(sx, 0.72, -2.21);
    group.add(tl);
  }

  if (isPolice) {
    // light bar on the roof
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    bar.position.set(0, 1.55, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.32, 1.56, -0.2);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.set(0.32, 1.56, -0.2);
    group.add(red, blue);
    // white doors stripe
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.92, 0.3, 2.0),
      new THREE.MeshLambertMaterial({ color: 0xf5f5f0 })
    );
    stripe.position.set(0, 0.62, -0.1);
    group.add(stripe);
  }

  // wheels (visual only; physics wheels are separate objects)
  const wheelGeo = new THREE.CylinderGeometry(CAR_PHYSICS.wheelRadius, CAR_PHYSICS.wheelRadius, CAR_PHYSICS.wheelWidth, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181d });
  const wheels = [];
  const wx = CAR_PHYSICS.wheelTrack;
  const wz = CAR_PHYSICS.wheelBase;
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, CAR_PHYSICS.wheelRadius, z);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  }

  group.userData.wheels = wheels;
  return group;
}

// Steer the front wheels and spin all wheels by distance travelled.
export function animateCarWheels(mesh, steerAngle, distance) {
  const wheels = mesh.userData.wheels || [];
  wheels.forEach((w, i) => {
    const isFront = i < 2;
    w.rotation.y = isFront ? steerAngle : 0;
    w.rotation.x += distance / CAR_PHYSICS.wheelRadius;
  });
}
