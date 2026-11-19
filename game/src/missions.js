// Neon Harbor 3D — the six story missions for Madame Kestrel.
// Each mission has an objective marker, a waypoint beacon and a cash reward.
// Enter starts the next job; completing one pays out and unlocks the next.

import { CONFIG } from './config.js';
import { spawnGang, clearGang } from './combat.js';
import { addWanted } from './police.js';

/** Waypoints (world x, z) for the six missions. */
const MISSION_SPOTS = [
  { start: [-25, 25], target: [175, -75], label: 'Drop the client at the Midtown hotel' },
  { start: [-25, 25], target: [150, 125], label: 'Steal the Harbor Coupe at the docks' },
  { start: [150, 125], target: [175, 150], label: 'Clear the Rust Vultures off the docks' },
  { start: [175, 150], target: [-125, -125], label: 'Deliver the package to Old Town' },
  { start: [-125, -125], target: [200, -125], label: "Hit the Vultures' warehouse in The Yards" },
  { start: [200, -125], target: [205, 207], label: "Escape to Kestrel's boat at the pier" },
];

/** Create the mission state. */
export function createMissions(game) {
  return {
    index: 0,
    active: false,
    done: false,
    allDone: false,
    waypoint: null,
    label: 'Press Enter to start the first job.',
    timer: 0,
  };
}

/** Start the next mission (Enter). */
export function startMission(game) {
  const m = game.missions;
  if (m.active || m.allDone) return;
  const spot = MISSION_SPOTS[m.index];
  m.active = true;
  m.waypoint = { x: spot.target[0], z: spot.target[1] };
  m.label = `${CONFIG.missions[m.index].name}: ${spot.label}`;
  game.hud.showObjective(m.label);
  game.audio.playMission();
  // mission 3 and 5 are fights: spawn the gang at the target
  if (m.index === 2) spawnGang(game, spot.target[0], spot.target[1], 4);
  if (m.index === 4) spawnGang(game, spot.target[0], spot.target[1], 5);
  // mission 4 draws police attention
  if (m.index === 3) addWanted(game, 1);
}

/** Complete the active mission: pay out, advance, unlock the next. */
function completeMission(game) {
  const m = game.missions;
  const reward = CONFIG.missions[m.index].reward;
  game.player.cash += reward;
  game.hud.showObjective(`Job done — +$${reward}. Press Enter for the next job.`);
  game.audio.playReward();
  clearGang(game);
  m.active = false;
  m.done = true;
  m.waypoint = null;
  m.index += 1;
  if (m.index >= CONFIG.missions.length) {
    m.allDone = true;
    m.label = 'All jobs done. Neon Harbor is yours, Juno.';
    game.saveBest();
  } else {
    m.label = `Next job: ${CONFIG.missions[m.index].name}. Press Enter.`;
  }
  game.save();
}

/** Update missions: check arrival at the waypoint. */
export function updateMissions(game, dt) {
  const m = game.missions;
  if (!m.active || !m.waypoint) return;
  const dx = game.player.pos.x - m.waypoint.x;
  const dz = game.player.pos.z - m.waypoint.z;
  const d = Math.hypot(dx, dz);
  // fight missions need the gang cleared first
  if ((m.index === 2 || m.index === 4) && game.combat.gang.length > 0) {
    m.label = `${CONFIG.missions[m.index].name}: clear the Vultures (${game.combat.gang.length} left).`;
    return;
  }
  if (d < 6) completeMission(game);
  void dt;
}

/** Distance and direction to the active waypoint (for the HUD beacon). */
export function waypointInfo(game) {
  const m = game.missions;
  if (!m.active || !m.waypoint) return null;
  const dx = m.waypoint.x - game.player.pos.x;
  const dz = m.waypoint.z - game.player.pos.z;
  return { x: m.waypoint.x, z: m.waypoint.z, dist: Math.hypot(dx, dz), angle: Math.atan2(dx, dz) };
}
