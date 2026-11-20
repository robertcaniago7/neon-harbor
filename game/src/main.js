// Boot: creates the world, wires the title screen / pause / game-over UI,
// and exposes a tiny debug handle (window.__neonHarbor) for verification.

import { createWorld } from './world.js';
import { getShotParams } from './shots.js';

const canvas = document.getElementById('game-canvas');
const titleScreen = document.getElementById('title-screen');
const pauseScreen = document.getElementById('pause-screen');
const overScreen = document.getElementById('gameover-screen');
const overTitle = document.getElementById('gameover-title');
const overText = document.getElementById('gameover-text');

const shotParams = getShotParams();
const isShot = !!shotParams.shot;

const world = createWorld(canvas, { seed: shotParams.seed || 1 });

let started = false;

function show(el, visible) {
  if (el) el.style.display = visible ? 'flex' : 'none';
}

function startGame() {
  if (started) return;
  started = true;
  show(titleScreen, false);
  show(overScreen, false);
  world.start();
  world.audio.resume();
}

function togglePause() {
  if (!started || world.isGameOver) return;
  const willPause = !world.isPaused;
  world.pause(willPause);
  show(pauseScreen, willPause);
}

function endGame(won) {
  show(pauseScreen, false);
  if (overTitle) overTitle.textContent = won ? 'NEON HARBOR IS YOURS' : 'BUSTED';
  if (overText) {
    overText.textContent = won
      ? 'All six jobs done. Madame Kestrel owes you one — and the city knows your name.'
      : 'The Harbor PD finally caught up with Juno Voss. The harbor never forgets.';
  }
  show(overScreen, true);
}

function restart() {
  window.location.reload();
}

world.onGameOver = (won) => endGame(won);
world.onPause = () => togglePause();

// Title buttons.
const startBtn = document.getElementById('btn-start');
if (startBtn) startBtn.addEventListener('click', startGame);
const continueBtn = document.getElementById('btn-continue');
if (continueBtn) {
  continueBtn.addEventListener('click', startGame);
}
const resumeBtn = document.getElementById('btn-resume');
if (resumeBtn) resumeBtn.addEventListener('click', togglePause);
const restartBtn = document.getElementById('btn-restart');
if (restartBtn) restartBtn.addEventListener('click', restart);
const quitBtn = document.getElementById('btn-quit');
if (quitBtn) quitBtn.addEventListener('click', () => window.location.reload());
const retryBtn = document.getElementById('btn-retry');
if (retryBtn) retryBtn.addEventListener('click', restart);

// Keyboard: Enter starts from the title, R restarts after game over.
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && !started && !isShot) startGame();
  if (e.code === 'KeyR' && world.isGameOver) restart();
});

// Shot mode: skip the title screen entirely so screenshots capture the game.
if (isShot) {
  started = true;
  show(titleScreen, false);
  world.start();
}

// Debug / verification handle.
window.__neonHarbor = {
  world,
  getState: () => world.getState(),
  start: startGame,
};

export { world, startGame };
