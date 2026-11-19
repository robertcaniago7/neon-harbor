// Neon Harbor 3D — every tuning number, colour and name in one place.
// All values come from the design spec; nothing here reads a file.

export const CONFIG = {
  // ---- world ----
  world: {
    xMin: -230, xMax: 230,
    zMin: -180, zMax: 180,
    groundY: 0,
    roadWidth: 10,
    laneOffset: 2.2,
    roadX: [-225, -175, -125, -75, -25, 25, 75, 125, 175, 225],
    roadZ: [-175, -125, -75, -25, 25, 75, 125, 175],
    blockX: [-200, -150, -100, -50, 0, 50, 100, 150, 200],
    blockZ: [-150, -100, -50, 0, 50, 100, 150],
    beachZ0: 180, beachZ1: 205,
    seaZ: 205,
  },

  // ---- palette ----
  palette: {
    skyDay: 0x8ec5f0, skyDusk: 0xff9a6b, skyNight: 0x1b1f3b,
    fogDay: 0xa8c8e8, fogNight: 0x2b2f5a,
    seaDay: 0x1fb6c9, seaNight: 0x0e3a5a,
    sand: 0xe8c47a,
    road: 0x454a55, sidewalk: 0x9aa0a8, ground: 0x7f9c6a,
    neonPink: 0xff2d95, neonCyan: 0x00e5ff, neonAmber: 0xffb020,
    windowDay: 0x2a3442, windowNight: 0xffc46b,
    sunDay: 0xfff2d0, sunDusk: 0xffb27a, sunNight: 0x8fa8ff,
  },

  // ---- districts: name, building height range, building colours ----
  districts: {
    Downtown: { h: [28, 78], colors: [0x8f9bb0, 0x6b7a94, 0x5a6b84, 0x7d8aa0] },
    Midtown: { h: [12, 28], colors: [0xc9a86a, 0xb08d57, 0xa8b8c8, 0xc77e6a] },
    'Old Town': { h: [6, 14], colors: [0xffb3c1, 0xffd6a5, 0xa8e6cf, 0xf9e79f, 0xf5c6a5] },
    'The Yards': { h: [8, 18], colors: [0x7a8b99, 0x5f7280, 0x8a7f70, 0x6b7f6b] },
    'Palma Beach': { h: [6, 12], colors: [0xffd6a5, 0xffb3c1, 0xa8e6cf, 0xfff1d6, 0xf9e79f] },
    Harbor: { h: [6, 14], colors: [0x7a8b99, 0x5f7280, 0xc77e6a] },
  },
  // parks (no buildings): [col, row]
  parks: [[1, 3], [7, 4]],

  // ---- day / night ----
  day: {
    lengthSec: 480,
    startTime: 0.72, // golden hour
  },

  // ---- player ----
  player: {
    radius: 0.45, height: 1.8,
    walkSpeed: 4.2, sprintSpeed: 7.0,
    health: 100, armor: 50,
    startX: -25, startZ: 25,
    startCash: 150,
    punchDamage: 12, punchRange: 2.2, punchCooldown: 0.35,
  },

  // ---- player car (cannon-es RaycastVehicle, arcade feel) ----
  car: {
    mass: 1400,
    chassisHalf: [0.95, 0.32, 2.2],
    wheelRadius: 0.36, wheelWidth: 0.28,
    wheelBase: 1.45, wheelTrack: 0.85,
    suspensionStiffness: 30, suspensionRest: 0.32, suspensionTravel: 0.3,
    suspensionMaxForce: 100000,
    dampingRelax: 2.3, dampingCompress: 4.4,
    frictionSlip: 1.4, rollInfluence: 0.01,
    maxEngineForce: 4000, maxBrakeForce: 1000,
    maxSteer: 0.55, maxSpeed: 38,
  },

  // ---- car models: name, colour, speed, grip, commonness ----
  carModels: [
    { name: 'Driftwood Sedan', color: 0x3fa7d6, speed: 1.0, grip: 1.0, weight: 5 },
    { name: 'Neon Taxi', color: 0xf2c94c, speed: 0.95, grip: 1.0, weight: 4 },
    { name: 'Harbor Coupe', color: 0xe5534b, speed: 1.15, grip: 1.1, weight: 3 },
    { name: 'Mackerel Truck', color: 0x7a8b99, speed: 0.8, grip: 0.85, weight: 2 },
    { name: 'Pelican Van', color: 0x9b7ede, speed: 0.85, grip: 0.9, weight: 2 },
    { name: 'Sunset Cruiser', color: 0xff8a5c, speed: 1.05, grip: 1.0, weight: 2 },
  ],
  policeCar: { name: 'Harbor PD Interceptor', color: 0x22303e, speed: 1.12, grip: 1.15 },

  // ---- weapons ----
  weapons: {
    fists: { name: 'Fists', damage: 12, range: 2.2, cooldown: 0.35, ammo: Infinity },
    pistol: { name: 'HK-9 Pistol', damage: 34, range: 120, cooldown: 0.22, ammo: 24 },
  },

  // ---- wanted ----
  wanted: {
    max: 5,
    decaySec: 14, // no police line of sight before one star fades
    policeCarsPerStar: [0, 1, 2, 3, 4, 5],
    footOfficersPerStar: [0, 0, 0, 2, 3, 4],
    unseenDrop: 2, // changing to an unseen car/outfit drops this many stars
  },

  // ---- missions ----
  missions: [
    { name: 'First Fare', reward: 400, blurb: 'Drive a client across town.' },
    { name: 'Stolen Coupe', reward: 700, blurb: 'Steal the Harbor Coupe and bring it to the garage.' },
    { name: 'Dockside Fight', reward: 1000, blurb: 'Clear the Rust Vultures off the docks.' },
    { name: 'Hot Package', reward: 1400, blurb: 'Pick up a package and deliver it while the police watch.' },
    { name: 'Warehouse Payback', reward: 1900, blurb: "Hit the Vultures' warehouse." },
    { name: 'Last Getaway', reward: 2500, blurb: "Escape to Kestrel's boat at the pier." },
  ],

  // ---- counts ----
  counts: { parked: 10, traffic: 16, peds: 14 },

  // ---- save keys ----
  saveKey: 'neon-harbor-3d-save-v1',
  bestKey: 'neon-harbor-3d-best-v1',

  // ---- quality tiers ----
  quality: {
    high: { pixelRatio: 2, shadow: 2048, traffic: 16, peds: 14, fogFar: 420 },
    low: { pixelRatio: 1.25, shadow: 1024, traffic: 8, peds: 8, fogFar: 300 },
  },
};

/** District name for a block column (0..8) and row (0..6, north to south). */
export function districtAt(col, row) {
  if (row >= 5) return col >= 6 ? 'Harbor' : 'Palma Beach';
  if (col <= 2) return 'Old Town';
  if (row <= 1) return 'Midtown';
  if (col >= 6 && row <= 2) return 'The Yards';
  if (col >= 3 && col <= 5 && row >= 2 && row <= 4) return 'Downtown';
  if (col >= 6 && row >= 3 && row <= 4) return 'Midtown';
  return 'Midtown';
}

/** True when the block (col, row) is a park (no buildings). */
export function isPark(col, row) {
  return CONFIG.parks.some(([c, r]) => c === col && r === row);
}
