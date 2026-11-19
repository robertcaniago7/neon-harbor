// Neon Harbor's story: Juno Voss, a getaway driver who owes Madame Kestrel one last
// favour, and the Rust Vultures who want the harbour for themselves. Six missions,
// each a chain of small steps the world runner advances.

import { MISSION_REWARD } from './config.js';

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
      { type: 'goto', x: 1500, y: 200, label: 'Pick up the client in Downtown', radius: 70 },
      { type: 'goto', x: 2700, y: 600, label: 'Drop the client at the Marina', radius: 70, needCar: true },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: 'Kestrel: "The Vultures parked a Harbor Coupe at the docks. Take it. Bring it to my garage in Midtown."',
    reward: MISSION_REWARD[1],
    steps: [
      { type: 'steal', model: 'Harbor Coupe', x: 2600, y: 1900, label: 'Steal the Harbor Coupe at the docks', radius: 90 },
      { type: 'goto', x: 1500, y: 1400, label: 'Deliver the coupe to the garage', radius: 80, needCar: true },
    ],
  },
  {
    id: 'dockside-trouble',
    title: 'Dockside Trouble',
    briefing: 'Kestrel: "Vultures are shaking down my dock crew. Go remind them whose harbour this is."',
    reward: MISSION_REWARD[2],
    steps: [
      { type: 'goto', x: 2500, y: 1800, label: 'Reach the docks', radius: 90 },
      { type: 'kill', count: 4, x: 2500, y: 1800, label: 'Deal with the Vultures (0/4)' },
    ],
  },
  {
    id: 'the-package',
    title: 'The Package',
    briefing: 'Kestrel: "A package waits in Old Town. The police know about it, so expect company. Deliver it to Midtown."',
    reward: MISSION_REWARD[3],
    steps: [
      { type: 'goto', x: 600, y: 600, label: 'Collect the package in Old Town', radius: 70 },
      { type: 'goto', x: 1500, y: 1400, label: 'Deliver the package to Midtown', radius: 80, wanted: 2 },
    ],
  },
  {
    id: 'payback',
    title: 'Payback',
    briefing: 'Kestrel: "The Vultures run a warehouse in The Yards. Burn their operation down. Then get out."',
    reward: MISSION_REWARD[4],
    steps: [
      { type: 'goto', x: 600, y: 1400, label: 'Reach the warehouse', radius: 90 },
      { type: 'kill', count: 6, x: 600, y: 1400, label: 'Clear the warehouse (0/6)' },
      { type: 'goto', x: 1500, y: 200, label: 'Escape to Downtown', radius: 90 },
    ],
  },
  {
    id: 'the-big-one',
    title: 'The Big One',
    briefing: 'Kestrel: "One last job. Lift the getaway car, shake the whole Harbor PD, and meet my boat at the pier."',
    reward: MISSION_REWARD[5],
    steps: [
      { type: 'steal', model: 'Sunset Cruiser', x: 1500, y: 600, label: 'Steal the Sunset Cruiser', radius: 90 },
      { type: 'survive', seconds: 30, label: 'Lose the heat — survive the chase (30s)', wanted: 4 },
      { type: 'goto', x: 2700, y: 1900, label: 'Reach Kestrel\'s boat at the pier', radius: 90 },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0,
    step: 0,
    active: false,
    kills: 0,
    timer: 0,
    banner: '',
    bannerTime: 0,
    done: false,
  };
}

export function currentMission(state) {
  return MISSIONS[state.index] || null;
}

export function currentStep(state) {
  const m = currentMission(state);
  return m ? m.steps[state.step] : null;
}

export function missionLabel(state) {
  const step = currentStep(state);
  if (!step) return '';
  if (step.type === 'kill') return step.label.replace('(0/', `(${state.kills}/`);
  if (step.type === 'survive') return `Lose the heat — survive the chase (${Math.ceil(step.seconds - state.timer)}s)`;
  return step.label;
}
