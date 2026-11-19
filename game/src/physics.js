// Neon Harbor 3D — cannon-es world + RaycastVehicle for the player's car only.
// Traffic, pedestrians and police are kinematic waypoint followers (no extra bodies).

import * as CANNON from '../vendor/cannon-es.min.js';
import { CONFIG } from './config.js';

/** Create the physics world: gravity, a ground plane, and a broadphase. */
export function createPhysicsWorld() {
  const world = new CANNON.World();
  world.gravity.set(0, -9.82, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  const groundMat = new CANNON.Material('ground');
  const tyreMat = new CANNON.Material('tyre');
  world.addContactMaterial(new CANNON.ContactMaterial(groundMat, tyreMat, { friction: 0.4, restitution: 0 }));
  world.defaultContactMaterial.friction = 0.4;

  const groundBody = new CANNON.Body({ mass: 0, material: groundMat });
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);
  return { world, groundMat, tyreMat };
}

/** Add a static box body for a building (so the car collides with it). */
export function addBuildingBody(phys, aabb) {
  const { world } = phys;
  const w = aabb.maxX - aabb.minX;
  const d = aabb.maxZ - aabb.minZ;
  const h = aabb.h;
  const body = new CANNON.Body({ mass: 0 });
  body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
  body.position.set((aabb.minX + aabb.maxX) / 2, h / 2, (aabb.minZ + aabb.maxZ) / 2);
  world.addBody(body);
  return body;
}

/**
 * Build the player's RaycastVehicle (arcade feel, from the spec numbers).
 * Returns { vehicle, chassisBody }. The car mesh is synced to chassisBody.
 */
export function createPlayerVehicle(phys, model) {
  const C = CONFIG.car;
  const { world, tyreMat } = phys;
  const chassisBody = new CANNON.Body({
    mass: C.mass,
    material: tyreMat,
    position: new CANNON.Vec3(0, 1, 0),
    angularDamping: 0.4,
    linearDamping: 0.05,
  });
  chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(C.chassisHalf[0], C.chassisHalf[1], C.chassisHalf[2])));
  world.addBody(chassisBody);

  const vehicle = new CANNON.RaycastVehicle({
    chassisBody,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2,
  });
  const wheelOpts = {
    radius: C.wheelRadius,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    suspensionStiffness: C.suspensionStiffness,
    suspensionRestLength: C.suspensionRest,
    frictionSlip: C.frictionSlip,
    dampingRelaxation: C.dampingRelax,
    dampingCompression: C.dampingCompress,
    maxSuspensionForce: C.suspensionMaxForce,
    rollInfluence: C.rollInfluence,
    axleLocal: new CANNON.Vec3(1, 0, 0),
    maxSuspensionTravel: C.suspensionTravel,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true,
  };
  const halfTrack = C.wheelTrack;
  const halfBase = C.wheelBase;
  vehicle.addWheel({ ...wheelOpts, chassisConnectionPointLocal: new CANNON.Vec3(-halfTrack, 0, halfBase), isFrontWheel: true });
  vehicle.addWheel({ ...wheelOpts, chassisConnectionPointLocal: new CANNON.Vec3(halfTrack, 0, halfBase), isFrontWheel: true });
  vehicle.addWheel({ ...wheelOpts, chassisConnectionPointLocal: new CANNON.Vec3(-halfTrack, 0, -halfBase), isFrontWheel: false });
  vehicle.addWheel({ ...wheelOpts, chassisConnectionPointLocal: new CANNON.Vec3(halfTrack, 0, -halfBase), isFrontWheel: false });
  vehicle.addToWorld(world);

  // per-model speed / grip scaling (applied by the caller through these fields)
  vehicle.modelSpeed = model.speed;
  vehicle.modelGrip = model.grip;
  return { vehicle, chassisBody };
}

/** Drive the player's car for one frame from the input state. */
export function drivePlayerCar(game, dt) {
  const { vehicle } = game.playerCar;
  const input = game.input;
  const C = CONFIG.car;
  const body = vehicle.chassisBody;
  // signed forward speed: velocity projected onto the chassis forward axis
  const fwd = new CANNON.Vec3(0, 0, 1);
  body.quaternion.vmult(fwd, fwd);
  const speed = body.velocity.dot(fwd);
  const overCap = Math.abs(speed) > C.maxSpeed;
  const engine = input.drive * C.maxEngineForce * vehicle.modelSpeed * (overCap && Math.sign(input.drive) === Math.sign(speed) ? 0 : 1);
  const brake = input.brake ? C.maxBrakeForce : 0;
  vehicle.applyEngineForce(engine, 2);
  vehicle.applyEngineForce(engine, 3);
  vehicle.setBrake(brake, 0);
  vehicle.setBrake(brake, 1);
  vehicle.setBrake(brake, 2);
  vehicle.setBrake(brake, 3);
  vehicle.setSteeringValue(-input.steer * C.maxSteer * vehicle.modelGrip, 0);
  vehicle.setSteeringValue(-input.steer * C.maxSteer * vehicle.modelGrip, 1);
  void dt;
}

/** Sync a car mesh to its physics chassis body. */
export function syncCarMesh(mesh, chassisBody) {
  mesh.position.set(chassisBody.position.x, chassisBody.position.y, chassisBody.position.z);
  mesh.quaternion.set(chassisBody.quaternion.x, chassisBody.quaternion.y, chassisBody.quaternion.z, chassisBody.quaternion.w);
}
