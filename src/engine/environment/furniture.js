// Procedural furniture. Every function draws into a Builder's local frame.
// Convention: origin on the floor, the object's "front" faces local +Z.
import * as THREE from 'three';
import { rng } from './textures.js';

const R = rng(1234);
const planeCache = new Map();
function plane(w, h) {
  const k = `${w}x${h}`;
  if (!planeCache.has(k)) planeCache.set(k, new THREE.PlaneGeometry(w, h));
  return planeCache.get(k);
}

// ---------- seating ----------
// Office chair: the sitter faces local -Z (place it on the +Z side of a desk with ry = 0).
export function officeChair(b, fabric = 'fabricChair', collide = true) {
  b.ao(0.55, 0.55);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.box('plastic', 0.05, 0.035, 0.3, Math.sin(a) * 0.14, 0.085, Math.cos(a) * 0.14, 0, a, 0);
    b.ball('rubber', 0.03, Math.sin(a) * 0.28, 0.03, Math.cos(a) * 0.28, 8);
  }
  b.cyl('metal', 0.022, 0.03, 0.32, 0, 0.26, 0, 10);
  b.box('plastic', 0.42, 0.04, 0.42, 0, 0.42, 0);
  b.box(fabric, 0.5, 0.075, 0.48, 0, 0.475, -0.01);
  b.box('plastic', 0.06, 0.32, 0.03, 0, 0.6, 0.24);
  b.box(fabric, 0.47, 0.52, 0.07, 0, 0.92, 0.27, -0.12);
  for (const sx of [-1, 1]) {
    b.box('plastic', 0.03, 0.2, 0.04, sx * 0.24, 0.6, 0.02);
    b.box('plastic', 0.06, 0.025, 0.24, sx * 0.24, 0.71, 0.0);
  }
  if (collide) b.collider(-0.24, -0.24, 0.24, 0.24);
}

export function simpleChair(b, seat = 'woodLight', frame = 'metalDark') {
  b.ao(0.45, 0.45);
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) b.cyl(frame, 0.015, 0.015, 0.45, x, 0.225, z, 6);
  b.box(seat, 0.46, 0.04, 0.44, 0, 0.46, 0);
  for (const x of [-0.2, 0.2]) b.cyl(frame, 0.013, 0.013, 0.42, x, 0.68, 0.2, 6);
  b.box(seat, 0.44, 0.22, 0.025, 0, 0.8, 0.21, -0.08);
  b.collider(-0.23, -0.23, 0.23, 0.23);
}

export function confChair(b) {
  b.ao(0.5, 0.55);
  // cantilever chair, sitter faces -Z
  b.box('metal', 0.03, 0.02, 0.55, -0.22, 0.01, 0);
  b.box('metal', 0.03, 0.02, 0.55, 0.22, 0.01, 0);
  b.box('metal', 0.03, 0.46, 0.03, -0.22, 0.23, 0.26);
  b.box('metal', 0.03, 0.46, 0.03, 0.22, 0.23, 0.26);
  b.box('leather', 0.5, 0.07, 0.48, 0, 0.47, 0);
  b.box('leather', 0.48, 0.5, 0.07, 0, 0.8, 0.26, -0.1);
  b.collider(-0.25, -0.25, 0.25, 0.28);
}

export function sofa(b, w = 2.0, fabric = 'fabricGrey') {
  b.ao(w, 0.85);
  const d = 0.85;
  b.box(fabric, w, 0.28, d, 0, 0.26, 0);
  const n = Math.max(2, Math.round(w / 0.7));
  const cw = (w - 0.3) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.15 + cw * (i + 0.5);
    b.box(fabric, cw - 0.02, 0.14, d - 0.25, x, 0.47, 0.08);
    b.box(fabric, cw - 0.02, 0.42, 0.18, x, 0.64, -d / 2 + 0.18, -0.12);
  }
  b.box(fabric, w, 0.5, 0.15, 0, 0.6, -d / 2 + 0.075);
  for (const sx of [-1, 1]) b.box(fabric, 0.15, 0.6, d, sx * (w / 2 - 0.075), 0.42, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl('metalDark', 0.02, 0.015, 0.12, sx * (w / 2 - 0.08), 0.06, sz * (d / 2 - 0.08), 6);
  b.collider(-w / 2, -d / 2, w / 2, d / 2);
}

