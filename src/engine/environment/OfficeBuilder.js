// Builds the complete office level: structure, furniture, fixtures, equipment and exterior.
import * as THREE from 'three';
import { Batcher, Builder } from './Batcher.js';
import * as F from './furniture.js';
import { createExtinguisherStation, createCallPoint } from './equipment.js';
import { screenTexture, signTexture, radialDecal } from './textures.js';
import { evacPlanTexture } from './signage.js';
import {
  WALL_H, WALL_T, DOOR_H, BUILDING, ROOMS, WALLS, DOORS, EXITS, EXTINGUISHERS, CALL_POINTS,
} from './layout.js';

export function buildOffice(materials, collision) {
  const { m } = materials;
  // extra materials: monitor screens + signs
  for (let i = 0; i < 4; i++) {
    m[`screen${i}`] = new THREE.MeshBasicMaterial({ map: screenTexture(i), color: '#d8d8d8' });
    materials.meta[`screen${i}`] = { worldUV: null, shadow: false };
  }
  const signMat = (tex) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  m.exitSign = signMat(signTexture('exit'));
  m.exitSignL = signMat(signTexture('exit', { arrow: 'left' }));
  m.exitSignR = signMat(signTexture('exit', { arrow: 'right' }));
  m.logo = new THREE.MeshBasicMaterial({ map: signTexture('logo'), transparent: true });
  for (const k of ['exitSign', 'exitSignL', 'exitSignR', 'logo']) materials.meta[k] = { worldUV: null, shadow: false };

  const batcher = new Batcher(materials);
  const root = new Builder(batcher, collision);
  const noCol = new Builder(batcher, null);
  const group = new THREE.Group();
  group.name = 'Office';

  const wallLines = []; // for the minimap
  const avoidWindows = [...EXTINGUISHERS, ...CALL_POINTS].map((e) => e.pos);

  // ---------------- structure ----------------
  for (const wall of WALLS) buildWallRun(wall);

  function place(b, mat, axis, at, s, e, y0, y1, thick = WALL_T, offset = 0) {
    const len = e - s, h = y1 - y0;
    if (len <= 0.001 || h <= 0.001) return;
    if (axis === 'x') b.box(mat, len, h, thick, (s + e) / 2, (y0 + y1) / 2, at + offset);
    else b.box(mat, thick, h, len, at + offset, (y0 + y1) / 2, (s + e) / 2);
  }
  function addCollider(axis, at, s, e, tag = 'wall') {
    const t = WALL_T / 2;
    if (axis === 'x') collision.add(s, at - t, e, at + t, tag);
    else collision.add(at - t, s, at + t, e, tag);
  }

  function buildWallRun(wall) {
    const { axis, at, from, to, kind } = wall;
    const gaps = (wall.gaps || []).slice().sort((a, b) => a.from - b.from);
    const solids = [];
    let cur = from;
    for (const g of gaps) { solids.push([cur, g.from]); cur = g.to; }
    solids.push([cur, to]);
    const outward = kind === 'exterior' ? (at === (axis === 'x' ? BUILDING.z0 : BUILDING.x0) ? -1 : 1) : 0;

    for (let [s, e] of solids) {
      if (e - s < 0.01) continue;
      const s2 = s === from ? s - WALL_T / 2 : s;
      const e2 = e === to ? e + WALL_T / 2 : e;
      addCollider(axis, at, s2, e2);
      wallLines.push({ axis, at, s: s2, e: e2, kind });
      if (kind === 'glass') glassRun(axis, at, s, e);
      else if (kind === 'exterior') exteriorRun(axis, at, s2, e2, outward, wall.junctions || []);
      else {
        place(noCol, 'wall', axis, at, s2, e2, 0, WALL_H);
        place(noCol, 'baseboard', axis, at, s2, e2, 0, 0.1, WALL_T + 0.025);
        aoStrips(axis, at, s2, e2, [1, -1]);
      }
    }
    for (const g of gaps) {
      const top = g.type === 'door' ? DOOR_H : g.type === 'exit' ? 2.35 : 2.45;
      if (kind === 'glass') {
        place(noCol, 'aluminium', axis, at, g.from, g.to, top, top + 0.06, 0.08);
        place(noCol, 'glass', axis, at, g.from, g.to, top + 0.06, WALL_H, 0.02);
      } else {
        place(noCol, kind === 'exterior' ? 'exterior' : 'wall', axis, at, g.from, g.to, top, WALL_H);
      }
      if (g.type === 'door' || g.type === 'exit') {
        const frameMat = g.type === 'exit' ? 'aluminium' : 'woodDark';
        place(noCol, frameMat, axis, at, g.from - 0.05, g.from, 0, top, WALL_T + 0.04);
        place(noCol, frameMat, axis, at, g.to, g.to + 0.05, 0, top, WALL_T + 0.04);
        place(noCol, frameMat, axis, at, g.from - 0.05, g.to + 0.05, top, top + 0.05, WALL_T + 0.04);
      }
      if (g.type === 'exit') buildExit(g, axis, at, outward);
      wallLines.push({ axis, at, s: g.from, e: g.to, kind: g.type, id: g.id });
    }
  }

  // Approximated ambient occlusion where walls meet the floor and ceiling (both are dark gradients).
  function aoStrips(axis, at, s, e, sides) {
    const len = e - s;
    if (len < 0.1) return;
    const mid = (s + e) / 2;
    for (const sg of sides) {
      const psi = axis === 'x' ? (sg > 0 ? 0 : Math.PI) : (sg * Math.PI) / 2;
      const pos = (off) => (axis === 'x' ? [mid, at + sg * off] : [at + sg * off, mid]);
      const [wx, wz] = pos(WALL_T / 2 + 0.006);
      noCol.at(wx, 0.42, wz, psi).edge('aoWall', len, 0.64, 0, 0, 0, 0, 0, Math.PI);
      noCol.at(wx, 2.77, wz, psi).edge('aoCeil', len, 0.46, 0, 0, 0);
      const [fx, fz] = pos(WALL_T / 2 + 0.0125 + 0.24);
      noCol.at(fx, 0.01, fz, psi).edge('aoFloor', len, 0.48, 0, 0, 0, -Math.PI / 2);
    }
  }

  function glassRun(axis, at, s, e) {
    place(noCol, 'glass', axis, at, s, e, 0.05, WALL_H - 0.05, 0.02);
    place(noCol, 'aluminium', axis, at, s, e, 0, 0.06, 0.08);
    place(noCol, 'aluminium', axis, at, s, e, WALL_H - 0.06, WALL_H, 0.08);
    place(noCol, 'frosted', axis, at, s, e, 1.0, 1.35, 0.025);
    const n = Math.max(1, Math.round((e - s) / 1.5));
    for (let i = 0; i <= n; i++) {
      const p = s + ((e - s) * i) / n;
      place(noCol, 'aluminium', axis, at, p - 0.03, p + 0.03, 0, WALL_H, 0.08);
    }
  }

  function exteriorRun(axis, at, s, e, outward, junctions) {
    const sillY = 0.9, headY = 2.45, ww = 1.7;
    const centres = [];
    for (let c = s + 1.2; c + ww / 2 <= e - 0.5; c += 2.7) {
      const nearJ = junctions.some((j) => Math.abs(j - c) < ww / 2 + 0.35);
      const nearEq = avoidWindows.some(([x, z]) => {
        const along = axis === 'x' ? x : z, across = axis === 'x' ? z : x;
        return Math.abs(across - at) < 0.4 && Math.abs(along - c) < ww / 2 + 0.4;
      });
      if (!nearJ && !nearEq) centres.push(c);
    }
    const solid = (a, b, y0, y1) => {
      place(noCol, 'wall', axis, at, a, b, y0, y1, WALL_T);
      place(noCol, 'exterior', axis, at, a, b, y0, y1, 0.06, outward * (WALL_T / 2 + 0.03));
    };
    if (!centres.length) {
      solid(s, e, 0, WALL_H);
    } else {
      // continuous bands below the sills and above the heads; piers only within the window band,
      // so every joint is hidden behind an aluminium sill/head (no hairline cracks at T-junctions)
      solid(s, e, 0, sillY);
      solid(s, e, headY, WALL_H);
      let cur = s;
      for (const c of centres) {
        const a = c - ww / 2, b = c + ww / 2;
        solid(cur, a, sillY, headY);
        place(noCol, 'windowGlass', axis, at, a, b, sillY, headY, 0.02);
        place(noCol, 'aluminium', axis, at, a, b, sillY - 0.04, sillY, WALL_T + 0.1); // sill
        place(noCol, 'aluminium', axis, at, a, b, headY, headY + 0.04, WALL_T + 0.02);
        for (const p of [a, c, b]) place(noCol, 'aluminium', axis, at, p - 0.025, p + 0.025, sillY, headY, WALL_T + 0.02);
        place(noCol, 'aluminium', axis, at, a, b, 1.75, 1.78, 0.05);
        cur = b;
      }
      solid(cur, e, sillY, headY);
    }
    place(noCol, 'baseboard', axis, at, s, e, 0, 0.1, WALL_T + 0.025);
    aoStrips(axis, at, s, e, [-outward]);
  }

  // Exit doorway: double leaves propped open outward + exterior canopy + illuminated sign.
  // Door leaf standing open, perpendicular to a wall running along `axis` (so it spans the other axis).
  function glazedLeaf(axis, cx, cz, len) {
    const B = (w, h, d, x, y, z, mat = 'aluminium') => (axis === 'x' ? noCol.box(mat, w, h, d, cx + x, y, cz + z) : noCol.box(mat, d, h, w, cx + z, y, cz + x));
    B(0.05, 0.1, len, 0, 2.2, 0);
    B(0.05, 0.22, len, 0, 0.11, 0);
    B(0.05, 2.25, 0.08, 0, 1.125, -len / 2 + 0.04);
    B(0.05, 2.25, 0.08, 0, 1.125, len / 2 - 0.04);
    B(0.012, 1.93, len - 0.16, 0, 1.185, 0, 'glass');
    B(0.035, 0.045, len - 0.3, 0.05, 1.0, 0, 'steel');
    B(0.035, 0.045, len - 0.3, -0.05, 1.0, 0, 'steel');
  }

  function buildExit(g, axis, at, outward) {
    const w = g.to - g.from, mid = (g.from + g.to) / 2;
    const leafW = w / 2 - 0.02;
    for (const side of [-1, 1]) {
      const hinge = side < 0 ? g.from + 0.03 : g.to - 0.03;
      // leaf swung 90° outward, lying against the outside face
      const off = outward * (WALL_T / 2 + leafW / 2 + 0.02);
      if (axis === 'x') {
        glazedLeaf('x', hinge + side * -0.04, at + off, leafW);
        collision.add(hinge - 0.08, Math.min(at + outward * 0.1, at + outward * (leafW + 0.15)), hinge + 0.08, Math.max(at + outward * 0.1, at + outward * (leafW + 0.15)), 'furniture');
      } else {
        glazedLeaf('z', at + off, hinge + side * -0.04, leafW);
        collision.add(Math.min(at + outward * 0.1, at + outward * (leafW + 0.15)), hinge - 0.08, Math.max(at + outward * 0.1, at + outward * (leafW + 0.15)), hinge + 0.08, 'furniture');
      }
    }
    // canopy outside
    const cOff = outward * 1.0;
    if (axis === 'x') noCol.box('metalDark', w + 1.2, 0.12, 2.0, mid, 2.7, at + cOff);
    else noCol.box('metalDark', 2.0, 0.12, w + 1.2, at + cOff, 2.7, mid);
    // illuminated sign above the opening, inside face
    const inward = -outward;
    const signPos = axis === 'x' ? [mid, 2.62, at + inward * (WALL_T / 2 + 0.035)] : [at + inward * (WALL_T / 2 + 0.035), 2.62, mid];
    const yaw = axis === 'x' ? (inward > 0 ? 0 : Math.PI) : (inward > 0 ? Math.PI / 2 : -Math.PI / 2);
    exitSign(signPos, yaw, 'exitSign');
  }

  function exitSign([x, y, z], yaw, mat) {
    const b = noCol.at(x, y, z, yaw);
    b.box('plasticWhite', 0.46, 0.2, 0.05, 0, 0, -0.02);
    b.geo(mat, new THREE.PlaneGeometry(0.42, 0.158), 0, 0, 0.006);
  }

  // ---------------- floors, ceilings, roof ----------------
  for (const r of ROOMS) {
    noCol.box(r.floor, r.x1 - r.x0, 0.02, r.z1 - r.z0, (r.x0 + r.x1) / 2, -0.01, (r.z0 + r.z1) / 2);
    noCol.box('ceiling', r.x1 - r.x0, 0.02, r.z1 - r.z0, (r.x0 + r.x1) / 2, WALL_H + 0.01, (r.z0 + r.z1) / 2);
  }
  noCol.box('roof', BUILDING.x1 + 0.6, 0.45, BUILDING.z1 + 0.6, BUILDING.x1 / 2, WALL_H + 0.25, BUILDING.z1 / 2);
  noCol.box('exterior', BUILDING.x1 + 0.7, 0.35, 0.15, BUILDING.x1 / 2, WALL_H + 0.55, -0.3);
  noCol.box('exterior', BUILDING.x1 + 0.7, 0.35, 0.15, BUILDING.x1 / 2, WALL_H + 0.55, BUILDING.z1 + 0.3);
  noCol.box('exterior', 0.15, 0.35, BUILDING.z1 + 0.7, -0.3, WALL_H + 0.55, BUILDING.z1 / 2);
  noCol.box('exterior', 0.15, 0.35, BUILDING.z1 + 0.7, BUILDING.x1 + 0.3, WALL_H + 0.55, BUILDING.z1 / 2);

  // ceiling light panels + smoke detectors + alarm strobes
  const lightPoints = [];
  for (const r of ROOMS) {
    if (r.id === 'corridor') {
      for (let x = 2; x < 40; x += 3) {
        noCol.box('fixture', 1.24, 0.03, 0.34, x, WALL_H - 0.012, 11.5);
        noCol.box('lightPanel', 1.2, 0.01, 0.3, x, WALL_H - 0.03, 11.5);
      }
      continue;
    }
    const nx = Math.max(1, Math.round((r.x1 - r.x0) / 2.6)), nz = Math.max(1, Math.round((r.z1 - r.z0) / 2.6));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = r.x0 + ((i + 0.5) * (r.x1 - r.x0)) / nx, z = r.z0 + ((j + 0.5) * (r.z1 - r.z0)) / nz;
      noCol.box('fixture', 0.64, 0.03, 0.64, x, WALL_H - 0.012, z);
      noCol.box('lightPanel', 0.6, 0.01, 0.6, x, WALL_H - 0.03, z);
    }
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    lightPoints.push([cx, cz]);
    noCol.cyl('smokeDetector', 0.07, 0.08, 0.04, cx + 0.9, WALL_H - 0.02, cz + 0.4, 16);
  }
  for (let x = 5; x < 40; x += 10) noCol.cyl('smokeDetector', 0.07, 0.08, 0.04, x, WALL_H - 0.02, 11.5, 16);

  const strobes = [
    [6, 10.12, 0], [18, 10.12, 0], [34, 10.12, 0], [12, 12.88, Math.PI], [30.5, 12.88, Math.PI],
    [0.12, 2.0, Math.PI / 2], [21.88, 3.0, -Math.PI / 2], [30.88, 7.5, -Math.PI / 2], [39.88, 3.0, -Math.PI / 2],
    [0.12, 20, Math.PI / 2], [25.88, 19.0, -Math.PI / 2], [30.88, 15.5, -Math.PI / 2], [39.88, 21.0, -Math.PI / 2], [12.12, 8.0, Math.PI / 2],
  ];
  for (const [x, z, yaw] of strobes) {
    const b = noCol.at(x, 2.45, z, yaw);
    b.box('plasticWhite', 0.12, 0.16, 0.04, 0, 0, 0.02);
    b.box('strobe', 0.08, 0.1, 0.04, 0, 0, 0.05);
  }

  // ---------------- furniture ----------------
  const screens = ['screen0', 'screen1', 'screen2', 'screen3'];

  // Reception
  F.receptionDesk(root.at(9.3, 0, 4.4, -Math.PI / 2));
  noCol.box('wallAccent', 0.02, WALL_H - 0.12, 8, 11.89, (WALL_H - 0.12) / 2 + 0.1, 4.6);
  noCol.geo('logo', new THREE.PlaneGeometry(2.6, 1.3), 11.87, 1.95, 4.4, 0, -Math.PI / 2, 0);
  F.sofa(root.at(4.0, 0, 0.6), 2.2, 'fabricGrey');
  F.coffeeTable(root.at(4.0, 0, 1.75));
  F.sofa(root.at(1.0, 0, 1.9, Math.PI / 2), 1.6, 'fabricTeal');
  F.plant(root.at(6.6, 0, 0.5), 1.2);
  F.plant(root.at(0.5, 0, 9.5), 1.1);
  F.plant(root.at(11.4, 0, 0.6), 1.2);
  F.waterCooler(root.at(11.6, 0, 9.4));
  F.wallArt(noCol.at(8.5, 1.7, 0.11), 1.6, 0.9, 'wallAccent');

  // Finance office
  F.desk(root.at(14.6, 0, 0.6), { screen: 'screen1', variant: 1 });
  F.desk(root.at(19.4, 0, 0.6), { screen: 'screen3', variant: 2 });
  F.bookshelf(root.at(21.7, 0, 6.2, -Math.PI / 2), 1.0, 2.0);
  F.bookshelf(root.at(21.7, 0, 7.25, -Math.PI / 2), 1.0, 2.0);
  F.filingCabinet(root.at(21.6, 0, 4.0, -Math.PI / 2));
  F.filingCabinet(root.at(21.6, 0, 4.55, -Math.PI / 2));
  F.roundTable(root.at(14.4, 0, 6.6));
  F.whiteboard(noCol.at(12.11, 1.5, 5.0, Math.PI / 2));
  F.plant(root.at(12.6, 0, 9.4));
  F.trashBin(root.at(16.0, 0, 0.4));

  // Conference
  F.conferenceTable(root.at(26.4, 0, 5.0), 4.2, 1.4);
  F.wallTV(noCol.at(30.89, 1.55, 5.0, -Math.PI / 2), 1.9);
  F.whiteboard(noCol.at(26.4, 1.5, 0.11), 2.4, 1.2);
  root.at(30.45, 0, 1.4, -Math.PI / 2).box('woodDark', 1.6, 0.75, 0.5, 0, 0.375, 0);
  root.at(30.45, 0, 1.4, -Math.PI / 2).collider(-0.8, -0.25, 0.8, 0.25);
  F.plant(root.at(22.6, 0, 0.6));
  F.plant(root.at(30.4, 0, 9.3));

  // Director's office
  F.execDesk(root.at(35.3, 0, 1.9));
  F.sofa(root.at(38.95, 0, 6.0, -Math.PI / 2), 2.0, 'leather');
  F.coffeeTable(root.at(37.6, 0, 6.0, Math.PI / 2), 1.0, 0.55);
  F.bookshelf(root.at(31.3, 0, 3.0, Math.PI / 2), 1.0, 2.1);
  F.bookshelf(root.at(31.3, 0, 4.05, Math.PI / 2), 1.0, 2.1);
  F.plant(root.at(31.6, 0, 9.3), 1.2);
  F.plant(root.at(39.4, 0, 0.6), 1.2);
  F.wallArt(noCol.at(35.3, 1.75, 9.89, Math.PI), 1.4, 0.9, 'fabricTeal');

  // Corridor
  F.noticeBoard(noCol.at(10.5, 1.55, 10.11));
  F.copier(root.at(24.5, 0, 12.55, Math.PI));
  F.recycleStation(root.at(36.5, 0, 12.65, Math.PI));
  F.waterCooler(root.at(14.2, 0, 12.7));
  F.plant(root.at(0.55, 0, 12.4));
  F.plant(root.at(33.6, 0, 12.5));
  {
    const b = root.at(26.5, 0, 10.4);
    b.box('bookBeige', 0.6, 0.4, 0.4, 0, 0.2, 0);
    b.box('bookBeige', 0.5, 0.35, 0.38, 0.05, 0.575, 0.0, 0, 0.1, 0);
    b.box('bookBeige', 0.45, 0.4, 0.35, 0.6, 0.2, 0.02, 0, -0.15, 0);
    b.collider(-0.3, -0.2, 0.85, 0.2);
  }

  // Open plan
  F.workIsland(root.at(10.0, 0, 16.0), 5, screens, 0);
  F.workIsland(root.at(13.5, 0, 21.0), 4, screens, 3);
  for (let i = 0; i < 4; i++) F.desk(root.at(0.55, 0, 15.6 + i * 1.5, Math.PI / 2), { screen: screens[i % 4], variant: i + 7, pedestal: false });
  F.copier(root.at(16.9, 0, 23.55, Math.PI));
  F.filingCabinet(root.at(14.9, 0, 23.6, Math.PI));
  F.filingCabinet(root.at(14.4, 0, 23.6, Math.PI));
  F.bookshelf(root.at(4.0, 0, 23.7, Math.PI), 1.2, 1.2);
  F.plant(root.at(0.6, 0, 23.4), 1.2);
  F.plant(root.at(11.0, 0, 23.4), 1.2);
  F.plant(root.at(17.4, 0, 13.6));
  F.whiteboard(noCol.at(17.89, 1.5, 19.0, -Math.PI / 2), 2.0, 1.1);

  // Break room
  F.kitchenRun(root.at(25.59, 0, 18.5, -Math.PI / 2), 6.0);
  F.fridge(root.at(25.55, 0, 22.5, -Math.PI / 2));
  F.vendingMachine(root.at(25.45, 0, 14.2, -Math.PI / 2));
  F.microwave(noCol.at(25.6, 0.9, 16.4, -Math.PI / 2));
  F.coffeeMachine(noCol.at(25.65, 0.9, 17.2, -Math.PI / 2));
  F.roundTable(root.at(20.2, 0, 21.0));
  F.roundTable(root.at(20.2, 0, 17.6));
  F.recycleStation(root.at(19.0, 0, 13.4));
  F.plant(root.at(18.5, 0, 23.4));
  F.wallTV(noCol.at(18.11, 1.9, 19.3, Math.PI / 2), 1.2);

  // Server & print
  for (let i = 0; i < 7; i++) F.serverRack(root.at(26.62, 0, 17.4 + i * 0.62, Math.PI / 2), i);
  for (let i = 0; i < 6; i++) F.serverRack(root.at(30.38, 0, 18.0 + i * 0.62, -Math.PI / 2), i + 10);
  F.bookshelf(root.at(30.7, 0, 15.2, -Math.PI / 2), 1.2, 1.8);
  F.copier(root.at(26.5, 0, 14.6, Math.PI / 2));
  noCol.box('metalDark', 0.3, 0.06, 6.0, 28.5, 2.75, 19.5); // cable tray

  // HR office
  F.desk(root.at(36.5, 0, 20.0), { screen: 'screen3', variant: 4 });
  F.simpleChair(root.at(36.1, 0, 18.8, Math.PI), 'fabricTeal');
  F.simpleChair(root.at(37.0, 0, 18.8, Math.PI), 'fabricTeal');
  for (let i = 0; i < 4; i++) F.filingCabinet(root.at(39.6, 0, 15.0 + i * 0.5, -Math.PI / 2));
  F.bookshelf(root.at(31.3, 0, 20.0, Math.PI / 2), 1.2, 2.0);
  F.plant(root.at(39.4, 0, 23.4), 1.2);
  F.plant(root.at(31.6, 0, 13.6));
  F.wallArt(noCol.at(36.0, 1.75, 23.89, Math.PI), 1.4, 0.9, 'fabricBlue');

  // Room name plates beside doors (corridor side)
  const roomSign = (label, x, z, yaw, backing = true) => {
    const key = `roomSign:${label}`;
    m[key] = new THREE.MeshStandardMaterial({ map: signTexture('room', { label }), roughness: 0.35 });
    materials.meta[key] = { worldUV: null, shadow: false };
    const b = noCol.at(x, 1.55, z, yaw);
    if (backing) b.box('aluminium', 0.43, 0.23, 0.012, 0, 0, 0.006);
    b.plane(key, 0.4, 0.2, 0, 0, backing ? 0.0125 : 0.012);
  };
  roomSign('FINANCE', 17.45, 10.1, 0);
  roomSign('DIRECTOR', 33.45, 10.1, 0);
  roomSign('CONFERENCE', 24.6, 10.0, 0, false);
  roomSign('KITCHEN', 22.45, 12.9, Math.PI);
  roomSign('SERVER ROOM', 29.42, 12.9, Math.PI);
  roomSign('HR', 35.45, 12.9, Math.PI);

  // Fire evacuation plans ("You are here")
  const plan = (x, z, yaw, idx) => {
    const key = `evacPlan${idx}`;
    m[key] = new THREE.MeshStandardMaterial({ map: evacPlanTexture([x, z]), roughness: 0.3 });
    materials.meta[key] = { worldUV: null, shadow: false };
    const b = noCol.at(x, 1.55, z, yaw);
    b.box('plastic', 0.68, 0.54, 0.02, 0, 0, 0.01);
    b.plane(key, 0.64, 0.5, 0, 0, 0.0205);
  };
  plan(13.3, 10.1, 0, 0);
  plan(32.4, 12.9, Math.PI, 1);
  plan(0.1, 2.65, Math.PI / 2, 2);
  plan(17.9, 22.3, -Math.PI / 2, 3);
  plan(23.8, 13.1, 0, 4);

  // HVAC supply grilles and wall clocks
  for (const r of ROOMS) {
    if (r.id === 'corridor') continue;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    noCol.plane('grille', 0.6, 0.6, cx - 1.3, WALL_H - 0.006, cz + 1.3, Math.PI / 2);
    if (r.x1 - r.x0 > 8) noCol.plane('grille', 0.6, 0.6, cx + 1.3, WALL_H - 0.006, cz - 1.3, Math.PI / 2);
  }
  for (let x = 8; x < 40; x += 12) noCol.plane('grille', 0.6, 0.6, x, WALL_H - 0.006, 11.5, Math.PI / 2);
  for (const [x, z, yaw] of [[18.11, 16.2, Math.PI / 2], [22.11, 7.6, Math.PI / 2], [10.5, 10.1, 0]]) {
    const b = noCol.at(x, x === 10.5 ? 2.45 : 2.25, z, yaw);
    b.cyl('plastic', 0.17, 0.17, 0.04, 0, 0, 0.02, 24, Math.PI / 2);
    b.plane('clock', 0.31, 0.31, 0, 0, 0.041);
  }

  // Exit signs (in addition to the ones over each exit)
  exitSign([6.25, 2.7, 10.11], 0, 'exitSignL');
  exitSign([14.0, 2.7, 10.11], 0, 'exitSignL');
  exitSign([25.4, 2.7, 12.89], Math.PI, 'exitSignL');
  exitSign([36.0, 2.7, 12.89], Math.PI, 'exitSignL');
  exitSign([6.0, 2.7, 13.11], 0, 'exitSignR');

  // ---------------- exterior ----------------
  noCol.box('grass', 160, 0.02, 120, 20, -0.06, 12);
  noCol.box('paving', 64, 0.02, 42, 20, -0.03, 12);
  noCol.box('asphalt', 34, 0.02, 8, 22, -0.02, -9);
  for (let x = 8; x < 38; x += 3) noCol.box('paper', 0.1, 0.01, 4, x, -0.005, -9);
  const cars = [[9.5, 'carPaint'], [15.5, 'carPaint2'], [21.5, 'carPaint'], [30.5, 'carPaint2']];
  for (const [x, p] of cars) F.car(root.at(x, 0, -9), p);
  const trees = [[-10, -4], [-10, 16], [-10, 28], [50, -4], [50, 20], [50, 30], [2, 32], [20, 32], [34, 32], [-4, -8], [44, -8]];
  trees.forEach(([x, z], i) => F.tree(root.at(x, 0, z), 0.85 + (i % 3) * 0.15));
  for (const [x, z] of [[-4, 0], [-4, 12], [-4, 24], [44, 2], [44, 22], [20, 28], [30, -4]]) F.lampPost(root.at(x, 0, z, x < 0 ? 0 : Math.PI));
  F.bench(root.at(-9, 0, 10, Math.PI / 2));
  F.bench(root.at(26, 0, 29));
  // boundary hedges (keep the player inside the site)
  const hedge = (x0, z0, x1, z1) => {
    noCol.box('hedge', x1 - x0, 1.0, z1 - z0, (x0 + x1) / 2, 0.5, (z0 + z1) / 2);
    noCol.box('hedge', x1 - x0 - 0.2, 0.25, z1 - z0 - 0.2, (x0 + x1) / 2, 1.1, (z0 + z1) / 2);
    collision.add(x0, z0, x1, z1, 'wall');
  };
  hedge(-12.5, -14, -11.5, 34); hedge(51.5, -14, 52.5, 34); hedge(-12.5, -14, 52.5, -13); hedge(-12.5, 33, 52.5, 34);
  // distant buildings (backdrop only, no collision)
  const skyline = [
    [-45, -32, 22, 14, 30, 'facade'], [-40, 18, 14, 26, 22, 'facade2'], [-48, 58, 20, 16, 16, 'facade'], [8, -50, 30, 14, 26, 'facade2'],
    [48, -44, 18, 18, 40, 'facade'], [88, 0, 16, 30, 20, 'facade2'], [84, 44, 22, 16, 30, 'facade'], [30, 78, 36, 14, 18, 'facade2'],
    [-12, 74, 18, 18, 34, 'facade'], [64, 80, 16, 16, 14, 'facade2'], [-30, -60, 18, 18, 18, 'facade2'], [80, -36, 20, 16, 24, 'facade2'],
  ];
  for (const [x, z, w, d, h, mat] of skyline) {
    noCol.box(mat, w, h, d, x, h / 2 - 0.05, z);
    noCol.box('roof', w + 0.4, 0.6, d + 0.4, x, h + 0.25, z);
  }
  noCol.box('asphalt', 220, 0.02, 10, 20, -0.04, -20);
  noCol.box('asphalt', 10, 0.02, 180, -20, -0.041, 12);

  // assembly points
  const assemblyMat = new THREE.MeshBasicMaterial({ map: radialDecal([[0, 'rgba(40,220,110,0.0)'], [0.7, 'rgba(40,220,110,0.25)'], [0.86, 'rgba(40,220,110,0.9)'], [1, 'rgba(40,220,110,0)']]), transparent: true, depthWrite: false });
  for (const [id, ex] of Object.entries(EXITS)) {
    const [x, z] = ex.safe;
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), assemblyMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.02, z);
    group.add(ring);
    const post = noCol.at(x + (id === 'C' ? 2.2 : 0), 0, z + (id === 'C' ? 0 : 2.2), id === 'A' ? Math.PI / 2 : id === 'B' ? -Math.PI / 2 : Math.PI);
    post.cyl('metalDark', 0.04, 0.04, 2.4, 0, 1.2, 0, 8);
    const signM = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: signTexture('assembly', { label: `EXIT ${id}` }), side: THREE.DoubleSide }));
    signM.position.copy(post.worldPoint(0, 2.2, 0.05));
    signM.rotation.y = id === 'A' ? Math.PI / 2 : id === 'B' ? -Math.PI / 2 : Math.PI;
    group.add(signM);
  }

  // ---------------- doors (dynamic) ----------------
  const doors = [];
  const doorWood = m.woodDark;
  for (const wall of WALLS) for (const g of wall.gaps || []) {
    if (g.type !== 'door') continue;
    const cfg = DOORS[g.id];
    const width = g.to - g.from - 0.06;
    const pivot = new THREE.Group();
    pivot.position.set(g.from + 0.03, 0, wall.at);
    const leaf = new THREE.Group();
    if (cfg.style === 'glass') {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(width - 0.12, 1.9, 0.05), m.glass);
      pane.position.set(width / 2, 1.05, 0);
      // hollow frame: use four bars rather than a solid slab
      leaf.add(pane);
      for (const [w, h, x, y] of [[width, 0.06, width / 2, 0.03], [width, 0.06, width / 2, 2.03], [0.06, 2.06, 0.03, 1.03], [0.06, 2.06, width - 0.03, 1.03]]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), m.aluminium);
        bar.position.set(x, y, 0);
        leaf.add(bar);
      }
    } else {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 2.06, 0.045), doorWood);
      slab.position.set(width / 2, 1.03, 0);
      const vision = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.05), m.glass);
      vision.position.set(width - 0.22, 1.35, 0);
      const kick = new THREE.Mesh(new THREE.BoxGeometry(width - 0.04, 0.2, 0.05), m.steel);
      kick.position.set(width / 2, 0.12, 0);
      leaf.add(slab, vision, kick);
    }
    for (const side of [-1, 1]) {
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.02), m.steel);
      lever.position.set(width - 0.12, 1.0, side * 0.05);
      const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), m.steel);
      rose.rotation.x = Math.PI / 2;
      rose.position.set(width - 0.07, 1.0, side * 0.03);
      leaf.add(lever, rose);
    }
    leaf.traverse((o) => { if (o.isMesh) { o.castShadow = o.material !== m.glass; o.receiveShadow = true; } });
    pivot.add(leaf);
    group.add(pivot);
    const openAngle = -cfg.swing * Math.PI / 2 * 0.95;
    const closedCol = collision.add(g.from, wall.at - 0.06, g.to, wall.at + 0.06, 'door', { doorId: g.id });
    const z0 = wall.at, z1 = wall.at + cfg.swing * (width + 0.03);
    const openCol = collision.add(g.from, Math.min(z0, z1), g.from + 0.09, Math.max(z0, z1), 'furniture', { doorId: g.id });
    const door = {
      id: g.id, pivot, leaf, open: cfg.open, angle: cfg.open ? openAngle : 0, openAngle, closedCol, openCol,
      center: [(g.from + g.to) / 2, wall.at], initialOpen: cfg.open,
    };
    closedCol.enabled = !door.open;
    openCol.enabled = door.open;
    pivot.rotation.y = door.angle;
    leaf.traverse((o) => { if (o.isMesh) o.userData.interact = { type: 'door', door }; });
    doors.push(door);
  }

  // ---------------- equipment ----------------
  const extinguishers = EXTINGUISHERS.map((e) => {
    const st = createExtinguisherStation();
    st.position.set(e.pos[0], 0, e.pos[1]);
    st.rotation.y = e.yaw;
    group.add(st);
    const item = { id: e.id, station: st, model: st.userData.extinguisher, pos: e.pos, available: true };
    item.model.traverse((o) => { if (o.isMesh) o.userData.interact = { type: 'extinguisher', item }; });
    return item;
  });
  const callPoints = CALL_POINTS.map((c) => {
    const cp = createCallPoint();
    cp.position.set(c.pos[0], 0, c.pos[1]);
    cp.rotation.y = c.yaw;
    group.add(cp);
    const item = { id: c.id, mesh: cp, pos: c.pos, activated: false };
    cp.traverse((o) => { if (o.isMesh) o.userData.interact = { type: 'alarm', item }; });
    return item;
  });

  group.add(batcher.build());
  return { group, doors, extinguishers, callPoints, wallLines, lightPoints };
}
