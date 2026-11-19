// Neon Harbor 3D — builds the city: ground, roads, sidewalks, buildings, palms,
// piers, neon signs, streetlights, and the road graph traffic/police drive on.

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, districtAt, isPark } from './config.js';
import { makeRng } from './random.js';
import { boxAt, groundAt, cylAt, coneAt, mergedMesh, mergedBasicMesh, mergeGeometries, paint } from './merge.js';

const W = CONFIG.world;
const P = CONFIG.palette;

/** Road-graph node id from grid indices. */
export function nodeId(ix, iz) {
  return iz * W.roadX.length + ix;
}

/** World position of a road-graph node. */
export function nodePos(ix, iz) {
  return { x: W.roadX[ix], z: W.roadZ[iz] };
}

/**
 * Build the road graph: intersections of every road X with every road Z.
 * Neighbours run along the same road to the adjacent intersection.
 */
export function buildRoadGraph() {
  const nx = W.roadX.length;
  const nz = W.roadZ.length;
  const neighbours = new Map();
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const id = nodeId(ix, iz);
      const list = [];
      if (ix > 0) list.push(nodeId(ix - 1, iz));
      if (ix < nx - 1) list.push(nodeId(ix + 1, iz));
      if (iz > 0) list.push(nodeId(ix, iz - 1));
      if (iz < nz - 1) list.push(nodeId(ix, iz + 1));
      neighbours.set(id, list);
    }
  }
  return { nx, nz, neighbours };
}

/** Nearest road-graph node (grid indices) to a world position. */
export function nearestNode(x, z) {
  let ix = 0;
  let best = Infinity;
  for (let i = 0; i < W.roadX.length; i++) {
    const d = Math.abs(W.roadX[i] - x);
    if (d < best) { best = d; ix = i; }
  }
  let iz = 0;
  best = Infinity;
  for (let i = 0; i < W.roadZ.length; i++) {
    const d = Math.abs(W.roadZ[i] - z);
    if (d < best) { best = d; iz = i; }
  }
  return { ix, iz, id: nodeId(ix, iz) };
}

/** Breadth-first path (list of node ids) across the road graph. */
export function bfsPath(graph, fromId, toId) {
  if (fromId === toId) return [fromId];
  const prev = new Map([[fromId, -1]]);
  const queue = [fromId];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const nb of graph.neighbours.get(cur) ?? []) {
      if (prev.has(nb)) continue;
      prev.set(nb, cur);
      if (nb === toId) {
        const path = [toId];
        let at = toId;
        while (prev.get(at) !== -1) {
          at = prev.get(at);
          path.unshift(at);
        }
        return path;
      }
      queue.push(nb);
    }
  }
  return [fromId];
}

/** Node grid indices from a node id. */
export function nodeIJ(id) {
  const nx = W.roadX.length;
  return { ix: id % nx, iz: Math.floor(id / nx) };
}

/**
 * Build the whole static city into the scene.
 * Returns { graph, buildings (AABBs), windowMat, neonMats, bounds }.
 */
