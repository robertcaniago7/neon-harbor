// Neon Harbor 3D — BufferGeometry merge helper for the city (instancing by merging).
// Builds coloured geometry pieces and merges same-material pieces into one mesh,
// which keeps the whole city to a few dozen draw calls.

import * as THREE from '../vendor/three.module.min.js';

/** Paint every vertex of a geometry with one colour (adds a `color` attribute). */
export function paint(geom, hex) {
  const c = new THREE.Color(hex);
  const n = geom.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geom;
}

/** A box of size (w,h,d), painted one colour, centred at (x, y, z), rotated ry around Y. */
export function boxAt(w, h, d, x, y, z, color, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  paint(g, color);
  if (ry !== 0) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

/** A flat plane (w x d) lying on the ground at y, painted one colour. */
export function groundAt(w, d, x, z, y, color) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  paint(g, color);
  g.translate(x, y, z);
  return g;
}

/** A cylinder (radiusTop, radiusBottom, height), painted one colour, at (x, y, z). */
export function cylAt(rTop, rBottom, h, x, y, z, color, segments = 8) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments);
  paint(g, color);
  g.translate(x, y, z);
  return g;
}

/** A cone (radius, height), painted one colour, at (x, y, z). */
export function coneAt(r, h, x, y, z, color, segments = 8) {
  const g = new THREE.ConeGeometry(r, h, segments);
  paint(g, color);
  g.translate(x, y, z);
  return g;
}

/** A sphere (radius), painted one colour, at (x, y, z). */
export function sphereAt(r, x, y, z, color, wSeg = 10, hSeg = 8) {
  const g = new THREE.SphereGeometry(r, wSeg, hSeg);
  paint(g, color);
  g.translate(x, y, z);
  return g;
}

/**
 * Merge indexed geometries that all carry position/normal/uv/color into one.
 * Every input must be indexed and carry those four attributes.
 */
export function mergeGeometries(geoms) {
  let vCount = 0;
  let iCount = 0;
  for (const g of geoms) {
    vCount += g.attributes.position.count;
    iCount += g.index.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  let vOff = 0;
  let iOff = 0;
  for (const g of geoms) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const u = g.attributes.uv;
    const c = g.attributes.color;
    pos.set(p.array, vOff * 3);
    nor.set(n.array, vOff * 3);
    uv.set(u.array, vOff * 2);
    col.set(c.array, vOff * 3);
    const gi = g.index.array;
    for (let k = 0; k < gi.length; k++) idx[iOff + k] = gi[k] + vOff;
    vOff += p.count;
    iOff += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/** Build a Mesh from merged geometry with a vertex-coloured standard material. */
export function mergedMesh(geoms, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.05,
  });
  const mesh = new THREE.Mesh(mergeGeometries(geoms), mat);
  mesh.castShadow = opts.castShadow ?? false;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  return mesh;
}

/** Build a Mesh from merged geometry with an unlit (basic) vertex-coloured material. */
export function mergedBasicMesh(geoms) {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(mergeGeometries(geoms), mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
