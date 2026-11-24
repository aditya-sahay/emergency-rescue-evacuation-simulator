// Office floor plan — single source of truth for geometry, navigation, fire zones and scenarios.
// Units are metres. X runs west→east, Z runs north→south, Y is up.

export const WALL_H = 3.0;
export const WALL_T = 0.2;
export const DOOR_H = 2.1;

export const BUILDING = { x0: 0, x1: 40, z0: 0, z1: 24 };

export const ROOMS = [
  { id: 'reception', name: 'Reception', x0: 0, x1: 12, z0: 0, z1: 10, floor: 'stone' },
  { id: 'officeA', name: 'Finance Office', x0: 12, x1: 22, z0: 0, z1: 10, floor: 'carpet' },
  { id: 'conference', name: 'Conference Room', x0: 22, x1: 31, z0: 0, z1: 10, floor: 'carpetDark' },
  { id: 'officeB', name: "Director's Office", x0: 31, x1: 40, z0: 0, z1: 10, floor: 'carpet' },
  { id: 'corridor', name: 'Main Corridor', x0: 0, x1: 40, z0: 10, z1: 13, floor: 'tile' },
  { id: 'openplan', name: 'Open-Plan Workspace', x0: 0, x1: 18, z0: 13, z1: 24, floor: 'carpet' },
  { id: 'kitchen', name: 'Break Room', x0: 18, x1: 26, z0: 13, z1: 24, floor: 'kitchenTile' },
  { id: 'server', name: 'Server & Print Room', x0: 26, x1: 31, z0: 13, z1: 24, floor: 'tile' },
  { id: 'officeC', name: 'HR Office', x0: 31, x1: 40, z0: 13, z1: 24, floor: 'carpet' },
];

// Axis-aligned wall runs. axis 'x' = wall runs along X at constant z; axis 'z' = runs along Z at constant x.
// gaps: openings in the run. type: 'door' (hinged door), 'opening' (open doorway), 'exit' (building exit).
export const WALLS = [
  // Exterior
  { axis: 'x', at: 0, from: 0, to: 40, kind: 'exterior', junctions: [12, 22, 31] },
  { axis: 'x', at: 24, from: 0, to: 40, kind: 'exterior', junctions: [18, 26, 31], gaps: [{ from: 7, to: 9.5, type: 'exit', id: 'C' }] },
  { axis: 'z', at: 0, from: 0, to: 24, kind: 'exterior', junctions: [10, 13], gaps: [{ from: 3.5, to: 6, type: 'exit', id: 'A' }] },
  { axis: 'z', at: 40, from: 0, to: 24, kind: 'exterior', junctions: [10, 13], gaps: [{ from: 10.25, to: 12.75, type: 'exit', id: 'B' }] },
  // Corridor north side (z = 10)
  { axis: 'x', at: 10, from: 0, to: 12, kind: 'interior', gaps: [{ from: 3.5, to: 9, type: 'opening' }] },
  { axis: 'x', at: 10, from: 12, to: 22, kind: 'interior', gaps: [{ from: 16, to: 17, type: 'door', id: 'dA' }] },
  { axis: 'x', at: 10, from: 22, to: 31, kind: 'glass', gaps: [{ from: 23, to: 24, type: 'door', id: 'dConf' }] },
  { axis: 'x', at: 10, from: 31, to: 40, kind: 'interior', gaps: [{ from: 32, to: 33, type: 'door', id: 'dB' }] },
  // Corridor south side (z = 13)
  { axis: 'x', at: 13, from: 0, to: 18, kind: 'glass', gaps: [{ from: 3, to: 5, type: 'opening' }, { from: 15, to: 17, type: 'opening' }] },
  { axis: 'x', at: 13, from: 18, to: 26, kind: 'interior', gaps: [{ from: 21, to: 22, type: 'door', id: 'dKitchen' }] },
  { axis: 'x', at: 13, from: 26, to: 31, kind: 'interior', gaps: [{ from: 28, to: 29, type: 'door', id: 'dServer' }] },
  { axis: 'x', at: 13, from: 31, to: 40, kind: 'interior', gaps: [{ from: 34, to: 35, type: 'door', id: 'dC' }] },
  // Room partitions
  { axis: 'z', at: 12, from: 0, to: 10, kind: 'interior' },
  { axis: 'z', at: 22, from: 0, to: 10, kind: 'interior' },
  { axis: 'z', at: 31, from: 0, to: 10, kind: 'interior' },
  { axis: 'z', at: 18, from: 13, to: 24, kind: 'interior' },
  { axis: 'z', at: 26, from: 13, to: 24, kind: 'interior' },
  { axis: 'z', at: 31, from: 13, to: 24, kind: 'interior' },
];

