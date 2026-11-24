// Pooled point-sprite particle system. One draw call per pool; CPU integration in typed arrays.
import * as THREE from 'three';

const vert = /* glsl */`
attribute float size;
attribute vec4 pcolor;
uniform float scale;
varying vec4 vColor;
#include <fog_pars_vertex>
void main() {
  vColor = pcolor;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.05, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const frag = /* glsl */`
uniform sampler2D map;
varying vec4 vColor;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.004) discard;
  #include <fog_fragment>
}`;

export class ParticlePool {
  /**
   * @param {object} o
   * o.max, o.texture, o.additive, o.fog,
   * o.gradient: array of [t, r, g, b, a] colour stops over normalised life
   * o.buoyancy (m/s² up), o.drag, o.turbulence, o.ceiling (y clamp; spreads sideways when hit)
   */
  constructor(o) {
    this.o = o;
    const n = (this.max = o.max);
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 4);
    this.size = new Float32Array(n);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.s0 = new Float32Array(n);
    this.s1 = new Float32Array(n);
    this.bounds = new Float32Array(n * 4); // x0,z0,x1,z1 clamp box (smoke stays in its room)
    this.alive = 0;
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('pcolor', this.colAttr);
    geo.setAttribute('size', this.sizeAttr);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(20, 0, 12), 1000);
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, scale: { value: 600 } }]),
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: !!o.fog,
    });
    this.material.uniforms.map.value = o.texture;
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = o.additive ? 5 : 4;
    this.life.fill(0);
    this.size.fill(0);
  }

  setScale(s) { this.material.uniforms.scale.value = s; }

  emit(x, y, z, vx, vy, vz, life, s0, s1, bounds) {
    // ring buffer: overwrite oldest particle when full
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.s0[i] = s0; this.s1[i] = s1;
    const b = bounds || NO_BOUNDS;
    this.bounds[i * 4] = b[0]; this.bounds[i * 4 + 1] = b[1]; this.bounds[i * 4 + 2] = b[2]; this.bounds[i * 4 + 3] = b[3];
  }

  update(dt, time) {
    const o = this.o, g = o.gradient;
    const drag = Math.exp(-(o.drag || 0) * dt);
    const turb = o.turbulence || 0;
    const ceiling = o.ceiling ?? 1e9;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.size[i] !== 0) { this.size[i] = 0; this.col[i * 4 + 3] = 0; }
        continue;
      }
      this.life[i] -= dt;
      const i3 = i * 3;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      let vx = this.vel[i3], vy = this.vel[i3 + 1], vz = this.vel[i3 + 2];
      vy += (o.buoyancy || 0) * dt - (o.gravity || 0) * dt;
      if (turb) {
        const px = this.pos[i3], pz = this.pos[i3 + 2];
        vx += Math.sin(time * 3.1 + pz * 2.3 + i) * turb * dt;
        vz += Math.cos(time * 2.7 + px * 2.1 + i * 0.7) * turb * dt;
      }
      vx *= drag; vy *= drag; vz *= drag;
      let x = this.pos[i3] + vx * dt, y = this.pos[i3 + 1] + vy * dt, z = this.pos[i3 + 2] + vz * dt;
      if (y > ceiling) {
        y = ceiling;
        if (vy > 0) {
          // hot gases spread along the ceiling
          const sp = vy * 0.8;
          const a = (i * 2.399) % (Math.PI * 2);
          vx += Math.cos(a) * sp; vz += Math.sin(a) * sp;
          vy = 0;
        }
      }
      if (y < 0.02) { y = 0.02; vy = Math.abs(vy) * 0.2; }
      const b = i * 4;
      if (x < this.bounds[b]) { x = this.bounds[b]; vx = -vx * 0.3; }
      if (x > this.bounds[b + 2]) { x = this.bounds[b + 2]; vx = -vx * 0.3; }
      if (z < this.bounds[b + 1]) { z = this.bounds[b + 1]; vz = -vz * 0.3; }
      if (z > this.bounds[b + 3]) { z = this.bounds[b + 3]; vz = -vz * 0.3; }
      this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
      this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      // gradient lookup
      let k = 0;
      while (k < g.length - 2 && t > g[k + 1][0]) k++;
      const a0 = g[k], a1 = g[k + 1];
      const f = Math.min(1, Math.max(0, (t - a0[0]) / (a1[0] - a0[0] || 1)));
      const c = i * 4;
      this.col[c] = a0[1] + (a1[1] - a0[1]) * f;
      this.col[c + 1] = a0[2] + (a1[2] - a0[2]) * f;
      this.col[c + 2] = a0[3] + (a1[3] - a0[3]) * f;
      this.col[c + 3] = (a0[4] + (a1[4] - a0[4]) * f) * (o.alphaScale ?? 1);
      if (this.life[i] <= 0) { this.size[i] = 0; this.col[c + 3] = 0; }
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.size.fill(0);
    for (let i = 0; i < this.max; i++) this.col[i * 4 + 3] = 0;
    this.sizeAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

const NO_BOUNDS = [-1e9, -1e9, 1e9, 1e9];
