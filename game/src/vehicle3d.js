// Neon Harbor 3D — builds car meshes (body, cabin, wheels, headlights) as one
// merged, vertex-coloured mesh per car, so each car costs a single draw call.

import * as THREE from '../vendor/three.module.min.js';
import { boxAt, cylAt, mergeGeometries, paint } from './merge.js';

/**
 * Build a car mesh for a model definition.
 * model: { name, color, speed, grip } — the colour is the body paint.
 * Returns a THREE.Mesh whose origin is at ground level, facing +Z (forward).
 * Length ~4.4 m, width ~1.9 m, matching the physics chassis half extents.
 */
export function buildCarMesh(model, opts = {}) {
  const body = model.color;
  const dark = 0x14181f;
  const glass = 0x1b2b3a;
  const parts = [];
  // main body
  parts.push(boxAt(1.9, 0.62, 4.4, 0, 0.55, 0, body));
  // cabin
  parts.push(boxAt(1.6, 0.55, 2.2, 0, 1.1, -0.25, glass));
  // hood / trunk accents
  parts.push(boxAt(1.86, 0.12, 1.0, 0, 0.9, 1.55, body));
  parts.push(boxAt(1.86, 0.12, 0.8, 0, 0.9, -1.7, body));
  // bumpers
  parts.push(boxAt(1.92, 0.22, 0.3, 0, 0.32, 2.2, dark));
  parts.push(boxAt(1.92, 0.22, 0.3, 0, 0.32, -2.2, dark));
  // headlights (front, +Z) and taillights
  parts.push(boxAt(0.42, 0.16, 0.08, -0.62, 0.62, 2.21, 0xfff6c9));
  parts.push(boxAt(0.42, 0.16, 0.08, 0.62, 0.62, 2.21, 0xfff6c9));
  parts.push(boxAt(0.42, 0.14, 0.08, -0.62, 0.62, -2.21, 0xff2d2d));
  parts.push(boxAt(0.42, 0.14, 0.08, 0.62, 0.62, -2.21, 0xff2d2d));
  // wheels (static in the merged mesh; the physics chassis carries the car)
  const wheelPos = [
    [-0.85, 0.36, 1.45], [0.85, 0.36, 1.45],
    [-0.85, 0.36, -1.45], [0.85, 0.36, -1.45],
  ];
  for (const [wx, wy, wz] of wheelPos) {
    const w = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
    w.rotateZ(Math.PI / 2);
    paint(w, dark);
    w.translate(wx, wy, wz);
    parts.push(w);
    const hub = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8);
    hub.rotateZ(Math.PI / 2);
    paint(hub, 0x9aa0a8);
    hub.translate(wx, wy, wz);
    parts.push(hub);
  }
  // police light bar: red on the left half, blue on the right half
  if (opts.police) {
    parts.push(boxAt(0.45, 0.18, 0.4, -0.23, 1.5, -0.25, 0xff2d2d));
    parts.push(boxAt(0.45, 0.18, 0.4, 0.23, 1.5, -0.25, 0x2d7dff));
  }
  // taxi sign
  if (opts.taxi) {
    parts.push(boxAt(0.7, 0.22, 0.4, 0, 1.5, -0.25, 0xf2c94c));
  }
  const geom = mergeGeometries(parts);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = model.name;
  return mesh;
}

/** A small glowing pickup marker (health / armor / ammo / cash). */
export function buildPickupMesh(kind) {
  const colors = { health: 0x37d67a, armor: 0x3fa7d6, ammo: 0xf2c94c, cash: 0x2fd67a };
  const g = new THREE.BoxGeometry(0.55, 0.55, 0.55);
  paint(g, colors[kind] ?? 0xffffff);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: colors[kind] ?? 0xffffff, emissiveIntensity: 0.55, roughness: 0.4 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = `pickup-${kind}`;
  return mesh;
}
