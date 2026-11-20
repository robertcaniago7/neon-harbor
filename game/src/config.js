// Neon Harbor 3D — every tuning number, colour and name in one place.
// All values come from the build spec. Nothing here is read from anywhere else.

export const CONFIG = {
  // World extents in metres: x east, z south, y up, ground y = 0.
  world: { minX: -230, maxX: 230, minZ: -180, maxZ: 180 },
  roadX: [-225, -175, -125, -75, -25, 25, 75, 125, 175, 225],
  roadZ: [-175, -125, -75, -25, 25, 75, 125, 175],
  blockX: [-200, -150, -100, -50, 0, 50, 100, 150, 200],
  blockZ: [-150, -100, -50, 0, 50, 100, 150],
  roadWidth: 10,
  laneOffset: 2.2,
  beachZ0: 180,
  beachZ1: 205,
  seaZ: 205,

  // Palette (hex numbers for three.js).
  colors: {
    skyDay: 0x8ec5f0, skyDusk: 0xff9a6b, skyNight: 0x1b1f3b,
    fogDay: 0xa8c8e8, fogNight: 0x2b2f5a,
    seaDay: 0x1fb6c9, seaNight: 0x0e3a5a,
    sand: 0xe8c47a, road: 0x454a55, sidewalk: 0x9aa0a8,
    neonPink: 0xff2d95, neonCyan: 0x00e5ff, neonAmber: 0xffb020,
    windowDay: 0x2a3442, windowNight: 0xffc46b,
    grass: 0x4f9e57, pierWood: 0x8a6f4d, concrete: 0x7d838c,
  },

  // District look: building height range + facade colours.
  districts: {
    Downtown: { h: [28, 78], colors: [0x8f9bb0, 0x6b7a94, 0x5a6b84, 0x7d8aa0] },
    Midtown: { h: [12, 28], colors: [0xc9a86a, 0xb08d57, 0xa8b8c8, 0xc77e6a] },
    'Old Town': { h: [6, 14], colors: [0xffb3c1, 0xffd6a5, 0xa8e6cf, 0xf9e79f, 0xf5c6a5] },
    'The Yards': { h: [8, 18], colors: [0x7a8b99, 0x5f7280, 0x8a7f70, 0x6b7f6b] },
    'Palma Beach': { h: [6, 12], colors: [0xffd6a5, 0xffb3c1, 0xa8e6cf, 0xfff1d6, 0xf9e79f] },
    Harbor: { h: [6, 14], colors: [0x7a8b99, 0x5f7280, 0xc77e6a] },
  },
  // Parks (no buildings) at block (col,row): (1,3) and (7,4).
  parks: [[1, 3], [7, 4]],

  // Day cycle: 480 s per full day. Start 0.72 (golden hour).
  // t in [0,1): 0 midnight, 0.25 dawn, 0.5 noon, 0.75 dusk.
  dayLength: 480,
  startTime: 0.72,

  // Player.
  player: {
    radius: 0.45, height: 1.8, walk: 4.2, sprint: 7.0,
    health: 100, armor: 50,
    punchDamage: 12, punchRange: 2.2, punchCooldown: 0.35,
    startX: -25, startZ: 25, startCash: 150,
  },

  // Player car (cannon-es RaycastVehicle, arcade feel).
  car: {
    mass: 1400, halfExtents: [0.95, 0.32, 2.2],
    wheelRadius: 0.36, wheelWidth: 0.28, wheelBase: 1.45, wheelTrack: 0.85,
    suspensionStiffness: 30, suspensionRest: 0.32, suspensionTravel: 0.3,
    maxSuspensionForce: 100000, dampingRelax: 2.3, dampingCompress: 4.4,
    frictionSlip: 1.4, rollInfluence: 0.01,
    maxEngineForce: 4000, maxBrakeForce: 1000, maxSteer: 0.55,
    maxSpeed: 38,
  },

  // Car models: name, colour, speed multiplier, grip, commonness weight.
  carModels: [
    { name: 'Driftwood Sedan', color: 0x3fa7d6, speed: 1.0, grip: 1.0, common: 5 },
    { name: 'Neon Taxi', color: 0xf2c94c, speed: 0.95, grip: 1.0, common: 4 },
    { name: 'Harbor Coupe', color: 0xe5534b, speed: 1.15, grip: 1.1, common: 3 },
    { name: 'Mackerel Truck', color: 0x7a8b99, speed: 0.8, grip: 0.85, common: 2 },
    { name: 'Pelican Van', color: 0x9b7ede, speed: 0.85, grip: 0.9, common: 2 },
    { name: 'Sunset Cruiser', color: 0xff8a5c, speed: 1.05, grip: 1.0, common: 2 },
  ],
  policeCar: { name: 'Harbor PD Interceptor', color: 0x22303e, speed: 1.12, grip: 1.15 },

  // Weapons.
  weapons: {
    fists: { damage: 12, range: 2.2, cooldown: 0.35, ammo: Infinity, name: 'Fists' },
    pistol: { damage: 34, range: 120, cooldown: 0.22, ammo: 24, name: 'HK-9 Pistol' },
  },

  // Wanted: max 5 stars. Decay 14 s with no police line of sight before a star fades.
  wanted: {
    max: 5, decay: 14,
    policePerStar: [0, 1, 2, 3, 4, 5],
    officersPerStar: [0, 0, 0, 2, 3, 4],
    unseenDrop: 2,
  },

  missionRewards: [400, 700, 1000, 1400, 1900, 2500],

  saveKey: 'neon-harbor-3d-save-v1',
  bestKey: 'neon-harbor-3d-best-v1',

  quality: {
    high: { pixelRatio: 2, shadow: 2048, traffic: 16, peds: 14, fogFar: 420 },
    low: { pixelRatio: 1.25, shadow: 1024, traffic: 8, peds: 8, fogFar: 300 },
  },

  counts: { parked: 10, traffic: 16, peds: 14 },

  // Story people.
  people: {
    player: 'Juno Voss',
    boss: 'Madame Kestrel',
    gang: 'Rust Vultures',
    city: 'Neon Harbor',
  },

  missions: [
    { name: 'First Fare', desc: 'Drive a client across town for Madame Kestrel.' },
    { name: 'Stolen Coupe', desc: 'Steal the Harbor Coupe and bring it to the garage.' },
    { name: 'Dockside Fight', desc: 'Clear the Rust Vultures off the docks.' },
    { name: 'Hot Package', desc: 'Pick up the package and deliver it while the police are watching.' },
    { name: 'Warehouse Payback', desc: 'Hit the Vultures\u2019 warehouse.' },
    { name: 'Last Getaway', desc: 'Escape to Kestrel\u2019s boat at the pier.' },
  ],
};

export default CONFIG;
