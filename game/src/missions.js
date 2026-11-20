// The 6 story missions for Madame Kestrel. Each mission has a name, a
// description, an objective point, a waypoint beacon, and a cash reward.
// Enter starts the next job; finishing one pays out and unlocks the next.

import * as THREE from 'three';
import { CONFIG } from './config.js';

const REWARDS = CONFIG.missionRewards;

// Objective spots (x, z) picked from the city grid.
const SPOTS = {
  midtown: [-25, 25],
  downtown: [75, -25],
  garage: [125, 75],
  docks: [175, 125],
  warehouse: [-125, -75],
  pier: [175, 205],
  beach: [25, 150],
  yards: [175, -125],
  oldtown: [-175, -25],
  harbor: [175, 75],
};

function makeObjective(scene, x, z, color) {
  // A tall glowing beacon column + a ring on the ground.
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.35, depthWrite: false,
  });
  const column = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true), mat);
  column.position.set(x, 30, z);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.22, 8, 32), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, 0.25, z);
  scene.add(column, ring);
  return { column, ring, mat, ringMat, x, z };
}

export function createMissions(scene) {
  const defs = [
    {
      name: 'First Fare', desc: 'Drive a client across town for Madame Kestrel.',
      spot: SPOTS.downtown, kind: 'drive', reward: REWARDS[0],
      brief: 'Pick up the client at Midtown and drive them to Downtown.',
    },
    {
      name: 'Stolen Coupe', desc: 'Steal the Harbor Coupe and bring it to the garage.',
      spot: SPOTS.docks, kind: 'steal', reward: REWARDS[1],
      brief: 'The Harbor Coupe is parked at the docks. Take it to the garage.',
    },
    {
      name: 'Dockside Fight', desc: 'Clear the Rust Vultures off the docks.',
      spot: SPOTS.docks, kind: 'fight', reward: REWARDS[2],
      brief: 'Vultures are holding the docks. Clear them out.',
    },
    {
      name: 'Hot Package', desc: 'Pick up the package and deliver it while the police are watching.',
      spot: SPOTS.warehouse, kind: 'deliver', reward: REWARDS[3],
      brief: 'Grab the package at the warehouse, then deliver it to the pier.',
    },
    {
      name: 'Warehouse Payback', desc: 'Hit the Vultures\u2019 warehouse.',
      spot: SPOTS.warehouse, kind: 'fight', reward: REWARDS[4],
      brief: 'Hit the Vultures\u2019 warehouse in The Yards and settle the score.',
    },
    {
      name: 'Last Getaway', desc: 'Escape to Kestrel\u2019s boat at the pier.',
      spot: SPOTS.pier, kind: 'escape', reward: REWARDS[5],
      brief: 'Lose the heat and reach Kestrel\u2019s boat at the pier.',
    },
  ];

  let current = -1; // -1 = no mission active
  let completed = 0;
  let objective = null;
  let stage = 0; // per-mission sub-stage (e.g. pickup then deliver)
  let killsNeeded = 0;

  function clearObjective() {
    if (!objective) return;
    scene.remove(objective.column, objective.ring);
    objective.column.geometry.dispose();
    objective.ring.geometry.dispose();
    objective = null;
  }

  function showObjective(x, z, color = 0xffb020) {
    clearObjective();
    objective = makeObjective(scene, x, z, color);
    return objective;
  }

  // Start mission `index`. Returns the mission def.
  function start(index) {
    if (index < 0 || index >= defs.length) return null;
    current = index;
    stage = 0;
    killsNeeded = 0;
    const def = defs[index];
    // Fight missions need a kill count; set by the world when it spawns foes.
    if (def.kind === 'fight') killsNeeded = 4;
    showObjective(def.spot[0], def.spot[1], def.kind === 'fight' ? 0xff3b30 : 0xffb020);
    return def;
  }

  // Mark the current mission done. Returns the reward.
  function complete() {
    if (current < 0) return 0;
    const reward = defs[current].reward;
    completed++;
    clearObjective();
    current = -1;
    stage = 0;
    return reward;
  }

  function fail() {
    clearObjective();
    current = -1;
    stage = 0;
  }

  function getCurrent() {
    return current < 0 ? null : defs[current];
  }

  function getObjectivePos() {
    if (!objective) return null;
    return { x: objective.x, z: objective.z };
  }

  function isDone() {
    return completed >= defs.length;
  }

  function setStage(n) {
    stage = n;
  }

  function setKillsNeeded(n) {
    killsNeeded = n;
  }

  return {
    defs,
    get current() { return current; },
    get completed() { return completed; },
    get stage() { return stage; },
    get killsNeeded() { return killsNeeded; },
    start, complete, fail, getCurrent, getObjectivePos, isDone,
    setStage, setKillsNeeded, showObjective, clearObjective,
    spots: SPOTS,
  };
}

export default createMissions;
