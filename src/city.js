// Neon Harbor's map: a road grid over six districts, the harbour water to the south,
// buildings with neon signs, and the road graph the traffic drives on.
// All geometry is generated from the seed, so the city is the same every visit.

import { ROAD, WORLD, HARBOR, DISTRICTS, PALETTE } from './config.js';
import { createRandom, hashString } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  // Off the district map (the dock strip and the water): name it after the
  // district straight inland, not the fallback at the far end of the list.
  const maxY = Math.max(...DISTRICTS.map((d) => d.y + d.h)) - 1;
  const inlandY = Math.min(y, maxY);
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && inlandY >= d.y && inlandY < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

export function createCity(seed) {
  const rng = createRandom(seed);
  const roadsX = [];
  const roadsY = [];
  for (let x = ROAD.gap; x < WORLD.width; x += ROAD.gap) roadsX.push(x);
  for (let y = ROAD.gap; y < WORLD.height - 200; y += ROAD.gap) roadsY.push(y);

  const buildings = [];
  const parks = [];
  for (let bx = 0; bx < roadsX.length - 1; bx += 1) {
    for (let by = 0; by < roadsY.length - 1; by += 1) {
      const x0 = roadsX[bx] + ROAD.width / 2 + ROAD.sidewalk;
      const y0 = roadsY[by] + ROAD.width / 2 + ROAD.sidewalk;
      const w = ROAD.gap - ROAD.width - ROAD.sidewalk * 2;
      const h = ROAD.gap - ROAD.width - ROAD.sidewalk * 2;
      const cx = x0 + w / 2;
      const cy = y0 + h / 2;
      if (cy > HARBOR.y) continue;
      const local = createRandom(hashString(`block-${bx}-${by}`));
      if (local.chance(0.14)) {
        parks.push({ x: x0, y: y0, w, h, trees: Math.floor(local.range(4, 9)) });
        continue;
      }
      const n = local.int(1, 3);
      for (let i = 0; i < n; i += 1) {
        const bw = w / n - 14;
        const bh = local.range(h * 0.4, h * 0.9);
        const bx0 = x0 + (w / n) * i + 7;
        const by0 = y0 + (h - bh) / 2;
        const d = districtAt(cx, cy);
        buildings.push({
          x: bx0, y: by0, w: bw, h: bh,
          color: local.pick([PALETTE.buildingA, PALETTE.buildingB, PALETTE.buildingC]),
          accent: d.accent,
          height: local.int(1, 5),
          sign: local.chance(0.55),
          signText: local.pick(['NEON', 'BAR', 'HOTEL', '24H', 'PIER', 'CLUB', 'CAFE', 'MART', 'GYM', 'TACO']),
        });
      }
    }
  }

  /** Nodes of the road graph: every intersection, with its neighbours. */
  const nodes = [];
  const nodeAt = new Map();
  for (const x of roadsX) {
    for (const y of roadsY) {
      const node = { x, y, next: [] };
      nodes.push(node);
      nodeAt.set(`${x},${y}`, node);
    }
  }
  for (const node of nodes) {
    for (const [dx, dy] of [[ROAD.gap, 0], [-ROAD.gap, 0], [0, ROAD.gap], [0, -ROAD.gap]]) {
      const other = nodeAt.get(`${node.x + dx},${node.y + dy}`);
      if (other) node.next.push(other);
    }
  }

  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const node of nodes) {
      const d = (node.x - x) ** 2 + (node.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = node;
      }
    }
    return best;
  }

  function onRoad(x, y) {
    const inX = roadsX.some((rx) => Math.abs(x - rx) < ROAD.width / 2);
    const inY = roadsY.some((ry) => Math.abs(y - ry) < ROAD.width / 2);
    return inX || inY;
  }

  function collidesBuilding(x, y, r) {
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }

  function inWater(x, y) {
    return y > HARBOR.y + 40;
  }

  function randomRoadSpot() {
    const node = nodes[Math.floor(rng.next() * nodes.length)];
    return { x: node.x + rng.range(-30, 30), y: node.y + rng.range(-30, 30) };
  }

  function randomSidewalkSpot() {
    const node = nodes[Math.floor(rng.next() * nodes.length)];
    const side = rng.pick([-1, 1]);
    const horizontal = rng.chance(0.5);
    return horizontal
      ? { x: node.x + rng.range(-160, 160), y: node.y + side * (ROAD.width / 2 + 12) }
      : { x: node.x + side * (ROAD.width / 2 + 12), y: node.y + rng.range(-160, 160) };
  }

  return {
    roadsX, roadsY, buildings, parks, nodes,
    nearestRoadPoint, onRoad, collidesBuilding, inWater,
    randomRoadSpot, randomSidewalkSpot,
  };
}
