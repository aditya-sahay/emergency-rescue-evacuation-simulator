// Procedural canvas textures — no external image assets are required.
import * as THREE from 'three';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// Deterministic PRNG so textures look identical every run.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toTexture(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

function noise(ctx, w, h, amount, seed, alpha = 1) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount * alpha;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

export function carpetTexture(base = '#59616c', seed = 3) {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(seed);
  // subtle loop-pile fibres
  for (let i = 0; i < 9000; i++) {
    const v = r() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.035 + r() * 0.05})`;
    ctx.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1);
  }
  // carpet-tile seams (each texture tile = 1 carpet tile)
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256);
  noise(ctx, 256, 256, 18, seed + 1);
  return toTexture(c);
}

export function tileTexture(base = '#c9ccce', grout = '#9a9ea2', tiles = 2, seed = 5) {
  const [c, ctx] = canvas(512);
  const s = 512 / tiles;
  const r = rng(seed);
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      const shade = (r() - 0.5) * 14;
      const col = new THREE.Color(base);
      ctx.fillStyle = `rgb(${col.r * 255 + shade},${col.g * 255 + shade},${col.b * 255 + shade})`;
      ctx.fillRect(x * s, y * s, s, s);
      // faint marbling
      for (let k = 0; k < 6; k++) {
        ctx.strokeStyle = `rgba(255,255,255,${0.03 + r() * 0.04})`;
        ctx.lineWidth = 1 + r() * 3;
        ctx.beginPath();
        ctx.moveTo(x * s + r() * s, y * s);
        ctx.bezierCurveTo(x * s + r() * s, y * s + r() * s, x * s + r() * s, y * s + r() * s, x * s + r() * s, y * s + s);
        ctx.stroke();
      }
    }
  }
  ctx.strokeStyle = grout;
  ctx.lineWidth = 4;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(512, i * s); ctx.stroke();
  }
  noise(ctx, 512, 512, 10, seed);
  return toTexture(c);
}

export function checkerTileTexture() {
  const [c, ctx] = canvas(256);
  const s = 64;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#d9d4c7' : '#7c8a8f';
    ctx.fillRect(x * s, y * s, s, s);
  }
  ctx.strokeStyle = 'rgba(40,40,40,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(256, i * s); ctx.stroke();
  }
  noise(ctx, 256, 256, 12, 9);
  return toTexture(c);
}

export function stoneTexture() {
  const [c, ctx] = canvas(512);
  ctx.fillStyle = '#cfc6b8';
  ctx.fillRect(0, 0, 512, 512);
  const r = rng(11);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(120,105,90,${0.05 + r() * 0.08})`;
    ctx.lineWidth = 0.5 + r() * 2.5;
    ctx.beginPath();
    let x = r() * 512, y = r() * 512;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 140; y += (r() - 0.3) * 90; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(90,80,70,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 512, 512);
  ctx.beginPath(); ctx.moveTo(256, 0); ctx.lineTo(256, 512); ctx.moveTo(0, 256); ctx.lineTo(512, 256); ctx.stroke();
  noise(ctx, 512, 512, 10, 12);
  return toTexture(c);
}

export function woodTexture(base = '#a87a4f', seed = 21) {
  const [c, ctx] = canvas(512);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  const r = rng(seed);
  for (let i = 0; i < 180; i++) {
    const y = r() * 512;
    ctx.strokeStyle = r() > 0.5 ? `rgba(60,35,15,${0.05 + r() * 0.12})` : `rgba(255,225,190,${0.04 + r() * 0.07})`;
    ctx.lineWidth = 0.5 + r() * 2.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * (2 + r() * 4));
    ctx.stroke();
  }
  noise(ctx, 512, 512, 14, seed);
  return toTexture(c);
}

export function wallTexture() {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#e9e7e2';
  ctx.fillRect(0, 0, 256, 256);
  noise(ctx, 256, 256, 9, 31);
  return toTexture(c);
}