// ---------- desks ----------
export function monitor(b, screenMat = 'screen0', w = 0.56) {
  const h = w * 0.6;
  b.box('plastic', 0.24, 0.015, 0.17, 0, 0.0075, 0);
  b.box('plastic', 0.045, 0.32, 0.03, 0, 0.17, -0.03);
  b.box('plastic', w, h, 0.028, 0, 0.12 + h / 2 + 0.05, 0);
  b.box('plastic', w * 0.4, h * 0.5, 0.03, 0, 0.12 + h / 2 + 0.05, -0.025);
  b.geo(screenMat, plane(w - 0.025, h - 0.025), 0, 0.12 + h / 2 + 0.05, 0.0145);
}

export function deskItems(b, variant) {
  b.box('plasticWhite', 0.44, 0.018, 0.14, 0, 0.009, 0.22);         // keyboard
  for (let r = 0; r < 4; r++) b.box('plasticGrey', 0.4, 0.004, 0.022, 0, 0.02, 0.17 + r * 0.03); // key rows
  b.box('plasticWhite', 0.06, 0.02, 0.1, 0.32, 0.01, 0.22);         // mouse
  if (variant % 3 === 0) { b.cyl('ceramic', 0.04, 0.035, 0.1, -0.42, 0.05, 0.12, 12); }  // mug
  if (variant % 2 === 0) { b.box('paper', 0.21, 0.01, 0.3, 0.45, 0.005, 0.05, 0, 0.2, 0); }
  if (variant % 4 === 1) {
    b.box('paper', 0.22, 0.04, 0.3, -0.45, 0.02, 0.0, 0, -0.1, 0);
    b.box('bookBlue', 0.2, 0.03, 0.28, -0.45, 0.055, 0.0, 0, 0.15, 0);
  }
}

// Workstation desk. The user sits on the +Z side; monitor at the back (-Z).
export function desk(b, { w = 1.4, d = 0.75, chair = true, screen = 'screen0', variant = 0, pedestal = true, top = 'woodLight' } = {}) {
  b.ao(w, d);
  const h = 0.74;
  b.box(top, w, 0.03, d, 0, h - 0.015, 0);
  b.box('aluminium', w, 0.012, 0.012, 0, h - 0.03, d / 2 - 0.006); // edge trim
  for (const sx of [-1, 1]) {
    b.box('metal', 0.05, h - 0.03, 0.05, sx * (w / 2 - 0.07), (h - 0.03) / 2, -d / 2 + 0.12);
    b.box('metal', 0.05, h - 0.03, 0.05, sx * (w / 2 - 0.07), (h - 0.03) / 2, d / 2 - 0.12);
    b.box('metal', 0.05, 0.05, d - 0.2, sx * (w / 2 - 0.07), h - 0.06, 0);
  }
  b.box('metal', w - 0.2, 0.05, 0.03, 0, h - 0.06, -d / 2 + 0.1);
  b.box('fabricGrey', w - 0.25, 0.32, 0.015, 0, h - 0.27, -d / 2 + 0.08);
  if (pedestal) {
    const px = w / 2 - 0.3;
    b.box('plasticGrey', 0.4, 0.56, 0.52, px, 0.3, -0.02);
    for (let i = 0; i < 3; i++) {
      b.box('metalDark', 0.36, 0.005, 0.005, px, 0.1 + i * 0.18, 0.245);
      b.box('aluminium', 0.12, 0.015, 0.015, px, 0.18 + i * 0.18, 0.255);
    }
  }
  const top0 = b.at(0, h, 0);
  monitor(top0.at(0, 0, -d / 2 + 0.2), screen);
  deskItems(top0.at(0, 0, -0.05), variant);
  b.collider(-w / 2, -d / 2, w / 2, d / 2);
  if (chair) officeChair(b.at((R() - 0.5) * 0.2, 0, d / 2 + 0.38 + R() * 0.1, (R() - 0.5) * 0.6), variant % 3 === 0 ? 'fabricBlue' : 'fabricChair');
}

