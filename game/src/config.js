// Neon Harbor 3D: every tuning number, colour and name in one place.
// The world is metres: x east [-230, 230], z south [-180, 180], y up, ground y = 0.
// Roads run every 50 m; blocks between them hold buildings. The sea is south (z > 205).

export const STEP = 1 / 60;

export const WORLD = { minX: -230, maxX: 230, minZ: -180, maxZ: 180 };

/** Road grid: pitch 50 m, road width 10 m (drivable 8 m, lanes at +/-2.2 m). */
export const ROAD = { pitch: 50, width: 10, lane: 2.2 };
export const ROAD_XS = [-225, -175, -125, -75, -25, 25, 75, 125, 175, 225];
export const ROAD_ZS = [-175, -125, -75, -25, 25, 75, 125, 175];
export const BLOCK_XS = [-200, -150, -100, -50, 0, 50, 100, 150, 200];
export const BLOCK_ZS = [-150, -100, -50, 0, 50, 100, 150];

/** Beach sand z in [180, 205]; sea z > 205. Piers reach into the sea at the south-east. */
export const BEACH = { sandZ0: 180, sandZ1: 205, seaZ0: 205, seaZ1: 330 };

export const DISTRICTS = {
  downtown: { name: 'Downtown', hMin: 28, hMax: 78, colors: ['#8f9bb0', '#6b7a94', '#5a6b84', '#7d8aa0'] },
  midtown: { name: 'Midtown', hMin: 12, hMax: 28, colors: ['#c9a86a', '#b08d57', '#a8b8c8', '#c77e6a'] },
  oldtown: { name: 'Old Town', hMin: 6, hMax: 14, colors: ['#ffb3c1', '#ffd6a5', '#a8e6cf', '#f9e79f', '#f5c6a5'] },
  yards: { name: 'The Yards', hMin: 8, hMax: 18, colors: ['#7a8b99', '#5f7280', '#8a7f70', '#6b7f6b'] },
  beach: { name: 'Palma Beach', hMin: 6, hMax: 12, colors: ['#ffd6a5', '#ffb3c1', '#a8e6cf', '#fff1d6', '#f9e79f'] },
  harbor: { name: 'Harbor', hMin: 6, hMax: 14, colors: ['#7a8b99', '#5f7280', '#c77e6a'] },
};

/** Block (col 0..8, row 0..6) -> district key. Rows run north (0) to south (6). */
export function districtAt(col, row) {
  if (row >= 5) return col >= 6 ? 'harbor' : 'beach';
  if (col <= 2) return 'oldtown';
  if (row <= 1) return 'midtown';
  if (col >= 6 && row <= 2) return 'yards';
  if (col >= 3 && col <= 5 && row >= 2 && row <= 4) return 'downtown';
  if (col >= 6 && row >= 3 && row <= 4) return 'midtown';
  return 'midtown';
}

/** A couple of blocks are parks, not buildings. */
export const PARKS = [{ col: 1, row: 3 }, { col: 7, row: 4 }];
export function isPark(col, row) {
  return PARKS.some((p) => p.col === col && p.row === row);
}

export const PALETTE = {
  daySky: 0x8ec5f0,
  duskSky: 0xff9a6b,
  nightSky: 0x1b1f3b,
  dayFog: 0xa8c8e8,
  nightFog: 0x2b2f5a,
  seaDay: 0x1fb6c9,
  seaNight: 0x0e3a5a,
  sand: 0xe8c47a,
  road: 0x454a55,
  sidewalk: 0x9aa0a8,
  neonPink: 0xff2d95,
  neonCyan: 0x00e5ff,
  neonAmber: 0xffb020,
  windowDay: 0x2a3442,
  windowNight: 0xffc46b,
};

export const PLAYER = {
  radius: 0.45,
  height: 1.8,
  walkSpeed: 4.2,
  sprintSpeed: 7.0,
  health: 100,
  armor: 50,
  punchDamage: 12,
  punchRange: 2.2,
  punchCooldown: 0.35,
};

/** Player car: cannon-es RaycastVehicle tuning (arcade feel). */
export const CAR_PHYSICS = {
  mass: 1400,
  chassisHalf: [0.95, 0.32, 2.2],
  wheelRadius: 0.36,
  wheelWidth: 0.28,
  wheelBase: 1.45,
  wheelTrack: 0.85,
  suspensionStiffness: 30,
  suspensionRestLength: 0.32,
  suspensionTravel: 0.3,
  maxSuspensionForce: 100000,
  dampingRelaxation: 2.3,
  dampingCompression: 4.4,
  frictionSlip: 1.4,
  rollInfluence: 0.01,
  maxEngineForce: 4000,
  maxBrakeForce: 1000,
  maxSteer: 0.55,
  maxSpeed: 38, // m/s, soft-capped in code
};

export const CAR_MODELS = [
  { name: 'Driftwood Sedan', color: 0x3fa7d6, speed: 1.0, grip: 1.0, common: 5 },
  { name: 'Neon Taxi', color: 0xf2c94c, speed: 0.95, grip: 1.0, common: 4 },
  { name: 'Harbor Coupe', color: 0xe5534b, speed: 1.15, grip: 1.1, common: 3 },
  { name: 'Mackerel Truck', color: 0x7a8b99, speed: 0.8, grip: 0.85, common: 2 },
  { name: 'Pelican Van', color: 0x9b7ede, speed: 0.85, grip: 0.9, common: 2 },
  { name: 'Sunset Cruiser', color: 0xff8a5c, speed: 1.05, grip: 1.0, common: 2 },
];
export const POLICE_CAR = { name: 'Harbor PD Interceptor', color: 0x22303e, speed: 1.12, grip: 1.15 };

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 2.2, cooldown: 0.35, ammo: Infinity, auto: false },
  pistol: { name: 'HK-9 Pistol', damage: 34, range: 120, cooldown: 0.22, ammo: 24, auto: false },
};

export const WANTED = {
  max: 5,
  /** Seconds with no police line of sight before one star fades. */
  decaySeconds: 14,
  /** Police cars hunting at each star level. */
  carsPerStar: [0, 1, 2, 3, 4, 5],
  /** Foot officers joining at 3+ stars. */
  footPerStar: [0, 0, 0, 2, 3, 4],
  /** Changing to an unseen car / outfit drops this many stars. */
  disguiseDrop: 2,
};

export const MISSION_REWARD = [400, 700, 1000, 1400, 1900, 2500];

export const SAVE_KEY = 'neon-harbor-3d-save-v1';
export const BEST_KEY = 'neon-harbor-3d-best-v1';

/** Day/night: t in [0,1); 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk. */
export const DAY_LENGTH = 480; // seconds per full day
export const START_TIME = 0.72; // golden hour for first impressions

/** Quality tiers. */
export const QUALITY = {
  high: { pixelRatio: 2, shadows: 2048, traffic: 16, peds: 14, fogFar: 420 },
  low: { pixelRatio: 1.25, shadows: 1024, traffic: 8, peds: 8, fogFar: 300 },
};
