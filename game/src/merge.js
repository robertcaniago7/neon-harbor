// BufferGeometry merge helper for the city: many static boxes/planes are merged
// into a few big geometries so the whole city renders in well under 100 draw calls.
// Works on non-indexed geometries with position/normal/uv + an optional color
// attribute, and applies a 4x4 matrix to each piece before merging.

import * as THREE from 'three';

// Merge an array of { geometry, matrix } pieces into one BufferGeometry.
// Each geometry is first converted to non-indexed form, then transformed.
export function mergePieces(pieces) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  let hasColor = false;

  for (const piece of pieces) {
    let g = piece.geometry;
    if (g.index) g = g.toNonIndexed();
    const m = piece.matrix || new THREE.Matrix4();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(m);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const col = g.attributes.color;
    if (col) hasColor = true;
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      positions.push(v.x, v.y, v.z);
      if (nor) {
        n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
        normals.push(n.x, n.y, n.z);
      } else {
        normals.push(0, 1, 0);
      }
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
      else uvs.push(0, 0);
      if (col) colors.push(col.getX(i), col.getY(i), col.getZ(i));
      else colors.push(1, 1, 1);
    }
    if (g !== piece.geometry) g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (hasColor) out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return out;
}

// Convenience: build a transformed box piece.
export function boxPiece(w, h, d, x, y, z, ry = 0, color = null) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (color !== null) {
    const c = new THREE.Color(color);
    const count = g.attributes.position.count;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
  return { geometry: g, matrix: m };
}

// Convenience: build a transformed plane piece (facing up by default).
export function planePiece(w, d, x, y, z, ry = 0, color = null) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  if (color !== null) {
    const c = new THREE.Color(color);
    const count = g.attributes.position.count;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
  return { geometry: g, matrix: m };
}

export default mergePieces;