// Back-to-back desk island along local X, with an acoustic divider.
export function workIsland(b, n, screens, seed = 0) {
  const w = 1.4, d = 0.75;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * w;
    desk(b.at(x, 0, d / 2 + 0.02), { w, d, screen: screens[(i + seed) % screens.length], variant: i + seed, pedestal: true });
    desk(b.at(x, 0, -d / 2 - 0.02, Math.PI), { w, d, screen: screens[(i + seed + 2) % screens.length], variant: i + seed + 5, pedestal: true });
  }
  b.box('fabricBlue', n * w, 0.42, 0.04, 0, 0.74 + 0.21, 0);
  b.box('aluminium', n * w, 0.02, 0.05, 0, 0.74 + 0.43, 0);
  // cable spine
  b.box('metalDark', n * w - 0.2, 0.08, 0.12, 0, 0.6, 0);
}

export function execDesk(b) {
  b.ao(2.6, 0.95, 0.3, 0); b.ao(0.55, 1.2, 1.3, -0.15);
  const w = 2.0, d = 0.95, h = 0.76;
  b.box('woodDark', w, 0.05, d, 0, h - 0.025, 0);
  b.box('woodDark', 0.06, h - 0.05, d, -w / 2 + 0.03, (h - 0.05) / 2, 0);
  b.box('woodDark', 0.06, h - 0.05, d, w / 2 - 0.03, (h - 0.05) / 2, 0);
  b.box('woodDark', w - 0.1, 0.5, 0.03, 0, h - 0.3, -d / 2 + 0.05);
  // return / credenza
  b.box('woodDark', 0.55, h - 0.02, 1.2, w / 2 + 0.3, (h - 0.02) / 2, -0.15);
  const t = b.at(0, h, 0);
  monitor(t.at(-0.35, 0, -0.25), 'screen2', 0.62);
  monitor(t.at(0.35, 0, -0.25), 'screen3', 0.62);
  deskItems(t.at(0, 0, 0), 1);
  b.cyl('plastic', 0.06, 0.08, 0.02, w / 2 + 0.3, h + 0.01, -0.5, 12); // desk lamp base
  b.cyl('metal', 0.01, 0.01, 0.4, w / 2 + 0.3, h + 0.2, -0.5, 6);
  b.cone('plastic', 0.09, 0.12, w / 2 + 0.3, h + 0.42, -0.45, 12, 0.4);
  b.collider(-w / 2, -d / 2, w / 2 + 0.6, d / 2);
  officeChair(b.at(0, 0, d / 2 + 0.45), 'leather');
}

export function receptionDesk(b) {
  b.ao(3.6, 0.85);
  const w = 3.6, d = 0.8;
  // tall front counter
  b.box('woodDark', w, 1.08, 0.08, 0, 0.54, d / 2);
  b.box('laminateWhite', w + 0.1, 0.04, 0.38, 0, 1.1, d / 2 - 0.08);
  for (let i = 0; i < 9; i++) b.box('woodLight', 0.06, 0.95, 0.02, -w / 2 + 0.2 + i * (w - 0.4) / 8, 0.52, d / 2 + 0.05);
  // sides
  b.box('woodDark', 0.08, 1.08, d, -w / 2, 0.54, 0);
  b.box('woodDark', 0.08, 1.08, d, w / 2, 0.54, 0);
  // lower work surface
  b.box('laminateWhite', w - 0.1, 0.04, d - 0.1, 0, 0.74, -0.02);
  b.box('aluminium', 0.04, 0.06, d, 0, 0.03, 0);
  const t = b.at(0, 0.76, 0);
  monitor(t.at(-0.8, 0, 0.05, Math.PI), 'screen1');
  monitor(t.at(0.8, 0, 0.05, Math.PI), 'screen0');
  b.box('plastic', 0.2, 0.06, 0.18, 0.1, 0.79, -0.1); // phone
  b.collider(-w / 2 - 0.05, -d / 2, w / 2 + 0.05, d / 2 + 0.1);
  officeChair(b.at(-0.8, 0, -0.65, Math.PI));
  officeChair(b.at(0.8, 0, -0.65, Math.PI));
}

