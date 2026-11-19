// Low-poly people: boxy characters built from a few boxes, with a procedural
// walk cycle (legs/arms swing, body bobs). No skeletal animation, no GLTF.

import * as THREE from 'three';
import { box, mergeGeometries } from './merge.js';

const SKINS = [0xc68e5e, 0x8d5524, 0xe8b98a, 0x6b4226, 0xf1c27d];
const SHIRTS = [0x3fa7d6, 0xe5534b, 0x9b7ede, 0x2f9e44, 0xf2c94c, 0xff8a5c, 0xeeeeee, 0x22303e];
const PANTS = [0x22303e, 0x3a4a5a, 0x6b4f30, 0x4a4a4a];

function part(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Build a character. Faces -Z when heading = 0 (same convention as cars). */
export function buildCharacter(opts = {}) {
  const skin = opts.skin ?? SKINS[Math.floor(Math.random() * SKINS.length)];
  const shirt = opts.shirt ?? SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
  const pants = opts.pants ?? PANTS[Math.floor(Math.random() * PANTS.length)];
  const group = new THREE.Group();

  const legL = part(0.2, 0.8, 0.22, pants, -0.13, 0.4, 0);
  const legR = part(0.2, 0.8, 0.22, pants, 0.13, 0.4, 0);
  legL.geometry.translate(0, -0.4, 0);
  legR.geometry.translate(0, -0.4, 0);
  legL.position.y = 0.8;
  legR.position.y = 0.8;
  // torso: body + head + hair merged into one mesh (one draw call instead of three)
  const torso = new THREE.Mesh(
    mergeGeometries([
      box(0.55, 0.68, 0.3, shirt, 0, 1.14, 0),
      box(0.32, 0.32, 0.32, skin, 0, 1.66, 0),
      box(0.34, 0.12, 0.34, opts.hair ?? 0x1a1a1a, 0, 1.84, 0),
    ]),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }),
  );
  torso.castShadow = true;
  const armL = part(0.16, 0.62, 0.18, shirt, -0.36, 1.42, 0);
  const armR = part(0.16, 0.62, 0.18, shirt, 0.36, 1.42, 0);
  armL.geometry.translate(0, -0.31, 0);
  armR.geometry.translate(0, -0.31, 0);
  armL.position.y = 1.42;
  armR.position.y = 1.42;
  // a simple gun in the right hand when armed (hidden by default)
  const gun = part(0.08, 0.1, 0.42, 0x14161a, 0.36, 1.1, -0.2);
  gun.visible = false;

  group.add(legL, legR, torso, armL, armR, gun);
  return {
    group,
    parts: { legL, legR, armL, armR, torso, gun },
    /** Procedural walk: phase advances with distance, speed 0..1 scales the swing. */
    setWalk(phase, amount) {
      const s = Math.sin(phase) * 0.55 * amount;
      legL.rotation.x = s;
      legR.rotation.x = -s;
      armL.rotation.x = -s * 0.8;
      armR.rotation.x = s * 0.8;
      torso.position.y = Math.abs(Math.cos(phase)) * 0.05 * amount;
    },
    setArmed(armed) {
      gun.visible = armed;
      armR.rotation.x = armed ? -1.2 : 0;
    },
  };
}
