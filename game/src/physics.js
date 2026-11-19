// cannon-es physics world: flat ground, static building boxes, and the player's
// RaycastVehicle. NPC cars, peds and police are kinematic (no cannon bodies).

import * as CANNON from 'cannon-es';
import { CAR_PHYSICS } from './config.js';

export function createPhysics(buildings) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;

  const groundMat = new CANNON.Material('ground');
  const ground = new CANNON.Body({ mass: 0, material: groundMat });
  ground.addShape(new CANNON.Box(new CANNON.Vec3(240, 0.5, 200)));
  ground.position.set(0, -0.5, 0);
  world.addBody(ground);

  // Sea-side barrier so cars cannot drive into the water (z > 205).
  const seaWall = new CANNON.Body({ mass: 0 });
  seaWall.addShape(new CANNON.Box(new CANNON.Vec3(240, 2, 1)));
  seaWall.position.set(0, 1, 206);
  world.addBody(seaWall);

  // Static building boxes.
  const boxMat = new CANNON.Material('building');
  for (const b of buildings) {
    const w = (b.maxX - b.minX) / 2;
    const d = (b.maxZ - b.minZ) / 2;
    const body = new CANNON.Body({ mass: 0, material: boxMat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w, b.h / 2, d)));
    body.position.set((b.minX + b.maxX) / 2, b.h / 2, (b.minZ + b.maxZ) / 2);
    body.allowSleep = true;
    body.sleepSpeedLimit = 0.1;
    world.addBody(body);
  }

  return { world, groundMat };
}

/** Build the player's RaycastVehicle at (x, z) facing `heading` (radians, 0 = -Z). */
export function createPlayerCar(physics, model, x, z, heading = 0) {
  const P = CAR_PHYSICS;
  const chassis = new CANNON.Body({ mass: P.mass });
  chassis.addShape(new CANNON.Box(new CANNON.Vec3(P.chassisHalf[0], P.chassisHalf[1], P.chassisHalf[2])));
  chassis.position.set(x, 1.1, z);
  chassis.quaternion.setFromEuler(0, heading, 0);
  chassis.angularDamping = 0.4;
  physics.world.addBody(chassis);

  const vehicle = new CANNON.RaycastVehicle({
    chassisBody: chassis,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2,
  });
  const wheelOpts = {
    radius: P.wheelRadius,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    suspensionStiffness: P.suspensionStiffness,
    suspensionRestLength: P.suspensionRestLength,
    frictionSlip: P.frictionSlip,
    dampingRelaxation: P.dampingRelaxation,
    dampingCompression: P.dampingCompression,
    maxSuspensionForce: P.maxSuspensionForce,
    rollInfluence: P.rollInfluence,
    axleLocal: new CANNON.Vec3(1, 0, 0),
    suspensionTravel: P.suspensionTravel,
    maxSuspensionTravel: P.suspensionTravel,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true,
    chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
  };
  const wb = P.wheelBase;
  const wt = P.wheelTrack;
  vehicle.addWheel({ ...wheelOpts, chassisConnectionPointLocal: new CANNON.Vec3(-wt, -0.05, wb) });
  vehicle.addWheel({ ...wheelOpts, chassisConnectionPointLocal: new CANNON.Vec3(wt, -0.05, wb) });
  vehicle.addWheel({ ...wheelOpts, chassisConnectionPointLocal: new CANNON.Vec3(-wt, -0.05, -wb) });
  vehicle.addWheel({ ...wheelOpts, chassisConnectionPointLocal: new CANNON.Vec3(wt, -0.05, -wb) });
  vehicle.addToWorld(physics.world);

  const state = {
    vehicle, chassis, model,
    steer: 0,
    speed: 0,
    /** throttle -1..1, steer -1..1, brake 0..1 */
    setInput(throttle, steer, brake) {
      const speedFactor = Math.max(0.35, 1 - Math.abs(this.speed) / (P.maxSpeed * 1.4));
      const targetSteer = steer * P.maxSteer * speedFactor;
      this.steer += (targetSteer - this.steer) * 0.35;
      // Wheels 2,3 sit at z = -wheelBase: the front axle (the car drives toward -Z).
      vehicle.setSteeringValue(this.steer, 2);
      vehicle.setSteeringValue(this.steer, 3);
      const force = throttle * P.maxEngineForce * model.speed;
      vehicle.applyEngineForce(force, 2);
      vehicle.applyEngineForce(force, 3);
      const b = brake > 0 ? P.maxBrakeForce : 0;
      vehicle.setBrake(b, 0);
      vehicle.setBrake(b, 1);
      vehicle.setBrake(b, 2);
      vehicle.setBrake(b, 3);
    },
    update() {
      const v = chassis.velocity;
      this.speed = Math.hypot(v.x, v.z);
      // soft speed cap
      if (this.speed > P.maxSpeed) {
        const s = P.maxSpeed / this.speed;
        v.x *= s;
        v.z *= s;
      }
    },
    position() {
      return { x: chassis.position.x, y: chassis.position.y, z: chassis.position.z };
    },
    heading() {
      const e = new CANNON.Vec3();
      chassis.quaternion.toEuler(e);
      return e.y;
    },
    forward() {
      // chassis forward is -Z in local space
      const q = chassis.quaternion;
      const f = new CANNON.Vec3(0, 0, -1);
      return q.vmult(f);
    },
    destroy() {
      vehicle.removeFromWorld(physics.world);
      physics.world.removeBody(chassis);
    },
  };
  return state;
}
