// Wall-mounted fire evacuation plans ("You are here"), drawn from the floor-plan data.
import * as THREE from 'three';
import { ROOMS, WALLS, EXITS, EXTINGUISHERS, CALL_POINTS } from './layout.js';

const short = {
  reception: 'RECEPTION', officeA: 'FINANCE', conference: 'CONFERENCE', officeB: 'DIRECTOR', corridor: '',
  openplan: 'OPEN-PLAN OFFICE', kitchen: 'KITCHEN', server: 'SERVER', officeC: 'HR',
};

export function evacPlanTexture(here) {
  const W = 768, H = 600;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  // header
  g.fillStyle = '#0a8f3c';
  g.fillRect(0, 0, W, 64);
  g.fillStyle = '#fff';
  g.font = 'bold 34px Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('FIRE EVACUATION PLAN', 24, 33);
  g.font = 'bold 18px Arial, sans-serif';
  g.textAlign = 'right';
  g.fillText('GROUND FLOOR', W - 24, 33);
  g.textAlign = 'left';
  // plan area: building 40 × 24 m plus a margin for exits/assembly points
  const ox = 70, oy = 110, sc = 14.5;
  const P = (x, z) => [ox + x * sc, oy + z * sc];
  g.fillStyle = '#eef1f3';
  for (const r of ROOMS) {
    const [x0, y0] = P(r.x0, r.z0), [x1, y1] = P(r.x1, r.z1);
    g.fillStyle = r.id === 'corridor' ? '#dfe8d8' : '#eef1f3';
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (short[r.id]) {
      g.fillStyle = '#6b737b';
      g.font = 'bold 13px Arial, sans-serif';
      g.textAlign = 'center';
      g.fillText(short[r.id], (x0 + x1) / 2, (y0 + y1) / 2);
    }
  }
  g.textAlign = 'left';
  // walls (solid parts only)
  g.strokeStyle = '#26292c';
  g.lineCap = 'square';
  for (const w of WALLS) {
    const gaps = (w.gaps || []).slice().sort((a, b) => a.from - b.from);
    let cur = w.from;
    const segs = [];
    for (const gp of gaps) { segs.push([cur, gp.from]); cur = gp.to; }
    segs.push([cur, w.to]);
    g.lineWidth = w.kind === 'exterior' ? 5 : w.kind === 'glass' ? 2 : 3;
    g.strokeStyle = w.kind === 'glass' ? '#5aa0c8' : '#26292c';
    for (const [s, e] of segs) {
      const [x0, y0] = w.axis === 'x' ? P(s, w.at) : P(w.at, s);
      const [x1, y1] = w.axis === 'x' ? P(e, w.at) : P(w.at, e);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
  }
  // escape routes: green arrows along the corridor towards exits A/B and through open plan to C
  g.strokeStyle = '#0a8f3c';
  g.fillStyle = '#0a8f3c';
  g.lineWidth = 4;
  const arrow = (pts) => {
    g.beginPath();
    pts.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.stroke();
    const [ax, ay] = P(...pts[pts.length - 2]), [bx, by] = P(...pts[pts.length - 1]);
    const a = Math.atan2(by - ay, bx - ax);
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx - Math.cos(a - 0.45) * 14, by - Math.sin(a - 0.45) * 14);
    g.lineTo(bx - Math.cos(a + 0.45) * 14, by - Math.sin(a + 0.45) * 14);
    g.closePath(); g.fill();
  };
  g.setLineDash([10, 6]);
  arrow([[20, 11.5], [36, 11.5], [41.5, 11.5]]);
  arrow([[18, 11.5], [6.25, 11.5], [6.25, 8], [3, 4.75], [-1.5, 4.75]]);
  arrow([[16, 12], [16, 18.4], [8.25, 18.4], [8.25, 25.2]]);
  g.setLineDash([]);
  // exits + assembly points
  g.font = 'bold 14px Arial, sans-serif';
  for (const [id, e] of Object.entries(EXITS)) {
    const [x, y] = P(...e.safe);
    const cx = Math.min(W - 40, Math.max(40, x)), cy = Math.min(H - 90, Math.max(80, y));
    g.fillStyle = '#0a8f3c';
    g.beginPath(); g.arc(cx, cy, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.fillText(id, cx, cy + 1);
  }
  g.textAlign = 'left';
  // equipment
  for (const e of EXTINGUISHERS) {
    const [x, y] = P(...e.pos);
    g.fillStyle = '#c4161c';
    g.fillRect(x - 5, y - 5, 10, 10);
  }
  for (const cp of CALL_POINTS) {
    const [x, y] = P(...cp.pos);
    g.strokeStyle = '#c4161c'; g.lineWidth = 2.5;
    g.strokeRect(x - 5, y - 5, 10, 10);
    g.fillStyle = '#fff'; g.fillRect(x - 2, y - 2, 4, 4);
  }
  // you are here
  const [hx, hy] = P(...here);
  g.fillStyle = 'rgba(220,20,20,0.25)';
  g.beginPath(); g.arc(hx, hy, 18, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d4141b';
  g.beginPath(); g.arc(hx, hy, 8, 0, Math.PI * 2); g.fill();
  g.font = 'bold 15px Arial, sans-serif';
  const label = 'YOU ARE HERE';
  const tw = g.measureText(label).width;
  const lx = Math.min(W - tw - 20, hx + 14), ly = hy < 200 ? hy + 30 : hy - 26;
  g.fillStyle = '#d4141b';
  g.fillRect(lx - 6, ly - 12, tw + 12, 24);
  g.fillStyle = '#fff';
  g.fillText(label, lx, ly + 1);
  // legend
  const ly2 = H - 34;
  g.font = '14px Arial, sans-serif';
  g.fillStyle = '#c4161c'; g.fillRect(24, ly2 - 6, 12, 12);
  g.fillStyle = '#222'; g.fillText('Fire extinguisher', 42, ly2 + 1);
  g.strokeStyle = '#c4161c'; g.lineWidth = 2.5; g.strokeRect(190, ly2 - 6, 12, 12);
  g.fillText('Fire alarm call point', 208, ly2 + 1);
  g.fillStyle = '#0a8f3c'; g.beginPath(); g.arc(388, ly2, 8, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#222'; g.fillText('Assembly point', 402, ly2 + 1);
  g.strokeStyle = '#0a8f3c'; g.lineWidth = 4; g.setLineDash([10, 6]);
  g.beginPath(); g.moveTo(530, ly2); g.lineTo(570, ly2); g.stroke(); g.setLineDash([]);
  g.fillText('Escape route', 578, ly2 + 1);
  g.font = 'bold 13px Arial, sans-serif';
  g.fillStyle = '#c4161c';
  g.fillText('IN CASE OF FIRE: RAISE THE ALARM · LEAVE BY THE NEAREST SAFE EXIT · DO NOT USE LIFTS', 24, H - 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
