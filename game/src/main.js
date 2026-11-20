// Neon Harbor 3D — main.js
// Boots world.js: title screen, pause, game-over, restart. Exposes the world
// on window for debugging and for the screenshot harness.

import { createWorld } from './world.js';
import { createInput } from './input.js';
import { loadSave } from './save.js';

const canvas = document.getElementById('game-canvas');
const input = createInput(canvas);
const world = createWorld({ canvas, input });

window.__neonHarbor = world;

const titleEl = document.getElementById('title-screen');
const startBtn = document.getElementById('btn-start');
const continueBtn = document.getElementById('btn-continue');
const pauseEl = document.getElementById('pause-screen');
const overEl = document.getElementById('gameover-screen');
const overText = document.getElementById('gameover-text');
const restartBtn = document.getElementById('btn-restart');
const resumeBtn = document.getElementById('btn-resume');

const saved = loadSave();
const isShot = new URLSearchParams(window.location.search).has('shot');

function hide(el) { if (el) el.style.display = 'none'; }
function show(el) { if (el) el.style.display = 'flex'; }

function beginGame() {
  hide(titleEl);
  hide(overEl);
  world.start();
  world.audio.resume();
}

if (startBtn) startBtn.addEventListener('click', () => { beginGame(); });
if (continueBtn) {
  if (saved && saved.mission > 0) {
    continueBtn.style.display = 'block';
    continueBtn.textContent = `Continue — Job ${saved.mission + 1} ($${saved.cash})`;
  }
  continueBtn.addEventListener('click', () => { beginGame(); });
}
if (restartBtn) restartBtn.addEventListener('click', () => {
  window.location.reload();
});
if (resumeBtn) resumeBtn.addEventListener('click', () => {
  world.paused = false;
  hide(pauseEl);
});

// In shot mode there is no title screen: the game runs immediately so the
// screenshot harness captures the staged scene.
if (isShot) {
  hide(titleEl);
  world.start();
} else {
  show(titleEl);
}

// Watch for pause / game over once a second.
setInterval(() => {
  if (world.paused) {
    show(pauseEl);
  } else {
    hide(pauseEl);
  }
  if (world.player.dead && !isShot) {
    if (overText) overText.textContent = `Busted flat in ${'Neon Harbor'}. Juno is down — the harbour keeps its secrets. Cash kept: $${Math.floor(world.player.cash)}.`;
    show(overEl);
    world.stop();
  }
}, 500);

export { world };
