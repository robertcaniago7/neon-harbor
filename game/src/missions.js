// Neon Harbor's story: Juno Voss, a getaway driver who owes Madame Kestrel one last
// favour, and the Rust Vultures who want the harbour for themselves. Six missions,
// each a chain of small steps the world runner advances. Coordinates are metres
// (x east, z south) on the 3D city grid.

import * as THREE from 'three';
import { MISSION_REWARD } from './config.js';
import { spawnEnemies, spawnPickup } from './combat.js';
import { addWanted } from './police.js';

export const STORY = {
  hero: 'Juno Voss',
  fixer: 'Madame Kestrel',
  gang: 'Rust Vultures',
  intro: 'Neon Harbor never sleeps. Juno Voss drives for whoever pays — tonight, that is Madame Kestrel.',
};

export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    briefing: 'Kestrel: "A client waits in Downtown. Drive him to the Marina. Smoothly. He hates sirens."',
    reward: MISSION_REWARD[0],
    steps: [
      { type: 'goto', x: 25, z: 25, label: 'Pick up the client in Downtown', radius: 8 },
      { type: 'goto', x: 175, z: 150, label: 'Drop the client at the Marina', radius: 8, needCar: true },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: 'Kestrel: "The Vultures parked a Harbor Coupe at the docks. Take it. Bring it to my garage in Midtown."',
    reward: MISSION_REWARD[1],
    steps: [
      { type: 'steal', model: 'Harbor Coupe', x: 225, z: 175, label: 'Steal the Harbor Coupe at the docks', radius: 10 },
      { type: 'goto', x: 25, z: -125, label: 'Deliver the coupe to the garage', radius: 9, needCar: true },
    ],
  },
  {
    id: 'dockside-trouble',
    title: 'Dockside Trouble',
    briefing: 'Kestrel: "Vultures are shaking down my dock crew. Go remind them whose harbour this is."',
    reward: MISSION_REWARD[2],
    steps: [
      { type: 'goto', x: 225, z: 175, label: 'Reach the docks', radius: 10 },
      { type: 'kill', count: 4, x: 225, z: 175, label: 'Deal with the Vultures (0/4)' },
    ],
  },
  {
    id: 'the-package',
    title: 'The Package',
    briefing: 'Kestrel: "A package waits in Old Town. The police know about it, so expect company. Deliver it to Midtown."',
    reward: MISSION_REWARD[3],
    steps: [
      { type: 'goto', x: -175, z: -25, label: 'Collect the package in Old Town', radius: 8 },
      { type: 'goto', x: 25, z: -125, label: 'Deliver the package to Midtown', radius: 9, wanted: 2 },
    ],
  },
  {
    id: 'payback',
    title: 'Payback',
    briefing: 'Kestrel: "The Vultures run a warehouse in The Yards. Burn their operation down. Then get out."',
    reward: MISSION_REWARD[4],
    steps: [
      { type: 'goto', x: 175, z: -75, label: 'Reach the warehouse', radius: 10 },
      { type: 'kill', count: 6, x: 175, z: -75, label: 'Clear the warehouse (0/6)' },
      { type: 'goto', x: 0, z: 0, label: 'Escape to Downtown', radius: 10 },
    ],
  },
  {
    id: 'the-big-one',
    title: 'The Big One',
    briefing: 'Kestrel: "One last job. Lift the getaway car, shake the whole Harbor PD, and meet my boat at the pier."',
    reward: MISSION_REWARD[5],
    steps: [
      { type: 'steal', model: 'Sunset Cruiser', x: 25, z: -25, label: 'Steal the Sunset Cruiser', radius: 10 },
      { type: 'survive', seconds: 30, label: 'Lose the heat — survive the chase (30s)', wanted: 4 },
      { type: 'goto', x: 185, z: 228, label: "Reach Kestrel's boat at the pier", radius: 9 },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0,
    step: 0,
    active: false,
    done: false,
    kills: 0,
    surviveT: 0,
    waypoint: null, // {x, z, label}
    beacon: null, // THREE.Mesh pillar at the waypoint
    stealCar: null, // parked car to steal for the current step
  };
}

function makeBeacon(scene) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd23f, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  mesh.position.y = 30;
  scene.add(mesh);
  return mesh;
}

function setWaypoint(state, scene, x, z, label) {
  if (state.beacon) scene.remove(state.beacon);
  state.beacon = makeBeacon(scene);
  state.beacon.position.x = x;
  state.beacon.position.z = z;
  state.waypoint = { x, z, label };
}

