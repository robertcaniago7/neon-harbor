// Neon Harbor 3D — input.js
// Keyboard, mouse, touch joystick (nipplejs, ES module via import map) and
// on-screen buttons. Produces one clean state object per frame.

import * as nipplejs from '../vendor/nipplejs.min.js';

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    forward: 0,
    strafe: 0,
    steer: 0,
    throttle: 0,
    brake: false,
    sprint: false,
    punch: false,
    shoot: false,
    shootHeld: false,
    enterCar: false,
    startJob: false,
    pause: false,
    mute: false,
    weaponSlot: 0,
    lookDX: 0,
    lookDY: 0,
    joyX: 0,
    joyY: 0,
    joyActive: false,
  };

  const keyMap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'brake',
    KeyF: 'enterCar',
    KeyE: 'punch',
    Enter: 'startJob',
    KeyP: 'pause', Escape: 'pause',
    KeyM: 'mute',
    Digit1: 'slot1', Digit2: 'slot2',
  };

  let mouseDown = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  window.addEventListener('keydown', (e) => {
    const action = keyMap[e.code];
    if (!action) return;
    if (['up', 'down', 'left', 'right', 'brake'].includes(action)) e.preventDefault();
    if (e.repeat) return;
    keys.add(action);
    if (action === 'enterCar') state.enterCar = true;
    if (action === 'punch') state.punch = true;
    if (action === 'startJob') state.startJob = true;
    if (action === 'pause') state.pause = true;
    if (action === 'mute') state.mute = true;
    if (action === 'slot1') state.weaponSlot = 0;
    if (action === 'slot2') state.weaponSlot = 1;
  });
  window.addEventListener('keyup', (e) => {
    const action = keyMap[e.code];
    if (action) keys.delete(action);
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    mouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    state.shootHeld = true;
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
    state.shootHeld = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    state.lookDX += e.clientX - lastMouseX;
    state.lookDY += e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  // --- touch joystick ---
  const zone = document.getElementById('joystick-zone');
  let stick = null;
  if (zone && typeof nipplejs.create === 'function') {
    stick = nipplejs.create({
      zone,
      mode: 'static',
      position: { left: '70px', bottom: '70px' },
      color: 'white',
      size: 110,
    });
    stick.on('move', (evt, data) => {
      if (!data || !data.vector) return;
      state.joyX = data.vector.x;
      state.joyY = data.vector.y;
      state.joyActive = true;
    });
    stick.on('end', () => {
      state.joyX = 0;
      state.joyY = 0;
      state.joyActive = false;
    });
  }

  // --- touch buttons ---
  const bindButton = (id, onDown, onUp) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); if (onUp) onUp(); }, { passive: false });
    el.addEventListener('mousedown', (e) => { e.preventDefault(); onDown(); });
    el.addEventListener('mouseup', () => { if (onUp) onUp(); });
  };
  bindButton('btn-shoot', () => { state.shoot = true; state.shootHeld = true; }, () => { state.shootHeld = false; });
  bindButton('btn-car', () => { state.enterCar = true; });
  bindButton('btn-hit', () => { state.punch = true; });
  bindButton('btn-job', () => { state.startJob = true; });

  function poll() {
    const up = keys.has('up') ? 1 : 0;
    const down = keys.has('down') ? 1 : 0;
    const left = keys.has('left') ? 1 : 0;
    const right = keys.has('right') ? 1 : 0;
    let fwd = up - down;
    let str = right - left;
    if (state.joyActive) {
      fwd = state.joyY;
      str = state.joyX;
    }
    state.forward = fwd;
    state.strafe = str;
    state.steer = -str;
    state.throttle = fwd;
    state.brake = keys.has('brake');
    state.sprint = keys.has('sprint');
    // consume one-shot flags after the frame reads them
    const snapshot = { ...state };
    state.enterCar = false;
    state.punch = false;
    state.startJob = false;
    state.pause = false;
    state.mute = false;
    state.shoot = false;
    state.lookDX = 0;
    state.lookDY = 0;
    return snapshot;
  }

  return { state, poll };
}
