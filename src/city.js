// Neon Harbor 3D city: a seeded grid city with six districts, a beach and a sea.
// All static scenery is merged / instanced so the whole city renders in a few dozen
// draw calls. Also builds the road graph (for traffic, police, peds and the minimap)
// and the building AABBs (for on-foot collision and the physics world).

import * as THREE from 'three';
import { ROAD_XS, ROAD_ZS, BLOCK_XS, BLOCK_ZS, DISTRICTS, districtAt, isPark, PALETTE, BEACH } from './config.js';
import { makeRng } from './random.js';
import { box, cyl, mergeGeometries, place, paint } from './merge.js';

/** Facade texture: a window grid, used as map and as emissiveMap (windows glow at night). */
function makeFacadeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d7dce0';
  g.fillRect(0, 0, 128, 256);
  const rng = makeRng(99);
  for (let r = 0; r < 12; r++) {
    for (let col = 0; col < 6; col++) {
      const lit = rng.chance(0.22);
      g.fillStyle = lit ? '#ffd9a0' : (rng.chance(0.5) ? '#2a3442' : '#33404f');
      g.fillRect(8 + col * 20, 10 + r * 20, 13, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCity(seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const buildings = []; // {minX,maxX,minZ,maxZ,h} AABBs
  const facadeGeos = [];
  const sidewalkGeos = [];
  const neonPinkGeos = [];
  const neonCyanGeos = [];
  const neonAmberGeos = [];
  const containerGeos = [];

  // --- ground base (urban ground under everything) ---
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a5244, roughness: 1, flatShading: true });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 420), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // --- roads: one dark plane + instanced centre dashes ---
  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.road, roughness: 1 });
  const roadPlane = new THREE.Mesh(new THREE.PlaneGeometry(470, 370), roadMat);
  roadPlane.rotation.x = -Math.PI / 2;
  roadPlane.position.set(0, 0.01, 0);
  roadPlane.receiveShadow = true;
  group.add(roadPlane);

  const dashGeo = new THREE.BoxGeometry(0.35, 0.02, 4);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.8 });
  const dashPositions = [];
  for (const x of ROAD_XS) for (let z = -170; z <= 170; z += 9) dashPositions.push([x, z, 0]);
  for (const z of ROAD_ZS) for (let x = -220; x <= 220; x += 9) dashPositions.push([x, z, Math.PI / 2]);
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashPositions.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  dashPositions.forEach(([x, z, ry], i) => {
    e.set(0, ry, 0);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, 0.03, z), q, new THREE.Vector3(1, 1, 1));
    dashes.setMatrixAt(i, m4);
  });
  dashes.instanceMatrix.needsUpdate = true;
  group.add(dashes);

  // --- buildings, sidewalks, neon signs, containers ---
  const facadeTex = makeFacadeTexture();
  const facadeMat = new THREE.MeshStandardMaterial({
    vertexColors: true, map: facadeTex, emissiveMap: facadeTex,
    emissive: new THREE.Color(PALETTE.windowNight), emissiveIntensity: 0,
    roughness: 0.9, flatShading: true,
  });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1, flatShading: true });
  const neonPinkMat = new THREE.MeshStandardMaterial({ color: 0x33001a, emissive: PALETTE.neonPink, emissiveIntensity: 0.4, roughness: 0.6 });
  const neonCyanMat = new THREE.MeshStandardMaterial({ color: 0x001a22, emissive: PALETTE.neonCyan, emissiveIntensity: 0.4, roughness: 0.6 });
  const neonAmberMat = new THREE.MeshStandardMaterial({ color: 0x241400, emissive: PALETTE.neonAmber, emissiveIntensity: 0.4, roughness: 0.6 });

  for (let col = 0; col < BLOCK_XS.length; col++) {
    for (let row = 0; row < BLOCK_ZS.length; row++) {
      const bx = BLOCK_XS[col];
      const bz = BLOCK_ZS[row];
      const district = districtAt(col, row);
      const d = DISTRICTS[district];
      // sidewalk slab for the block
      sidewalkGeos.push(box(44, 0.18, 44, PALETTE.sidewalk, bx, 0.09, bz));
      if (isPark(col, row)) continue;
      if (district === 'harbor') {
        // warehouses + shipping containers
        const n = rng.int(1, 2);
        for (let k = 0; k < n; k++) {
          const w = rng.range(18, 26);
          const dep = rng.range(12, 18);
          const h = rng.range(d.hMin, d.hMax);
          const x = bx + rng.range(-8, 8);
          const z = bz + rng.range(-8, 8);
          facadeGeos.push(box(w, h, dep, rng.pick(d.colors), x, h / 2, z));
          buildings.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dep / 2, maxZ: z + dep / 2, h });
        }
        for (let k = 0; k < 5; k++) {
          const cColor = rng.pick([0xe5534b, 0x3fa7d6, 0xf2c94c, 0x7a8b99, 0x9b7ede]);
          const x = bx + rng.range(-16, 16);
          const z = bz + rng.range(-14, 14);
          containerGeos.push(box(6, 2.6, 2.6, cColor, x, 1.3, z, rng.chance(0.5) ? Math.PI / 2 : 0));
        }
        continue;
      }
      if (district === 'downtown') {
        const w = rng.range(22, 30);
        const dep = rng.range(22, 30);
        const h = rng.range(d.hMin, d.hMax);
        facadeGeos.push(box(w, h, dep, rng.pick(d.colors), bx, h / 2, bz));
        buildings.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - dep / 2, maxZ: bz + dep / 2, h });
        // rooftop box
        facadeGeos.push(box(w * 0.4, 3, dep * 0.4, '#4a5568', bx, h + 1.5, bz));
        // neon sign on the facade
        const signGeos = rng.chance(0.5) ? neonPinkGeos : neonCyanGeos;
        const face = rng.pick([1, -1]);
        signGeos.push(box(0.5, rng.range(2, 4), rng.range(8, 14), '#ffffff', bx + face * (w / 2 + 0.4), rng.range(10, h - 6), bz));
        continue;
      }
      // low / mid blocks: 2-3 buildings
      const n = rng.int(2, 3);
      for (let k = 0; k < n; k++) {
        const w = rng.range(10, 16);
        const dep = rng.range(10, 16);
        const h = rng.range(d.hMin, d.hMax);
        const x = bx + rng.range(-11, 11);
        const z = bz + rng.range(-11, 11);
        facadeGeos.push(box(w, h, dep, rng.pick(d.colors), x, h / 2, z));
        buildings.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dep / 2, maxZ: z + dep / 2, h });
        if (district === 'beach' && rng.chance(0.6)) {
          // awning strip
          neonAmberGeos.push(box(w * 0.9, 0.3, 3, rng.pick([0xff2d95, 0x00e5ff, 0xffb020]), x, Math.min(h - 1, 4), z + dep / 2 + 1.4));
        }
      }
    }
  }

  const facadeMesh = new THREE.Mesh(mergeGeometries(facadeGeos), facadeMat);
  facadeMesh.castShadow = true;
  facadeMesh.receiveShadow = true;
  group.add(facadeMesh);
  const sidewalkMesh = new THREE.Mesh(mergeGeometries(sidewalkGeos), sidewalkMat);
  sidewalkMesh.receiveShadow = true;
  group.add(sidewalkMesh);
  if (containerGeos.length) {
    const cMesh = new THREE.Mesh(mergeGeometries(containerGeos),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }));
    cMesh.castShadow = true;
    group.add(cMesh);
  }
  const neonPinkMesh = new THREE.Mesh(mergeGeometries(neonPinkGeos), neonPinkMat);
  const neonCyanMesh = new THREE.Mesh(mergeGeometries(neonCyanGeos), neonCyanMat);
  const neonAmberMesh = new THREE.Mesh(mergeGeometries(neonAmberGeos), neonAmberMat);
  group.add(neonPinkMesh, neonCyanMesh, neonAmberMesh);

  // --- cranes in the harbour ---
  const craneGeos = [];
  craneGeos.push(box(2, 26, 2, 0xd8a020, 195, 13, 140));
  craneGeos.push(box(2, 26, 2, 0xd8a020, 215, 13, 120));
  craneGeos.push(box(24, 2, 2, 0xd8a020, 195, 25, 140));
  craneGeos.push(box(24, 2, 2, 0xd8a020, 215, 25, 120));
  const craneMesh = new THREE.Mesh(mergeGeometries(craneGeos),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true }));
  craneMesh.castShadow = true;
  group.add(craneMesh);

  // --- palms (instanced trunks + fronds) ---
  const trunkGeo = cyl(0.14, 0.22, 5, 0x8a6b46, 0, 2.5, 0, 6);
  const frondGeo = (() => {
    const geos = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const f = new THREE.ConeGeometry(0.55, 3.2, 4);
      paint(f, 0x2f9e44);
      f.translate(0, 1.6, 0); // base at origin, tip up
      // lean outward (~57 deg) then swing around to direction a
      const lean = new THREE.Matrix4().makeRotationZ(1.0);
      const spin = new THREE.Matrix4().makeRotationY(-a);
      f.applyMatrix4(new THREE.Matrix4().multiplyMatrices(spin, lean));
      f.translate(Math.cos(a) * 0.4, 5.0, Math.sin(a) * 0.4);
      geos.push(f);
    }
    return mergeGeometries(geos);
  })();
  const palmSpots = [];
  for (let x = -220; x <= 220; x += 14) palmSpots.push([x + rng.range(-2, 2), 186]);
  for (const p of [{ col: 1, row: 3 }, { col: 7, row: 4 }]) {
    for (let k = 0; k < 8; k++) {
      palmSpots.push([BLOCK_XS[p.col] + rng.range(-16, 16), BLOCK_ZS[p.row] + rng.range(-16, 16)]);
    }
  }
  for (let col = 0; col <= 5; col++) {
    for (let k = 0; k < 3; k++) {
      palmSpots.push([BLOCK_XS[col] + rng.range(-16, 16), BLOCK_ZS[5] + rng.range(-14, 14)]);
    }
  }
  const trunkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const frondMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    const s = rng.range(0.85, 1.3);
    const ry = rng.range(0, Math.PI * 2);
    const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
    m4.compose(new THREE.Vector3(x, 0, z), q2, new THREE.Vector3(s, s, s));
    trunks.setMatrixAt(i, m4);
    fronds.setMatrixAt(i, m4);
  });
  trunks.instanceMatrix.needsUpdate = true;
  fronds.instanceMatrix.needsUpdate = true;
  trunks.castShadow = true;
  group.add(trunks, fronds);

  // --- streetlights (instanced pole + lamp head) ---
  const poleGeo = cyl(0.09, 0.12, 6, 0x2e3138, 0, 3, 0, 6);
  const headGeo = box(0.9, 0.18, 0.35, 0xfff2c0, 0, 6, 0);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf8a, emissiveIntensity: 0.15, roughness: 0.5 });
  const poleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const lampSpots = [];
  for (const x of ROAD_XS) for (const z of ROAD_ZS) {
    if (rng.chance(0.5)) lampSpots.push([x + 5.5, z + 5.5]);
  }
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const heads = new THREE.InstancedMesh(headGeo, lampMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng.range(0, Math.PI * 2), 0));
    m4.compose(new THREE.Vector3(x, 0, z), q2, new THREE.Vector3(1, 1, 1));
    poles.setMatrixAt(i, m4);
    heads.setMatrixAt(i, m4);
  });
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  group.add(poles, heads);

  // --- beach sand + umbrellas ---
  const sandMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1, flatShading: true });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(470, BEACH.sandZ1 - BEACH.sandZ0), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, (BEACH.sandZ0 + BEACH.sandZ1) / 2);
  sand.receiveShadow = true;
  group.add(sand);
  const umbGeos = [];
  for (let x = -200; x <= 200; x += 28) {
    const c = rng.pick([0xff2d95, 0x00e5ff, 0xffb020, 0xff6b6b]);
    umbGeos.push(cyl(0.05, 0.05, 2.4, 0xd8d8d8, x, 1.2, 190));
    const cone = new THREE.ConeGeometry(2.2, 1.1, 8);
    paint(cone, c);
    place(cone, x, 2.9, 190);
    umbGeos.push(cone);
  }
  const umbMesh = new THREE.Mesh(mergeGeometries(umbGeos),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
  group.add(umbMesh);

  // --- sea (animated vertices) ---
  const seaGeo = new THREE.PlaneGeometry(560, 140, 48, 12);
  seaGeo.rotateX(-Math.PI / 2);
  const seaMat = new THREE.MeshStandardMaterial({ color: PALETTE.seaDay, roughness: 0.35, metalness: 0.1, flatShading: true });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.set(0, -0.6, (BEACH.seaZ0 + BEACH.seaZ1) / 2);
  group.add(sea);
  const seaBase = seaGeo.attributes.position.array.slice();

  // --- piers + boat (south-east harbour) ---
  const pierGeos = [];
  for (const px of [150, 185, 215]) {
    pierGeos.push(box(8, 0.3, 52, 0x8a6b46, px, 0.15, 206));
    for (let z = 190; z <= 228; z += 12) {
      pierGeos.push(box(0.6, 2.4, 0.6, 0x6b4f30, px - 3.4, -0.6, z));
      pierGeos.push(box(0.6, 2.4, 0.6, 0x6b4f30, px + 3.4, -0.6, z));
    }
  }
  const pierMesh = new THREE.Mesh(mergeGeometries(pierGeos),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  pierMesh.receiveShadow = true;
  group.add(pierMesh);
  // Kestrel's boat beside the middle pier
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(box(3.4, 1.2, 9, 0xf2f2f2, 0, 0.4, 0), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, flatShading: true }));
  const cabin = new THREE.Mesh(box(2.4, 1.4, 3.4, 0x22303e, 0, 1.6, -0.5), hull.material);
  boat.add(hull, cabin);
  boat.position.set(185, -0.3, 228);
  boat.rotation.y = 0.15;
  group.add(boat);

  // --- road graph ---
  const nodes = new Map();
  for (const x of ROAD_XS) for (const z of ROAD_ZS) nodes.set(`${x},${z}`, { x, z });
  const edges = [];
  for (const z of ROAD_ZS) for (let j = 0; j < ROAD_XS.length - 1; j++) {
    edges.push({ ax: ROAD_XS[j], az: z, bx: ROAD_XS[j + 1], bz: z });
  }
  for (const x of ROAD_XS) for (let i = 0; i < ROAD_ZS.length - 1; i++) {
    edges.push({ ax: x, az: ROAD_ZS[i], bx: x, bz: ROAD_ZS[i + 1] });
  }
  const roadGraph = { nodes, edges };

  const spawnPoints = {
    downtown: { x: 0, z: 0 },
    marina: { x: 175, z: 150 },
    docks: { x: 200, z: 160 },
    oldtown: { x: -175, z: -25 },
    midtown: { x: 0, z: -125 },
    yards: { x: 175, z: -75 },
    pier: { x: 185, z: 228 },
    garage: { x: 25, z: -125 },
    warehouse: { x: 175, z: -75 },
    beach: { x: -25, z: 175 },
  };

  let time = 0;
  return {
    group, roadGraph, buildings, spawnPoints,
    facadeMat, neonPinkMat, neonCyanMat, neonAmberMat, lampMat, seaMat,
    update(dt) {
      time += dt;
      const pos = sea.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = seaBase[i * 3];
        const bz = seaBase[i * 3 + 2];
        pos.array[i * 3 + 1] = Math.sin(bx * 0.12 + time * 1.1) * 0.35 + Math.sin(bz * 0.22 + time * 1.6) * 0.25;
      }
      pos.needsUpdate = true;
      sea.geometry.computeVertexNormals();
      boat.position.y = -0.3 + Math.sin(time * 0.9) * 0.15;
      boat.rotation.z = Math.sin(time * 0.7) * 0.02;
    },
  };
}

// Shared temp matrix (module scope, reused by instancing loops above).
const m4 = new THREE.Matrix4();
