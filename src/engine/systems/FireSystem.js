// Fire simulation: growth, fuel consumption, heat-transfer propagation between combustible zones,
// smoke generation and extinguisher suppression. This is a gameplay model, not a CFD/combustion solver.
import * as THREE from 'three';
import { ParticlePool } from './ParticleSystem.js';
import { COMBUSTIBLES, roomAt } from '../environment/layout.js';
import { flameSprite, smokeSprite, radialDecal, ringTexture } from '../environment/textures.js';
import { isStructural } from './CollisionWorld.js';

const SPREAD_TICK = 0.25;      // s between propagation evaluations
const IGNITION_HEAT = 10;      // heat units a zone must absorb to ignite
const HEAT_K = 3.2;            // heat-transfer coefficient
const SPREAD_RANGE = 7;        // m — zones beyond this receive no heat
const WALL_ATTENUATION = [1, 0.12, 0.03];
const MAX_LIGHTS = 4;

export class FireSystem {
  constructor(scene, collision, quality = 1) {
    this.scene = scene;
    this.collision = collision;
    this.quality = quality;
    this.group = new THREE.Group();
    this.group.name = 'Fires';
    scene.add(this.group);

    this.flames = new ParticlePool({
      max: 3200, texture: flameSprite(), additive: true, buoyancy: 1.4, drag: 1.2, turbulence: 2.2,
      gradient: [[0, 1, 0.95, 0.75, 0], [0.08, 1, 0.82, 0.4, 0.95], [0.45, 1, 0.42, 0.08, 0.75], [0.8, 0.65, 0.14, 0.03, 0.3], [1, 0.2, 0.05, 0.02, 0]],
    });
    this.smoke = new ParticlePool({
      max: 1600, texture: smokeSprite(), additive: false, fog: true, buoyancy: 0.35, drag: 0.6, turbulence: 0.6, ceiling: 2.75,
      gradient: [[0, 0.22, 0.21, 0.2, 0], [0.12, 0.17, 0.16, 0.15, 0.55], [0.6, 0.13, 0.13, 0.13, 0.4], [1, 0.12, 0.12, 0.12, 0]],
    });
    this.steam = new ParticlePool({
      max: 500, texture: smokeSprite(), additive: false, fog: true, buoyancy: 0.6, drag: 0.8, turbulence: 1.0, ceiling: 2.8,
      gradient: [[0, 0.9, 0.9, 0.9, 0], [0.15, 0.85, 0.86, 0.88, 0.45], [1, 0.8, 0.8, 0.82, 0]],
    });
    scene.add(this.flames.points, this.smoke.points, this.steam.points);

    this.glowTex = radialDecal([[0, 'rgba(255,190,90,1)'], [0.35, 'rgba(255,110,30,0.6)'], [1, 'rgba(255,60,10,0)']]);
    this.scorchTex = radialDecal([[0, 'rgba(8,6,5,0.95)'], [0.55, 'rgba(15,12,10,0.7)'], [1, 'rgba(20,18,16,0)']]);
    this.ringTex = ringTexture();
    this.planeGeo = new THREE.PlaneGeometry(1, 1);

    this.lights = [];
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const l = new THREE.PointLight('#ff7a2e', 0, 9, 2);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
    this.zones = COMBUSTIBLES.map((c) => ({ ...c, room: roomAt(c.pos[0], c.pos[1]) }));
    this.reset();
  }

  reset() {
    for (const f of this.fires || []) this._removeVisuals(f, true);
    this.fires = [];
    this.nextId = 1;
    this.spreadAcc = 0;
    this.state = new Map(this.zones.map((z) => [z.id, { heat: 0, fire: null, status: 'intact' }]));
    this.flames.clear();
    this.smoke.clear();
    this.steam.clear();
    for (const l of this.lights) l.intensity = 0;
    this.spreadEnabled = true;
    this.totalExtinguished = 0;
    this.peakActive = 0;
  }

  get activeFires() { return this.fires.filter((f) => f.active); }

