// Neon Harbor 3D — config.js
// Every tuning number, colour and name in one place.

export const WORLD = {
  xMin: -230,
  xMax: 230,
  zMin: -180,
  zMax: 180,
  groundY: 0,
  beachZ0: 180,
  beachZ1: 205,
  seaZ: 205,
};

export const ROADS_X = [-225, -175, -125, -75, -25, 25, 75, 125, 175, 225];
export const ROADS_Z = [-175, -125, -75, -25, 25, 75, 125, 175];
export const BLOCKS_X = [-200, -150, -100, -50, 0, 50, 100, 150, 200];
export const BLOCKS_Z = [-150, -100, -50, 0, 50, 100, 150];
export const ROAD_WIDTH = 10;
export const ROAD_SPACING = 50;

export const DISTRICTS = {
  downtown: { hMin: 28, hMax: 78, colors: [0x8f9bb0, 0x6b7a94, 0x5a6b84, 0x7d8aa0] },
  midtown: { hMin: 12, hMax: 28, colors: [0xc9a86a, 0xb08d57, 0xa8b8c8, 0xc77e6a] },
  oldtown: { hMin: 6, hMax: 14, colors: [0xffb3c1, 0xffd6a5, 0xa8e6cf, 0xf9e79f, 0xf5c6a5] },
  yards: { hMin: 8, hMax: 18, colors: [0x7a8b99, 0x5f7280, 0x8a7f70, 0x6b7f6b] },
  beach: { hMin: 6, hMax: 12, colors: [0xffd6a5, 0xffb3c1, 0xa8e6cf, 0xfff1d6, 0xf9e79f] },
  harbor: { hMin: 6, hMax: 14, colors: [0x7a8b99, 0x5f7280, 0xc77e6a] },
};

export const PARKS = [
  { col: 1, row: 3 },
  { col: 7, row: 4 },
];

export const PALETTE = {
  skyDay: 0x8ec5f0,
  skyDusk: 0xff9a6b,
  skyNight: 0x1b1f3b,
  fogDay: 0xa8c8e8,
  fogNight: 0x2b2f5a,
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

export const DAY_LENGTH = 480; // seconds per full day
export const START_TIME = 0.72; // golden hour

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
  startX: -25,
  startZ: 25,
  startCash: 150,
};

export const CAR_PHYSICS = {
  mass: 1400,
  halfExtents: [0.95, 0.32, 2.2],
  wheelRadius: 0.36,
  wheelWidth: 0.28,
  wheelBase: 1.45,
  wheelTrack: 0.85,
  suspensionStiffness: 30,
  suspensionRest: 0.32,
  suspensionTravel: 0.3,
  suspensionMaxForce: 100000,
  dampingRelax: 2.3,
  dampingCompress: 4.4,
  frictionSlip: 1.4,
  rollInfluence: 0.01,
  maxEngineForce: 4000,
  maxBrakeForce: 1000,
  maxSteer: 0.55,
  maxSpeed: 38,
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
  fists: { damage: 12, range: 2.2, cooldown: 0.35, ammo: Infinity },
  pistol: { name: 'HK-9', damage: 34, range: 120, cooldown: 0.22, ammo: 24 },
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 14,
  policePerStar: [0, 1, 2, 3, 4, 5],
  officersPerStar: [0, 0, 0, 2, 3, 4],
  unseenDrop: 2,
};

export const MISSION_REWARDS = [400, 700, 1000, 1400, 1900, 2500];

export const SAVE_KEYS = {
  save: 'neon-harbor-3d-save-v1',
  best: 'neon-harbor-3d-best-v1',
};

export const QUALITY = {
  high: { pixelRatio: 2, shadowMap: 2048, traffic: 16, peds: 14, fogFar: 420 },
  low: { pixelRatio: 1.25, shadowMap: 1024, traffic: 8, peds: 8, fogFar: 300 },
};

export const COUNTS = {
  parkedCars: 10,
  trafficCars: 16,
  pedestrians: 14,
};

export const NAMES = {
  player: 'Juno Voss',
  fixer: 'Madame Kestrel',
  gang: 'Rust Vultures',
  city: 'Neon Harbor',
};

export const DISTRICT_NAMES = {
  downtown: 'Downtown',
  midtown: 'Midtown',
  oldtown: 'Old Town',
  yards: 'The Yards',
  beach: 'Palma Beach',
  harbor: 'Harbor',
};
