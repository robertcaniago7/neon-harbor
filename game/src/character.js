// Neon Harbor 3D — character.js
// Builds low-poly pedestrian / player character meshes: legs, torso, head,
// arms, with a simple walk swing. One mesh per person, cheap and readable.

import * as THREE from '../vendor/three.module.min.js';
import { PLAYER } from './config.js';

const SKINS = [0xf2c9a0, 0xc98d5f, 0x8a5a3b, 0xe8b88a];
const SHIRTS = [0xff2d95, 0x00e5ff, 0xffb020, 0x9b7ede, 0x3fa7d6, 0xe5534b, 0x2e8b57];
const PANTS = [0x22303e, 0x454a55, 0x6b4a2a, 0x2a3442];

export function buildCharacterMesh(opts = {}) {
  const {
    skin = SKINS[0],
    shirt = SHIRTS[0],
    pants = PANTS[0],
    isPlayer = false,
  } = opts;
  const g = new THREE.Group();

  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });

  // legs
  const legGeo = new THREE.BoxGeometry(0.22, 0.8, 0.22);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.14, 0.4, 0);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.14, 0.4, 0);
  legL.castShadow = true;
  legR.castShadow = true;
  g.add(legL, legR);

  // torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), shirtMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);

  // arms
  const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.16);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.4, 1.15, 0);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.4, 1.15, 0);
  g.add(armL, armR);

  // head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);

  // player gets a dark jacket + cap so Juno reads on screen
  if (isPlayer) {
    const jacket = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.5, 0.38),
      new THREE.MeshLambertMaterial({ color: 0x1c2733 })
    );
    jacket.position.y = 1.2;
    g.add(jacket);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.14, 0.46),
      new THREE.MeshLambertMaterial({ color: 0xff2d95 })
    );
    cap.position.y = 1.96;
    g.add(cap);
  }

  g.userData.parts = { legL, legR, armL, armR, head, torso };
  g.userData.height = PLAYER.height;
  return g;
}

// Swing limbs for a walk cycle; phase advances with distance.
export function animateWalk(mesh, phase, speedFactor = 1) {
  const p = mesh.userData.parts;
  if (!p) return;
  const swing = 0.55 * speedFactor;
  p.legL.rotation.x = Math.sin(phase) * swing;
  p.legR.rotation.x = -Math.sin(phase) * swing;
  p.armL.rotation.x = -Math.sin(phase) * swing * 0.8;
  p.armR.rotation.x = Math.sin(phase) * swing * 0.8;
}

export function randomOutfit(rng) {
  return {
    skin: rng.pick(SKINS),
    shirt: rng.pick(SHIRTS),
    pants: rng.pick(PANTS),
  };
}
