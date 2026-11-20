// Input: keyboard, mouse drag-look + click-shoot, touch joystick (nipplejs)
// and on-screen buttons. One shared state object the world reads each frame.

import nipplejs from 'nipplejs';

export function createInput(canvas, opts = {}) {
  const keys = {};
  const state = {
    keys,
    // movement axes in [-1, 1]: x = strafe/right, y = forward
    moveX: 0,
    moveY: 0,
    // camera look deltas accumulated this frame (consumed by world)
    lookDX: 0,
    lookDY: 0,
    // mouse held for aiming/shooting
    mouseDown: false,
    // touch joystick vector
    joyX: 0,
    joyY: 0,
    // edge-triggered actions (world consumes and clears them)
    pressed: {},
    sprint: false,
    brake: false,
  };

  const onAction = opts.onAction || (() => {});

  function press(action) {
    state.pressed[action] = true;
    onAction(action);
  }

  const keyMap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'brake',
    KeyF: 'enterCar',
    KeyE: 'punch',
    Enter: 'job',
    Digit1: 'weapon1',
    Digit2: 'weapon2',
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
  };

  function onKeyDown(e) {
    const action = keyMap[e.code];
    if (!action) return;
    if (e.code === 'Space') e.preventDefault();
    if (!keys[action]) press(action);
    keys[action] = true;
    if (action === 'sprint') state.sprint = true;
    if (action === 'brake') state.brake = true;
  }

  function onKeyUp(e) {
    const action = keyMap[e.code];
    if (!action) return;
    keys[action] = false;
    if (action === 'sprint') state.sprint = false;
    if (action === 'brake') state.brake = false;
  }

  // Mouse drag looks around; holding the button aims/shoots.
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function onMouseDown(e) {
    if (e.button !== 0) return;
    dragging = true;
    state.mouseDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
    press('shoot');
  }

  function onMouseMove(e) {
    if (!dragging) return;
    state.lookDX += e.clientX - lastX;
    state.lookDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onMouseUp(e) {
    if (e.button !== 0) return;
    dragging = false;
    state.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Touch joystick (nipplejs module) + buttons, if the DOM exists.
  let joystick = null;
  const joyZone = document.getElementById('joystick-zone');
  if (joyZone && nipplejs && typeof nipplejs.create === 'function') {
    joystick = nipplejs.create({
      zone: joyZone,
      mode: 'static',
      position: { left: '70px', bottom: '70px' },
      color: 'white',
      size: 110,
    });
    joystick.on('move', (evt, data) => {
      if (!data || !data.vector) return;
      state.joyX = data.vector.x;
      state.joyY = data.vector.y;
    });
    joystick.on('end', () => {
      state.joyX = 0;
      state.joyY = 0;
    });
  }

  // On-screen buttons: data-action attributes.
  const buttons = document.querySelectorAll('[data-action]');
  buttons.forEach((btn) => {
    const action = btn.getAttribute('data-action');
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (action === 'shoot') state.mouseDown = true;
      press(action);
    }, { passive: false });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (action === 'shoot') state.mouseDown = false;
    }, { passive: false });
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (action === 'shoot') state.mouseDown = true;
      press(action);
    });
    btn.addEventListener('mouseup', () => {
      if (action === 'shoot') state.mouseDown = false;
    });
  });

  // Recompute movement axes from keys + joystick each time the world asks.
  function poll() {
    let x = 0;
    let y = 0;
    if (keys.left) x -= 1;
    if (keys.right) x += 1;
    if (keys.up) y += 1;
    if (keys.down) y -= 1;
    if (state.joyX !== 0 || state.joyY !== 0) {
      x += state.joyX;
      y += state.joyY;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    state.moveX = x;
    state.moveY = y;
    return state;
  }

  // Consume an edge-triggered action (returns true once per press).
  function consume(action) {
    if (state.pressed[action]) {
      state.pressed[action] = false;
      return true;
    }
    return false;
  }

  function consumeLook() {
    const dx = state.lookDX;
    const dy = state.lookDY;
    state.lookDX = 0;
    state.lookDY = 0;
    return { dx, dy };
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    if (joystick) joystick.destroy();
  }

  return { state, poll, consume, consumeLook, dispose };
}

export default createInput;