export function conferenceTable(b, len = 4.2, wid = 1.4) {
  b.ao(len - 0.6, wid * 0.7);
  const h = 0.75;
  b.box('woodDark', len - wid, 0.05, wid, 0, h - 0.025, 0);
  const cap = new THREE.CylinderGeometry(wid / 2, wid / 2, 0.05, 32, 1, false, 0, Math.PI);
  b.geo('woodDark', cap, len / 2 - wid / 2, h - 0.025, 0, 0, 0, 0);
  b.geo('woodDark', cap, -len / 2 + wid / 2, h - 0.025, 0, 0, Math.PI, 0);
  for (const sx of [-1, 1]) {
    b.box('metalDark', 0.5, h - 0.05, 0.5, sx * (len / 2 - 1.0), (h - 0.05) / 2, 0);
    b.box('metal', 0.9, 0.02, 0.7, sx * (len / 2 - 1.0), 0.01, 0);
  }
  b.box('plastic', 0.3, 0.03, 0.2, 0, h + 0.015, 0); // conference phone
  b.collider(-len / 2, -wid / 2, len / 2, wid / 2);
  const per = Math.floor((len - 0.6) / 0.8);
  for (let i = 0; i < per; i++) {
    const x = (i - (per - 1) / 2) * 0.8;
    confChair(b.at(x, 0, wid / 2 + 0.38, (R() - 0.5) * 0.3));
    confChair(b.at(x, 0, -wid / 2 - 0.38, Math.PI + (R() - 0.5) * 0.3));
  }
  confChair(b.at(len / 2 + 0.45, 0, 0, Math.PI / 2));
}

// ---------- storage ----------
export function bookshelf(b, w = 1.0, h = 2.0, d = 0.38) {
  b.ao(w, d, 0, 0.02);
  b.box('woodDark', 0.03, h, d, -w / 2 + 0.015, h / 2, 0);
  b.box('woodDark', 0.03, h, d, w / 2 - 0.015, h / 2, 0);
  b.box('woodDark', w, 0.02, d, 0, h - 0.01, 0);
  b.box('woodDark', w, 0.01, d, 0, h / 2, -d / 2 + 0.005);
  const shelves = Math.round(h / 0.4);
  const books = ['bookRed', 'bookBlue', 'bookGreen', 'bookBeige', 'paper'];
  for (let s = 0; s < shelves; s++) {
    const y = 0.05 + s * (h / shelves);
    b.box('woodDark', w - 0.06, 0.025, d - 0.02, 0, y, 0);
    let x = -w / 2 + 0.06;
    while (x < w / 2 - 0.12) {
      const bw = 0.025 + R() * 0.04, bh = 0.2 + R() * 0.12;
      if (R() > 0.12) b.box(books[Math.floor(R() * books.length)], bw, bh, d * 0.75, x + bw / 2, y + 0.0125 + bh / 2, 0.01, 0, 0, R() > 0.9 ? 0.2 : 0);
      x += bw + 0.004;
    }
  }
  b.collider(-w / 2, -d / 2, w / 2, d / 2);
}

export function filingCabinet(b, drawers = 4) {
  b.ao(0.47, 0.62);
  const h = drawers * 0.33;
  b.box('plasticGrey', 0.47, h, 0.62, 0, h / 2, 0);
  for (let i = 0; i < drawers; i++) {
    const y = 0.18 + i * 0.33;
    b.box('metal', 0.43, 0.3, 0.01, 0, y, 0.312);
    b.box('aluminium', 0.15, 0.025, 0.03, 0, y + 0.08, 0.325);
    b.box('plastic', 0.08, 0.04, 0.005, 0, y + 0.03, 0.318);
  }
  b.collider(-0.24, -0.31, 0.24, 0.31);
}

