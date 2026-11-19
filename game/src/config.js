// Neon Harbor: every tuning number, colour and name in one place.
// The world is 3200 x 2400 units; the camera shows a window of it. The renderer scales the
// canvas to the browser window, so no rule below depends on the screen size.

export const STEP = 1 / 60;

export const WORLD = { width: 3200, height: 2400 };

/** Road grid: roads run every ROAD_GAP units; blocks between them hold buildings. */
export const ROAD = { gap: 400, width: 96, sidewalk: 26 };

/** The harbour water along the south edge: no road, no driving, just docks and light. */
export const HARBOR = { y: 2080, dockY: 2160 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  sprintSpeed: 330,
  health: 100,
  armor: 50,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.35,
};

export const CAR = {
  accel: 420,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 3.2,
  brake: 700,
  health: 100,
  stealWanted: 1,
};

/** Car models: name, size, colour, top speed factor and handling factor. All original. */
export const CAR_MODELS = [
  { name: 'Driftwood Sedan', w: 46, h: 24, color: '#3fa7d6', speed: 1.0, grip: 1.0, common: 5 },
  { name: 'Neon Taxi', w: 46, h: 24, color: '#f2c94c', speed: 0.95, grip: 1.0, common: 4 },
  { name: 'Harbor Coupe', w: 44, h: 22, color: '#e5534b', speed: 1.15, grip: 1.1, common: 3 },
  { name: 'Mackerel Truck', w: 58, h: 28, color: '#7a8b99', speed: 0.8, grip: 0.85, common: 2 },
  { name: 'Pelican Van', w: 54, h: 26, color: '#9b7ede', speed: 0.85, grip: 0.9, common: 2 },
  { name: 'Sunset Cruiser', w: 50, h: 24, color: '#ff8a5c', speed: 1.05, grip: 1.0, common: 2 },
];

export const POLICE_CAR = { name: 'Harbor PD Interceptor', w: 48, h: 24, color: '#22303e', speed: 1.12, grip: 1.15 };

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 40, cooldown: 0.35, ammo: Infinity, auto: false },
  pistol: { name: 'HK-9 Pistol', damage: 34, range: 520, cooldown: 0.22, ammo: 24, auto: false },
};

export const WANTED = {
  max: 5,
  /** Seconds out of every police line of sight before one star fades. */
  decaySeconds: 14,
  /** How many police cars hunt the player at each star level. */
  carsPerStar: [0, 1, 2, 3, 4, 5],
  /** Foot officers join the hunt from 3 stars up. */
  footFromStar: 3,
};

export const MISSION_REWARD = [400, 650, 900, 1200, 1600, 2500];

export const SAVE_KEY = 'neon-harbor.save.v1';
export const BEST_KEY = 'neon-harbor.best.v1';

/** Districts, west to east, north to south: name and palette accent. */
export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 1100, h: 1000, accent: '#f2c94c', note: 'brick lanes, corner delis' },
  { name: 'Downtown', x: 1100, y: 0, w: 1100, h: 1000, accent: '#ff5c8a', note: 'neon towers, night market' },
  { name: 'Marina', x: 2200, y: 0, w: 1000, h: 1000, accent: '#3fa7d6', note: 'yachts, arcades, pier' },
  { name: 'The Yards', x: 0, y: 1000, w: 1100, h: 1080, accent: '#7a8b99', note: 'warehouses, rail spur' },
  { name: 'Midtown', x: 1100, y: 1000, w: 1100, h: 1080, accent: '#9b7ede', note: 'offices, the plaza' },
  { name: 'Harbor', x: 2200, y: 1000, w: 1000, h: 1080, accent: '#2ec4b6', note: 'docks, cranes, fish market' },
];

export const PALETTE = {
  sky: '#1a1033',
  sunset: '#ff9e5e',
  road: '#232838',
  roadLine: '#d8c25a',
  sidewalk: '#3a4054',
  grass: '#1e4632',
  water: '#0e4a6b',
  buildingA: '#2c3350',
  buildingB: '#3a2c50',
  buildingC: '#233850',
  neonPink: '#ff5c8a',
  neonCyan: '#37e0d8',
  neonYellow: '#f2c94c',
  text: '#f4f1ea',
  muted: '#9aa3b5',
  panel: 'rgba(12, 14, 26, 0.82)',
  police: '#4fc3f7',
  policeDark: '#22303e',
  enemy: '#e5534b',
  health: '#58d68d',
  armor: '#4fc3f7',
  cash: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
