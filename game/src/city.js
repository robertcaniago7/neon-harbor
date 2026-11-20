// Neon Harbor 3D — city.js
// Builds the city: ground, roads, sidewalks, buildings, palms, piers, neon.
// Districts follow the spec grid: block col 0..8, row 0..6 (rows run north 0
// to south 6). Roads sit every 50 m; blocks between them hold buildings.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, ROADS_X, ROADS_Z, BLOCKS_X, BLOCKS_Z, DISTRICTS, PARKS, PALETTE } from './config.js';
import { makeRng, hashSeed } from './random.js';
import { mergeBoxes } from './merge.js';

export function districtAt(col, row) {
  if (row >= 5) return col >= 6 ? 'harbor' : 'beach';
  if (col <= 2) return 'oldtown';
  if (row <= 1) return 'midtown';
  if (col >= 6 && row <= 2) return 'yards';
  if (col >= 3 && col <= 5 && row >= 2 && row <= 4) return 'downtown';
  return 'midtown';
}

export function isPark(col, row) {
  return PARKS.some((p) => p.col === col && p.row === row);
}

export function buildCity(scene) {
  const rng = makeRng(1337);
  const group = new THREE.Group();
  group.name = 'city';

  // --- ground slab (grass/concrete base under everything) ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.xMax - WORLD.xMin + 60, WORLD.zMax - WORLD.zMin + 90),
    new THREE.MeshLambertMaterial({ color: 0x8a9a7a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 10);
  ground.receiveShadow = true;
  group.add(ground);

  // --- beach sand and sea (south) ---
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.xMax - WORLD.xMin + 60, WORLD.beachZ1 - WORLD.beachZ0),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.01, (WORLD.beachZ0 + WORLD.beachZ1) / 2);
  sand.receiveShadow = true;
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.xMax - WORLD.xMin + 60, 120),
    new THREE.MeshLambertMaterial({ color: PALETTE.seaDay })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, WORLD.seaZ + 60);
  sea.name = 'sea';
  group.add(sea);

  // --- roads (dark strips along every road line) ---
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const roadGeos = [];
  for (const x of ROADS_X) {
    const g = new THREE.BoxGeometry(10, 0.1, WORLD.zMax - WORLD.zMin);
    g.translate(x, 0.05, 0);
    roadGeos.push(g);
  }
  for (const z of ROADS_Z) {
    const g = new THREE.BoxGeometry(WORLD.xMax - WORLD.xMin, 0.1, 10);
    g.translate(0, 0.05, z);
    roadGeos.push(g);
  }
  const roadMesh = new THREE.Mesh(
    mergeGeosSimple(roadGeos),
    roadMat
  );
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // --- sidewalks (pale frames around each block) ---
  const walkItems = [];
  for (let c = 0; c < BLOCKS_X.length; c++) {
    for (let r = 0; r < BLOCKS_Z.length; r++) {
      walkItems.push({ w: 46, h: 0.12, d: 46, x: BLOCKS_X[c], y: 0.06, z: BLOCKS_Z[r], color: PALETTE.sidewalk });
    }
  }
  for (const m of mergeBoxes(walkItems)) group.add(m);

  // --- buildings, one merged mesh per district colour set ---
  const buildingItems = [];
  const windowItems = [];
  const neonSigns = [];
  for (let c = 0; c < BLOCKS_X.length; c++) {
    for (let r = 0; r < BLOCKS_Z.length; r++) {
      if (isPark(c, r)) continue;
      const d = districtAt(c, r);
      const spec = DISTRICTS[d];
      const brng = makeRng(hashSeed(`block-${c}-${r}`));
      const bx = BLOCKS_X[c];
      const bz = BLOCKS_Z[r];
      const n = d === 'downtown' ? 4 : brng.int(2, 3);
      for (let i = 0; i < n; i++) {
        const w = brng.range(10, 16);
        const dep = brng.range(10, 16);
        const h = brng.range(spec.hMin, spec.hMax);
        const ox = brng.range(-11, 11);
        const oz = brng.range(-11, 11);
        const color = brng.pick(spec.colors);
        buildingItems.push({ w, h, d: dep, x: bx + ox, y: h / 2, z: bz + oz, color });
        // lit window strips on tall buildings
        if (h > 20) {
          const floors = Math.floor(h / 4);
          for (let f = 0; f < floors; f++) {
            windowItems.push({
              w: w * 0.8, h: 0.5, d: 0.2,
              x: bx + ox, y: 3 + f * 4, z: bz + oz + dep / 2 + 0.1,
              color: PALETTE.windowNight,
            });
          }
        }
      }
      // neon signs in downtown / harbor / beach at dusk
      if ((d === 'downtown' || d === 'harbor' || d === 'beach') && brng.chance(0.6)) {
        const neonColor = brng.pick([PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonAmber]);
        neonSigns.push({ x: bx + brng.range(-14, 14), y: brng.range(6, 16), z: bz + brng.range(-14, 14), color: neonColor, w: brng.range(4, 9) });
      }
    }
  }
  for (const m of mergeBoxes(buildingItems)) group.add(m);
  for (const m of mergeBoxes(windowItems)) {
    m.material = new THREE.MeshBasicMaterial({ color: PALETTE.windowNight });
    m.castShadow = false;
    group.add(m);
  }

  // --- neon sign meshes (emissive boxes, glow at night) ---
  const neonGroup = new THREE.Group();
  neonGroup.name = 'neon';
  for (const s of neonSigns) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(s.w, 0.9, 0.3),
      new THREE.MeshBasicMaterial({ color: s.color })
    );
    sign.position.set(s.x, s.y, s.z);
    sign.rotation.y = rng.range(0, Math.PI);
    neonGroup.add(sign);
  }
  group.add(neonGroup);

  // --- palm trees along the beach road ---
  const palmTrunks = [];
  const palmTops = [];
  for (let x = -220; x <= 220; x += 20) {
    const z = 168 + rng.range(-2, 2);
    palmTrunks.push({ w: 0.5, h: 6, d: 0.5, x, y: 3, z, color: 0x7a5a38 });
    palmTops.push({ w: 3.2, h: 1.2, d: 3.2, x, y: 6.6, z, color: 0x2e8b57 });
  }
  for (const m of mergeBoxes(palmTrunks)) group.add(m);
  for (const m of mergeBoxes(palmTops)) group.add(m);

  // --- park trees ---
  const parkTrunks = [];
  const parkTops = [];
  for (const p of PARKS) {
    const px = BLOCKS_X[p.col];
    const pz = BLOCKS_Z[p.row];
    for (let i = 0; i < 6; i++) {
      const x = px + rng.range(-16, 16);
      const z = pz + rng.range(-16, 16);
      parkTrunks.push({ w: 0.6, h: 4, d: 0.6, x, y: 2, z, color: 0x6b4a2a });
      parkTops.push({ w: 4, h: 3, d: 4, x, y: 5.5, z, color: 0x3f9e4d });
    }
  }
  for (const m of mergeBoxes(parkTrunks)) group.add(m);
  for (const m of mergeBoxes(parkTops)) group.add(m);

  // --- piers reaching into the sea (south-east) ---
  const pierItems = [];
  for (const px of [120, 170, 210]) {
    pierItems.push({ w: 8, h: 0.8, d: 42, x: px, y: 0.4, z: 196, color: 0x8a6f4d });
    // pier posts
    for (let z = 180; z <= 214; z += 8) {
      pierItems.push({ w: 0.8, h: 1.6, d: 0.8, x: px - 3.4, y: 0.4, z, color: 0x6b4a2a });
      pierItems.push({ w: 0.8, h: 1.6, d: 0.8, x: px + 3.4, y: 0.4, z, color: 0x6b4a2a });
    }
  }
  // Kestrel's boat at the end of the middle pier
  const boat = new THREE.Group();
  boat.name = 'kestrel-boat';
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(4, 1.6, 12),
    new THREE.MeshLambertMaterial({ color: 0xf5f5f0 })
  );
  hull.position.y = 0.4;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.6, 4),
    new THREE.MeshLambertMaterial({ color: 0x22303e })
  );
  cabin.position.set(0, 1.8, -1);
  boat.add(hull, cabin);
  boat.position.set(170, 0.2, 216);
  boat.rotation.y = 0.15;
  group.add(boat);
  for (const m of mergeBoxes(pierItems)) group.add(m);

  // --- harbour crates and containers (The Yards / Harbor) ---
  const crateItems = [];
  const crng = makeRng(777);
  for (let i = 0; i < 40; i++) {
    const x = crng.range(130, 225);
    const z = crng.range(-40, 170);
    crateItems.push({
      w: crng.range(2, 5), h: crng.range(2, 4), d: crng.range(2, 5),
      x, y: 1.5, z,
      color: crng.pick([0xc77e6a, 0x7a8b99, 0x5f7280, 0xf2c94c]),
    });
  }
  for (const m of mergeBoxes(crateItems)) group.add(m);

  scene.add(group);
  return { group, neonGroup, sea, boat };
}

function mergeGeosSimple(geos) {
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
