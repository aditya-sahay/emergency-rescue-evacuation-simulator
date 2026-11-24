// 2D canvas minimap: static floor plan pre-rendered once, dynamic layer redrawn ~15×/s.
import { ROOMS, EXITS, BUILDING } from '../environment/layout.js';

const VIEW = { x0: -9, x1: 49, z0: -3, z1: 33 };

export class Minimap {
  constructor(wallLines) {
    this.wallLines = wallLines;
    this.canvas = null;
    this.static = null;
  }

  attach(canvas) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d') || null;
    this.static = null;
  }

  _setup() {
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || 280, h = c.clientHeight || 175;
    c.width = w * dpr;
    c.height = h * dpr;
    this.scale = Math.min((w * dpr) / (VIEW.x1 - VIEW.x0), (h * dpr) / (VIEW.z1 - VIEW.z0));
    this.ox = (w * dpr - (VIEW.x1 - VIEW.x0) * this.scale) / 2;
    this.oy = (h * dpr - (VIEW.z1 - VIEW.z0) * this.scale) / 2;
    this.dpr = dpr;
    const s = document.createElement('canvas');
    s.width = c.width;
    s.height = c.height;
    const g = s.getContext('2d');
    const P = (x, z) => this.P(x, z);
    g.fillStyle = 'rgba(16,22,30,0.0)';
    g.fillRect(0, 0, s.width, s.height);
    // site
    let [ax, az] = P(-8, -2); let [bx, bz] = P(48, 32);
    g.fillStyle = 'rgba(70,90,80,0.25)';
    g.fillRect(ax, az, bx - ax, bz - az);
    for (const r of ROOMS) {
      [ax, az] = P(r.x0, r.z0); [bx, bz] = P(r.x1, r.z1);
      g.fillStyle = r.id === 'corridor' ? 'rgba(120,140,160,0.35)' : 'rgba(60,75,92,0.55)';
      g.fillRect(ax, az, bx - ax, bz - az);
    }
    g.lineCap = 'square';
    for (const l of this.wallLines) {
      const [x0, z0] = l.axis === 'x' ? [l.s, l.at] : [l.at, l.s];
      const [x1, z1] = l.axis === 'x' ? [l.e, l.at] : [l.at, l.e];
      [ax, az] = P(x0, z0); [bx, bz] = P(x1, z1);
      if (l.kind === 'exit') { g.strokeStyle = '#2bff8a'; g.lineWidth = 3 * this.dpr; }
      else if (l.kind === 'opening' || l.kind === 'door') continue;
      else if (l.kind === 'glass') { g.strokeStyle = 'rgba(150,210,240,0.9)'; g.lineWidth = 1.5 * this.dpr; }
      else { g.strokeStyle = '#d7e0ea'; g.lineWidth = (l.kind === 'exterior' ? 2.4 : 1.6) * this.dpr; }
      g.beginPath(); g.moveTo(ax, az); g.lineTo(bx, bz); g.stroke();
    }
    g.font = `${8 * this.dpr}px Inter, sans-serif`;
    g.fillStyle = 'rgba(220,230,240,0.55)';
    g.textAlign = 'center';
    const short = { reception: 'RECEPTION', officeA: 'FINANCE', conference: 'CONF', officeB: 'DIRECTOR', openplan: 'OPEN PLAN', kitchen: 'KITCHEN', server: 'SERVER', officeC: 'HR' };
    for (const r of ROOMS) {
      if (!short[r.id]) continue;
      const [x, z] = P((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
      g.fillText(short[r.id], x, z + 3 * this.dpr);
    }
    for (const [id, e] of Object.entries(EXITS)) {
      const [x, z] = P(...e.safe);
      g.fillStyle = 'rgba(43,255,138,0.25)';
      g.beginPath(); g.arc(x, z, 7 * this.dpr, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2bff8a';
      g.font = `bold ${8 * this.dpr}px Inter, sans-serif`;
      g.fillText(id, x, z + 3 * this.dpr);
    }
    this.static = s;
    this.w = c.width; this.h = c.height;
  }

  P(x, z) { return [this.ox + (x - VIEW.x0) * this.scale, this.oy + (z - VIEW.z0) * this.scale]; }

  draw(st, time) {
    if (!this.ctx) return;
    if (!this.static || this.canvas.width !== this.w) this._setup();
    const g = this.ctx;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.static, 0, 0);
    const d = this.dpr;
    // doors
    for (const door of st.doors) {
      const [x, z] = this.P(...door.center);
      g.fillStyle = door.open ? 'rgba(120,200,255,0.9)' : '#ffb347';
      g.fillRect(x - 3 * d, z - 1.5 * d, 6 * d, 3 * d);
    }
    // equipment
    for (const e of st.extinguishers) {
      if (!e.available) continue;
      const [x, z] = this.P(...e.pos);
      g.fillStyle = '#ff4d4d';
      g.fillRect(x - 2 * d, z - 2 * d, 4 * d, 4 * d);
    }
    for (const c of st.callPoints) {
      const [x, z] = this.P(...c.pos);
      g.strokeStyle = c.activated ? '#ffd21a' : '#ff4d4d';
      g.lineWidth = 1.2 * d;
      g.strokeRect(x - 2.5 * d, z - 2.5 * d, 5 * d, 5 * d);
    }
    // route
    if (st.route && st.showRoute) {
      g.strokeStyle = st.route.hazardous ? '#ffb020' : '#2bff8a';
      g.lineWidth = 2 * d;
      g.setLineDash([4 * d, 3 * d]);
      g.lineDashOffset = -time * 20 * d;
      g.beginPath();
      st.route.points.forEach((p, i) => { const [x, z] = this.P(p.x, p.y); i ? g.lineTo(x, z) : g.moveTo(x, z); });
      g.stroke();
      g.setLineDash([]);
    }
    // fires
    for (const f of st.fires) {
      if (!f.active) continue;
      const [x, z] = this.P(f.position.x, f.position.z);
      const r = (0.5 + 1.5 * f.intensity) * this.scale;
      const pulse = 0.6 + 0.4 * Math.sin(time * 6 + f.position.x);
      g.fillStyle = `rgba(255,${80 + 80 * (1 - f.intensity)},30,${0.35 * pulse})`;
      g.beginPath(); g.arc(x, z, r + 2 * d, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff6a1a';
      g.beginPath(); g.arc(x, z, 2.5 * d, 0, Math.PI * 2); g.fill();
    }
    // player
    const [px, pz] = this.P(st.player.x, st.player.z);
    g.save();
    g.translate(px, pz);
    g.rotate(-st.player.yaw);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#0b1220';
    g.lineWidth = 1.2 * d;
    g.beginPath();
    g.moveTo(0, -6 * d); g.lineTo(4.2 * d, 4.5 * d); g.lineTo(0, 2.5 * d); g.lineTo(-4.2 * d, 4.5 * d); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }
}

export { BUILDING };
