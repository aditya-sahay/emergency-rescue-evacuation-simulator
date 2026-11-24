// 2D (XZ-plane) collision world built from axis-aligned boxes with a uniform spatial grid.
// Walls, doors and furniture are all full-height obstacles for a walking player, so a 2D
// solver is both accurate for this level and far cheaper than a general 3D physics engine.

export class CollisionWorld {
  constructor(cellSize = 2) {
    this.cell = cellSize;
    this.boxes = [];
    this.grid = new Map();
    this._stamp = 0;
  }

  _key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }

  add(x0, z0, x1, z1, tag = 'furniture', data = null) {
    const box = {
      id: this.boxes.length,
      x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1),
      tag, data, enabled: true, _stamp: 0,
    };
    this.boxes.push(box);
    const c = this.cell;
    for (let ix = Math.floor(box.x0 / c); ix <= Math.floor(box.x1 / c); ix++) {
      for (let iz = Math.floor(box.z0 / c); iz <= Math.floor(box.z1 / c); iz++) {
        const k = this._key(ix, iz);
        let list = this.grid.get(k);
        if (!list) { list = []; this.grid.set(k, list); }
        list.push(box);
      }
    }
    return box;
  }

  query(x0, z0, x1, z1, out = []) {
    out.length = 0;
    const stamp = ++this._stamp;
    const c = this.cell;
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++) {
      for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) {
        const list = this.grid.get(this._key(ix, iz));
        if (!list) continue;
        for (const b of list) {
          if (b._stamp === stamp || !b.enabled) continue;
          b._stamp = stamp;
          if (b.x1 < x0 || b.x0 > x1 || b.z1 < z0 || b.z0 > z1) continue;
          out.push(b);
        }
      }
    }
    return out;
  }

  // Push a circle (player) out of every overlapping box. Mutates pos {x, z}. Returns true if collided.
  resolveCircle(pos, r) {
    const near = this.query(pos.x - r - 0.1, pos.z - r - 0.1, pos.x + r + 0.1, pos.z + r + 0.1, this._tmp || (this._tmp = []));
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of near) {
        const cx = Math.max(b.x0, Math.min(pos.x, b.x1));
        const cz = Math.max(b.z0, Math.min(pos.z, b.z1));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = moved = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = r - d;
          pos.x += (dx / d) * push;
          pos.z += (dz / d) * push;
        } else {
          // centre inside the box: push out along the shallowest axis
          const left = pos.x - b.x0, right = b.x1 - pos.x, up = pos.z - b.z0, down = b.z1 - pos.z;
          const m = Math.min(left, right, up, down);
          if (m === left) pos.x = b.x0 - r;
          else if (m === right) pos.x = b.x1 + r;
          else if (m === up) pos.z = b.z0 - r;
          else pos.z = b.z1 + r;
        }
      }
      if (!moved) break;
    }
    return hit;
  }

  // Count obstacles crossed by segment A→B whose tag passes the filter (slab test).
  segmentHits(ax, az, bx, bz, filter, maxCount = 99) {
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), z0 = Math.min(az, bz), z1 = Math.max(az, bz);
    const near = this.query(x0, z0, x1, z1, this._tmp2 || (this._tmp2 = []));
    const dx = bx - ax, dz = bz - az;
    let count = 0;
    for (const b of near) {
      if (filter && !filter(b)) continue;
      let tmin = 0, tmax = 1;
      if (Math.abs(dx) < 1e-9) { if (ax < b.x0 || ax > b.x1) continue; }
      else {
        let t1 = (b.x0 - ax) / dx, t2 = (b.x1 - ax) / dx;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      if (Math.abs(dz) < 1e-9) { if (az < b.z0 || az > b.z1) continue; }
      else {
        let t1 = (b.z0 - az) / dz, t2 = (b.z1 - az) / dz;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      count++;
      if (count >= maxCount) break;
    }
    return count;
  }

  lineOfSight(ax, az, bx, bz) {
    return this.segmentHits(ax, az, bx, bz, isStructural, 1) === 0;
  }
}

export const isStructural = (b) => b.tag === 'wall' || b.tag === 'door';
