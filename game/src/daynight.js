// Day/night cycle: sun + moon, sky colour, fog, and how bright the street
// lights and neon signs burn. Time t in [0,1): 0 midnight, 0.25 dawn,
// 0.5 noon, 0.75 dusk. Day length is 480 s per full day.

import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.colors;

// Small helper: lerp between two hex colours.
function lerpColor(a, b, t, out) {
  out.setHex(a);
  out.lerp(new THREE.Color(b), t);
  return out;
}

export function createDayNight(scene, renderer) {
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.35);
  scene.add(moon);
  scene.add(moon.target);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a3f4a, 0.9);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambient);

  // Street-light glow points are plain emissive sprites in the city mesh;
  // this light is a soft warm wash that fades in at night.
  const nightWash = new THREE.PointLight(0xffb020, 0, 300, 1.2);
  nightWash.position.set(0, 60, 0);
  scene.add(nightWash);

  const skyColor = new THREE.Color(C.skyDay);
  const fogColor = new THREE.Color(C.fogDay);
  scene.background = skyColor;
  scene.fog = new THREE.Fog(fogColor.getHex(), 60, 420);

  let time = CONFIG.startTime;

  // How "day" it is: 1 at noon, 0 at midnight, smooth in between.
  function daylight(t) {
    // cos curve peaking at t = 0.5 (noon).
    return Math.max(0, Math.cos((t - 0.5) * Math.PI * 2) * 0.5 + 0.5);
  }

  function update(dt, quality) {
    time = (time + dt / CONFIG.dayLength) % 1;
    const dl = daylight(time);
    const dusk = Math.max(0, 1 - Math.abs(time - 0.75) * 6) * (1 - dl * 0.4);
    const dawn = Math.max(0, 1 - Math.abs(time - 0.25) * 6) * (1 - dl * 0.4);

    // Sun position arcs across the sky.
    const sunAngle = (time - 0.25) * Math.PI * 2;
    const sunH = Math.sin(sunAngle);
    sun.position.set(Math.cos(sunAngle) * 320, Math.max(20, sunH * 300), 140);
    sun.target.position.set(0, 0, 0);
    sun.intensity = 0.15 + 2.1 * dl;
    sun.visible = sunH > -0.08;

    // Moon opposite the sun.
    const moonAngle = sunAngle + Math.PI;
    moon.position.set(Math.cos(moonAngle) * 300, Math.max(30, Math.sin(moonAngle) * 260), -120);
    moon.target.position.set(0, 0, 0);
    moon.intensity = 0.1 + 0.4 * (1 - dl);

    hemi.intensity = 0.25 + 0.75 * dl;
    ambient.intensity = 0.12 + 0.18 * dl;

    // Sky: day blue -> dusk orange -> night deep blue.
    if (dl > 0.55) {
      lerpColor(C.skyDay, C.skyDusk, Math.max(0, (0.95 - dl) * 2.2), skyColor);
    } else if (dusk > 0.05 || dawn > 0.05) {
      skyColor.setHex(C.skyDusk);
      skyColor.lerp(new THREE.Color(C.skyNight), Math.max(0, 1 - Math.max(dusk, dawn)));
    } else {
      skyColor.setHex(C.skyNight);
    }
    scene.background = skyColor;

    // Fog follows the sky.
    lerpColor(C.fogDay, C.fogNight, 1 - dl, fogColor);
    scene.fog.color.copy(fogColor);
    scene.fog.far = (quality && quality.fogFar) || 420;

    // Neon + street lights burn brightest at night.
    const neonLevel = 1 - dl * 0.75;
    nightWash.intensity = (1 - dl) * 900;

    // Sea colour shifts with daylight too (the city mesh reads this).
    const sea = new THREE.Color(C.seaDay).lerp(new THREE.Color(C.seaNight), 1 - dl);

    return {
      time, daylight: dl, dusk, dawn,
      neonLevel, seaColor: sea.getHex(),
      isNight: dl < 0.25,
    };
  }

  function setTime(t) {
    time = ((t % 1) + 1) % 1;
  }

  function getTime() {
    return time;
  }

  return { update, setTime, getTime, sun, moon };
}

export default createDayNight;