export function buildCity(scene, seed = 1) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // ---- ground, sand, sea ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W.xMax - W.xMin + 60, W.zMax - W.zMin + 90),
    new THREE.MeshStandardMaterial({ color: P.ground, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 10);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(W.xMax - W.xMin + 60, W.beachZ1 - W.beachZ0),
    new THREE.MeshStandardMaterial({ color: P.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, (W.beachZ0 + W.beachZ1) / 2);
  sand.receiveShadow = true;
  group.add(sand);

  const seaMat = new THREE.MeshStandardMaterial({ color: P.seaDay, roughness: 0.25, metalness: 0.1 });
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(W.xMax - W.xMin + 120, 120),
    seaMat,
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.05, W.seaZ + 60);
  group.add(sea);

  // ---- roads (dark strips) + sidewalks (light borders) ----
  const roadGeoms = [];
  const walkGeoms = [];
  for (const x of W.roadX) {
    roadGeoms.push(groundAt(W.roadWidth, W.zMax - W.zMin + 20, x, 0, 0.03, P.road));
    walkGeoms.push(groundAt(3, W.zMax - W.zMin + 20, x - (W.roadWidth / 2 + 1.5), 0, 0.035, P.sidewalk));
    walkGeoms.push(groundAt(3, W.zMax - W.zMin + 20, x + (W.roadWidth / 2 + 1.5), 0, 0.035, P.sidewalk));
  }
  for (const z of W.roadZ) {
    roadGeoms.push(groundAt(W.xMax - W.xMin + 20, W.roadWidth, 0, z, 0.03, P.road));
    walkGeoms.push(groundAt(W.xMax - W.xMin + 20, 3, 0, z - (W.roadWidth / 2 + 1.5), 0.035, P.sidewalk));
    walkGeoms.push(groundAt(W.xMax - W.xMin + 20, 3, 0, z + (W.roadWidth / 2 + 1.5), 0.035, P.sidewalk));
  }
  // beach road along the sand
  roadGeoms.push(groundAt(W.xMax - W.xMin + 20, W.roadWidth, 0, 182, 0.03, P.road));
  group.add(mergedMesh(roadGeoms, { roughness: 0.95 }));
  group.add(mergedMesh(walkGeoms, { roughness: 0.95 }));

  // ---- buildings ----
  const buildings = []; // AABBs for collision {minX,maxX,minZ,maxZ,h}
  const byColor = new Map();
  const windowGeoms = [];
  const neonGeoms = { pink: [], cyan: [], amber: [] };
  const roofGeoms = [];
  for (let row = 0; row < W.blockZ.length; row++) {
    for (let col = 0; col < W.blockX.length; col++) {
      const cx = W.blockX[col];
      const cz = W.blockZ[row];
      if (isPark(col, row)) {
        // park: a few trees and a lawn block
        for (let t = 0; t < 5; t++) {
          const px = cx + rng.range(-16, 16);
          const pz = cz + rng.range(-14, 14);
          roofGeoms.push(cylAt(0.35, 0.5, 4.5, px, 2.2, pz, 0x6b4a2f, 6));
          roofGeoms.push(coneAt(2.6, 4.5, px, 6.2, pz, 0x3f7d3a, 7));
        }
        continue;
      }
      const district = districtAt(col, row);
      const def = CONFIG.districts[district];
      const nBuild = rng.int(1, 3);
      for (let b = 0; b < nBuild; b++) {
        const bw = rng.range(10, 18);
        const bd = rng.range(10, 18);
        const bh = rng.range(def.h[0], def.h[1]);
        const bx = cx + rng.range(-12, 12);
        const bz = cz + rng.range(-11, 11);
        const color = rng.pick(def.colors);
        const list = byColor.get(color) ?? [];
        list.push(boxAt(bw, bh, bd, bx, bh / 2, bz, color));
        byColor.set(color, list);
        buildings.push({ minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2, h: bh });
        // rooftop rim
        roofGeoms.push(boxAt(bw + 0.6, 0.5, bd + 0.6, bx, bh + 0.25, bz, 0x3a3f47));
        // windows on the south + north faces
        if (bh > 9) {
          const rows = Math.floor(bh / 4);
          const cols = Math.max(2, Math.floor(bw / 4));
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const wx = bx - bw / 2 + 2 + (c * (bw - 4)) / Math.max(1, cols - 1);
              const wy = 3 + r * 4;
              const wq = new THREE.PlaneGeometry(1.5, 2.0);
              wq.translate(wx, wy, bz + bd / 2 + 0.06);
              windowGeoms.push(wq);
              const wq2 = new THREE.PlaneGeometry(1.5, 2.0);
              wq2.rotateY(Math.PI);
              wq2.translate(wx, wy, bz - bd / 2 - 0.06);
              windowGeoms.push(wq2);
            }
          }
        }
        // neon sign on some tall downtown / harbour buildings
        if ((district === 'Downtown' || district === 'Harbor') && bh > 20 && rng.chance(0.55)) {
          const neonColor = rng.pick([P.neonPink, P.neonCyan, P.neonAmber]);
          const key = neonColor === P.neonPink ? 'pink' : neonColor === P.neonCyan ? 'cyan' : 'amber';
          neonGeoms[key].push(boxAt(rng.range(4, 8), 0.8, 0.5, bx, bh - 2, bz + bd / 2 + 0.35, neonColor));
        }
      }
    }
  }
  for (const geoms of byColor.values()) {
    const mesh = mergedMesh(geoms, { roughness: 0.9 });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (roofGeoms.length > 0) group.add(mergedMesh(roofGeoms, { roughness: 0.9 }));
  // windows (unlit; daynight recolours them)
  const windowMat = new THREE.MeshBasicMaterial({ color: P.windowDay });
  if (windowGeoms.length > 0) {
    const painted = windowGeoms.map((g) => paint(g, 0xffffff));
    const windowMesh = new THREE.Mesh(mergeGeometries(painted), windowMat);
    group.add(windowMesh);
  }
  // neon signs (unlit, always bright)
  const neonMats = {};
  for (const [key, geoms] of Object.entries(neonGeoms)) {
    if (geoms.length === 0) continue;
    const mesh = mergedBasicMesh(geoms);
    neonMats[key] = mesh.material;
    group.add(mesh);
  }

  // ---- palms along the beach and the south road ----
  const trunkGeoms = [];
  const leafGeoms = [];
  for (let x = -220; x <= 220; x += 22) {
    const px = x + rng.range(-4, 4);
    const pz = rng.range(186, 196);
    trunkGeoms.push(cylAt(0.28, 0.45, 6.5, px, 3.2, pz, 0x6b4a2f, 6));
    for (let l = 0; l < 4; l++) {
      const a = (l / 4) * Math.PI * 2 + rng.range(-0.3, 0.3);
      leafGeoms.push(coneAt(1.5, 3.6, px + Math.cos(a) * 1.6, 6.8, pz + Math.sin(a) * 1.6, 0x2e7d32, 5));
    }
  }
  if (trunkGeoms.length > 0) group.add(mergedMesh(trunkGeoms, { roughness: 1 }));
  if (leafGeoms.length > 0) group.add(mergedMesh(leafGeoms, { roughness: 1 }));

  // ---- piers into the sea (south-east, Harbor) ----
  const pierGeoms = [];
  for (const px of [150, 205]) {
    pierGeoms.push(boxAt(7, 0.7, 55, px, 0.9, 207, 0x8a6f4d));
    for (let z = 186; z <= 232; z += 9) {
      pierGeoms.push(cylAt(0.35, 0.35, 2.4, px - 3, 0.2, z, 0x5f4630, 6));
      pierGeoms.push(cylAt(0.35, 0.35, 2.4, px + 3, 0.2, z, 0x5f4630, 6));
    }
  }
  group.add(mergedMesh(pierGeoms, { roughness: 1 }));

  // ---- streetlights along the main roads ----
  const poleGeoms = [];
  const lampGeoms = [];
  for (const x of W.roadX) {
    for (const z of W.roadZ) {
      if (((x + z) % 100 + 100) % 100 !== 0) continue;
      poleGeoms.push(cylAt(0.09, 0.12, 5.4, x + 6.4, 2.7, z + 6.4, 0x2f333a, 6));
      lampGeoms.push(boxAt(0.9, 0.25, 0.4, x + 6.4, 5.5, z + 6.4, 0xfff2b0));
    }
  }
  if (poleGeoms.length > 0) group.add(mergedMesh(poleGeoms, { roughness: 0.8 }));
  if (lampGeoms.length > 0) group.add(mergedBasicMesh(lampGeoms));

  const graph = buildRoadGraph();
  return { graph, buildings, windowMat, neonMats, seaMat, bounds: W };
}
