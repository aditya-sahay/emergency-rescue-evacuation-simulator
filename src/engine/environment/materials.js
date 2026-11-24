// Shared PBR material library. `worldUV` gives the texture scale (metres per repeat) used by the
// geometry batcher to generate box-projected UVs so textures never stretch.
import * as THREE from 'three';
import * as T from './textures.js';

export function createMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const m = {};
  const meta = {};
  const def = (key, mat, opts = {}) => { m[key] = mat; meta[key] = { worldUV: opts.worldUV ?? null, shadow: opts.shadow ?? true }; };

  def('wall', std({ color: '#ffffff', map: T.wallTexture(), roughness: 0.92 }), { worldUV: 2.5 });
  def('wallAccent', std({ color: '#2f4a60', roughness: 0.85 }), { worldUV: 2.5 });
  def('wallWarm', std({ color: '#c9b79c', roughness: 0.9, map: T.wallTexture() }), { worldUV: 2.5 });
  def('exterior', std({ color: '#b9bec4', roughness: 0.85, map: T.wallTexture() }), { worldUV: 3 });
  def('baseboard', std({ color: '#3c3f44', roughness: 0.6 }));
  def('ceiling', std({ color: '#ffffff', map: T.ceilingTexture(), roughness: 0.95 }), { worldUV: 1.2, shadow: false });
  def('roof', std({ color: '#55595e', roughness: 0.9 }), { shadow: false });
  def('carpet', std({ color: '#ffffff', map: T.carpetTexture('#5d6670', 3), roughness: 1 }), { worldUV: 0.6 });
  def('carpetDark', std({ color: '#ffffff', map: T.carpetTexture('#3d4650', 4), roughness: 1 }), { worldUV: 0.6 });
  def('tile', std({ color: '#ffffff', map: T.tileTexture('#c4c7c9', '#8d9296', 2, 5), roughness: 0.32, metalness: 0.02 }), { worldUV: 1.2 });
  def('kitchenTile', std({ color: '#ffffff', map: T.checkerTileTexture(), roughness: 0.4 }), { worldUV: 1.2 });
  def('stone', std({ color: '#ffffff', map: T.stoneTexture(), roughness: 0.28 }), { worldUV: 2.4 });
  def('grass', std({ color: '#ffffff', map: T.grassTexture(), roughness: 1 }), { worldUV: 2 });
  def('paving', std({ color: '#ffffff', map: T.pavingTexture(), roughness: 0.9 }), { worldUV: 2 });
  def('asphalt', std({ color: '#3a3c3f', roughness: 0.95 }));

  def('wood', std({ color: '#ffffff', map: T.woodTexture('#b08356', 21), roughness: 0.55 }), { worldUV: 1.6 });
  def('woodDark', std({ color: '#ffffff', map: T.woodTexture('#6b4a33', 22), roughness: 0.5 }), { worldUV: 1.6 });
  def('woodLight', std({ color: '#ffffff', map: T.woodTexture('#d8bf98', 23), roughness: 0.6 }), { worldUV: 1.6 });
  def('laminateWhite', std({ color: '#eceff1', roughness: 0.45 }));
  def('metal', std({ color: '#a3a9b0', roughness: 0.32, metalness: 0.85 }));
  def('metalDark', std({ color: '#3d4248', roughness: 0.4, metalness: 0.7 }));
  def('steel', std({ color: '#c8cdd2', roughness: 0.22, metalness: 0.9 }));
  def('aluminium', std({ color: '#cfd3d7', roughness: 0.35, metalness: 0.75 }));
  def('plastic', std({ color: '#1f2226', roughness: 0.55 }));
  def('plasticGrey', std({ color: '#8d939a', roughness: 0.5 }));
  def('plasticWhite', std({ color: '#e7e9ea', roughness: 0.4 }));
  def('fabricChair', std({ color: '#ffffff', map: T.fabricTexture('#2b3542'), roughness: 0.95 }), { worldUV: 0.4 });
  def('fabricBlue', std({ color: '#ffffff', map: T.fabricTexture('#3f6283'), roughness: 0.95 }), { worldUV: 0.5 });
  def('fabricGrey', std({ color: '#ffffff', map: T.fabricTexture('#7c838b'), roughness: 0.95 }), { worldUV: 0.5 });
  def('fabricTeal', std({ color: '#ffffff', map: T.fabricTexture('#2f6f6c'), roughness: 0.95 }), { worldUV: 0.5 });
  def('leather', std({ color: '#2b2522', roughness: 0.55 }));
  def('countertop', std({ color: '#2d2f31', roughness: 0.25, metalness: 0.1 }));
  def('cabinetWhite', std({ color: '#f3f3f1', roughness: 0.5 }));
  def('ceramic', std({ color: '#f7f7f7', roughness: 0.2 }));
  def('rubber', std({ color: '#151515', roughness: 0.9 }));
  def('plantGreen', std({ color: '#3e7a3c', roughness: 0.8 }));
  def('plantDark', std({ color: '#2d5a2c', roughness: 0.8 }));
  def('soil', std({ color: '#3b2a1d', roughness: 1 }));
  def('potGrey', std({ color: '#5a5f63', roughness: 0.7 }));
  def('bark', std({ color: '#5b4330', roughness: 1 }));
  def('paper', std({ color: '#f5f5f0', roughness: 0.9 }));
  def('bookRed', std({ color: '#8e2f2f', roughness: 0.8 }));
  def('bookBlue', std({ color: '#2f4f8e', roughness: 0.8 }));
  def('bookGreen', std({ color: '#3d6e4a', roughness: 0.8 }));
  def('bookBeige', std({ color: '#c8b48c', roughness: 0.8 }));
  def('screenOff', std({ color: '#0c0d0f', roughness: 0.15, metalness: 0.3 }));
  def('whiteboard', std({ color: '#ffffff', map: T.whiteboardTexture(), roughness: 0.2 }));
  def('lightPanel', new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fffaf0', emissiveIntensity: 2.2, roughness: 1 }), { shadow: false });
  def('ledGreen', new THREE.MeshBasicMaterial({ color: '#39ff7a' }), { shadow: false });
  def('ledBlue', new THREE.MeshBasicMaterial({ color: '#40b4ff' }), { shadow: false });
  def('ledAmber', new THREE.MeshBasicMaterial({ color: '#ffb02e' }), { shadow: false });
  def('glass', new THREE.MeshStandardMaterial({
    color: '#bcd6e2', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide,
  }), { shadow: false });
  def('windowGlass', new THREE.MeshStandardMaterial({
    color: '#9fc3dc', transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.4, depthWrite: false, side: THREE.DoubleSide,
  }), { shadow: false });
  def('frosted', new THREE.MeshStandardMaterial({ color: '#f4f8fa', transparent: true, opacity: 0.6, roughness: 0.6, depthWrite: false }), { shadow: false });
  def('red', std({ color: '#c4161c', roughness: 0.35, metalness: 0.15 }));
  def('green', std({ color: '#0a8f3c', roughness: 0.5 }));
  def('yellow', std({ color: '#e7b416', roughness: 0.5 }));
  def('smokeDetector', std({ color: '#f5f5f5', roughness: 0.5 }), { shadow: false });
  // Alarm strobes: one shared material flashed by the emergency system.
  def('strobe', new THREE.MeshStandardMaterial({ color: '#ff2a1a', emissive: '#ff1a0a', emissiveIntensity: 0.15, roughness: 0.3 }), { shadow: false });
  def('foliage', std({ color: '#47713a', roughness: 0.9, flatShading: true }));
  def('foliage2', std({ color: '#5c8a3f', roughness: 0.9, flatShading: true }));
  def('carPaint', std({ color: '#2a4d74', roughness: 0.25, metalness: 0.6 }));
  def('carPaint2', std({ color: '#b8bcc0', roughness: 0.25, metalness: 0.6 }));
  def('carGlass', std({ color: '#1b2630', roughness: 0.1, metalness: 0.5 }));

  // --- refinement additions ---
  // ceiling fixtures: no shadow casting (they produced floating dark squares on the floor)
  def('fixture', std({ color: '#cfd3d7', roughness: 0.35, metalness: 0.75 }), { shadow: false });
  def('grille', std({ map: T.grilleTexture(), roughness: 0.6 }), { shadow: false });
  def('clock', std({ map: T.clockTexture(), roughness: 0.3 }), { shadow: false });
  const leafMap = T.leafTexture();
  def('leaf', std({ color: '#4c8a3f', map: leafMap, roughness: 0.55 }));
  def('leafDark', std({ color: '#2f6630', map: leafMap, roughness: 0.55 }));
  def('leafLight', std({ color: '#6fa64a', map: leafMap, roughness: 0.6 }));
  def('canopy', std({ color: '#4d7a37', map: leafMap, roughness: 0.85 }));
  def('canopyDark', std({ color: '#36602c', map: leafMap, roughness: 0.85 }));
  def('canopyLight', std({ color: '#6b9445', map: leafMap, roughness: 0.85 }));
  def('hedge', std({ color: '#ffffff', map: T.hedgeTexture(), roughness: 0.95 }), { worldUV: 1.5 });
  def('facade', std({ color: '#ffffff', map: T.facadeTexture(401, '#8f9aa6'), roughness: 0.4, metalness: 0.2 }), { worldUV: 7.5, shadow: false });
  def('facade2', std({ color: '#ffffff', map: T.facadeTexture(402, '#b4a48e'), roughness: 0.6 }), { worldUV: 7.5, shadow: false });
  // approximated ambient occlusion (contact shadows + corner gradients)
  // vertex-alpha decals (geometry carries the falloff, see Batcher.js)
  const aoMat = (opacity) => new THREE.MeshBasicMaterial({
    color: '#ffffff', vertexColors: true, transparent: true, opacity, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  });
  def('aoBlob', aoMat(0.62), { shadow: false });
  def('aoFloor', aoMat(0.42), { shadow: false });
  def('aoWall', aoMat(0.34), { shadow: false });
  def('aoCeil', aoMat(0.26), { shadow: false });

  return { m, meta };
}
