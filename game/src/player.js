// Juno Voss on foot: WASD movement with sprint, punching, entering cars, and the
// numbers the HUD reads: health, armor, cash, weapon and ammo.

import { PLAYER, WEAPONS } from './config.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: 0,
    health: PLAYER.health,
    armor: 0,
    cash: 150,
    weapon: 'fists',
    ammo: 0,
    inCar: null,
    punchCool: 0,
    shootCool: 0,
    hurtFlash: 0,
    dead: false,
    moving: false,
  };
}

export function stepPlayerOnFoot(player, input, city, dt) {
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  player.moving = len > 0;
  if (len > 0) {
    dx /= len;
    dy /= len;
    const speed = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const nx = player.x + dx * speed * dt;
    const ny = player.y + dy * speed * dt;
    if (!city.collidesBuilding(nx, player.y, PLAYER.radius) && !city.inWater(nx, player.y)) player.x = nx;
    if (!city.collidesBuilding(player.x, ny, PLAYER.radius) && !city.inWater(player.x, ny)) player.y = ny;
    player.angle = Math.atan2(dy, dx);
  }
  player.x = Math.max(20, Math.min(3180, player.x));
  player.y = Math.max(20, Math.min(2380, player.y));
  if (player.punchCool > 0) player.punchCool -= dt;
  if (player.shootCool > 0) player.shootCool -= dt;
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
}

/** Aim on foot follows the mouse (screen space is converted by the caller). */
export function aimAt(player, wx, wy) {
  player.angle = Math.atan2(wy - player.y, wx - player.x);
}

export function hurtPlayer(player, damage) {
  if (player.dead) return;
  let rest = damage;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, rest * 0.6);
    player.armor -= absorbed;
    rest -= absorbed;
  }
  player.health -= rest;
  player.hurtFlash = 0.35;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
  }
}

export function healPlayer(player, amount) {
  player.health = Math.min(PLAYER.health, player.health + amount);
}

export function giveWeapon(player, weapon, ammo) {
  player.weapon = weapon;
  player.ammo += ammo;
}

export function weaponOf(player) {
  return player.weapon === 'pistol' && player.ammo > 0 ? WEAPONS.pistol : WEAPONS.fists;
}