  ignite(zoneId, intensity = 0.25, time = 0) {
    const zone = this.zones.find((z) => z.id === zoneId);
    const st = this.state.get(zoneId);
    if (!zone || !st || st.status !== 'intact') return null;
    const fire = {
      id: `FIRE-${String(this.nextId++).padStart(2, '0')}`,
      zoneId,
      zone,
      room: zone.room ? zone.room.name : 'Unknown',
      position: new THREE.Vector3(zone.pos[0], 0, zone.pos[1]),
      intensity,
      spreadRate: 0.032 * (0.5 + zone.flam),
      active: true,
      extinguished: false,
      burnedOut: false,
      fuel: zone.fuel,
      smokeRate: 0,
      danger: 'low',
      ignitedAt: time,
      burnTime: 0,
      suppressedAt: -10,
      emitF: 0, emitS: 0, emitSt: 0,
    };
    const r = fire.zone.room;
    fire.bounds = r ? [r.x0 + 0.15, r.z0 + 0.15, r.x1 - 0.15, r.z1 - 0.15] : null;
    st.status = 'burning';
    st.fire = fire;
    this._createVisuals(fire);
    this.fires.push(fire);
    return fire;
  }

  _createVisuals(fire) {
    const mk = (tex, blending, y, order) => {
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending, polygonOffset: true, polygonOffsetFactor: -order, toneMapped: false });
      const m = new THREE.Mesh(this.planeGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(fire.position.x, y, fire.position.z);
      m.renderOrder = order;
      this.group.add(m);
      return m;
    };
    fire.scorch = mk(this.scorchTex, THREE.NormalBlending, 0.012, 1);
    fire.scorch.material.toneMapped = true;
    fire.glow = mk(this.glowTex, THREE.AdditiveBlending, 0.016, 2);
    fire.ring = mk(this.ringTex, THREE.NormalBlending, 0.02, 3);
  }

  _removeVisuals(fire, all) {
    for (const k of all ? ['scorch', 'glow', 'ring'] : ['glow', 'ring']) {
      if (fire[k]) {
        this.group.remove(fire[k]);
        fire[k].material.dispose();
        fire[k] = null;
      }
    }
  }

  dangerRadius(f) { return 0.5 + 1.5 * f.intensity; }

  update(dt, time, camera) {
    const events = [];
    // --- growth & fuel ---
    for (const f of this.fires) {
      if (!f.active) continue;
      f.burnTime += dt;
      const recentlySprayed = time - f.suppressedAt < 0.6;
      if (f.fuel > 0) {
        if (!recentlySprayed) f.intensity += f.spreadRate * (0.35 + f.intensity) * (1 - f.intensity) * dt;
        f.fuel -= f.intensity * dt;
      } else {
        f.intensity -= 0.04 * dt;
      }
      f.intensity = Math.min(1, f.intensity);
      if (f.intensity <= 0.02) {
        f.active = false;
        f.intensity = 0;
        const st = this.state.get(f.zoneId);
        if (f.fuel > 0) {
          f.extinguished = true;
          st.status = 'extinguished';
          this.totalExtinguished++;
          events.push({ type: 'extinguished', fire: f });
        } else {
          f.burnedOut = true;
          st.status = 'burnt';
          events.push({ type: 'burnedOut', fire: f });
        }
        this._removeVisuals(f, false);
        continue;
      }
      f.smokeRate = 0.3 + 1.4 * f.intensity;
      f.danger = f.intensity > 0.75 ? 'extreme' : f.intensity > 0.5 ? 'high' : f.intensity > 0.25 ? 'moderate' : 'low';
    }

    // --- propagation (heat transfer between zones) ---
    this.spreadAcc += dt;
    while (this.spreadAcc >= SPREAD_TICK) {
      this.spreadAcc -= SPREAD_TICK;
      if (!this.spreadEnabled) continue;
      for (const z of this.zones) {
        const st = this.state.get(z.id);
        if (st.status !== 'intact') continue;
        let gain = 0;
        for (const f of this.fires) {
          if (!f.active) continue;
          const dx = f.position.x - z.pos[0], dz = f.position.z - z.pos[1];
          const d2 = dx * dx + dz * dz;
          if (d2 > SPREAD_RANGE * SPREAD_RANGE) continue;
          const walls = this.collision.segmentHits(f.position.x, f.position.z, z.pos[0], z.pos[1], isStructural, 2);
          gain += (f.intensity * HEAT_K * z.flam * WALL_ATTENUATION[walls]) / (1 + d2 / 8);
        }
        st.heat = Math.max(0, st.heat + (gain - 0.15) * SPREAD_TICK);
        if (st.heat >= IGNITION_HEAT) {
          const nf = this.ignite(z.id, 0.15, time);
          if (nf) events.push({ type: 'spread', fire: nf });
        }
      }
    }

    // --- particles ---
    const q = this.quality;
    for (const f of this.fires) {
      if (!f.active) {
        if (f.extinguished && time - f.suppressedAt < 4) this._emitSteam(f, dt * 0.5);
        continue;
      }
      const I = f.intensity;
      const r = 0.2 + 0.85 * I;
      const baseY = f.zone.label.includes('desk') || f.zone.label.includes('table') || f.zone.label.includes('counter') ? 0.35 : 0.1;
      f.emitF += dt * (70 + 300 * I) * q;
      while (f.emitF >= 1) {
        f.emitF -= 1;
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r;
        const centre = 1 - rr / r;
        this.flames.emit(
          f.position.x + Math.cos(a) * rr, baseY + Math.random() * 0.15, f.position.z + Math.sin(a) * rr,
          (Math.random() - 0.5) * 0.3, 0.6 + (1.4 + centre) * I + Math.random() * 0.5, (Math.random() - 0.5) * 0.3,
          0.4 + Math.random() * 0.45 * (0.5 + I), 0.28 + 0.42 * I * (0.6 + centre), 0.06,
        );
      }
      f.emitE = (f.emitE || 0) + dt * (2 + 14 * I) * q;
      while (f.emitE >= 1) {
        f.emitE -= 1;
        const a = Math.random() * Math.PI * 2, rr = Math.random() * r * 0.7;
        this.flames.emit(
          f.position.x + Math.cos(a) * rr, baseY + 0.4 + Math.random() * 0.6 * I, f.position.z + Math.sin(a) * rr,
          (Math.random() - 0.5) * 1.2, 1.6 + Math.random() * 2.2 * (0.5 + I), (Math.random() - 0.5) * 1.2,
          0.9 + Math.random() * 0.9, 0.05 + Math.random() * 0.04, 0.02,
        );
      }
      f.emitS += dt * (4 + 26 * I) * q;
      while (f.emitS >= 1) {
        f.emitS -= 1;
        this.smoke.emit(
          f.position.x + (Math.random() - 0.5) * r, 0.9 + 1.1 * I, f.position.z + (Math.random() - 0.5) * r,
          (Math.random() - 0.5) * 0.4, 0.9 + I, (Math.random() - 0.5) * 0.4,
          5 + Math.random() * 4, 0.7 + I * 0.5, 2.6 + 1.2 * I, f.bounds,
        );
      }
      if (time - f.suppressedAt < 0.3) this._emitSteam(f, dt);
      // decals
      const flick = 0.85 + 0.15 * Math.sin(time * 23 + f.position.x) * Math.sin(time * 13.7);
      f.glow.scale.setScalar(1.2 + 3.2 * I);
      f.glow.material.opacity = Math.min(1, 0.4 + I) * flick;
      const sc = Math.min(3.2, 0.8 + f.burnTime * 0.03 + I * 1.5);
      if (sc > f.scorch.scale.x) f.scorch.scale.setScalar(sc);
      const dr = this.dangerRadius(f) * 2;
      f.ring.scale.setScalar(dr);
      f.ring.material.opacity = 0.45 + 0.35 * Math.sin(time * 5);
      f.ring.rotation.z = time * 0.3;
    }
    this.flames.update(dt, time);
    this.smoke.update(dt, time);
    this.steam.update(dt, time);

    // --- lights: assign pooled lights to the most significant fires near the camera ---
    // Point lights don't cast shadows, so an unoccluded fire light would glow through walls into
    // other rooms. Fires the camera can't see are dimmed (smoothed to avoid popping) and light range
    // is kept short so it stays mostly within the fire's own room.
    for (const f of this.fires) {
      if (!f.active) continue;
      const vis = camera && !this.collision.lineOfSight(camera.position.x, camera.position.z, f.position.x, f.position.z) ? 0.22 : 1;
      f.lightVis = f.lightVis == null ? vis : f.lightVis + (vis - f.lightVis) * Math.min(1, dt * 4);
    }
    const ranked = this.fires.filter((f) => f.active)
      .map((f) => ({ f, w: (f.intensity * (0.4 + 0.6 * f.lightVis)) / (1 + (camera ? f.position.distanceTo(camera.position) * 0.15 : 0)) }))
      .sort((a, b) => b.w - a.w);
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const l = this.lights[i];
      const e = ranked[i];
      if (!e) { l.intensity = 0; continue; }
      const f = e.f;
      const flick = 0.75 + 0.25 * Math.sin(time * 17 + i * 3) * Math.sin(time * 9.3 + i);
      l.position.set(f.position.x, 0.6 + f.intensity * 0.8, f.position.z);
      l.intensity = (4 + 26 * f.intensity) * flick * f.lightVis;
      l.distance = 3.5 + 4.5 * f.intensity;
    }

    this.peakActive = Math.max(this.peakActive, this.activeFires.length);
    return events;
  }

  _emitSteam(f, dt) {
    f.emitSt += dt * 40 * this.quality;
    while (f.emitSt >= 1) {
      f.emitSt -= 1;
      this.steam.emit(
        f.position.x + (Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 0.4, f.position.z + (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6,
        1.5 + Math.random() * 1.5, 0.5, 2.0, f.bounds,
      );
    }
  }

  /**
   * Apply extinguishing agent along a ray. Returns { onTarget, fires } — the fires that were hit.
   * Effectiveness depends on distance (best 1.5–5 m), aim at the base of the flames and line of sight.
   */
  suppress(origin, dir, dt, time) {
    const hit = [];
    const to = new THREE.Vector3();
    for (const f of this.fires) {
      if (!f.active) continue;
      let best = 0;
      for (const [y, weight] of [[0.3, 1.0], [0.3 + 0.9 * f.intensity, 0.45]]) {
        to.set(f.position.x - origin.x, y - origin.y, f.position.z - origin.z);
        const along = to.dot(dir);
        if (along <= 0.2 || along > 7.5) continue;
        const perp = Math.sqrt(Math.max(0, to.lengthSq() - along * along));
        const tol = 0.35 + 0.65 * f.intensity + along * 0.1;
        if (perp > tol) continue;
        const range = along <= 5 ? 1 : Math.max(0, (7.5 - along) / 2.5);
        const eff = weight * range * (1 - 0.5 * (perp / tol));
        best = Math.max(best, eff);
      }
      if (best <= 0) continue;
      if (!this.collision.lineOfSight(origin.x, origin.z, f.position.x, f.position.z)) continue;
      f.intensity -= 0.2 * best * dt;
      f.suppressedAt = time;
      hit.push({ fire: f, eff: best });
    }
    return { onTarget: hit.length > 0, fires: hit };
  }

  // Thermal hazard at a point: returns damage per second and whether the point is inside flames.
  hazardAt(x, z) {
    let dps = 0, inFlames = false, nearest = Infinity, nearestFire = null, radiant = 0;
    for (const f of this.fires) {
      if (!f.active) continue;
      const d = Math.hypot(f.position.x - x, f.position.z - z);
      if (d < nearest) { nearest = d; nearestFire = f; }
      const reach = 2.5 + 2 * f.intensity;
      if (d >= reach) continue;
      if (!this.collision.lineOfSight(x, z, f.position.x, f.position.z)) continue; // walls shield radiant heat
      const dr = this.dangerRadius(f);
      if (d < dr) { inFlames = true; dps += 22 * f.intensity + 6; }
      {
        const k = f.intensity * (1 - d / reach);
        dps += 7 * k;
        radiant = Math.max(radiant, k);
      }
    }
    return { dps, inFlames, nearest, nearestFire, radiant };
  }

  dispose() {
    this.reset();
    this.flames.dispose(); this.smoke.dispose(); this.steam.dispose();
    for (const l of this.lights) this.scene.remove(l);
    this.scene.remove(this.group, this.flames.points, this.smoke.points, this.steam.points);
  }
}
