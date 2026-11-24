// Geometry batching: thousands of furniture parts are merged into one mesh per material,
// cutting draw calls from thousands to a few dozen. Also generates world-space box-projected UVs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

// Geometry cache for repeated primitives (cloned on add).
const geoCache = new Map();
function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}

export class Batcher {
  constructor(materials) {
    this.mats = materials.m;
    this.meta = materials.meta;
    this.buckets = new Map();
  }

  add(matKey, geometry, matrix) {
    if (!this.mats[matKey]) throw new Error(`Unknown material ${matKey}`);
    const g = geometry.clone();
    g.applyMatrix4(matrix);
    let list = this.buckets.get(matKey);
    if (!list) { list = []; this.buckets.set(matKey, list); }
    list.push(g);
  }

  build() {
    const group = new THREE.Group();
    group.name = 'StaticBatched';
    for (const [key, list] of this.buckets) {
      const meta = this.meta[key];
      const anyNonIndexed = list.some((g) => !g.index);
      const keep = ['position', 'normal', 'uv'];
      if (list.every((g) => g.attributes.color)) keep.push('color'); // vertex-alpha decals
      const prepared = list.map((g) => {
        let geo = anyNonIndexed && g.index ? g.toNonIndexed() : g;
        for (const name of Object.keys(geo.attributes)) {
          if (!keep.includes(name)) geo.deleteAttribute(name);
        }
        if (meta.worldUV) worldUV(geo, meta.worldUV);
        return geo;
      });
      const merged = mergeGeometries(prepared, false);
      if (!merged) { console.warn('merge failed for', key); continue; }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, this.mats[key]);
      mesh.name = `batch:${key}`;
      mesh.castShadow = meta.shadow;
      mesh.receiveShadow = meta.shadow || key === 'ceiling';
      mesh.matrixAutoUpdate = false;
      if (this.mats[key].transparent) mesh.renderOrder = 2;
      group.add(mesh);
      prepared.forEach((g) => g.dispose());
    }
    this.buckets.clear();
    return group;
  }
}

function worldUV(geo, scale) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = pos.getX(i); v = pos.getZ(i); }
    else if (nx >= nz) { u = pos.getZ(i); v = pos.getY(i); }
    else { u = pos.getX(i); v = pos.getY(i); }
    uv[i * 2] = u / scale;
    uv[i * 2 + 1] = v / scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// Vertex-alpha decal geometries (no textures → immune to texture filtering differences between GPUs).
// Blob: 4×4 vertex grid in the XZ plane; the inner 2×2 vertices are opaque, the border ring transparent.
// Sized in metres: opaque core = the w × d footprint, fading to zero `fade` metres outside it.
function blobGeometry(w, d, fade) {
  const xs = [-w / 2 - fade, -w / 2, w / 2, w / 2 + fade];
  const zs = [-d / 2 - fade, -d / 2, d / 2, d / 2 + fade];
  const pos = [], col = [], uv = [], nor = [], idx = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    pos.push(xs[i], 0, zs[j]);
    nor.push(0, 1, 0);
    uv.push(i / 3, j / 3);
    const inner = i > 0 && i < 3 && j > 0 && j < 3;
    col.push(0, 0, 0, inner ? 1 : 0);
  }
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const a = j * 4 + i, b = a + 1, c = a + 4, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}
// Edge: unit quad facing +Z; opaque along its +Y edge, transparent along -Y.
function edgeGeometry() {
  const g = new THREE.PlaneGeometry(1, 1);
  const c = [];
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) c.push(0, 0, 0, p.getY(i) > 0 ? 1 : 0);
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 4));
  return g;
}

// Builder: a local coordinate frame for composing objects from primitives.
export class Builder {
  constructor(batcher, collision, matrix = new THREE.Matrix4()) {
    this.batcher = batcher;
    this.collision = collision;
    this.matrix = matrix;
  }

  at(x, y, z, ry = 0) {
    const local = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    return new Builder(this.batcher, this.collision, this.matrix.clone().multiply(local));
  }

