// Interactive equipment meshes (not batched because they move / change state).
import * as THREE from 'three';
import { signTexture } from './textures.js';

const shared = {};
function mats() {
  if (shared.red) return shared;
  shared.red = new THREE.MeshStandardMaterial({ color: '#c8141b', roughness: 0.28, metalness: 0.25 });
  shared.black = new THREE.MeshStandardMaterial({ color: '#121314', roughness: 0.6 });
  shared.chrome = new THREE.MeshStandardMaterial({ color: '#d6d9dc', roughness: 0.15, metalness: 1 });
  shared.label = new THREE.MeshStandardMaterial({ color: '#f1efe8', roughness: 0.6 });
  shared.gauge = new THREE.MeshStandardMaterial({ color: '#e8f5e9', roughness: 0.3, emissive: '#1a3d1f', emissiveIntensity: 0.2 });
  shared.bracket = new THREE.MeshStandardMaterial({ color: '#4b5056', roughness: 0.4, metalness: 0.7 });
  shared.extSign = new THREE.MeshStandardMaterial({ map: signTexture('extinguisher'), roughness: 0.6 });
  shared.cpBody = new THREE.MeshStandardMaterial({ color: '#c8141b', roughness: 0.4 });
  shared.cpFace = new THREE.MeshStandardMaterial({ map: signTexture('callpoint'), roughness: 0.3 });
  shared.cpActive = new THREE.MeshStandardMaterial({ color: '#ffd21a', emissive: '#ffb300', emissiveIntensity: 0.8, roughness: 0.4 });
  return shared;
}

// Fire extinguisher (CO2 / dry powder style), origin at the bottom of the cylinder, nozzle pointing +Z.
export function createExtinguisherModel({ forView = false } = {}) {
  const m = mats();
  const g = new THREE.Group();
  const seg = forView ? 24 : 16;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.46, seg), m.red);
  body.position.y = 0.23;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.075, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.red);
  dome.position.y = 0.46;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.03, seg), m.black);
  base.position.y = 0.015;
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0765, 0.0765, 0.16, seg, 1, true, -0.9, 1.8), m.label);
  label.position.y = 0.24;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.05, 12), m.chrome);
  neck.position.y = 0.535;
  const valve = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.07), m.black);
  valve.position.set(0, 0.57, 0.01);
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16), m.gauge);
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(0, 0.575, 0.05);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.012, 0.15), m.black);
  lever.position.set(0, 0.615, 0.03);
  lever.rotation.x = -0.12;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.012, 0.13), m.chrome);
  handle.position.set(0, 0.59, -0.04);
  const pin = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 6, 12), m.chrome);
  pin.position.set(0.03, 0.59, 0.0);
  pin.rotation.y = Math.PI / 2;
  // hose
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.56, 0.035), new THREE.Vector3(0.05, 0.52, 0.09), new THREE.Vector3(0.09, 0.35, 0.1),
    new THREE.Vector3(0.1, 0.2, 0.06), new THREE.Vector3(0.09, 0.12, 0.0),
  ]);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.011, 8), m.black);
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.012, 0.09, 12), m.black);
  horn.position.set(0.09, 0.08, 0.0);
  g.add(body, dome, base, label, neck, valve, gauge, lever, handle, pin, hose, horn);
  g.userData.lever = lever;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = !forView; o.receiveShadow = !forView; } });
  return g;
}

// Wall-mounted extinguisher station: bracket + extinguisher + sign. Front faces +Z.
export function createExtinguisherStation() {
  const m = mats();
  const station = new THREE.Group();
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), m.bracket);
  bracket.position.set(0, 1.08, 0.03);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.01), m.bracket);
  plate.position.set(0, 0.9, 0.005);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16), m.extSign);
  sign.position.set(0, 1.62, 0.006);
  const ext = createExtinguisherModel();
  ext.position.set(0, 0.5, 0.1);
  ext.rotation.y = Math.PI * 0.15;
  station.add(bracket, plate, sign, ext);
  station.userData.extinguisher = ext;
  return station;
}

// Manual call point (break-glass fire alarm). Front faces +Z.
export function createCallPoint() {
  const m = mats();
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.05), m.cpBody);
  body.position.set(0, 1.4, 0.025);
  body.scale.set(1.6, 1, 1); // landscape housing to match the 2:1 face label
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), m.cpFace);
  face.position.set(0, 1.4, 0.0505);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.012), m.cpActive);
  flag.position.set(0, 1.44, 0.056);
  flag.visible = false;
  g.add(body, face, flag);
  g.userData.flag = flag;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}
