// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. The game moves between four screens:
// title, play, paused and game over. Enter starts the next mission while playing.
//
// ?seed=N fixes the city. ?shot=cover|city|mission|combat (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { STEP } from './config.js';
import { createWorld, resetWorld, stepWorld, toggleCar, startMission, playerPos } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT, ACTION_ENTER, ACTION_MUTE, ACTION_CONTINUE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { saveGame, loadGame, clearSave, readBest, saveBest } from './save.js';

const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 10;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function snapshotSave() {
  const p = world.player;
  return {
    x: p.x, y: p.y, cash: p.cash, health: p.health, armor: p.armor,
    weapon: p.weapon, ammo: p.ammo,
    missionIndex: world.mission.index, cashEarned: world.cashEarned, kills: world.kills,
  };
}

function applySave(data) {
  const p = world.player;
  p.x = data.x ?? 1500;
  p.y = data.y ?? 200;
  p.cash = data.cash ?? 150;
  p.health = data.health ?? 100;
  p.armor = data.armor ?? 0;
  p.weapon = data.weapon ?? 'fists';
  p.ammo = data.ammo ?? 0;
  world.mission.index = data.missionIndex ?? 0;
  world.cashEarned = data.cashEarned ?? 0;
  world.kills = data.kills ?? 0;
  p.inCar = null;
  p.dead = false;
  world.over = null;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  let lastMissionIndex = 0;
  const hasSave = !!loadGame();

  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    resetWorld(world);
    lastMissionIndex = 0;
    saveTimer = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Drive to the yellow marker — press Enter to start the first mission.');
  }

  function continueGame() {
    const data = loadGame();
    if (!data) return;
    resetWorld(world);
    applySave(data);
    lastMissionIndex = world.mission.index;
    screen = SCREEN_PLAY;
    announce('Welcome back to Neon Harbor.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.cashEarned > best) {
      best = world.cashEarned;
      saveBest(best);
    }
    clearSave();
    announce(`Game over. Cash earned $${world.cashEarned}. Best $${best}.`);
  }

  function handleActions() {
    const { actions, clicked } = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONTINUE && hasSave) {
        audio.unlock();
        continueGame();
      } else if (actions & ACTION_CONFIRM || clicked) {
        audio.unlock();
        startNewGame();
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM || clicked) startNewGame();
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_ENTER) {
      const result = toggleCar(world, audio);
      if (result === 'enter') announce('In the car. Drive!');
      else if (result === 'exit') announce('On foot.');
    }
    if (actions & ACTION_CONFIRM && !world.mission.active && !world.mission.done) {
      startMission(world, audio);
      announce('Mission started.');
    }
    if (actions & ACTION_INTERACT) {
      world._punch = true;
    }
  }

  function step() {
    const cam = renderer.getCamera();
    const mouse = input.mouse;
    const stepInput = {
      held: input.held,
      mouse: { down: mouse.down, x: mouse.x, y: mouse.y },
      punch: !!world._punch,
      mouseWorldX: mouse.x + cam.x,
      mouseWorldY: mouse.y + cam.y,
    };
    world._punch = false;
    stepWorld(world, stepInput, audio, STEP);
    if (world.events.length) {
      announce(world.events[world.events.length - 1]);
      world.events.length = 0;
    }
    if (world.over) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
        saveTimer += STEP;
        if (saveTimer > AUTOSAVE_SECONDS) {
          saveTimer = 0;
          saveGame(snapshotSave());
        }
        if (world.mission.index !== lastMissionIndex) {
          lastMissionIndex = world.mission.index;
          saveGame(snapshotSave());
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best, now / 1000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce(hasSave
    ? 'Neon Harbor. Press Space for a new game, or C to continue.'
    : 'Neon Harbor. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