// ---------- decor ----------
export function plant(b, size = 1, kind = null) {
  const s = size;
  const type = kind ?? (R() > 0.45 ? 'ficus' : 'snake');
  b.ao(0.42 * s, 0.42 * s);
  // tapered planter with rim
  b.cyl('potGrey', 0.2 * s, 0.15 * s, 0.42 * s, 0, 0.21 * s, 0, 20);
  b.cyl('potGrey', 0.215 * s, 0.215 * s, 0.04 * s, 0, 0.42 * s, 0, 20);
  b.cyl('soil', 0.185 * s, 0.185 * s, 0.02, 0, 0.425 * s, 0, 16);
  const top = 0.43 * s;
  const mats = ['leaf', 'leafDark', 'leafLight'];
  if (type === 'snake') {
    // upright sword-shaped blades (Sansevieria)
    const n = 16;
    for (let i = 0; i < n; i++) {
      const yaw = R() * Math.PI * 2, rr = R() * 0.1 * s;
      const len = (0.55 + R() * 0.45) * s;
      b.leaf(mats[i % 3], len, (0.07 + R() * 0.03) * s, Math.sin(yaw) * rr, top, Math.cos(yaw) * rr, yaw, 0.05 + R() * 0.28, (R() - 0.5) * 0.6);
    }
  } else {
    // ficus: three stems with clusters of drooping oval leaves
    for (let k = 0; k < 3; k++) {
      const sa = (k / 3) * Math.PI * 2 + R();
      const lean = 0.08 + R() * 0.12;
      const h = (0.75 + R() * 0.45) * s;
      const sx = Math.sin(sa) * Math.sin(lean), sz = Math.cos(sa) * Math.sin(lean);
      b.cyl('bark', 0.012 * s, 0.022 * s, h, sx * h / 2, top + h / 2, sz * h / 2, 6, sz * 0.9, -sx * 0.9);
      const leaves = 22;
      for (let i = 0; i < leaves; i++) {
        const t = 0.35 + 0.65 * (i / leaves);
        const ax = sx * h * t, ay = top + h * t * Math.cos(lean), az = sz * h * t;
        b.leaf(mats[(i + k) % 3], (0.13 + R() * 0.07) * s, (0.07 + R() * 0.03) * s, ax, ay, az, R() * Math.PI * 2, 0.7 + R() * 0.9, (R() - 0.5) * 0.5);
      }
      for (let i = 0; i < 6; i++) b.leaf(mats[i % 3], 0.14 * s, 0.07 * s, sx * h, top + h * Math.cos(lean), sz * h, R() * Math.PI * 2, R() * 0.6);
    }
  }
  b.collider(-0.22 * s, -0.22 * s, 0.22 * s, 0.22 * s);
}

