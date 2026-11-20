// Neon Harbor 3D — physics.js
// cannon-es world + RaycastVehicle for the player's car only. Traffic,
// pedestrians and police are kinematic waypoint followers (no extra bodies).

import * as CANNON from '../vendor/cannon-es.min.js';
import { CAR_PHYSICS } from './config.js';

export function createPhysicsWorld() {
  const world = new CANNON.World();
  world.gravity.set(0, -9.82, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.defaultContactMaterial.friction = 0.6;

  // flat ground plane
  const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);

  return world;
}

export function createPlayerVehicle(world, model) {
  const p = CAR_PHYSICS;
  const speedMul = model ? model.speed : 1;
  const gripMul = model ? model.grip : 1;

  const chassis = new CANNON.Body({
    mass: p.mass,
    shape: new CANNON.Box(new CANNON.Vec3(p.halfExtents[0], p.halfExtents[1], p.halfExtents[2])),
    position: new CANNON.Vec3(0, 1, 0),
    angularDamping: 0.5,
    linearDamping: 0.05,
  });
  world.addBody(chassis);

  const vehicle = new CANNON.RaycastVehicle({
    chassisBody: chassis,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2,
  });

  const wheelOptions = {
    radius: p.wheelRadius,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    suspensionStiffness: p.suspensionStiffness,
    suspensionRestLength: p.suspensionRest,
    frictionSlip: p.frictionSlip * gripMul,
    dampingRelaxation: p.dampingRelax,
    dampingCompression: p.dampingCompress,
    maxSuspensionForce: p.suspensionMaxForce,
    rollInfluence: p.rollInfluence,
    axleLocal: new CANNON.Vec3(-1, 0, 0),
    chassisConnectionPointLocal: new CANNON.Vec3(0, 0.15, 0),
    maxSuspensionTravel: p.suspensionTravel,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true,
  };

  const halfTrack = p.wheelTrack;
  const halfBase = p.wheelBase;
  const positions = [
    [-halfTrack, halfBase],
    [halfTrack, halfBase],
    [-halfTrack, -halfBase],
    [halfTrack, -halfBase],
  ];
  for (const [x, z] of positions) {
    vehicle.addWheel({
      ...wheelOptions,
      chassisConnectionPointLocal: new CANNON.Vec3(x, 0.15, z),
    });
  }
  vehicle.addToWorld(world);

  return {
    vehicle,
    chassis,
    speedMul,
    drive(engineForce, steer) {
      vehicle.applyEngineForce(engineForce, 2);
      vehicle.applyEngineForce(engineForce, 3);
      vehicle.setSteeringValue(steer, 0);
      vehicle.setSteeringValue(steer, 1);
    },
    brake(force) {
      for (let i = 0; i < 4; i++) vehicle.setBrake(force, i);
    },
    speedKmh() {
      const v = chassis.velocity;
      return Math.sqrt(v.x * v.x + v.z * v.z) * 3.6;
    },
    speedMs() {
      const v = chassis.velocity;
      return Math.sqrt(v.x * v.x + v.z * v.z);
    },
    forward() {
      const q = chassis.quaternion;
      // forward is +Z in local space rotated by yaw
      const yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
      return { x: Math.sin(yaw), z: Math.cos(yaw), yaw };
    },
    reset(x, z, yaw = 0) {
      chassis.position.set(x, 1, z);
      chassis.velocity.set(0, 0, 0);
      chassis.angularVelocity.set(0, 0, 0);
      chassis.quaternion.setFromEuler(0, yaw, 0);
    },
  };
}

export function stepPhysics(world, dt) {
  world.step(1 / 60, dt, 3);
}
