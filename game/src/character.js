// Character meshes: simple articulated low-poly people.
// Player (Juno) is a distinct jacket + dark hair; pedestrians vary by palette;
// gang members wear rust-red; police wear navy with a cap.

import * as THREE from 'three';

function mat(color, rough = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });
}

const SKIN = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0];
const SHIRTS = [0x3fa7d6, 0xe5534b, 0x7a8b99, 0x9b7ede, 0xff8a5c, 0x4f9e57, 0xf2c94c, 0xc9a86a];
const PANTS = [0x2a3442, 0x3a3f4a, 0x5a4a3a, 0x22303e];

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Build a person. opts: { skin, shirt, pants, jacket, gang, police, hat }.
// Returns { group, parts: { head, torso, armL, armR, legL, legR } }.
// Limbs pivot at the shoulder/hip so the walk cycle can swing them.
export function buildCharacterMesh(opts = {}) {
  const rng = opts.rng;
  const pick = (arr) => (rng ? arr[Math.floor(rng.next() * arr.length)] : arr[0]);
  const skin = opts.skin ?? pick(SKIN);
  const shirt = opts.shirt ?? pick(SHIRTS);
  const pants = opts.pants ?? pick(PANTS);

  const group = new THREE.Group();
  const skinMat = mat(skin);
  const shirtMat = mat(opts.gang ? 0xb03a2e : opts.police ? 0x22303e : shirt);
  const pantsMat = mat(opts.police ? 0x1a2432 : pants);
  const jacketMat = opts.jacket ? mat(opts.jacket, 0.6) : null;

  // Legs (pivot groups at hip height y=0.82).
  const legL = new THREE.Group();
  legL.position.set(-0.11, 0.82, 0);
  legL.add(box(0.16, 0.82, 0.18, pantsMat, 0, -0.41, 0));
  const legR = new THREE.Group();
  legR.position.set(0.11, 0.82, 0);
  legR.add(box(0.16, 0.82, 0.18, pantsMat, 0, -0.41, 0));

  // Torso (pivot at shoulder line for a slight lean).
  const torso = new THREE.Group();
  torso.position.set(0, 0.82, 0);
  torso.add(box(0.46, 0.58, 0.26, shirtMat, 0, 0.29, 0));
  if (jacketMat) {
    torso.add(box(0.5, 0.5, 0.3, jacketMat, 0, 0.3, 0));
  }
  if (opts.police) {
    torso.add(box(0.48, 0.08, 0.28, mat(0xd8d8d8), 0, 0.52, 0));
  }

  // Arms (pivot groups at shoulder height).
  const armL = new THREE.Group();
  armL.position.set(-0.29, 1.32, 0);
  armL.add(box(0.13, 0.56, 0.15, shirtMat, 0, -0.26, 0));
  armL.add(box(0.12, 0.16, 0.13, skinMat, 0, -0.6, 0));
  const armR = new THREE.Group();
  armR.position.set(0.29, 1.32, 0);
  armR.add(box(0.13, 0.56, 0.15, shirtMat, 0, -0.26, 0));
  armR.add(box(0.12, 0.16, 0.13, skinMat, 0, -0.6, 0));

  // Head.
  const head = new THREE.Group();
  head.position.set(0, 1.44, 0);
  head.add(box(0.3, 0.3, 0.28, skinMat, 0, 0.16, 0));
  // Hair cap.
  const hairMat = mat(opts.police ? 0x1a1a1a : 0x2a1a0e);
  head.add(box(0.32, 0.1, 0.3, hairMat, 0, 0.32, 0));
  head.add(box(0.32, 0.22, 0.06, hairMat, 0, 0.2, -0.13));
  if (opts.police) {
    // Cap brim.
    head.add(box(0.32, 0.05, 0.34, mat(0x22303e), 0, 0.34, 0.02));
  }
  if (opts.gang) {
    // Rust-red bandana.
    head.add(box(0.32, 0.08, 0.3, mat(0xb03a2e), 0, 0.28, 0));
  }

  group.add(legL, legR, torso, armL, armR, head);
  group.userData.height = 1.8;

  return {
    group,
    parts: { head, torso, armL, armR, legL, legR },
  };
}

// Juno Voss, the player: teal jacket, dark hair, dark jeans.
export function buildPlayerMesh() {
  return buildCharacterMesh({
    skin: 0xe8b98a, shirt: 0x2a3442, pants: 0x22303e, jacket: 0x2e7f8f,
  });
}

export default buildCharacterMesh;
