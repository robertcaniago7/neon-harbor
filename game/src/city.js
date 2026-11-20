// City builder: ground, roads, sidewalks, buildings (merged), palms, piers,
// beach, sea, neon signs — plus the road graph traffic and police drive on.
// All static geometry is merged into a handful of draw calls.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mergePieces, boxPiece, planePiece } from './merge.js';

const C = CONFIG.colors;

// District for a block (col 0..8, row 0..6). Rows run north 0 to south 6.
export function districtAt(col, row) {
  if (row >= 5) return col >= 6 ? 'Harbor' : 'Palma Beach';
  if (col <= 2) return 'Old Town';
  if (row <= 1) return 'Midtown';
  if (col >= 6 && row <= 2) return 'The Yards';
  if (col >= 3 && col <= 5 && row >= 2 && row <= 4) return 'Downtown';
  if (col >= 6 && row >= 3 && row <= 4) return 'Midtown';
  return 'Midtown';
}

function isPark(col, row) {
  return CONFIG.parks.some((p) => p[0] === col && p[1] === row);
}

// Road graph: nodes at every road intersection, edges along the roads.
function buildRoadGraph() {
  const nodes = [];
  const index = new Map();
  const xs = CONFIG.roadX;
  const zs = CONFIG.roadZ;
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < zs.length; j++) {
      const id = nodes.length;
      nodes.push({ id, x: xs[i], z: zs[j], i, j });
      index.set(`${i},${j}`, id);
    }
  }
  const adjacency = nodes.map(() => []);
  const link = (a, b) => {
    adjacency[a].push(b);
    adjacency[b].push(a);
  };
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < zs.length; j++) {
      const id = index.get(`${i},${j}`);
      if (i + 1 < xs.length) link(id, index.get(`${i + 1},${j}`));
      if (j + 1 < zs.length) link(id, index.get(`${i},${j + 1}`));
    }
  }
  function nearestNode(x, z) {
    let best = 0;
    let bestD = Infinity;
    for (const n of nodes) {
      const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
      if (d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    return best;
  }
  function randomNode(rng) {
    return Math.floor(rng.next() * nodes.length);
  }
  return { nodes, adjacency, nearestNode, randomNode };
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  group.name = 'city';

  // ---- ground base (concrete) --------------------------------------
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x6f757e, roughness: 0.95 });
  const base = new THREE.Mesh(new THREE.PlaneGeometry(700, 620), baseMat);
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, -0.05, 10);
  base.receiveShadow = true;
  group.add(base);

  // ---- roads + sidewalks (merged flat planes) ----------------------
  const roadPieces = [];
  const walkPieces = [];
  for (const x of CONFIG.roadX) {
    roadPieces.push(planePiece(CONFIG.roadWidth, 380, x, 0.0, 0, 0, C.road));
    walkPieces.push(planePiece(2.5, 380, x - 6.2, 0.02, 0, 0, C.sidewalk));
    walkPieces.push(planePiece(2.5, 380, x + 6.2, 0.02, 0, 0, C.sidewalk));
  }
  for (const z of CONFIG.roadZ) {
    roadPieces.push(planePiece(470, CONFIG.roadWidth, 0, 0.0, z, 0, C.road));
    walkPieces.push(planePiece(470, 2.5, 0, 0.02, z - 6.2, 0, C.sidewalk));
    walkPieces.push(planePiece(470, 2.5, 0, 0.02, z + 6.2, 0, C.sidewalk));
  }
  // Road centre dashes (merged, pale).
  const dashPieces = [];
  for (const x of CONFIG.roadX) {
    for (let z = -170; z <= 170; z += 14) {
      dashPieces.push(planePiece(0.35, 5, x, 0.03, z, 0, 0xd8dce2));
    }
  }
  for (const z of CONFIG.roadZ) {
    for (let x = -220; x <= 220; x += 14) {
      dashPieces.push(planePiece(5, 0.35, x, 0.03, z, 0, 0xd8dce2));
    }
  }
  const roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const roadMesh = new THREE.Mesh(mergePieces([...roadPieces, ...dashPieces]), roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);
  const walkMesh = new THREE.Mesh(mergePieces(walkPieces), roadMat);
  walkMesh.receiveShadow = true;
  group.add(walkMesh);

  // ---- beach + sea --------------------------------------------------
  const sandMat = new THREE.MeshStandardMaterial({ color: C.sand, roughness: 1 });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(470, 26), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.0, (CONFIG.beachZ0 + CONFIG.beachZ1) / 2);
  sand.receiveShadow = true;
  group.add(sand);

  const seaMat = new THREE.MeshStandardMaterial({
    color: C.seaDay, roughness: 0.25, metalness: 0.1,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 300), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, CONFIG.seaZ + 150);
  group.add(sea);

  // ---- buildings + windows (merged) --------------------------------
  const buildingPieces = [];
  const windowPieces = [];
  const neonPieces = [];
  const roofPieces = [];
  let buildingCount = 0;
  const neonColors = [C.neonPink, C.neonCyan, C.neonAmber];

  for (let col = 0; col < CONFIG.blockX.length; col++) {
    for (let row = 0; row < CONFIG.blockZ.length; row++) {
      const cx = CONFIG.blockX[col];
      const cz = CONFIG.blockZ[row];
      if (isPark(col, row)) {
        // Park: grass square + a few trees (trunk + canopy blobs).
        const grass = planePiece(38, 38, cx, 0.04, cz, 0, C.grass);
        buildingPieces.push(grass);
        for (let t = 0; t < 5; t++) {
          const tx = cx + rng.range(-14, 14);
          const tz = cz + rng.range(-14, 14);
          buildingPieces.push(boxPiece(0.5, 2.2, 0.5, tx, 1.1, tz, 0, 0x6b4a2f));
          buildingPieces.push(boxPiece(2.6, 1.8, 2.6, tx, 3.0, tz, 0, 0x3f7d3a));
        }
        continue;
      }
      const district = districtAt(col, row);
      const spec = CONFIG.districts[district];
      const nB = rng.int(1, 3);
      for (let b = 0; b < nB; b++) {
        const w = rng.range(12, 22);
        const d = rng.range(12, 22);
        const h = rng.range(spec.h[0], spec.h[1]);
        const bx = cx + rng.range(-9, 9);
        const bz = cz + rng.range(-9, 9);
        const color = rng.pick(spec.colors);
        buildingPieces.push(boxPiece(w, h, d, bx, h / 2, bz, 0, color));
        // Flat roof cap, slightly darker.
        roofPieces.push(boxPiece(w * 0.92, 0.5, d * 0.92, bx, h + 0.2, bz, 0, 0x3a3f4a));
        // Rooftop box (AC unit / stair bulkhead).
        if (rng.chance(0.6)) {
          roofPieces.push(boxPiece(rng.range(2, 4), 1.2, rng.range(2, 4),
            bx + rng.range(-4, 4), h + 0.9, bz + rng.range(-4, 4), 0, 0x4a4f58));
        }
        // Windows: thin lit strips on the south + east faces, every ~4 m.
        const floors = Math.max(1, Math.floor(h / 4));
        for (let f = 0; f < floors; f++) {
          const wy = 2.5 + f * 4;
          const nW = Math.max(1, Math.floor(w / 5));
          for (let k = 0; k < nW; k++) {
            const wx = bx - w / 2 + 2.5 + k * 5;
            if (wx > bx + w / 2 - 2) break;
            windowPieces.push(boxPiece(2.2, 1.5, 0.12, wx, wy, bz + d / 2 + 0.07, 0, C.windowDay));
          }
          const nE = Math.max(1, Math.floor(d / 5));
          for (let k = 0; k < nE; k++) {
            const wz = bz - d / 2 + 2.5 + k * 5;
            if (wz > bz + d / 2 - 2) break;
            windowPieces.push(boxPiece(0.12, 1.5, 2.2, bx + w / 2 + 0.07, wy, wz, 0, C.windowDay));
          }
        }
        // Neon signs on Downtown + Harbor towers.
        if ((district === 'Downtown' || district === 'Harbor') && rng.chance(0.55)) {
          const nc = rng.pick(neonColors);
          const nw = rng.range(3, 7);
          const ny = h * rng.range(0.55, 0.9);
          const side = rng.chance(0.5) ? 1 : -1;
          neonPieces.push(boxPiece(nw, 0.9, 0.18, bx, ny, bz + side * (d / 2 + 0.12), 0, nc));
        }
        buildingCount++;
      }
    }
  }

  const buildingMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
  const buildingMesh = new THREE.Mesh(mergePieces(buildingPieces), buildingMat);
  buildingMesh.castShadow = true;
  buildingMesh.receiveShadow = true;
  group.add(buildingMesh);
  const roofMesh = new THREE.Mesh(mergePieces(roofPieces), buildingMat);
  group.add(roofMesh);

  const windowMat = new THREE.MeshStandardMaterial({
    color: C.windowDay, emissive: C.windowDay, emissiveIntensity: 0.55, roughness: 0.4,
  });
  const windowMesh = new THREE.Mesh(mergePieces(windowPieces), windowMat);
  group.add(windowMesh);

  const neonMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const neonMesh = new THREE.Mesh(mergePieces(neonPieces), neonMat);
  group.add(neonMesh);

  // ---- palms along the beach road -----------------------------------
  const palmPieces = [];
  const leafPieces = [];
  let palmCount = 0;
  for (let x = -215; x <= 215; x += 18) {
    if (rng.chance(0.75)) {
      const px = x + rng.range(-3, 3);
      const pz = 178 + rng.range(-2, 2);
      palmPieces.push(boxPiece(0.45, 5.5, 0.45, px, 2.75, pz, 0, 0x7a5a38));
      for (let l = 0; l < 5; l++) {
        const a = (l / 5) * Math.PI * 2 + rng.range(-0.3, 0.3);
        leafPieces.push(boxPiece(2.6, 0.12, 0.7,
          px + Math.cos(a) * 1.2, 5.6, pz + Math.sin(a) * 1.2, -a, 0x2f8f4e));
      }
      palmCount++;
    }
  }
  const palmMesh = new THREE.Mesh(mergePieces(palmPieces), buildingMat);
  palmMesh.castShadow = true;
  group.add(palmMesh);
  const leafMesh = new THREE.Mesh(mergePieces(leafPieces), buildingMat);
  leafMesh.castShadow = true;
  group.add(leafMesh);

  // ---- piers into the sea (south-east) ------------------------------
  const pierPieces = [];
  const pierXs = [125, 175];
  for (const px of pierXs) {
    for (let z = 182; z <= 232; z += 4) {
      pierPieces.push(boxPiece(7, 0.3, 3.6, px, 0.6, z, 0, C.pierWood));
    }
    for (let z = 186; z <= 230; z += 12) {
      pierPieces.push(boxPiece(0.4, 2.4, 0.4, px - 3, -0.4, z, 0, 0x5a4630));
      pierPieces.push(boxPiece(0.4, 2.4, 0.4, px + 3, -0.4, z, 0, 0x5a4630));
    }
  }
  const pierMesh = new THREE.Mesh(mergePieces(pierPieces), buildingMat);
  pierMesh.castShadow = true;
  pierMesh.receiveShadow = true;
  group.add(pierMesh);

  // ---- street lamps (merged posts) -----------------------------------
  const lampPieces = [];
  for (const x of CONFIG.roadX) {
    for (const z of CONFIG.roadZ) {
      lampPieces.push(boxPiece(0.18, 5.2, 0.18, x + 6.8, 2.6, z + 6.8, 0, 0x2a2f36));
      lampPieces.push(boxPiece(1.4, 0.14, 0.14, x + 6.1, 5.2, z + 6.8, 0, 0x2a2f36));
    }
  }
  const lampMesh = new THREE.Mesh(mergePieces(lampPieces), buildingMat);
  group.add(lampMesh);

  scene.add(group);

  return {
    group,
    roadGraph: buildRoadGraph(),
    districtAt,
    windowMat,
    neonMat,
    seaMat,
    buildingCount,
    palmCount,
  };
}

export default buildCity;
