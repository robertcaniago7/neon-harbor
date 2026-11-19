// Keyboard and mouse: WASD/arrows to move and drive, mouse to aim, click to shoot,
// E to interact or punch, F to enter or leave a car, Shift to sprint, P or Escape to
// pause, M to mute. Edge-triggered actions are read once per frame.
// Touch: the on-screen pad in index.html drives the same held keys and actions,
// and touching the game area aims and shoots, like a mouse click.

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
  const held = { up: false, down: false, left: false, right: false, sprint: false, brake: false };
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let actions = 0;

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

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }

  function onMouseDown(e) {
    onMouseMove(e);
    mouse.down = true;
    mouse.clicked = true;
  }

  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  // Touch controls: on-screen pad + tap the game area to aim and shoot.
  // Only wired on devices with a coarse pointer (touch screens).
  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (isTouch) {
    document.documentElement.classList.add('touch');

    function setMouseFromTouch(t) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = t.clientX - rect.left;
      mouse.y = t.clientY - rect.top;
    }
    canvas.addEventListener('touchstart', (e) => {
      setMouseFromTouch(e.changedTouches[0]);
      mouse.down = true;
      mouse.clicked = true;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      setMouseFromTouch(e.changedTouches[0]);
      e.preventDefault();
    }, { passive: false });
    const endTouch = (e) => { mouse.down = false; e.preventDefault(); };
    canvas.addEventListener('touchend', endTouch, { passive: false });
    canvas.addEventListener('touchcancel', endTouch, { passive: false });

    function bindHold(id, name) {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.touchAction = 'none';
      el.addEventListener('pointerdown', (e) => { held[name] = true; e.preventDefault(); });
      const release = (e) => { held[name] = false; e.preventDefault(); };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('pointerleave', release);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    function bindAction(id, bit) {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.touchAction = 'none';
      el.addEventListener('pointerdown', (e) => { actions |= bit; e.preventDefault(); });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    bindHold('btn-up', 'up');
    bindHold('btn-down', 'down');
    bindHold('btn-left', 'left');
    bindHold('btn-right', 'right');
    bindAction('btn-car', ACTION_ENTER);
    bindAction('btn-punch', ACTION_INTERACT);
    bindAction('btn-mission', ACTION_CONFIRM);
    bindAction('btn-pause', ACTION_PAUSE);
    bindAction('btn-continue', ACTION_CONTINUE);
    bindAction('btn-mute', ACTION_MUTE);
  }

  return {
    held,
    mouse,
    takeActions() {
      const a = actions;
      actions = 0;
      const clicked = mouse.clicked;
      mouse.clicked = false;
      return { actions: a, clicked };
    },
  };
}
