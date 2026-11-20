// Screenshot staging: reads ?shot=<name>&seed=<n> from the URL and positions
// the player / camera / time of day for that shot. Used by shots.json.
// The world calls applyShot(world, name) once at boot when a shot is requested.

import * as THREE from 'three';

export function getShotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || null,
    seed: parseInt(q.get('seed') || '1', 10) || 1,
  };
}

// Per-shot staging: where the player stands, what they drive, the time of day,
// how many police are closing in, and where the camera looks.
export const SHOT_STAGING = {
  cover: {
    time: 0.72,
    player: { x: 25, z: -25, heading: Math.PI * 0.15, inCar: 'Sunset Cruiser' },
    camera: { dist: 11, height: 4.2, angle: 0.5 },
    wanted: 3,
    gang: 0,
    note: 'Golden-hour downtown, Juno in a Sunset Cruiser with Harbor PD closing in.',
  },
  city: {
    time: 0.5,
    player: { x: -25, z: 150, heading: Math.PI, inCar: null },
    camera: { dist: 10, height: 3.6, angle: 0 },
    wanted: 0,
    gang: 0,
    note: 'Afternoon on the beach road, looking north at the Downtown skyline.',
  },
  mission: {
    time: 0.78,
    player: { x: 175, z: 125, heading: 0, inCar: null },
    camera: { dist: 12, height: 5, angle: Math.PI },
    wanted: 1,
    gang: 4,
    note: 'Dusk at the docks, Vultures holding the corner.',
  },
  combat: {
    time: 0.05,
    player: { x: 175, z: -100, heading: Math.PI * 0.75, inCar: null, weapon: 'pistol' },
    camera: { dist: 8, height: 3.0, angle: 0.35 },
    wanted: 2,
    gang: 3,
    note: 'Night in The Yards, pistol out.',
  },
};

export function applyShot(world, name) {
  const staging = SHOT_STAGING[name];
  if (!staging || !world) return null;
  if (world.daynight) world.daynight.setTime(staging.time);
  const p = staging.player;
  if (world.setPlayerPose) world.setPlayerPose(p.x, p.z, p.heading);
  if (p.inCar && world.putPlayerInCar) world.putPlayerInCar(p.inCar);
  if (p.weapon && world.setWeapon) world.setWeapon(p.weapon);
  if (staging.wanted && world.police) world.police.setWanted(staging.wanted, { x: p.x, z: p.z });
  if (staging.gang && world.combat) {
    for (let i = 0; i < staging.gang; i++) {
      const a = (i / staging.gang) * Math.PI * 2;
      world.combat.spawnGang(p.x + Math.cos(a) * 9, p.z + Math.sin(a) * 9);
    }
  }
  if (world.setCameraShot) world.setCameraShot(staging.camera);
  return staging;
}

export default { getShotParams, SHOT_STAGING, applyShot };
