// Physics: cannon-es world + a RaycastVehicle for the player's car only.
// Traffic, pedestrians and police are kinematic waypoint followers — no extra
// physics bodies, so the simulation stays cheap.

import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';

export function createPhysics() {
  const world = new CANNON.World();
  world.gravity.set(0, -18, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;

  const groundMat = new CANNON.Material('ground');
  const tyreMat = new CANNON.Material('tyre');
  world.addContactMaterial(new CANNON.ContactMaterial(groundMat, tyreMat, {
    friction: 0.55,
    restitution: 0.05,
  }));
  world.defaultContactMaterial.friction = 0.4;

  // Static ground plane.
  const groundBody = new CANNON.Body({ mass: 0, material: groundMat });
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);

  let vehicle = null;
  let chassisBody = null;

  // Build the player's RaycastVehicle at (x, z) facing `heading` radians.
  function createPlayerCar(x, z, heading = 0) {
    const P = CONFIG.car;
    chassisBody = new CANNON.Body({
      mass: P.mass,
      material: tyreMat,
      position: new CANNON.Vec3(x, 1.1, z),
      angularDamping: 0.4,
      linearDamping: 0.02,
    });
    const he = P.halfExtents;
    chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(he[0], he[1], he[2])));
    chassisBody.quaternion.setFromEuler(0, heading, 0);
    world.addBody(chassisBody);

    vehicle = new CANNON.RaycastVehicle({
      chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    const wheelOpts = {
      radius: P.wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: P.suspensionStiffness,
      suspensionRestLength: P.suspensionRest,
      frictionSlip: P.frictionSlip,
      dampingRelaxation: P.dampingRelax,
      dampingCompression: P.dampingCompress,
      maxSuspensionForce: P.maxSuspensionForce,
      rollInfluence: P.rollInfluence,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      maxSuspensionTravel: P.suspensionTravel,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };
    const halfTrack = P.wheelTrack;
    const halfBase = P.wheelBase;
    const wheelPositions = [
      [-halfTrack, 0.1, halfBase],
      [halfTrack, 0.1, halfBase],
      [-halfTrack, 0.1, -halfBase],
      [halfTrack, 0.1, -halfBase],
    ];
    for (const pos of wheelPositions) {
      wheelOpts.chassisConnectionPointLocal.set(pos[0], pos[1], pos[2]);
      vehicle.addWheel(wheelOpts);
    }
    vehicle.addToWorld(world);
    return { vehicle, chassisBody };
  }

  // Arcade drive: throttle in [-1,1], steer in [-1,1], braking flag.
  // Returns the car's forward speed (m/s) for the HUD + engine sound.
  function drive(throttle, steer, braking) {
    if (!vehicle) return 0;
    const P = CONFIG.car;
    const steerVal = Math.max(-P.maxSteer, Math.min(P.maxSteer, steer * P.maxSteer));
    vehicle.setSteeringValue(steerVal, 0);
    vehicle.setSteeringValue(steerVal, 1);
    const engine = braking ? 0 : throttle * P.maxEngineForce;
    vehicle.applyEngineForce(engine, 2);
    vehicle.applyEngineForce(engine, 3);
    if (braking) {
      vehicle.setBrake(P.maxBrakeForce, 0);
      vehicle.setBrake(P.maxBrakeForce, 1);
      vehicle.setBrake(P.maxBrakeForce, 2);
      vehicle.setBrake(P.maxBrakeForce, 3);
    } else {
      vehicle.setBrake(0, 0);
      vehicle.setBrake(0, 1);
      vehicle.setBrake(0, 2);
      vehicle.setBrake(0, 3);
    }
    // Soft speed cap.
    const v = chassisBody.velocity;
    const speed = Math.hypot(v.x, v.z);
    if (speed > P.maxSpeed) {
      const s = P.maxSpeed / speed;
      v.x *= s;
      v.z *= s;
      chassisBody.velocity = v;
    }
    return speed;
  }

  function removePlayerCar() {
    if (!vehicle) return;
    vehicle.removeFromWorld(world);
    world.removeBody(chassisBody);
    vehicle = null;
    chassisBody = null;
  }

  function step(dt) {
    world.step(1 / 60, dt, 3);
  }

  function carPosition(out) {
    if (!chassisBody) return null;
    out.set(chassisBody.position.x, chassisBody.position.y, chassisBody.position.z);
    return out;
  }

  function carHeading() {
    if (!chassisBody) return 0;
    const e = new CANNON.Vec3();
    chassisBody.quaternion.toEuler(e);
    return e.y;
  }

  return {
    world, createPlayerCar, drive, removePlayerCar, step,
    carPosition, carHeading,
    get vehicle() { return vehicle; },
    get chassisBody() { return chassisBody; },
  };
}

export default createPhysics;
