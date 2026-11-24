// Danger-aware evacuation routing over a hand-placed navigation graph (Dijkstra, multi-exit).
// Edge cost = length + penalties for passing near active fires and through heavy smoke.
import * as THREE from 'three';
import { NAV_NODES, NAV_EDGES, EXITS, roomAt } from '../environment/layout.js';

export class EvacuationRouter {
  constructor(collision) {
    this.collision = collision;
    this.ids = Object.keys(NAV_NODES);
    this.pos = NAV_NODES;
    this.adj = new Map(this.ids.map((id) => [id, []]));
    for (const [a, b] of NAV_EDGES) {
      this.adj.get(a).push(b);
      this.adj.get(b).push(a);
    }
    this.safeNodes = Object.fromEntries(Object.entries(EXITS).map(([id, e]) => [e.node, id]));
    this.route = null;
  }

  // Danger along a segment, sampled every 0.75 m.
  _segmentDanger(ax, az, bx, bz, fires, smoke) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / 0.75));
    let cost = 0, blocked = false;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      for (const f of fires) {
        if (!f.active) continue;
        const d = Math.hypot(f.position.x - x, f.position.z - z);
        const dr = 0.5 + 1.5 * f.intensity;
        if (d < dr + 0.4) {
          cost += 25 * f.intensity + 8;
          if (f.intensity > 0.45) blocked = true;
        } else if (d < dr + 2.5) cost += 4 * f.intensity * (1 - (d - dr - 0.4) / 2.1);
      }
      if (smoke) {
        const r = roomAt(x, z);
        if (r) cost += (smoke.byId[r.id]?.smoke || 0) * 1.5;
      }
    }
    return { cost: cost * (len / (n + 1)), blocked };
  }

  update(px, pz, fires, smoke) {
    // virtual start node: connect to visible nodes nearby
    const start = '__start';
    const dist = new Map([[start, 0]]);
    const prev = new Map();
    const done = new Set();
    const startEdges = [];
    for (const id of this.ids) {
      const [x, z] = this.pos[id];
      const d = Math.hypot(x - px, z - pz);
      if (d > 14) continue;
      if (!this.collision.lineOfSight(px, pz, x, z)) continue;
      startEdges.push([id, d]);
    }
    if (!startEdges.length) {
      // fallback: nearest node regardless of visibility
      let best = null, bd = Infinity;
      for (const id of this.ids) {
        const [x, z] = this.pos[id];
        const d = Math.hypot(x - px, z - pz);
        if (d < bd) { bd = d; best = id; }
      }
      startEdges.push([best, bd]);
    }
    const blockedExits = new Set();
    const edgeCost = (ax, az, bx, bz) => {
      const base = Math.hypot(bx - ax, bz - az);
      const dz = this._segmentDanger(ax, az, bx, bz, fires, smoke);
      return base + dz.cost + (dz.blocked ? 400 : 0);
    };
    // Dijkstra (graph is tiny: ~45 nodes)
    const queue = [start];
    while (queue.length) {
      queue.sort((a, b) => dist.get(a) - dist.get(b));
      const u = queue.shift();
      if (done.has(u)) continue;
      done.add(u);
      const [ux, uz] = u === start ? [px, pz] : this.pos[u];
      const neigh = u === start ? startEdges.map((e) => e[0]) : this.adj.get(u);
      for (const v of neigh) {
        if (done.has(v)) continue;
        const [vx, vz] = this.pos[v];
        const c = dist.get(u) + edgeCost(ux, uz, vx, vz);
        if (c < (dist.get(v) ?? Infinity)) {
          dist.set(v, c);
          prev.set(v, u);
          queue.push(v);
        }
      }
    }
    let bestExit = null, bestCost = Infinity;
    const exitCosts = {};
    for (const [node, exitId] of Object.entries(this.safeNodes)) {
      const c = dist.get(node) ?? Infinity;
      exitCosts[exitId] = c;
      if (c >= 400) blockedExits.add(exitId);
      if (c < bestCost) { bestCost = c; bestExit = node; }
    }
    // Hysteresis: keep guiding to the current exit unless another is clearly (15 %) better,
    // so the arrows don't flicker between two near-equal routes.
    if (this.route) {
      const prevNode = EXITS[this.route.exitId].node;
      const prevCost = dist.get(prevNode) ?? Infinity;
      if (prevNode !== bestExit && prevCost < 400 && prevCost <= bestCost * 1.15) { bestExit = prevNode; bestCost = prevCost; }
    }
    if (!bestExit) { this.route = null; return null; }
    const path = [];
    let cur = bestExit;
    while (cur && cur !== start) { path.unshift(cur); cur = prev.get(cur); }
    const points = [new THREE.Vector2(px, pz), ...path.map((id) => new THREE.Vector2(...this.pos[id]))];
    let length = 0;
    for (let i = 1; i < points.length; i++) length += points[i].distanceTo(points[i - 1]);
    this.route = {
      exitId: this.safeNodes[bestExit], points, length, cost: bestCost, blockedExits: [...blockedExits], exitCosts,
      hazardous: bestCost >= 400,
    };
    return this.route;
  }
}

// Animated chevrons on the floor along the current route.
export class ArrowGuide {
  constructor(scene, max = 70) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.28); shape.lineTo(0.26, 0.0); shape.lineTo(0.26, -0.12); shape.lineTo(0, 0.14);
    shape.lineTo(-0.26, -0.12); shape.lineTo(-0.26, 0.0); shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2); // shape +Y → world -Z
    this.mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.max = max;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, this.color.set('#22ff88'));
    scene.add(this.mesh);
    this.visible = false;
  }

  update(route, time, visible) {
    if (!visible || !route) { this.mesh.count = 0; return; }
    const pts = route.points;
    let count = 0, carried = 0.9; // first chevron 0.9 m ahead of the player
    const hazard = route.hazardous;
    for (let i = 1; i < pts.length && count < this.max; i++) {
      const a = pts[i - 1], b = pts[i];
      const seg = a.distanceTo(b);
      const dx = (b.x - a.x) / (seg || 1), dz = (b.y - a.y) / (seg || 1);
      let t = carried;
      while (t < seg && count < this.max) {
        const x = a.x + dx * t, z = a.y + dz * t;
        this.dummy.position.set(x, 0.03, z);
        this.dummy.rotation.set(0, Math.atan2(-dx, -dz), 0);
        const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(time * 6 - count * 0.55));
        this.dummy.scale.setScalar(0.9 + pulse * 0.25);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(count, this.dummy.matrix);
        this.color.set(hazard ? '#ffb020' : '#22ff88').multiplyScalar(0.5 + pulse * 0.9);
        this.mesh.setColorAt(count, this.color);
        count++;
        t += 1.1;
      }
      carried = t - seg;
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
