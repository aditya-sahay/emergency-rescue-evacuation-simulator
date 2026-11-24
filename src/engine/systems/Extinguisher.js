// Fire extinguisher: pickup, capacity, spraying (hold LMB), discharge particles and suppression.
import * as THREE from 'three';
import { createExtinguisherModel } from '../environment/equipment.js';
import { ParticlePool } from './ParticleSystem.js';
import { softSprite } from '../environment/textures.js';

const DISCHARGE_PER_SEC = 7.5; // % capacity per second → ~13 s of continuous discharge

export class Extinguisher {
  constructor(scene, viewScene, camera) {
    this.camera = camera;
    this.viewScene = viewScene;
    this.view = createExtinguisherModel({ forView: true });
    this.view.scale.setScalar(0.85);
    this.rest = new THREE.Vector3(0.28, -0.6, -0.62);
    this.view.position.copy(this.rest);
    this.view.rotation.set(0.25, -0.6, 0.12);
    viewScene.add(this.view);
    this.spray = new ParticlePool({
      max: 900, texture: softSprite(), additive: false, fog: true, drag: 2.4, gravity: 1.2, turbulence: 1.5,
      gradient: [[0, 1, 1, 1, 0], [0.08, 0.96, 0.97, 1, 0.55], [0.6, 0.92, 0.93, 0.95, 0.3], [1, 0.9, 0.9, 0.9, 0]],
    });
    scene.add(this.spray.points);
    this.reset();
  }

  reset() {
    this.held = false;
    this.capacity = 0;
    this.spraying = false;
    this.used = 0;            // total % discharged across all extinguishers
    this.onTargetTime = 0;
    this.sprayTime = 0;
    this.pickedUp = 0;
    this.emitAcc = 0;
    this.kick = 0;
    this.view.visible = false;
    this.spray.clear();
  }

  pickUp() {
    this.held = true;
    this.capacity = 100;
    this.pickedUp++;
    this.view.visible = true;
    this.raise = 0;
  }

  // Returns { spraying, empty, hits }
  update(dt, time, firing, fireSystem, player) {
    let result = { spraying: false, empty: false, hits: [] };
    this.spraying = false;
    if (this.held && firing && this.capacity > 0) {
      this.spraying = true;
      const use = Math.min(this.capacity, DISCHARGE_PER_SEC * dt);
      this.capacity -= use;
      this.used += use;
      this.sprayTime += dt;
      const origin = this.camera.position.clone();
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const sup = fireSystem.suppress(origin, dir, dt, time);
      if (sup.onTarget) this.onTargetTime += dt;
      result = { spraying: true, empty: this.capacity <= 0, hits: sup.fires };
      // particles from the nozzle position in world space
      const nozzle = new THREE.Vector3(0.12, -0.28, -0.75).applyQuaternion(this.camera.quaternion).add(origin);
      this.emitAcc += dt * 260;
      while (this.emitAcc >= 1) {
        this.emitAcc -= 1;
        const spread = 0.09;
        const d = dir.clone();
        d.x += (Math.random() - 0.5) * spread * 2;
        d.y += (Math.random() - 0.5) * spread * 2;
        d.z += (Math.random() - 0.5) * spread * 2;
        d.normalize();
        const sp = 9 + Math.random() * 4;
        this.spray.emit(nozzle.x, nozzle.y, nozzle.z, d.x * sp + player.velocity.x, d.y * sp, d.z * sp + player.velocity.z, 0.7 + Math.random() * 0.4, 0.06, 1.3);
      }
      if (this.capacity <= 0) { this.capacity = 0; result.empty = true; }
    }
    this.spray.update(dt, time);

    // view-model animation (bob, recoil, raise on pickup)
    if (this.held) {
      this.raise = Math.min(1, (this.raise ?? 1) + dt * 3);
      this.kick += ((this.spraying ? 1 : 0) - this.kick) * Math.min(1, dt * 12);
      const bobX = Math.cos(player.bobPhase) * (player.moving ? 0.012 : 0);
      const bobY = Math.abs(Math.sin(player.bobPhase)) * (player.moving ? 0.018 : 0);
      this.view.position.set(
        this.rest.x + bobX + (Math.random() - 0.5) * 0.004 * this.kick,
        this.rest.y - bobY - (1 - this.raise) * 0.4 + this.kick * 0.03,
        this.rest.z + this.kick * 0.04,
      );
      this.view.rotation.set(0.25 + this.kick * 0.12, -0.6, 0.12);
      if (this.view.userData.lever) this.view.userData.lever.rotation.x = -0.12 + this.kick * 0.25;
    }
    return result;
  }

  get accuracy() { return this.sprayTime > 0 ? this.onTargetTime / this.sprayTime : 0; }
}
