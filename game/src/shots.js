// Neon Harbor 3D — reads ?shot= and stages each screenshot: time of day,
// player position / car, police and gang presence, and a cinematic camera.
// Shots are rendered with ?shot=<name>&seed=1 (see shots.json).

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { spawnGang } from './combat.js';
import { addWanted } from './police.js';
import { buildCarMesh } from './vehicle3d.js';

/** The four staged shots. */
export const SHOTS = {
  cover: {
    time: 0.72,
    blurb: 'Golden-hour downtown, Juno in a Sunset Cruiser with Harbor PD closing in.',
  },
  city: {
    time: 0.5,
    blurb: 'Afternoon on the beach road, looking north at the Downtown skyline.',
  },
  mission: {
    time: 0.78,
    blurb: 'Dusk at the docks, Vultures holding the corner.',
  },
  combat: {
    time: 0.05,
    blurb: 'Night in The Yards, pistol out.',
  },
};

/** Read the shot name from the URL (?shot=cover). Null when none. */
export function shotFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    const name = q.get('shot');
    return name && SHOTS[name] ? name : null;
  } catch (err) {
    return null;
  }
}

/** Put the player in a car of the given model at a spot (for staged shots). */
function stagePlayerCar(game, modelName, x, z, heading) {
  const model = CONFIG.carModels.find((m) => m.name === modelName) ?? CONFIG.carModels[0];
  // find a parked car of that model, or repurpose the nearest parked car
  let parked = game.traffic.parked.find((c) => c.model.name === modelName && !c.stolen);
  if (!parked) parked = game.traffic.parked.find((c) => !c.stolen);
  if (!parked) return false;
  parked.model = model;
  parked.x = x;
  parked.z = z;
  parked.heading = heading;
  // rebuild its mesh in the right colour
  game.scene.remove(parked.mesh);
  const mesh = buildCarMesh(model, { taxi: model.name === 'Neon Taxi' });
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  game.scene.add(mesh);
  parked.mesh = mesh;
  return game.enterCar(parked);
}

/** Place a police interceptor right behind the player (for the cover shot). */
function stagePoliceBehind(game) {
  addWanted(game, 2);
  const car = game.police.cars[0];
  if (!car) return;
  // anchor on the player car when driving (player.pos is stale until the
  // first update runs), else on the player on foot
  const anchor = game.playerCar ? game.playerCar.mesh.position : game.player.pos;
  const px = anchor.x;
  const pz = anchor.z;
  // directly south of the player car (it faces north), so it reads as a chase;
  // staged: it holds its pose for the screenshot instead of pursuing
  car.mesh.position.set(px, 0, pz + 14);
  car.mesh.rotation.y = Math.PI;
  car.staged = true;
}

/** Stage one shot: set time, player, police/gang, and the camera. */
export function applyShot(game, name) {
  const shot = SHOTS[name];
  if (!shot) return false;
  game.shotMode = true;
  game.freezeTime = true;
  game.time = shot.time;
  game.state = 'playing';
  game.paused = false;

  if (name === 'cover') {
    // golden-hour downtown, Juno driving a Sunset Cruiser, PD closing in
    stagePlayerCar(game, 'Sunset Cruiser', 25, 25, Math.PI);
    stagePoliceBehind(game);
    // camera low and close, directly behind the chase: PD large in the
    // foreground, Juno's cruiser centre-frame, downtown towers behind
    game.shotCamera = {
      pos: new THREE.Vector3(30, 4.5, 44),
      lookAt: new THREE.Vector3(24, 2, 20),
    };
  } else if (name === 'city') {
    // afternoon on the beach road, looking north at the Downtown skyline;
    // offset between the beach palms and raised so no palm blocks the centre
    game.player.pos.set(-14, 0, 182);
    game.player.mesh.position.copy(game.player.pos);
    game.player.heading = Math.PI;
    game.player.mesh.rotation.y = Math.PI;
    game.shotCamera = {
      pos: new THREE.Vector3(-14, 9, 198),
      lookAt: new THREE.Vector3(-14, 14, 30),
    };
  } else if (name === 'mission') {
    // dusk at the docks, Vultures holding the corner; camera in close
    game.player.pos.set(150, 0, 130);
    game.player.mesh.position.copy(game.player.pos);
    game.player.heading = Math.PI / 4;
    game.player.mesh.rotation.y = Math.PI / 4;
    game.player.weapon = 'pistol';
    spawnGang(game, 168, 144, 4);
    game.shotCamera = {
      pos: new THREE.Vector3(138, 4.5, 118),
      lookAt: new THREE.Vector3(166, 2, 142),
    };
  } else if (name === 'combat') {
    // night in The Yards (block col 8, row 2), pistol out; camera in close
    game.player.pos.set(175, 0, -50);
    game.player.mesh.position.copy(game.player.pos);
    game.player.heading = -Math.PI / 2;
    game.player.mesh.rotation.y = -Math.PI / 2;
    game.player.weapon = 'pistol';
    spawnGang(game, 185, -60, 3);
    addWanted(game, 1);
    game.shotCamera = {
      pos: new THREE.Vector3(162, 4.5, -36),
      lookAt: new THREE.Vector3(180, 1.5, -55),
    };
  }
  // apply the staged time of day immediately (no advance)
  game.time = shot.time;
  return true;
}
