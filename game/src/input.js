// Unified input: keyboard + mouse on desktop, nipplejs joystick + touch buttons
// + tap-to-aim on mobile. All producers write the same state the game reads.

import nipplejs from 'nipplejs';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_ENTER = 8;
export const ACTION_MUTE = 16;
export const ACTION_CONTINUE = 32;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'brake',
};

export function createInput(canvas) {
  const isTouch = ('ontouchstart' in window) || window.matchMedia('(pointer: coarse)').matches;
  const held = { up: false, down: false, left: false, right: false, sprint: false, brake: false };
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const joy = { x: 0, y: 0, active: false };
  let actions = 0;
  let lookDX = 0;
  let lookDY = 0;
  let zoomDelta = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function onKeyDown(e) {
    const name = KEYMAP[e.code];
    if (name) {
      held[name] = true;
      e.preventDefault();
    }
    if (e.code === 'Space' || e.code === 'Enter') actions |= ACTION_CONFIRM;
    if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACTION_PAUSE;
    if (e.code === 'KeyE') actions |= ACTION_INTERACT;
    if (e.code === 'KeyF') actions |= ACTION_ENTER;
    if (e.code === 'KeyM') actions |= ACTION_MUTE;
    if (e.code === 'KeyC') actions |= ACTION_CONTINUE;
  }
  function onKeyUp(e) {
    const name = KEYMAP[e.code];
    if (name) held[name] = false;
  }

  function setMouseFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }
  function onMouseMove(e) {
    setMouseFromEvent(e);
    if (dragging) {
      lookDX += e.clientX - lastX;
      lookDY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  }
  function onMouseDown(e) {
    setMouseFromEvent(e);
    if (e.button === 2) return; // right button = aim, handled by contextmenu suppression
    mouse.down = true;
    mouse.clicked = true;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onMouseUp() {
    mouse.down = false;
    dragging = false;
  }
  function onWheel(e) {
    zoomDelta += e.deltaY;
    e.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // --- touch: nipplejs joystick (left), drag-to-look (right half), tap to aim+shoot ---
  let stick = null;
  if (isTouch) {
    document.documentElement.classList.add('touch');
    const zone = document.getElementById('joy-zone');
    if (zone) {
      stick = nipplejs.create({
        zone, mode: 'static', position: { left: '86px', bottom: '86px' },
        size: 110, color: 'white', multitouch: true,
      });
      stick.on('move', (evt, data) => {
        if (!data || !data.vector) return;
        joy.x = data.vector.x;
        joy.y = data.vector.y;
        joy.active = true;
      });
      stick.on('end', () => {
        joy.x = 0;
        joy.y = 0;
        joy.active = false;
      });
    }
    // right-half drag looks around; quick tap aims + shoots
    let lookTouchId = null;
    let lookLastX = 0;
    let lookLastY = 0;
    let tapStart = 0;
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        const rect = canvas.getBoundingClientRect();
        if (t.clientX - rect.left < rect.width * 0.45) continue; // left = joystick zone
        if (lookTouchId === null) {
          lookTouchId = t.identifier;
          lookLastX = t.clientX;
          lookLastY = t.clientY;
          tapStart = performance.now();
          mouse.x = t.clientX - rect.left;
          mouse.y = t.clientY - rect.top;
        }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) {
          lookDX += (t.clientX - lookLastX) * 2.2;
          lookDY += (t.clientY - lookLastY) * 2.2;
          lookLastX = t.clientX;
          lookLastY = t.clientY;
          const rect = canvas.getBoundingClientRect();
          mouse.x = t.clientX - rect.left;
          mouse.y = t.clientY - rect.top;
          mouse.down = true;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) {
          lookTouchId = null;
          mouse.down = false;
          if (performance.now() - tapStart < 250) mouse.clicked = true;
        }
      }
      e.preventDefault();
    };
    canvas.addEventListener('touchend', endTouch, { passive: false });
    canvas.addEventListener('touchcancel', endTouch, { passive: false });

    // HTML action buttons
    const bind = (id, bit) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (ev) => { actions |= bit; ev.preventDefault(); });
      el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    };
    bind('btn-car', ACTION_ENTER);
    bind('btn-punch', ACTION_INTERACT);
    bind('btn-mission', ACTION_CONFIRM);
    bind('btn-pause', ACTION_PAUSE);
    bind('btn-continue', ACTION_CONTINUE);
    bind('btn-mute', ACTION_MUTE);
    // SHOOT button: hold to fire toward the crosshair (screen centre)
    const shootBtn = document.getElementById('btn-shoot');
    if (shootBtn) {
      shootBtn.addEventListener('pointerdown', (ev) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = rect.width / 2;
        mouse.y = rect.height / 2;
        mouse.down = true;
        mouse.clicked = true;
        ev.preventDefault();
      });
      const release = (ev) => { mouse.down = false; ev.preventDefault(); };
      shootBtn.addEventListener('pointerup', release);
      shootBtn.addEventListener('pointercancel', release);
      shootBtn.addEventListener('pointerleave', release);
    }
  }

  return {
    held, mouse, joy, isTouch,
    /** Inject an ACTION_* bit as if its key had been pressed (used by the __nh probe). */
    queueAction(bit) {
      actions |= bit;
    },
    /** Move vector -1..1 (x = strafe/right, y = forward). */
    moveVector() {
      let x = 0;
      let y = 0;
      if (held.left) x -= 1;
      if (held.right) x += 1;
      if (held.up) y += 1;
      if (held.down) y -= 1;
      if (joy.active) {
        x += joy.x;
        y += joy.y;
      }
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      return { x, y };
    },
    get sprint() {
      return held.sprint || (joy.active && joy.y > 0.92);
    },
    get brake() {
      return held.brake || (joy.active && joy.y < -0.92);
    },
    takeActions() {
      const a = actions;
      actions = 0;
      const clicked = mouse.clicked;
      mouse.clicked = false;
      return { actions: a, clicked };
    },
    takeLook() {
      const d = { dx: lookDX, dy: lookDY };
      lookDX = 0;
      lookDY = 0;
      return d;
    },
    takeZoom() {
      const z = zoomDelta;
      zoomDelta = 0;
      return z;
    },
  };
}
