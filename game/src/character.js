// Neon Harbor 3D — builds pedestrian / player character meshes as one merged,
// vertex-coloured mesh per person (a single draw call each).

import * as THREE from '../vendor/three.module.min.js';
import { boxAt, sphereAt, mergeGeometries } from './merge.js';

/**
 * Build a low-poly person. Origin at ground level, facing +Z.
 * opts: { shirt, pants, skin, hair } as hex colours, height scale (default 1.8 m).
 * Returns a THREE.Mesh; the whole figure bobs/sways as one piece when walking.
 */
export function buildCharacterMesh(opts = {}) {
  const shirt = opts.shirt ?? 0x3fa7d6;
  const pants = opts.pants ?? 0x2f333a;
  const skin = opts.skin ?? 0xd9a066;
  const hair = opts.hair ?? 0x2b2118;
  const parts = [];
  // legs
  parts.push(boxAt(0.2, 0.75, 0.22, -0.14, 0.375, 0, pants));
  parts.push(boxAt(0.2, 0.75, 0.22, 0.14, 0.375, 0, pants));
  // torso
  parts.push(boxAt(0.62, 0.7, 0.34, 0, 1.1, 0, shirt));
  // arms
  parts.push(boxAt(0.16, 0.62, 0.18, -0.4, 1.05, 0, shirt));
  parts.push(boxAt(0.16, 0.62, 0.18, 0.4, 1.05, 0, shirt));
  // hands
  parts.push(sphereAt(0.09, -0.4, 0.72, 0, skin, 6, 5));
  parts.push(sphereAt(0.09, 0.4, 0.72, 0, skin, 6, 5));
  // head + hair
  parts.push(sphereAt(0.21, 0, 1.62, 0, skin, 10, 8));
  parts.push(sphereAt(0.22, 0, 1.68, -0.03, hair, 10, 8));
  // shoes
  parts.push(boxAt(0.22, 0.1, 0.34, -0.14, 0.05, 0.04, 0x14181f));
  parts.push(boxAt(0.22, 0.1, 0.34, 0.14, 0.05, 0.04, 0x14181f));
  const geom = mergeGeometries(parts);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.02 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Juno Voss, the player: teal jacket, dark jeans, dark hair. */
export function buildPlayerMesh() {
  return buildCharacterMesh({ shirt: 0x2f8f7a, pants: 0x2f333a, skin: 0xd9a066, hair: 0x1c1410 });
}

/** A gang member (Rust Vultures): rust-red jacket. */
export function buildGangMesh() {
  return buildCharacterMesh({ shirt: 0xb03a2e, pants: 0x3a3f47, skin: 0xc98d5f, hair: 0x14100c });
}

/** A police foot officer: navy uniform, cap. */
export function buildOfficerMesh() {
  const mesh = buildCharacterMesh({ shirt: 0x22303e, pants: 0x1b2530, skin: 0xd9a066, hair: 0x22303e });
  return mesh;
}