// Door behaviour. swing: +1 opens toward +Z, -1 toward -Z (always into the room, away from the corridor).
export const DOORS = {
  dA: { swing: -1, open: true, style: 'wood' },
  dConf: { swing: -1, open: false, style: 'glass' },
  dB: { swing: -1, open: true, style: 'wood' },
  dKitchen: { swing: 1, open: true, style: 'wood' },
  dServer: { swing: 1, open: false, style: 'wood' },
  dC: { swing: 1, open: true, style: 'wood' },
};

export const EXITS = {
  A: { name: 'Main Entrance (West)', door: [0, 4.75], safe: [-7, 4.75], node: 'safeA' },
  B: { name: 'East Fire Exit', door: [40, 11.5], safe: [47, 11.5], node: 'safeB' },
  C: { name: 'South Fire Exit', door: [8.25, 24], safe: [8.25, 31], node: 'safeC' },
};

// Evacuation navigation graph (nodes placed in walkable aisles).
export const NAV_NODES = {
  // corridor spine
  cA: [1.5, 11.5], cB: [4, 11.5], cC: [6.25, 11.5], cD: [10, 11.5], cE: [16.25, 11.5],
  cF: [21.5, 11.5], cG: [23.5, 11.5], cH: [28.5, 11.5], cI: [32.5, 11.5], cJ: [34.5, 11.5], cK: [38.5, 11.5],
  // reception + exit A
  rDoor: [6.25, 9.2], rMid: [4.5, 6.5], rExit: [1.0, 4.75], outA: [-2, 4.75], safeA: [-7, 4.75],
  // finance office
  aDoor: [16.5, 9.2], aIn: [17, 6.5],
  // conference
  fDoor: [23.5, 9.2], fIn: [23.3, 6],
  // director
  bDoor: [32.5, 9.2], bIn: [34.5, 7],
  // open plan + exit C
  oN1: [4, 14], oW: [4, 18.4], oC: [8.25, 18.4], oN2: [16, 14], oE: [16, 18.4], oExit: [8.25, 23], outC: [8.25, 26], safeC: [8.25, 31],
  // kitchen, server, HR
  kDoor: [21.5, 14], kIn: [22, 17.5],
  sDoor: [28.5, 14], sIn: [28.5, 16.5],
  hDoor: [34.5, 14], hIn: [35.5, 16.5],
  // exit B
  outB: [42, 11.5], safeB: [47, 11.5],
};

export const NAV_EDGES = [
  ['cA', 'cB'], ['cB', 'cC'], ['cC', 'cD'], ['cD', 'cE'], ['cE', 'cF'], ['cF', 'cG'], ['cG', 'cH'],
  ['cH', 'cI'], ['cI', 'cJ'], ['cJ', 'cK'], ['cK', 'outB'], ['outB', 'safeB'],
  ['cC', 'rDoor'], ['cB', 'rDoor'], ['rDoor', 'rMid'], ['rMid', 'rExit'], ['rExit', 'outA'], ['outA', 'safeA'],
  ['cE', 'aDoor'], ['aDoor', 'aIn'],
  ['cG', 'fDoor'], ['fDoor', 'fIn'],
  ['cI', 'bDoor'], ['bDoor', 'bIn'],
  ['cB', 'oN1'], ['oN1', 'oW'], ['oW', 'oC'], ['cE', 'oN2'], ['oN2', 'oE'], ['oE', 'oC'], ['oC', 'oExit'], ['oExit', 'outC'], ['outC', 'safeC'],
  ['cF', 'kDoor'], ['kDoor', 'kIn'],
  ['cH', 'sDoor'], ['sDoor', 'sIn'],
  ['cJ', 'hDoor'], ['hDoor', 'hIn'],
];