export function coffeeTable(b, w = 1.1, d = 0.6) {
  b.ao(w, d);
  b.box('woodLight', w, 0.04, d, 0, 0.42, 0);
  b.box('glass', w - 0.1, 0.01, d - 0.1, 0, 0.18, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('metalDark', 0.04, 0.4, 0.04, sx * (w / 2 - 0.05), 0.2, sz * (d / 2 - 0.05));
  b.box('bookRed', 0.3, 0.03, 0.22, 0.2, 0.455, 0.05, 0, 0.3, 0);
  b.box('paper', 0.28, 0.02, 0.21, 0.22, 0.48, 0.04, 0, 0.5, 0);
  b.collider(-w / 2, -d / 2, w / 2, d / 2);
}

export function trashBin(b) {
  b.ao(0.3, 0.3);
  b.cyl('plasticGrey', 0.15, 0.12, 0.42, 0, 0.21, 0, 14);
  b.collider(-0.15, -0.15, 0.15, 0.15);
}

export function recycleStation(b) {
  b.ao(1.2, 0.46);
  const cols = ['bookBlue', 'bookGreen', 'yellow'];
  for (let i = 0; i < 3; i++) {
    b.box(cols[i], 0.38, 0.75, 0.45, (i - 1) * 0.4, 0.375, 0);
    b.box('plastic', 0.36, 0.03, 0.43, (i - 1) * 0.4, 0.765, 0);
  }
  b.collider(-0.6, -0.23, 0.6, 0.23);
}

export function waterCooler(b) {
  b.ao(0.34, 0.34);
  b.box('plasticWhite', 0.32, 1.0, 0.32, 0, 0.5, 0);
  b.box('plastic', 0.2, 0.05, 0.05, 0, 0.8, 0.17);
  b.cyl('glass', 0.14, 0.14, 0.4, 0, 1.22, 0, 16);
  b.collider(-0.17, -0.17, 0.17, 0.17);
}

export function copier(b) {
  b.ao(0.9, 0.65);
  b.box('plasticWhite', 0.9, 0.85, 0.65, 0, 0.425, 0);
  b.box('plasticGrey', 0.88, 0.1, 0.62, 0, 0.9, 0);
  b.box('plastic', 0.6, 0.04, 0.5, 0, 0.97, 0);
  b.box('plasticGrey', 0.3, 0.08, 0.2, -0.25, 0.95, 0.24, -0.4);
  b.box('screenOff', 0.18, 0.1, 0.01, -0.25, 0.96, 0.33, -0.4);
  for (let i = 0; i < 3; i++) b.box('plasticGrey', 0.8, 0.01, 0.005, 0, 0.2 + i * 0.2, 0.326);
  b.box('paper', 0.32, 0.03, 0.22, 0.48, 0.6, 0);
  b.collider(-0.6, -0.33, 0.6, 0.33);
}

export function serverRack(b, seed = 0) {
  b.ao(0.6, 1.0);
  const w = 0.6, d = 1.0, h = 2.0;
  b.box('plastic', w, h, d, 0, h / 2, 0);
  b.box('metalDark', w - 0.04, h - 0.1, 0.02, 0, h / 2, d / 2 + 0.005);
  const r = rng(seed + 7);
  for (let u = 0; u < 16; u++) {
    const y = 0.2 + u * 0.105;
    b.box('plasticGrey', w - 0.1, 0.085, 0.01, 0, y, d / 2 + 0.02);
    for (let k = 0; k < 4; k++) {
      const v = r();
      b.box(v > 0.7 ? 'ledBlue' : v > 0.15 ? 'ledGreen' : 'ledAmber', 0.012, 0.012, 0.01, -w / 2 + 0.09 + k * 0.03, y + 0.02, d / 2 + 0.03);
    }
  }
  b.collider(-w / 2, -d / 2, w / 2, d / 2 + 0.05);
}

// Kitchen counter run along local X; backs onto a wall at -Z.
export function kitchenRun(b, len, { sink = true, upper = true } = {}) {
  b.ao(len, 0.62);
  const d = 0.62;
  const units = Math.round(len / 0.6);
  for (let i = 0; i < units; i++) {
    const x = -len / 2 + 0.3 + i * (len / units);
    b.box('cabinetWhite', len / units - 0.01, 0.78, d - 0.04, x, 0.47, 0);
    b.box('aluminium', 0.12, 0.015, 0.02, x, 0.78, d / 2 - 0.005);
    if (upper) {
      b.box('cabinetWhite', len / units - 0.01, 0.7, 0.34, x, 1.85, -d / 2 + 0.17);
      b.box('aluminium', 0.015, 0.12, 0.02, x + 0.2, 1.62, -d / 2 + 0.35);
    }
  }
  b.box('rubber', len, 0.08, d - 0.08, 0, 0.04, -0.02);
  b.box('countertop', len + 0.02, 0.04, d, 0, 0.88, 0);
  b.box('ceramic', len, 0.5, 0.01, 0, 1.15, -d / 2 + 0.005); // splashback
  if (upper) b.box('lightPanel', len - 0.1, 0.01, 0.06, 0, 1.495, -d / 2 + 0.3);
  if (sink) {
    b.box('steel', 0.5, 0.02, 0.4, len / 2 - 0.6, 0.905, 0.02);
    b.box('metalDark', 0.42, 0.01, 0.32, len / 2 - 0.6, 0.91, 0.02);
    b.cyl('steel', 0.015, 0.015, 0.3, len / 2 - 0.6, 1.05, -0.22, 8);
    b.cyl('steel', 0.012, 0.012, 0.2, len / 2 - 0.6, 1.19, -0.13, 8, Math.PI / 2);
  }
  b.collider(-len / 2, -d / 2, len / 2, d / 2);
}

export function fridge(b) {
  b.ao(0.75, 0.7);
  b.box('steel', 0.75, 1.85, 0.7, 0, 0.925, 0);
  b.box('metalDark', 0.74, 0.01, 0.005, 0, 1.2, 0.351);
  b.box('aluminium', 0.03, 0.5, 0.04, -0.3, 1.5, 0.37);
  b.box('aluminium', 0.03, 0.35, 0.04, -0.3, 0.85, 0.37);
  b.collider(-0.38, -0.35, 0.38, 0.35);
}

export function microwave(b) {
  b.box('plastic', 0.5, 0.3, 0.38, 0, 0.15, 0);
  b.box('screenOff', 0.32, 0.22, 0.01, -0.06, 0.15, 0.191);
  b.box('plasticGrey', 0.1, 0.22, 0.01, 0.18, 0.15, 0.191);
}

export function coffeeMachine(b) {
  b.box('plastic', 0.3, 0.42, 0.38, 0, 0.21, 0);
  b.box('steel', 0.22, 0.05, 0.2, 0, 0.03, 0.12);
  b.cyl('ceramic', 0.04, 0.035, 0.09, 0, 0.1, 0.12, 12);
}

export function roundTable(b, r = 0.55) {
  b.ao(0.5, 0.5);
  b.cyl('laminateWhite', r, r, 0.035, 0, 0.74, 0, 28);
  b.cyl('metalDark', 0.04, 0.04, 0.7, 0, 0.37, 0, 10);
  b.cyl('metalDark', 0.28, 0.3, 0.03, 0, 0.015, 0, 20);
  b.collider(-r, -r, r, r);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    simpleChair(b.at(Math.sin(a) * (r + 0.35), 0, Math.cos(a) * (r + 0.35), a), 'fabricTeal');
  }
}