export function ceilingTexture() {
  // 2x2 acoustic ceiling tiles per texture repeat
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#f2f1ee';
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(41);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(120,120,120,${r() * 0.18})`;
    ctx.fillRect(r() * 256, r() * 256, 1, 1);
  }
  ctx.strokeStyle = '#b8bcc0';
  ctx.lineWidth = 5;
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 128); ctx.lineTo(256, i * 128); ctx.stroke();
  }
  return toTexture(c);
}

export function grassTexture() {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#4f6b35';
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(51);
  for (let i = 0; i < 6000; i++) {
    const g = 80 + r() * 70;
    ctx.fillStyle = `rgba(${g * 0.6},${g},${g * 0.4},0.5)`;
    ctx.fillRect(r() * 256, r() * 256, 1, 2 + r() * 3);
  }
  return toTexture(c);
}

export function pavingTexture() {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#9b9a95';
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(61);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) {
    const sh = (r() - 0.5) * 20;
    ctx.fillStyle = `rgb(${155 + sh},${154 + sh},${149 + sh})`;
    ctx.fillRect(x * 128 + (y % 2) * 64, y * 64, 126, 62);
    ctx.fillRect(x * 128 + (y % 2) * 64 - 256, y * 64, 126, 62);
  }
  noise(ctx, 256, 256, 22, 62);
  return toTexture(c);
}

export function fabricTexture(base) {
  const [c, ctx] = canvas(128);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 2) {
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(i, 0, 1, 128);
    ctx.fillRect(0, i, 128, 1);
  }
  noise(ctx, 128, 128, 16, 71);
  return toTexture(c);
}

// Monitor screen content (fake spreadsheets / dashboards).
export function screenTexture(variant = 0) {
  const [c, ctx] = canvas(256, 160);
  const bg = ['#0f1b2b', '#f4f6f8', '#1b1f27', '#eef3f8'][variant % 4];
  const light = variant % 2 === 1;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = light ? '#2c5d8f' : '#2a3f5c';
  ctx.fillRect(0, 0, 256, 14);
  const r = rng(80 + variant);
  if (variant % 4 === 1) {
    // spreadsheet
    ctx.strokeStyle = '#cfd6de';
    for (let y = 20; y < 160; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
    for (let x = 0; x < 256; x += 40) { ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x, 160); ctx.stroke(); }
    ctx.fillStyle = '#56606b';
    for (let y = 22; y < 160; y += 10) for (let x = 4; x < 256; x += 40) ctx.fillRect(x, y + 2, 10 + r() * 22, 4);
  } else {
    // dashboard
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = light ? '#ffffff' : '#243246';
      ctx.fillRect(8 + i * 62, 22, 56, 30);
      ctx.fillStyle = ['#4fc3f7', '#81c784', '#ffb74d', '#e57373'][i];
      ctx.fillRect(12 + i * 62, 40, 20 + r() * 26, 6);
    }
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= 240; x += 12) ctx.lineTo(8 + x, 140 - r() * 60);
    ctx.stroke();
    ctx.fillStyle = light ? '#90a4ae' : '#37474f';
    for (let i = 0; i < 10; i++) ctx.fillRect(8 + i * 24, 150 - r() * 30, 14, 160);
  }
  return toTexture(c, { repeat: false });
}

export function signTexture(kind, opts = {}) {
  const w = 512, h = kind === 'exit' ? 192 : 256;
  const [c, ctx] = canvas(w, h);
  if (kind === 'exit') {
    ctx.fillStyle = '#0a8f3c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    // running figure (simple pictogram)
    const fx = opts.arrow === 'left' ? 340 : 40;
    ctx.save();
    ctx.translate(fx, 20);
    ctx.beginPath(); ctx.arc(70, 24, 18, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(62, 50); ctx.lineTo(48, 100); ctx.lineTo(80, 128); ctx.lineTo(74, 160); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(48, 100); ctx.lineTo(20, 135); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60, 60); ctx.lineTo(92, 80); ctx.lineTo(112, 64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(58, 62); ctx.lineTo(30, 78); ctx.stroke();
    ctx.restore();
    ctx.font = 'bold 96px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', 260, h / 2 + 4);
    if (opts.arrow) {
      ctx.save();
      ctx.translate(opts.arrow === 'left' ? 70 : 440, h / 2);
      if (opts.arrow === 'left') ctx.scale(-1, 1);
      ctx.beginPath();
      ctx.moveTo(-30, -18); ctx.lineTo(5, -18); ctx.lineTo(5, -42); ctx.lineTo(45, 0); ctx.lineTo(5, 42); ctx.lineTo(5, 18); ctx.lineTo(-30, 18);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  } else if (kind === 'extinguisher') {
    ctx.fillStyle = '#c4161c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FIRE', 300, 100);
    ctx.fillText('EXTINGUISHER', 300, 170);
    ctx.fillRect(40, 60, 70, 150);
    ctx.fillStyle = '#c4161c';
    ctx.fillRect(52, 90, 46, 108);
  } else if (kind === 'callpoint') {
    ctx.fillStyle = '#c4161c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 50px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FIRE ALARM', w / 2, 70);
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.fillText('PRESS HERE', w / 2, 230);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(176, 92, 160, 104);
    ctx.fillStyle = '#c4161c';
    ctx.beginPath(); ctx.arc(256, 144, 30, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'assembly') {
    ctx.fillStyle = '#0a8f3c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ASSEMBLY', w / 2, 100);
    ctx.fillText('POINT', w / 2, 180);
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.fillText(opts.label || '', w / 2, 236);
  } else if (kind === 'logo') {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#e8eef4';
    ctx.font = '800 70px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NORTHWIND', w / 2, 130);
    ctx.font = '500 30px Arial, sans-serif';
    ctx.fillStyle = '#9fc3e6';
    ctx.fillText('ENGINEERING  GROUP', w / 2, 190);
  } else if (kind === 'room') {
    ctx.fillStyle = '#263238';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.label || '', w / 2, h / 2);
  }
  return toTexture(c, { repeat: false });
}

export function whiteboardTexture() {
  const [c, ctx] = canvas(512, 256);
  ctx.fillStyle = '#fbfbfb';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#1e5aa8';
  ctx.lineWidth = 3;
  ctx.font = '28px "Comic Sans MS", cursive';
  ctx.fillStyle = '#1e5aa8';
  ctx.fillText('Q4 Roadmap', 30, 50);
  ctx.strokeRect(40, 80, 110, 60);
  ctx.strokeRect(210, 80, 110, 60);
  ctx.strokeRect(380, 80, 100, 60);
  ctx.beginPath(); ctx.moveTo(150, 110); ctx.lineTo(210, 110); ctx.moveTo(320, 110); ctx.lineTo(380, 110); ctx.stroke();
  ctx.strokeStyle = '#c62828';
  ctx.beginPath(); ctx.moveTo(40, 200); ctx.bezierCurveTo(140, 160, 260, 230, 470, 180); ctx.stroke();
  return toTexture(c, { repeat: false });
}

// Particle sprites
export function softSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const [c, ctx] = canvas(64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(c, { repeat: false, srgb: false });
}

export function flameSprite() {
  // teardrop-shaped flame tongue: bright core, soft tapered top
  const [c, ctx] = canvas(64);
  ctx.save();
  ctx.translate(32, 40);
  ctx.scale(0.62, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -40);
  ctx.bezierCurveTo(22, -14, 30, 8, 0, 24);
  ctx.bezierCurveTo(-30, 8, -22, -14, 0, -40);
  ctx.fill();
  ctx.restore();
  return toTexture(c, { repeat: false, srgb: false });
}

export function smokeSprite() {
  const [c, ctx] = canvas(128);
  const r = rng(91);
  for (let i = 0; i < 26; i++) {
    const x = 64 + (r() - 0.5) * 50, y = 64 + (r() - 0.5) * 50, rad = 18 + r() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  // fade out edges
  const img = ctx.getImageData(0, 0, 128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const d = Math.hypot(x - 64, y - 64) / 64;
    const i = (y * 128 + x) * 4 + 3;
    img.data[i] *= Math.max(0, 1 - d * d);
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { repeat: false, srgb: false });
}

export function radialDecal(stops) {
  const [c, ctx] = canvas(128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(c, { repeat: false });
}

export function ringTexture() {
  const [c, ctx] = canvas(256);
  ctx.strokeStyle = 'rgba(255,60,40,0.95)';
  ctx.lineWidth = 10;
  ctx.setLineDash([22, 14]);
  ctx.beginPath(); ctx.arc(128, 128, 118, 0, Math.PI * 2); ctx.stroke();
  const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 124);
  g.addColorStop(0, 'rgba(255,40,20,0)');
  g.addColorStop(1, 'rgba(255,40,20,0.28)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(128, 128, 124, 0, Math.PI * 2); ctx.fill();
  return toTexture(c, { repeat: false });
}

export function skyTexture() {
  const [c, ctx] = canvas(16, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#5f8fc4');
  g.addColorStop(0.5, '#a9c6e3');
  g.addColorStop(0.56, '#dfe7ec');
  g.addColorStop(1, '#8b9187');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 256);
  const t = toTexture(c, { repeat: false });
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

// ---------- refinement: approximated ambient occlusion + detail textures ----------

// Soft rounded-rectangle contact shadow, stretched under furniture footprints.
export function aoBlobTexture() {
  // shadowBlur (supported everywhere, unlike ctx.filter) draws a blurred copy offset back on-canvas
  const [c, ctx] = canvas(128);
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 300;
  ctx.fillStyle = '#000';
  ctx.fillRect(28 - 300, 28, 72, 72);
  return toTexture(c, { repeat: false, srgb: false });
}

// Edge gradient: opaque black along the top (v = 1) fading to transparent. Used where walls meet floor/ceiling.
export function aoEdgeTexture() {
  const [c, ctx] = canvas(8, 64);
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 64);
  const t = toTexture(c, { repeat: false, srgb: false });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function leafTexture() {
  // subtle vein/variation map for smooth foliage
  const [c, ctx] = canvas(128);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  const r = rng(301);
  for (let i = 0; i < 900; i++) {
    const v = 200 + r() * 55;
    ctx.fillStyle = `rgba(${v * 0.85},${v},${v * 0.8},0.5)`;
    ctx.beginPath(); ctx.arc(r() * 128, r() * 128, 1 + r() * 5, 0, Math.PI * 2); ctx.fill();
  }
  return toTexture(c);
}

export function hedgeTexture() {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#2c4a22';
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(311);
  for (let i = 0; i < 2600; i++) {
    const g = 60 + r() * 90;
    ctx.fillStyle = `rgba(${g * 0.55},${g},${g * 0.35},${0.5 + r() * 0.5})`;
    ctx.beginPath(); ctx.ellipse(r() * 256, r() * 256, 2 + r() * 4, 1 + r() * 2, r() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  return toTexture(c);
}

export function facadeTexture(seed = 401, tint = '#8f9aa6') {
  // one repeat = 2 floors × 3 bays of curtain-wall glazing
  const [c, ctx] = canvas(256);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(seed);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) {
    const lit = r() > 0.75;
    const sh = 40 + r() * 40;
    ctx.fillStyle = lit ? `rgb(${190 + sh / 2},${180 + sh / 2},${140})` : `rgb(${sh * 0.6},${sh * 0.8},${sh + 30})`;
    ctx.fillRect(x * 85 + 8, y * 128 + 22, 70, 90);
  }
  noise(ctx, 256, 256, 10, seed);
  return toTexture(c);
}

export function grilleTexture() {
  const [c, ctx] = canvas(128);
  ctx.fillStyle = '#e9eaeb';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#5d6165';
  for (let i = 0; i < 4; i++) {
    const inset = 14 + i * 12;
    ctx.strokeStyle = '#6f7378';
    ctx.lineWidth = 4;
    ctx.strokeRect(inset, inset, 128 - inset * 2, 128 - inset * 2);
  }
  ctx.fillRect(60, 60, 8, 8);
  return toTexture(c, { repeat: false });
}

export function clockTexture() {
  const [c, ctx] = canvas(128);
  ctx.fillStyle = '#fafafa';
  ctx.beginPath(); ctx.arc(64, 64, 62, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.lineWidth = i % 3 ? 2 : 4;
    ctx.beginPath(); ctx.moveTo(64 + Math.sin(a) * 48, 64 - Math.cos(a) * 48); ctx.lineTo(64 + Math.sin(a) * 56, 64 - Math.cos(a) * 56); ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 + 26, 64 - 14); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 - 8, 64 - 44); ctx.stroke();
  ctx.strokeStyle = '#c4161c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 + 30, 64 + 34); ctx.stroke();
  return toTexture(c, { repeat: false });
}
