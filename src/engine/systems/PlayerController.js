// First-person controller: WASD + mouse look, sprint, crouch, jump, gravity, collision, head-bob.
import * as THREE from 'three';

const STAND = 1.65, CROUCH = 1.0;
const WALK = 3.0, SPRINT = 5.4, CROUCH_SPEED = 1.6;
const GRAVITY = 22, JUMP = 5.2, RADIUS = 0.32;

export class PlayerController {
  constructor(camera, input, collision) {
    this.camera = camera;
    this.input = input;
    this.collision = collision;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.sensitivity = 1;
    this.reset(0, 0, 0);
  }

  reset(x, z, yaw) {
    this.position.set(x, 0, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.vy = 0;
    this.onGround = true;
    this.crouching = false;
    this.eyeY = STAND;
    this.bobPhase = 0;
    this.bob = 0;
    this.distance = 0;
    this.moving = false;
    this.sprinting = false;
    this.stepEvent = false;
    this._apply();
  }

  get forward() {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  update(dt) {
    const inp = this.input;
    const [mx, my] = inp.consumeMouse();
    const sens = 0.0022 * this.sensitivity;
    this.yaw -= mx * sens;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - my * sens));

    if (inp.wasPressed('KeyC')) this.crouching = !this.crouching;
    const fwd = (inp.down('KeyW') || inp.down('ArrowUp') ? 1 : 0) - (inp.down('KeyS') || inp.down('ArrowDown') ? 1 : 0);
    const strafe = (inp.down('KeyD') || inp.down('ArrowRight') ? 1 : 0) - (inp.down('KeyA') || inp.down('ArrowLeft') ? 1 : 0);
    this.sprinting = (inp.down('ShiftLeft') || inp.down('ShiftRight')) && fwd > 0 && !this.crouching;
    if (this.sprinting && this.crouching) this.crouching = false;
    const speed = this.crouching ? CROUCH_SPEED : this.sprinting ? SPRINT : WALK;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = -sin * fwd + cos * strafe;
    let wz = -cos * fwd - sin * strafe;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx = (wx / len) * speed; wz = (wz / len) * speed; }
    const accel = this.onGround ? 14 : 3;
    const k = 1 - Math.exp(-accel * dt);
    this.velocity.x += (wx - this.velocity.x) * k;
    this.velocity.z += (wz - this.velocity.z) * k;

    // jump & gravity (the floor is the walkable surface at y = 0)
    if (inp.wasPressed('Space') && this.onGround && !this.crouching) { this.vy = JUMP; this.onGround = false; }
    this.vy -= GRAVITY * dt;
    this.position.y += this.vy * dt;
    if (this.position.y <= 0) { this.position.y = 0; this.vy = 0; this.onGround = true; }

    // horizontal move with sub-stepping so fast movement can't tunnel through thin walls
    const before = { x: this.position.x, z: this.position.z };
    const dx = this.velocity.x * dt, dz = this.velocity.z * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1));
    const p = { x: this.position.x, z: this.position.z };
    for (let i = 0; i < steps; i++) {
      p.x += dx / steps;
      p.z += dz / steps;
      this.collision.resolveCircle(p, RADIUS);
    }
    this.position.x = p.x;
    this.position.z = p.z;
    const moved = Math.hypot(p.x - before.x, p.z - before.z);
    // kill velocity into walls
    if (dt > 0) {
      const actualV = moved / dt;
      const wantV = Math.hypot(this.velocity.x, this.velocity.z);
      if (wantV > 0.01 && actualV < wantV * 0.3) this.velocity.multiplyScalar(0.5);
    }
    this.distance += moved;
    this.moving = moved / Math.max(dt, 1e-4) > 0.5 && this.onGround;

    // eye height & head bob
    const targetEye = this.crouching ? CROUCH : STAND;
    this.eyeY += (targetEye - this.eyeY) * Math.min(1, dt * 10);
    this.stepEvent = false;
    if (this.moving) {
      const prev = this.bobPhase;
      this.bobPhase += dt * (this.sprinting ? 12 : this.crouching ? 6 : 8.5);
      if (Math.floor(prev / Math.PI) !== Math.floor(this.bobPhase / Math.PI)) this.stepEvent = true;
      this.bob = Math.sin(this.bobPhase * 2) * (this.sprinting ? 0.045 : 0.028);
    } else {
      this.bob *= 1 - Math.min(1, dt * 8);
    }
    this._apply();
  }

  _apply() {
    this.camera.position.set(this.position.x, this.position.y + this.eyeY + this.bob, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
