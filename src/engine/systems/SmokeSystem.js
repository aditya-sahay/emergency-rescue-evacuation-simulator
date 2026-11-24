// Zone-based smoke model: each room accumulates smoke from its fires; smoke flows between rooms and
// the corridor through openings (closed doors slow it dramatically). A hot smoke layer descends from
// the ceiling as concentration rises — staying low (crouching) keeps your head below it.
import * as THREE from 'three';
import { ROOMS, roomAt, insideBuilding, WALL_H } from '../environment/layout.js';
import { smokeSprite } from '../environment/textures.js';

const ROOM_LINKS = {
  reception: 'open', officeA: 'dA', conference: 'dConf', officeB: 'dB',
  openplan: 'open', kitchen: 'dKitchen', server: 'dServer', officeC: 'dC',
};

export class SmokeSystem {
  constructor(scene) {
    this.scene = scene;
    this.rooms = ROOMS.map((r) => ({ ...r, area: (r.x1 - r.x0) * (r.z1 - r.z0), smoke: 0 }));
    this.byId = Object.fromEntries(this.rooms.map((r) => [r.id, r]));
    const tex = smokeSprite();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.layers = this.rooms.map((r) => {
      const mat = new THREE.MeshBasicMaterial({ color: '#2a2a2a', map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0 - 0.1, r.z1 - r.z0 - 0.1), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((r.x0 + r.x1) / 2, WALL_H - 0.05, (r.z0 + r.z1) / 2);
      mesh.renderOrder = 6;
      mesh.visible = false;
      scene.add(mesh);
      // second, solid backing to give the layer some body
      const mat2 = new THREE.MeshBasicMaterial({ color: '#1c1c1c', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const back = new THREE.Mesh(mesh.geometry, mat2);
      back.rotation.x = -Math.PI / 2;
      back.position.copy(mesh.position);
      back.renderOrder = 6;
      back.visible = false;
      scene.add(back);
      return { room: r, mesh, back };
    });
    this.fogClear = new THREE.Color('#b9c6d2');
    this.fogSmoke = new THREE.Color('#2e2d2b');
    this.fog = new THREE.FogExp2(this.fogClear.clone(), 0.004);
    scene.fog = this.fog;
    this.reset();
  }

  reset() {
    for (const r of this.rooms) r.smoke = 0;
    this.local = 0;
    this.visibility = 1;
    this.layerHeight = WALL_H;
    this.fog.density = 0.004;
    this.fog.color.copy(this.fogClear);
    for (const l of this.layers) { l.mesh.visible = l.back.visible = false; }
  }

  layerY(smoke) { return WALL_H - 2.3 * Math.min(1, smoke); }

  update(dt, time, fires, doors, player) {
    // sources
    for (const f of fires) {
      if (!f.active) continue;
      const r = this.byId[f.zone.room?.id];
      if (r) r.smoke = Math.min(1, r.smoke + (f.smokeRate * dt * 2.2) / r.area);
    }
    // exchange with corridor
    const corridor = this.byId.corridor;
    const doorOpen = Object.fromEntries(doors.map((d) => [d.id, d.open]));
    for (const [id, link] of Object.entries(ROOM_LINKS)) {
      const r = this.byId[id];
      const open = link === 'open' || doorOpen[link];
      const rate = link === 'open' ? 0.12 : open ? 0.07 : 0.004;
      const diff = r.smoke - corridor.smoke;
      const flow = diff * rate * dt;
      r.smoke -= flow * (corridor.area / (corridor.area + r.area));
      corridor.smoke += flow * (r.area / (corridor.area + r.area));
    }
    // ventilation / leakage through exits
    for (const r of this.rooms) r.smoke = Math.max(0, r.smoke - (r.id === 'corridor' || r.id === 'reception' ? 0.0035 : 0.0018) * dt);

    // visuals
    for (const l of this.layers) {
      const s = l.room.smoke;
      const vis = s > 0.02;
      l.mesh.visible = l.back.visible = vis;
      if (!vis) continue;
      const y = this.layerY(s);
      l.mesh.position.y = y;
      l.back.position.y = Math.min(WALL_H - 0.02, y + 0.15);
      l.mesh.material.opacity = Math.min(0.9, s * 1.5);
      l.back.material.opacity = Math.min(0.75, s * 1.1);
      l.mesh.material.map.offset.set(time * 0.01, time * 0.007);
    }

    // player-local visibility
    const px = player.position.x, pz = player.position.z, eye = player.eyeY;
    const inside = insideBuilding(px, pz, -0.05);
    const room = inside ? roomAt(px, pz) : null;
    const s = room ? this.byId[room.id].smoke : 0;
    const ly = this.layerY(s);
    const head = Math.min(1, Math.max(0, (eye - ly) / 0.5 + 0.5));
    let near = 0;
    for (const f of fires) {
      if (!f.active) continue;
      const d = Math.hypot(f.position.x - px, f.position.z - pz);
      near = Math.max(near, f.intensity * Math.max(0, 1 - d / 6) * 0.35);
    }
    const target = Math.min(0.95, s * (0.25 + 0.85 * head) + near);
    this.local += (target - this.local) * Math.min(1, dt * 2);
    this.visibility = 1 - this.local;
    this.layerHeight = ly;
    this.headInSmoke = s > 0.08 && head > 0.6;

    this.fog.density = 0.004 + Math.pow(this.local, 1.4) * 0.32;
    this.fog.color.copy(this.fogClear).lerp(this.fogSmoke, Math.min(1, this.local * 1.6));
    return { local: this.local, roomSmoke: s, headInSmoke: this.headInSmoke };
  }

  // Smoke inhalation damage per second at the current local concentration.
  inhalationDps() { return this.local > 0.2 ? (this.local - 0.15) * 5.5 : 0; }

  maxSmoke() { return Math.max(...this.rooms.map((r) => r.smoke)); }
}