export function currentMission(state) {
  return state.index < MISSIONS.length ? MISSIONS[state.index] : null;
}

export function currentStep(state) {
  const m = currentMission(state);
  return m ? m.steps[state.step] : null;
}

export function startMission(state, ctx) {
  const m = currentMission(state);
  if (!m || state.active) return false;
  state.active = true;
  state.step = 0;
  state.kills = 0;
  state.surviveT = 0;
  ctx.events.push('missionStart:' + m.title);
  ctx.audio.mission();
  enterStep(state, ctx);
  return true;
}

function enterStep(state, ctx) {
  const step = currentStep(state);
  if (!step) return;
  if (step.type === 'goto' || step.type === 'steal') {
    setWaypoint(state, ctx.scene, step.x, step.z, step.label);
  }
  if (step.type === 'kill') {
    setWaypoint(state, ctx.scene, step.x, step.z, step.label);
    spawnEnemies(ctx.combat, step.x, step.z, step.count, 'vulture');
    state.kills = 0;
  }
  if (step.type === 'steal') {
    // park the target car at the spot (a fresh, stealable car)
    state.stealCar = ctx.spawnParkedCar(step.model, step.x, step.z);
  }
  if (step.type === 'survive') {
    state.surviveT = 0;
    addWanted(ctx.police, step.wanted, { car: { model: 'Sunset Cruiser', color: 0xff8a5c } });
    if (state.beacon) {
      ctx.scene.remove(state.beacon);
      state.beacon = null;
    }
    state.waypoint = null;
  }
}

function completeStep(state, ctx) {
  state.step += 1;
  const m = currentMission(state);
  if (state.step >= m.steps.length) {
    completeMission(state, ctx);
    return;
  }
  enterStep(state, ctx);
}

function completeMission(state, ctx) {
  const m = currentMission(state);
  ctx.player.cash += m.reward;
  ctx.stats.cashEarned += m.reward;
  ctx.events.push('missionDone:' + m.title + ':' + m.reward);
  ctx.audio.cash();
  if (state.beacon) {
    ctx.scene.remove(state.beacon);
    state.beacon = null;
  }
  state.waypoint = null;
  state.active = false;
  state.index += 1;
  state.step = 0;
  if (state.index >= MISSIONS.length) {
    state.done = true;
    ctx.events.push('storyDone');
  }
}

export function stepMissions(state, ctx, dt) {
  if (!state.active) return;
  const step = currentStep(state);
  if (!step) return;
  const p = ctx.player.pos;
  if (step.type === 'goto') {
    const d = Math.hypot(p.x - step.x, p.z - step.z);
    if (d < step.radius) {
      if (step.needCar && !ctx.playerCar) return; // must arrive in a car
      if (step.wanted) addWanted(ctx.police, step.wanted);
      completeStep(state, ctx);
    }
  } else if (step.type === 'steal') {
    if (ctx.playerCar && ctx.playerCar.model.name === step.model) {
      completeStep(state, ctx);
    }
  } else if (step.type === 'kill') {
    const label = step.label.replace(/\(\d+\/\d+\)/, `(${state.kills}/${step.count})`);
    if (state.waypoint) state.waypoint.label = label;
    if (state.kills >= step.count) completeStep(state, ctx);
  } else if (step.type === 'survive') {
    state.surviveT += dt;
    if (state.waypoint) state.waypoint.label = step.label.replace(/\(\d+s\)/, `(${Math.ceil(step.seconds - state.surviveT)}s)`);
    if (state.surviveT >= step.seconds) completeStep(state, ctx);
  }
}

/** Called by combat when an enemy dies during a kill step. */
export function noteKill(state) {
  if (state.active) state.kills += 1;
}

export function objectiveText(state) {
  const m = currentMission(state);
  if (!m) return 'Story complete — Neon Harbor is yours.';
  if (!state.active) return `Next job: ${m.title} — press Enter to start.`;
  const step = currentStep(state);
  if (!step) return m.title;
  if (step.type === 'kill') return step.label.replace(/\(\d+\/\d+\)/, `(${state.kills}/${step.count})`);
  if (step.type === 'survive') return `${step.label} — ${Math.max(0, Math.ceil(step.seconds - state.surviveT))}s left`;
  return step.label;
}