// Combustible zones — fire can only exist at these locations; propagation is computed between them.
// fuel = seconds of burning at full intensity; flam = ease of ignition (0..1).
export const COMBUSTIBLES = [
  // kitchen
  { id: 'k1', pos: [24.9, 16.0], fuel: 220, flam: 0.95, label: 'kitchen counter' },
  { id: 'k2', pos: [21.0, 20.5], fuel: 160, flam: 0.7, label: 'dining table' },
  { id: 'k3', pos: [24.9, 21.5], fuel: 200, flam: 0.8, label: 'cabinets' },
  { id: 'k4', pos: [19.0, 13.6], fuel: 140, flam: 0.75, label: 'recycling bins' },
  // server/print
  { id: 's1', pos: [27.0, 19.5], fuel: 220, flam: 0.85, label: 'server rack' },
  { id: 's2', pos: [30.0, 15.2], fuel: 180, flam: 0.9, label: 'paper store' },
  { id: 's3', pos: [30.1, 21.0], fuel: 200, flam: 0.8, label: 'server rack' },
  // open plan
  { id: 'o1', pos: [8.0, 16.0], fuel: 200, flam: 0.75, label: 'workstations' },
  { id: 'o2', pos: [12.0, 16.0], fuel: 200, flam: 0.75, label: 'workstations' },
  { id: 'o3', pos: [12.5, 20.6], fuel: 200, flam: 0.75, label: 'workstations' },
  { id: 'o4', pos: [15.5, 20.6], fuel: 200, flam: 0.75, label: 'workstations' },
  { id: 'o5', pos: [1.5, 18.5], fuel: 180, flam: 0.7, label: 'workstations' },
  { id: 'o6', pos: [16.8, 23.2], fuel: 150, flam: 0.85, label: 'printer & paper' },
  // corridor
  { id: 'h1', pos: [10.5, 10.6], fuel: 90, flam: 0.5, label: 'notice board' },
  { id: 'h2', pos: [24.5, 12.45], fuel: 120, flam: 0.65, label: 'copier' },
  { id: 'h3', pos: [26.5, 10.6], fuel: 100, flam: 0.55, label: 'storage boxes' },
  { id: 'h4', pos: [36.5, 12.4], fuel: 100, flam: 0.55, label: 'recycling station' },
  // conference
  { id: 'f1', pos: [25.5, 5.0], fuel: 200, flam: 0.6, label: 'conference table' },
  { id: 'f2', pos: [28.5, 5.0], fuel: 200, flam: 0.6, label: 'conference table' },
  { id: 'f3', pos: [30.4, 1.5], fuel: 140, flam: 0.7, label: 'AV cabinet' },
  // finance office
  { id: 'a1', pos: [14.6, 2.2], fuel: 180, flam: 0.7, label: 'desk' },
  { id: 'a2', pos: [19.4, 2.2], fuel: 180, flam: 0.7, label: 'desk' },
  { id: 'a3', pos: [21.4, 7.0], fuel: 200, flam: 0.85, label: 'filing shelves' },
  // director
  { id: 'b1', pos: [36.0, 3.0], fuel: 200, flam: 0.65, label: 'executive desk' },
  { id: 'b2', pos: [38.4, 6.0], fuel: 150, flam: 0.7, label: 'sofa' },
  // HR
  { id: 'c1', pos: [36.5, 20.5], fuel: 200, flam: 0.65, label: 'desk' },
  { id: 'c2', pos: [39.2, 16.0], fuel: 200, flam: 0.85, label: 'filing cabinets' },
  // reception
  { id: 'r1', pos: [9.5, 4.0], fuel: 160, flam: 0.6, label: 'reception desk' },
  { id: 'r2', pos: [4.0, 1.2], fuel: 150, flam: 0.7, label: 'waiting sofas' },
];

// Wall-mounted equipment. yaw = rotation about Y; the item's front (local +Z) faces (sin yaw, cos yaw).
export const EXTINGUISHERS = [
  { id: 'X1', pos: [2.0, 10.12], yaw: 0 },            // corridor west end, north wall
  { id: 'X2', pos: [20.0, 10.12], yaw: 0 },           // corridor, north wall
  { id: 'X3', pos: [30.0, 12.88], yaw: Math.PI },     // corridor, south wall near server
  { id: 'X4', pos: [17.88, 15.0], yaw: -Math.PI / 2 },// open plan east wall
  { id: 'X5', pos: [0.12, 8.5], yaw: Math.PI / 2 },   // reception west wall
  { id: 'X6', pos: [39.88, 8.5], yaw: -Math.PI / 2 }, // director's office
  { id: 'X7', pos: [36.0, 10.12], yaw: 0 },           // corridor east, north wall
];

export const CALL_POINTS = [
  { id: 'MCP1', pos: [0.12, 7.0], yaw: Math.PI / 2 },   // by exit A
  { id: 'MCP2', pos: [39.0, 10.12], yaw: 0 },          // by exit B
  { id: 'MCP3', pos: [6.5, 23.88], yaw: Math.PI },      // by exit C
  { id: 'MCP4', pos: [27.0, 12.88], yaw: Math.PI },     // corridor centre, server wall
  { id: 'MCP5', pos: [19.0, 12.88], yaw: Math.PI },     // corridor, kitchen wall
];

// Possible scenarios. player start + yaw, ignition zone.
export const SCENARIOS = [
  { id: 'kitchen', name: 'Break-room fire', start: [35.0, 6.5], yaw: Math.PI * 0.85, ignite: 'k1' },
  { id: 'server', name: 'Server-room electrical fire', start: [17.0, 5.8], yaw: Math.PI, ignite: 's1' },
  { id: 'openplan', name: 'Workspace fire', start: [36.0, 17.0], yaw: 0, ignite: 'o2' },
  { id: 'copier', name: 'Corridor copier fire', start: [23.3, 5.5], yaw: Math.PI, ignite: 'h2' },
];

export function roomAt(x, z) {
  for (const r of ROOMS) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r;
  }
  return null;
}

export function insideBuilding(x, z, margin = 0) {
  return x > BUILDING.x0 - margin && x < BUILDING.x1 + margin && z > BUILDING.z0 - margin && z < BUILDING.z1 + margin;
}
