// Screenshot staging for shots.json: arrange a real game state for each named shot.
// The caller then runs a couple of seconds of simulation so physics and police settle,
// renders one frame, and sets window.__shotReady.

import { addWanted } from './police.js';
import { spawnEnemies } from './combat.js';
import { startMission } from './missions.js';

export const SHOT_NAMES = ['cover', 'city', 'mission', 'combat'];

export function stageShot(ctx, name) {
  ctx.shotMode = true;
  const P = ctx.player;
  if (name === 'cover') {
    // Golden-hour downtown: Juno in a Sunset Cruiser, Harbor PD closing in.
    // The car drives during the settle (shotDrive) so the cover shows it moving.
    ctx.dayT = 0.7;
    const car = ctx.spawnParkedCar('Sunset Cruiser', 25, 25, -Math.PI / 2);
    ctx.enterCar(car); // stealing adds 1 star; top up to 3
    addWanted(ctx.police, 2, { car: { model: 'Sunset Cruiser', color: 0xff8a5c } });
    ctx.camYaw = -Math.PI / 2;
    ctx.camPitch = 0.28;
    ctx.camDist = 13;
    ctx.shotDrive = true;
  } else if (name === 'city') {
    // Afternoon on the beach road, looking north at the Downtown skyline.
    ctx.dayT = 0.45;
    P.pos.set(-25, 0, 175);
    P.heading = 0;
    P.char.group.position.copy(P.pos);
    P.char.group.rotation.y = 0;
    ctx.camYaw = 0;
    ctx.camPitch = 0.32;
    ctx.camDist = 12;
  } else if (name === 'mission') {
    // Golden hour on the harbour road: Vultures hold the corner ahead, Juno walks in.
    ctx.dayT = 0.72;
    ctx.missions.index = 2; // Dockside Trouble
    startMission(ctx.missions, ctx);
    P.pos.set(225, 0, 168);
    P.heading = Math.PI; // face south down the road toward the docks
    P.char.group.position.copy(P.pos);
    P.char.group.rotation.y = P.heading;
    spawnEnemies(ctx.combat, 225, 175, 4, 'vulture');
    addWanted(ctx.police, 1);
    ctx.camYaw = P.heading;
    ctx.camPitch = 0.3;
    ctx.camDist = 12;
  } else if (name === 'combat') {
    // Night in The Yards: pistol out, three Vultures ahead, heat at 2 stars.
    ctx.dayT = 0.02;
    ctx.missions.index = 4; // Payback
    startMission(ctx.missions, ctx);
    P.pos.set(163, 0, -63);
    P.heading = Math.atan2(-(175 - 163), -(-75 + 63));
    P.char.group.position.copy(P.pos);
    P.char.group.rotation.y = P.heading;
    P.ownsPistol = true;
    P.weapon = 'pistol';
    P.ammo = 24;
    P.char.setArmed(true);
    spawnEnemies(ctx.combat, 175, -75, 3, 'vulture');
    addWanted(ctx.police, 2);
    ctx.camYaw = P.heading;
    ctx.camPitch = 0.25;
    ctx.camDist = 10;
  }
}
