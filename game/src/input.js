// Neon Harbor 3D — keyboard, mouse, touch joystick and on-screen buttons.

import nipplejs from '../vendor/nipplejs.min.js';

/**
 * Create the input state. Reads WASD/arrows, mouse drag (camera), mouse click
 * (shoot), and a nipplejs touch joystick plus the HUD buttons.
 * Returns an object the game loop reads every frame:
 *   moveX/moveZ (on foot), drive (-1..1), steer (-1..1), brake, sprint,
 *   shootHeld, punchPressed, interactPressed, jobPressed, pausePressed, mutePressed,
 *   camDX/camDY (mouse drag deltas, consumed each frame), joystick {x, y}.
 */
export function createInput(canvas, buttons = {}) {
  const input = {
    keys: new Set(),
    moveX: 0, moveZ: 0,
    drive: 0, steer: 0, brake: false, sprint: false,
    shootHeld: false,
    punchPressed: false, interactPressed: false, jobPressed: false,
    pausePressed: false, mutePressed: false,
    camDX: 0, camDY: 0,
    joystick: { x: 0, y: 0 },
    usingTouch: false,
  };

  const onKeyDown = (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    if (e.code === 'KeyE') input.punchPressed = true;
    if (e.code === 'KeyF') input.interactPressed = true;
    if (e.code === 'Enter') input.jobPressed = true;
    if (e.code === 'KeyP' || e.code === 'Escape') input.pausePressed = true;
    if (e.code === 'KeyM') input.mutePressed = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e) => input.keys.delete(e.code);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => input.keys.clear());

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    input.shootHeld = true;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    input.shootHeld = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    input.camDX += e.clientX - lastX;
    input.camDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  // Touch joystick (left) — created on the zone element when present.
  const zone = document.getElementById('joy-zone');
  if (zone && typeof nipplejs !== 'undefined') {
    try {
      const manager = nipplejs.create({ zone, mode: 'static', position: { left: '80px', bottom: '90px' }, color: 'white', size: 110 });
      manager.on('move', (_evt, data) => {
        if (!data || !data.vector) return;
        input.usingTouch = true;
        input.joystick.x = data.vector.x;
        input.joystick.y = data.vector.y;
      });
      manager.on('end', () => {
        input.joystick.x = 0;
        input.joystick.y = 0;
      });
    } catch (err) {
      // Touch joystick is optional; the game still works without it.
      console.warn('joystick unavailable', err);
    }
  }

  // On-screen buttons (touch): SHOOT / CAR / HIT / JOB.
  const bindButton = (id, down, up) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); input.usingTouch = true; down(); });
    if (up) el.addEventListener('pointerup', (e) => { e.preventDefault(); up(); });
    el.addEventListener('pointerleave', () => { if (up) up(); });
  };
  bindButton('btn-shoot', () => { input.shootHeld = true; }, () => { input.shootHeld = false; });
  bindButton('btn-car', () => { input.interactPressed = true; });
  bindButton('btn-hit', () => { input.punchPressed = true; });
  bindButton('btn-job', () => { input.jobPressed = true; });
  void buttons;

  /** Recompute the per-frame movement axes from keys + joystick. Call once per frame. */
  input.poll = () => {
    const k = input.keys;
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const joyY = input.joystick.y;
    const joyX = input.joystick.x;
    // on-foot axes: moveZ forward, moveX strafe
    input.moveZ = fwd + joyY;
    input.moveX = strafe + joyX;
    // driving axes: drive forward/back, steer left/right
    input.drive = fwd + joyY;
    input.steer = -(strafe + joyX);
    input.brake = k.has('Space');
    input.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    // clamp
    input.moveZ = Math.max(-1, Math.min(1, input.moveZ));
    input.moveX = Math.max(-1, Math.min(1, input.moveX));
    input.drive = Math.max(-1, Math.min(1, input.drive));
    input.steer = Math.max(-1, Math.min(1, input.steer));
  };

  /** Consume one-shot presses (call after the game loop reads them). */
  input.consumePresses = () => {
    input.punchPressed = false;
    input.interactPressed = false;
    input.jobPressed = false;
    input.pausePressed = false;
    input.mutePressed = false;
  };

  /** Consume accumulated camera drag deltas. */
  input.consumeCamera = () => {
    const dx = input.camDX;
    const dy = input.camDY;
    input.camDX = 0;
    input.camDY = 0;
    return { dx, dy };
  };

  return input;
}
