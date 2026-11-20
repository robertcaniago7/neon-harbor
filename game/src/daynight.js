// Neon Harbor 3D — daynight.js
// Sun/moon, sky colour, fog, streetlight and neon intensity by time of day.
// Time t in [0,1): 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk.

import * as THREE from '../vendor/three.module.min.js';
import { PALETTE } from './config.js';

function lerpColor(a, b, f) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, f);
}

// Sun height: 0 at midnight, 1 at noon, back to 0 at midnight.
export function sunHeight(t) {
  return Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
}

export function isNight(t) {
  const h = sunHeight(t);
  return h < 0.25;
}

export function createDayNight(scene) {
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 800;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);

  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.35);
  moon.position.set(-80, 120, -60);
  scene.add(moon);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x5a6b7a, 0.9);
  scene.add(hemi);

  // a few streetlights that switch on at night
  const streetlights = [];
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const x of [-175, -75, 25, 125, 225]) {
    for (const z of [-125, -25, 75, 175]) {
      const pole = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 6, 0.25),
        new THREE.MeshLambertMaterial({ color: 0x2a3442 })
      );
      pole.position.set(x + 6, 3, z + 6);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(x + 6, 6.2, z + 6);
      lamp.visible = false;
      scene.add(pole, lamp);
      streetlights.push(lamp);
    }
  }

  function update(t, fogFar) {
    const h = sunHeight(t);
    // sky: night -> dawn -> day -> dusk -> night
    let sky;
    if (h > 0.75) sky = PALETTE.skyDay;
    else if (h > 0.45) sky = lerpColor(PALETTE.skyDusk, PALETTE.skyDay, (h - 0.45) / 0.3).getHex();
    else if (h > 0.2) sky = lerpColor(PALETTE.skyNight, PALETTE.skyDusk, (h - 0.2) / 0.25).getHex();
    else sky = PALETTE.skyNight;
    scene.background = new THREE.Color(sky);
    scene.fog = new THREE.Fog(h > 0.4 ? PALETTE.fogDay : PALETTE.fogNight, 60, fogFar);

    // sun position follows the day arc
    const ang = t * Math.PI * 2;
    sun.position.set(Math.cos(ang) * 300, Math.sin(ang) * 260 + 40, 120);
    sun.intensity = 0.4 + h * 2.0;
    moon.intensity = h < 0.25 ? 0.5 : 0.05;
    hemi.intensity = 0.4 + h * 0.7;

    const night = h < 0.3;
    for (const lamp of streetlights) lamp.visible = night;
    return { sunHeight: h, night };
  }

  return { sun, moon, hemi, streetlights, update };
}