export function vendingMachine(b) {
  b.ao(0.9, 0.8);
  b.box('red', 0.9, 1.85, 0.8, 0, 0.925, 0);
  b.box('glass', 0.6, 1.3, 0.01, -0.1, 1.1, 0.405);
  b.box('plasticWhite', 0.58, 1.28, 0.6, -0.1, 1.1, 0.1);
  for (let i = 0; i < 6; i++) b.box(i % 2 ? 'bookBlue' : 'yellow', 0.56, 0.06, 0.1, -0.1, 0.55 + i * 0.21, 0.36);
  b.box('screenOff', 0.15, 0.25, 0.01, 0.32, 1.3, 0.405);
  b.collider(-0.45, -0.4, 0.45, 0.4);
}

// ---------- wall items (front faces +Z, back against the wall) ----------
export function wallTV(b, w = 1.6) {
  const h = w * 0.5625;
  b.box('plastic', w, h, 0.05, 0, 0, 0.03);
  b.geo('screen2', plane(w - 0.04, h - 0.04), 0, 0, 0.056);
}

export function whiteboard(b, w = 2.0, h = 1.1) {
  b.box('aluminium', w + 0.04, h + 0.04, 0.025, 0, 0, 0.0125);
  b.geo('whiteboard', plane(w, h), 0, 0, 0.027);
  b.box('aluminium', w * 0.6, 0.03, 0.06, 0, -h / 2 - 0.03, 0.04);
}

