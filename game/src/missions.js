// Neon Harbor 3D — missions.js
// The 6 story missions for Madame Kestrel. Each has an objective marker, a
// waypoint beacon and a cash reward. Enter starts the next job.

import { MISSION_REWARDS, NAMES } from './config.js';

export const MISSIONS = [
  {
    id: 1,
    name: 'First Fare',
    brief: 'Drive the client across town to the Downtown hotel.',
    target: { x: 25, z: -75 },
    reward: MISSION_REWARDS[0],
    type: 'drive',
  },
  {
    id: 2,
    name: 'Stolen Coupe',
    brief: 'Steal the Harbor Coupe from the garage and bring it back.',
    target: { x: 78, z: 28 },
    reward: MISSION_REWARDS[1],
    type: 'steal',
  },
  {
    id: 3,
    name: 'Dockside Fight',
    brief: 'Clear the Rust Vultures off the docks. No witnesses.',
    target: { x: 175, z: 125 },
    reward: MISSION_REWARDS[2],
    type: 'fight',
    enemies: 3,
  },
  {
    id: 4,
    name: 'Hot Package',
    brief: 'Pick up the package and deliver it while the police watch.',
    target: { x: -125, z: -125 },
    reward: MISSION_REWARDS[3],
    type: 'deliver',
  },
  {
    id: 5,
    name: 'Warehouse Payback',
    brief: 'Hit the Vultures\u2019 warehouse in The Yards. Make it loud.',
    target: { x: 175, z: -75 },
    reward: MISSION_REWARDS[4],
    type: 'fight',
    enemies: 4,
  },
  {
    id: 6,
    name: 'Last Getaway',
    brief: 'Escape to Kestrel\u2019s boat at the pier. This is the last favour.',
    target: { x: 170, z: 216 },
    reward: MISSION_REWARDS[5],
    type: 'escape',
  },
];

export function createMissions() {
  const state = {
    current: 0, // index into MISSIONS, 0-based; 6 means all done
    active: false,
    phase: 'idle', // idle | active | done
    startedAt: 0,
  };

  function currentMission() {
    return state.current < MISSIONS.length ? MISSIONS[state.current] : null;
  }

  function startNext(now) {
    const m = currentMission();
    if (!m) return null;
    state.active = true;
    state.phase = 'active';
    state.startedAt = now;
    return m;
  }

  function complete() {
    const m = currentMission();
    if (!m) return 0;
    state.active = false;
    state.phase = 'done';
    state.current += 1;
    return m.reward;
  }

  function reset() {
    state.current = 0;
    state.active = false;
    state.phase = 'idle';
  }

  function allDone() {
    return state.current >= MISSIONS.length;
  }

  function objectiveText() {
    const m = currentMission();
    if (!m) return `${NAMES.fixer} owes you nothing now. The harbour is yours.`;
    if (!state.active) return `Press Enter — next job: ${m.name} ($${m.reward})`;
    return `${m.name}: ${m.brief}`;
  }

  return { state, currentMission, startNext, complete, reset, allDone, objectiveText };
}
