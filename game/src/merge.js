// Minimal geometry helpers, written for this game (no addons): merge indexed
// BufferGeometries that share one material, and colour/transform boxes and
// cylinders before merging. Everything merged this way renders in one draw call.

import * as THREE from 'three';

/** Fill a geometry's `color` attribute with one flat colour. */
export function paint(geo, hex) {
  const color = new THREE.Color(hex);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Translate / rotate / scale a geometry in place. Angles in radians. */
export function place(geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  geo.applyMatrix4(m);
  return geo;
}

/** A box centred at (x, y, z), optionally rotated around Y and painted one colour. */
export function box(w, h, d, hex, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  paint(g, hex);
  if (x !== 0 || y !== 0 || z !== 0 || ry !== 0) place(g, x, y, z, ry);
  return g;
}

/** A cylinder (radiusTop, radiusBottom, height) painted one colour. */
export function cyl(rt, rb, h, hex, x = 0, y = 0, z = 0, seg = 8) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  paint(g, hex);
  if (x !== 0 || y !== 0 || z !== 0) place(g, x, y, z);
  return g;
}

/** Merge indexed geometries (position/normal/uv/color + index) into one geometry. */
export function mergeGeometries(geos) {
  let vCount = 0;
  let iCount = 0;
  let hasUv = false;
  let hasColor = false;
  for (const g of geos) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
    if (g.attributes.uv) hasUv = true;
    if (g.attributes.color) hasColor = true;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = hasUv ? new Float32Array(vCount * 2) : null;
  const col = hasColor ? new Float32Array(vCount * 3) : null;
  const idx = new Uint32Array(iCount);
  let vOff = 0;
  let iOff = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vOff * 3);
    nor.set(g.attributes.normal.array, vOff * 3);
    if (uv) {
      if (g.attributes.uv) uv.set(g.attributes.uv.array, vOff * 2);
      else uv.fill(0, vOff * 2, (vOff + n) * 2);
    }
    if (col) {
      if (g.attributes.color) col.set(g.attributes.color.array, vOff * 3);
      else col.fill(1, vOff * 3, (vOff + n) * 3);
    }
    if (g.index) {
      const src = g.index.array;
      for (let i = 0; i < src.length; i++) idx[iOff + i] = src[i] + vOff;
      iOff += src.length;
    } else {
      for (let i = 0; i < n; i++) idx[iOff + i] = vOff + i;
      iOff += n;
    }
    vOff += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