export function noticeBoard(b, w = 1.2, h = 0.9) {
  b.box('woodLight', w + 0.05, h + 0.05, 0.02, 0, 0, 0.01);
  b.box('bark', w, h, 0.01, 0, 0, 0.022);
  const cols = ['paper', 'yellow', 'bookBeige', 'plasticWhite'];
  for (let i = 0; i < 7; i++) b.box(cols[i % 4], 0.18 + R() * 0.1, 0.22 + R() * 0.08, 0.004, (R() - 0.5) * (w - 0.3), (R() - 0.5) * (h - 0.3), 0.03, 0, 0, (R() - 0.5) * 0.2);
}

export function wallArt(b, w = 1.2, h = 0.8, mat = 'wallAccent') {
  b.box('metalDark', w + 0.06, h + 0.06, 0.03, 0, 0, 0.015);
  b.box(mat, w, h, 0.01, 0, 0, 0.033);
  b.box('bookBeige', w * 0.4, h * 0.35, 0.005, -w * 0.15, h * 0.12, 0.04);
  b.box('yellow', w * 0.15, w * 0.15, 0.005, w * 0.25, -h * 0.18, 0.04);
}

// ---------- exterior ----------
export function tree(b, s = 1) {
  b.ao(1.6 * s, 1.6 * s);
  b.cyl('bark', 0.11 * s, 0.17 * s, 2.4 * s, 0, 1.2 * s, 0, 10);
  // forked limbs
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + R();
    b.cyl('bark', 0.05 * s, 0.09 * s, 1.3 * s, Math.sin(a) * 0.3 * s, 2.8 * s, Math.cos(a) * 0.3 * s, 8, Math.cos(a) * 0.5, -Math.sin(a) * 0.5);
  }
  // canopy built from many smooth overlapping lobes
  const mats = ['canopy', 'canopyDark', 'canopyLight'];
  for (let i = 0; i < 16; i++) {
    const a = R() * Math.PI * 2, r = (0.3 + R() * 1.1) * s, y = (3.0 + R() * 1.6) * s;
    const rad = (0.65 + R() * 0.45) * s * (1 - (r / s) * 0.18);
    b.sphere(mats[i % 3], rad, Math.sin(a) * r, y, Math.cos(a) * r, 1, 0.85, 1, 1);
  }
  b.collider(-0.25 * s, -0.25 * s, 0.25 * s, 0.25 * s);
}

export function bench(b) {
  b.ao(1.6, 0.5);
  for (let i = 0; i < 4; i++) b.box('woodLight', 1.6, 0.04, 0.09, 0, 0.45, -0.18 + i * 0.12);
  for (const sx of [-0.65, 0.65]) {
    b.box('metalDark', 0.05, 0.45, 0.45, sx, 0.225, 0);
  }
  b.collider(-0.8, -0.25, 0.8, 0.25);
}

export function lampPost(b) {
  b.cyl('metalDark', 0.06, 0.08, 4.2, 0, 2.1, 0, 10);
  b.box('metalDark', 0.6, 0.08, 0.2, 0.25, 4.2, 0);
  b.box('lightPanel', 0.45, 0.02, 0.15, 0.3, 4.15, 0);
  b.collider(-0.1, -0.1, 0.1, 0.1);
}

export function car(b, paint = 'carPaint') {
  b.ao(1.9, 4.3);
  b.box(paint, 1.8, 0.6, 4.3, 0, 0.55, 0);
  b.box(paint, 1.6, 0.5, 2.3, 0, 1.08, -0.2);
  b.box('carGlass', 1.62, 0.38, 2.1, 0, 1.1, -0.2);
  for (const sx of [-1, 1]) for (const sz of [-1.35, 1.35]) b.cyl('rubber', 0.34, 0.34, 0.24, sx * 0.82, 0.34, sz, 16, 0, Math.PI / 2);
  b.box('lightPanel', 0.3, 0.1, 0.02, -0.6, 0.65, 2.16);
  b.box('lightPanel', 0.3, 0.1, 0.02, 0.6, 0.65, 2.16);
  b.collider(-0.95, -2.2, 0.95, 2.2);
}
