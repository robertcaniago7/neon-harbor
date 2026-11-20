// Neon Harbor 3D — shots.js
// Reads the ?shot= query and stages the player/camera for each screenshot.
// Each shot is a real render of the live game at a fixed seed.

export const SHOTS = {
  cover: {
    name: 'cover',
    desc: 'Golden-hour downtown, Juno in a Sunset Cruiser with Harbor PD closing in.',
    time: 0.72,
    player: { x: 25, z: -25, yaw: 0.4, inCar: true, carModel: 5, wanted: 3 },
    camera: { x: 34, y: 7, z: -40, lookX: 25, lookY: 1.5, lookZ: -25 },
  },
  city: {
    name: 'city',
    desc: 'Afternoon on the beach road, looking north at the Downtown skyline.',
    time: 0.55,
    player: { x: 75, z: 168, yaw: Math.PI, inCar: false, wanted: 0 },
    camera: { x: 75, y: 9, z: 178, lookX: 75, lookY: 6, lookZ: 0 },
  },
  mission: {
    name: 'mission',
    desc: 'Dusk at the docks, Vultures holding the corner.',
    time: 0.78,
    player: { x: 175, z: 125, yaw: -0.6, inCar: false, wanted: 1, enemies: 3 },
    camera: { x: 158, y: 8, z: 108, lookX: 178, lookY: 1.5, lookZ: 128 },
  },
  combat: {
    name: 'combat',
    desc: 'Night in The Yards, pistol out.',
    time: 0.05,
    player: { x: 175, z: -75, yaw: 0.9, inCar: false, wanted: 2, enemies: 2, weapon: 1 },
    camera: { x: 164, y: 6, z: -88, lookX: 178, lookY: 1.5, lookZ: -72 },
  },
};

export function parseShotQuery(search) {
  const params = new URLSearchParams(search || '');
  const shot = params.get('shot');
  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  if (shot && SHOTS[shot]) return { name: shot, seed, def: SHOTS[shot] };
  return { name: null, seed, def: null };
}

export function shotNames() {
  return Object.keys(SHOTS);
}
