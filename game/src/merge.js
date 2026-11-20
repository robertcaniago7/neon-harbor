// Neon Harbor 3D — merge.js
// Small BufferGeometry merge helper so the city renders in few draw calls.
// Geometries are merged per material colour; each merged mesh keeps one
// material, so a whole district of boxes becomes a single draw call.

import * as THREE from '../vendor/three.module.min.js';

export function mergeBoxes(items) {
  // items: [{ w, h, d, x, y, z, ry?, color }]
  const byColor = new Map();
  for (const it of items) {
    const key = it.color;
    if (!byColor.has(key)) byColor.set(key, []);
    byColor.get(key).push(it);
  }
  const meshes = [];
  for (const [color, list] of byColor) {
    const geos = [];
    for (const it of list) {
      const g = new THREE.BoxGeometry(it.w, it.h, it.d);
      if (it.ry) g.rotateY(it.ry);
      g.translate(it.x, it.y, it.z);
      geos.push(g);
    }
    const merged = mergeGeometries(geos);
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }
  return meshes;
}

export function mergeGeometries(geos) {
  let posCount = 0;
  let idxCount = 0;
  for (const g of geos) {
    posCount += g.attributes.position.count;
    idxCount += g.index ? g.index.count : 0;
  }
  const positions = new Float32Array(posCount * 3);
  const normals = new Float32Array(posCount * 3);
  const uvs = new Float32Array(posCount * 2);
  const index = new Uint32Array(idxCount);
  let pOff = 0;
  let iOff = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    positions.set(g.attributes.position.array, pOff * 3);
    if (g.attributes.normal) normals.set(g.attributes.normal.array, pOff * 3);
    if (g.attributes.uv) uvs.set(g.attributes.uv.array, pOff * 2);
    if (g.index) {
      const arr = g.index.array;
      for (let i = 0; i < arr.length; i++) index[iOff + i] = arr[i] + pOff;
      iOff += arr.length;
    }
    pOff += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

// Merge a list of already-built meshes (same material) into one mesh.
export function mergeMeshes(meshes, material) {
  const geos = [];
  for (const m of meshes) {
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    geos.push(g);
  }
  const merged = mergeGeometries(geos);
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