  _place(mat, geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    _m.compose(_p, _q, _s);
    this.batcher.add(mat, geo, this.matrix.clone().multiply(_m));
  }

  // Box centred at (x, y, z) in local space.
  box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const g = cached('box', () => new THREE.BoxGeometry(1, 1, 1));
    this._place(mat, g, x, y, z, rx, ry, rz, w, h, d);
  }

  cyl(mat, rTop, rBot, h, x, y, z, seg = 16, rx = 0, rz = 0) {
    const g = cached(`cyl:${rTop}:${rBot}:${seg}`, () => new THREE.CylinderGeometry(rTop, rBot, 1, seg));
    this._place(mat, g, x, y, z, rx, 0, rz, 1, h, 1);
  }

  sphere(mat, r, x, y, z, sx = 1, sy = 1, sz = 1, detail = 1) {
    const g = cached(`ico:${detail}`, () => new THREE.IcosahedronGeometry(1, detail));
    this._place(mat, g, x, y, z, 0, 0, 0, r * sx, r * sy, r * sz);
  }

  ball(mat, r, x, y, z, seg = 12) {
    const g = cached(`sph:${seg}`, () => new THREE.SphereGeometry(1, seg, Math.max(6, seg / 2)));
    this._place(mat, g, x, y, z, 0, 0, 0, r, r, r);
  }

  cone(mat, r, h, x, y, z, seg = 8, rx = 0, rz = 0) {
    const g = cached(`cone:${seg}`, () => new THREE.ConeGeometry(1, 1, seg));
    this._place(mat, g, x, y, z, rx, 0, rz, r, h, r);
  }

  // Smooth leaf blade: an ellipsoid of length `len` along local +Y, rooted at (x, y, z),
  // tilted outward by `tilt` and then turned by `yaw` (Euler order YXZ).
  leaf(mat, len, wid, x, y, z, yaw, tilt, roll = 0) {
    const g = cached('leaf', () => new THREE.SphereGeometry(1, 6, 4));
    const dir = new THREE.Vector3(Math.sin(tilt) * Math.sin(yaw), Math.cos(tilt), Math.sin(tilt) * Math.cos(yaw));
    _e.set(tilt, yaw, roll, 'YXZ');
    _q.setFromEuler(_e);
    _e.order = 'XYZ';
    _p.set(x + dir.x * len / 2, y + dir.y * len / 2, z + dir.z * len / 2);
    _s.set(wid / 2, len / 2, wid / 9);
    _m.compose(_p, _q, _s);
    this.batcher.add(mat, g, this.matrix.clone().multiply(_m));
  }

  // Contact shadow (approximated ambient occlusion) on the floor under a w × d footprint.
  ao(w, d, x = 0, z = 0, y = 0.012) {
    const g = blobGeometry(w * 0.92, d * 0.92, 0.26 + Math.min(w, d) * 0.12);
    this._place('aoBlob', g, x, y, z);
  }

  // Gradient strip (dark along its local +Y edge) for wall/floor/ceiling junction occlusion.
  edge(mat, w, h, x, y, z, rx = 0, ry = 0, rz = 0) {
    const g = cached('aoEdge', edgeGeometry);
    this._place(mat, g, x, y, z, rx, ry, rz, w, h, 1);
  }

  // Flat plane facing local +Z.
  plane(mat, w, h, x, y, z, rx = 0, ry = 0, rz = 0) {
    const g = cached('plane1', () => new THREE.PlaneGeometry(1, 1));
    this._place(mat, g, x, y, z, rx, ry, rz, w, h, 1);
  }

  geo(mat, geometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    this._place(mat, geometry, x, y, z, rx, ry, rz);
  }

  // Axis-aligned (after transform) collider from a local-space rectangle.
  collider(x0, z0, x1, z1, tag = 'furniture') {
    if (!this.collision) return;
    const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => new THREE.Vector3(x, 0, z).applyMatrix4(this.matrix));
    const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
    this.collision.add(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), tag);
  }

  worldPoint(x, y, z) {
    return new THREE.Vector3(x, y, z).applyMatrix4(this.matrix);
  }
}
