// Engine: owns the renderer, scene and all simulation systems, runs the main loop and
// publishes a compact state snapshot to the React UI.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createMaterials } from './environment/materials.js';
import { buildOffice } from './environment/OfficeBuilder.js';
import { skyTexture } from './environment/textures.js';
import { SCENARIOS, EXITS, roomAt, insideBuilding, ROOMS } from './environment/layout.js';
import { CollisionWorld, isStructural } from './systems/CollisionWorld.js';
import { Input } from './systems/Input.js';
import { PlayerController } from './systems/PlayerController.js';
import { FireSystem } from './systems/FireSystem.js';
import { SmokeSystem } from './systems/SmokeSystem.js';
import { Extinguisher } from './systems/Extinguisher.js';
import { EmergencyManager, EVAC_TIME } from './systems/EmergencyManager.js';
import { EvacuationRouter, ArrowGuide } from './systems/EvacuationRouter.js';
import { AudioManager } from './systems/AudioManager.js';
import { Minimap } from './systems/Minimap.js';
import { computeResults } from './systems/ScoreManager.js';
import { QUALITY } from './Settings.js';

// distance (m) from an assembly point's centre that counts as having reached it
const ASSEMBLY_RADIUS = 3.5;

const ATTRACT_PATH = [
  [3, 1.7, 11.5], [12, 1.75, 11.6], [19, 1.7, 11.3], [21.5, 1.65, 12.2], [23, 1.7, 11.2], [29, 1.75, 11.5],
  [36, 1.7, 11.5], [34, 1.7, 7.5], [30, 1.8, 6], [25, 1.8, 8.5], [20, 1.7, 11.5], [14, 1.7, 14.2],
  [9, 1.7, 18.6], [4, 1.7, 14], [4, 1.7, 8], [7, 1.7, 3], [3, 1.7, 7],
];

export class Engine {
  constructor(canvas, { onState, onEvent, settings }) {
    this.canvas = canvas;
    this.onState = onState;
    this.onEvent = onEvent;
    this.settings = settings;
    this.mode = 'attract';
    this.paused = false;
    this.ended = false;
    this.time = 0;
    this._disposed = false;
    this._init();
  }

  _init() {
    const q = QUALITY[this.settings.quality] || QUALITY.medium;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q.antialias, powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.82;
    r.shadowMap.enabled = q.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = false;

    const scene = (this.scene = new THREE.Scene());
    scene.background = skyTexture();
    const pmrem = new THREE.PMREMGenerator(r);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = this.envTex;
    scene.environmentIntensity = 0.42;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 250); // 0.1 near plane: better depth precision for decals
    scene.add(this.camera);

    // lighting: daylight key + sky fill + emissive ceiling panels + a few interior fills
    this.hemi = new THREE.HemisphereLight('#e4ecf5', '#5a5247', 0.7);
    scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight('#fff1dc', 2.2));
    sun.position.set(32, 45, 26);
    sun.target.position.set(20, 0, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 26, bottom: -26, near: 5, far: 110 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);
    this.fillLights = [];
    for (const [x, z] of [[6, 5], [26.5, 5], [9, 18.5], [22, 18.5], [35.5, 12]]) {
      const l = new THREE.PointLight('#fff4e6', 9, 14, 1.6);
      l.position.set(x, 2.7, z);
      scene.add(l);
      this.fillLights.push(l);
    }
    // alarm strobe light that follows the player's room
    this.alarmLight = new THREE.PointLight('#ff2010', 0, 12, 1.5);
    scene.add(this.alarmLight);

    // world
    this.materials = createMaterials();
    this.collision = new CollisionWorld(2);
    const office = (this.office = buildOffice(this.materials, this.collision));
    scene.add(office.group);
    this.interactables = [];
    for (const d of office.doors) this.interactables.push(d.leaf);
    for (const e of office.extinguishers) this.interactables.push(e.model);
    for (const c of office.callPoints) this.interactables.push(c.mesh);

    // first-person view model rendered in a separate pass (never clips into walls)
    this.viewScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.viewScene.add(new THREE.HemisphereLight('#ffffff', '#554433', 1.6));
    const vdl = new THREE.DirectionalLight('#ffffff', 1.8);
    vdl.position.set(1, 2, 1);
    this.viewScene.add(vdl);
    this.viewFireLight = new THREE.PointLight('#ff7a2e', 0, 4, 1);
    this.viewFireLight.position.set(0, 0.5, -1.5);
    this.viewScene.add(this.viewFireLight);
    this.viewScene.environment = this.envTex;

    // systems
    const pq = q.particles;
    this.input = new Input(this.canvas);
    this.input.onLockChange = (locked) => this._onLockChange(locked);
    // Esc while the mouse is not captured (e.g. on the click-to-continue overlay) still opens the pause menu
    this.input.onEscape = () => { if (this.mode === 'play' && !this.ended && !this.paused && !this.input.locked) this.pause(); };
    this.player = new PlayerController(this.camera, this.input, this.collision);
    this.player.sensitivity = this.settings.sensitivity;
    this.fires = new FireSystem(scene, this.collision, pq);
    this.smoke = new SmokeSystem(scene);
    this.extinguisher = new Extinguisher(scene, this.viewScene, this.camera);
    this.emergency = new EmergencyManager();
    this.router = new EvacuationRouter(this.collision);
    this.arrows = new ArrowGuide(scene);
    this.audio = new AudioManager();
    this.audio.setVolume(this.settings.volume);
    this.minimap = new Minimap(office.wallLines);
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 2.7;

    this.attractCurve = new THREE.CatmullRomCurve3(ATTRACT_PATH.map((p) => new THREE.Vector3(...p)), true, 'centripetal');
    this._startAttract();

    this._resize = () => this.resize();
    window.addEventListener('resize', this._resize);
    this.resize();
    this.clock = new THREE.Clock();
    this._uiAcc = 0;
    this._mapAcc = 0;
    this._routeAcc = 1;
    this.fps = 60;
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  // ------------------------------------------------------------------ lifecycle
  _startAttract() {
    this.mode = 'attract';
    this._resetWorld();
    this.fires.spreadEnabled = false;
    this.fires.ignite('k1', 0.75, 0);
    this.fires.ignite('h2', 0.45, 0);
    this.attractT = 0;
  }

  _resetWorld() {
    this.fires.reset();
    this.smoke.reset();
    this.extinguisher.reset();
    for (const d of this.office.doors) {
      d.open = d.initialOpen;
      d.angle = d.open ? d.openAngle : 0;
      d.pivot.rotation.y = d.angle;
      d.closedCol.enabled = !d.open;
      d.openCol.enabled = d.open;
    }
    for (const e of this.office.extinguishers) { e.available = true; e.model.visible = true; }
    for (const c of this.office.callPoints) { c.activated = false; c.mesh.userData.flag.visible = false; }
    this.materials.m.strobe.emissiveIntensity = 0.15;
    this.alarmLight.intensity = 0;
    this.arrows.update(null, 0, false);
    this.audio.setAlarm(false);
  }

  startSession(scenarioId = null) {
    this.audio.init();
    const scenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    this.scenario = scenario;
    this._resetWorld();
    this.mode = 'play';
    this.paused = false;
    this.ended = false;
    this.time = 0;
    this.emergency.reset(scenario);
    this.player.reset(scenario.start[0], scenario.start[1], scenario.yaw);
    this.health = 100;
    this.stats = {
      exposure: 0, smokeTime: 0, crouchSmokeTime: 0, doorsClosed: 0, totalFires: 0, exitId: null,
    };
    this.route = null;
    this.router.route = null; // no exit preference carried over from a previous session
    this._lastBlocked = '';
    this._lastWarn = -10;
    this._cdWarned = new Set();
    this.timeline = [];
    this._wasOutside = false;
    this._outside = false;
    this._loggedExit = false;
    this._prompt = null;
    this.input.enabled = true;
    this.input.requestLock();
    this._notify(`Scenario: ${scenario.name}`, 'info');
    this._emitState(true);
  }

  restart() { this.startSession(this.scenario?.id); }

  toMenu() {
    this.input.enabled = false;
    this.input.exitLock();
    this.paused = false;
    this.ended = false;
    this.audio.setAlarm(false);
    this._startAttract();
  }

  pause() {
    if (this.mode !== 'play' || this.ended) return;
    this.paused = true;
    this.audio.suspend();
    this.onEvent?.({ type: 'paused' });
  }

  resume() {
    if (this.mode !== 'play' || this.ended) return;
    this.input.reset();
    this.input.requestLock();
    this.paused = false;
    this.audio.resume();
    this.onEvent?.({ type: 'resumed' });
  }

  _onLockChange(locked) {
    this.onEvent?.({ type: 'lock', locked });
    if (!locked && this.mode === 'play' && !this.ended && !this.paused) this.pause();
  }

  applySettings(s) {
    this.settings = s;
    const q = QUALITY[s.quality] || QUALITY.medium;
    this.player.sensitivity = s.sensitivity;
    this.audio.setVolume(s.volume);
    this.fires.quality = q.particles;
    if (this.renderer.shadowMap.enabled !== q.shadows) {
      this.renderer.shadowMap.enabled = q.shadows;
      this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    }
    if (this.sun.shadow.mapSize.x !== q.shadowMap) {
      this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.resize();
  }

  attachMinimap(canvas) { this.minimap.attach(canvas); }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const q = QUALITY[this.settings.quality] || QUALITY.medium;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = w / h;
    this.viewCamera.updateProjectionMatrix();
    const scale = (h * this.renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    for (const p of [this.fires.flames, this.fires.smoke, this.fires.steam, this.extinguisher.spray]) p.setScale(scale);
  }

  // ------------------------------------------------------------------ main loop
  _loop() {
    if (this._disposed) return;
    this._raf = requestAnimationFrame(this._loop);
    const raw = this.clock.getDelta();
    const dt = Math.min(0.05, raw);
    this.fps += ((1 / Math.max(raw, 1e-3)) - this.fps) * 0.05;
    this.time += dt;
    this._dt = dt;
    try {
      if (this.mode === 'attract') this._updateAttract(dt);
      else if (!this.paused && !this.ended && (this.input.locked || this.allowUnlocked)) this._updatePlay(dt);
      else if (this.ended) this._updateEnded(dt);
    } catch (err) {
      console.error(err);
    }
    this._render();
    this.input.endFrame();
  }

  _updateAttract(dt) {
    this.attractT = (this.attractT + dt / 95) % 1;
    const p = this.attractCurve.getPointAt(this.attractT);
    const look = this.attractCurve.getPointAt((this.attractT + 0.012) % 1);
    this.camera.position.copy(p);
    look.y -= 0.15;
    this.camera.lookAt(look);
    this.fires.update(dt, this.time, this.camera);
    this._updateStrobes(true, p);
    this.smoke.fog.density = 0.006;
  }

  _updateEnded(dt) {
    // keep the world alive but frozen-in-time for the player, slow drift of particles
    this.fires.flames.update(dt, this.time);
    this.fires.smoke.update(dt, this.time);
    this.extinguisher.spray.update(dt, this.time);
  }

  _updatePlay(dt) {
    const em = this.emergency;
    const P = this.player;
    P.update(dt);
    if (P.stepEvent) this.audio.footstep(P.sprinting);

    // interaction
    this._updateInteraction();

    // extinguisher
    const ex = this.extinguisher.update(dt, this.time, this.input.firing && (this.input.locked || this.allowUnlocked), this.fires, P);
    this._sprayFeedback = ex.spraying ? this._sprayHint(ex) : null;
    if (ex.empty && !this._emptyWarned) { this._emptyWarned = true; this.audio.empty(); this._notify('Extinguisher empty — find another or evacuate now.', 'warn'); }
    if (this.input.wasPressed('KeyG') && this.extinguisher.held) { this.extinguisher.held = false; this.extinguisher.view.visible = false; this._notify('Extinguisher dropped', 'info'); }

    // fire & smoke
    const fireEvents = this.fires.update(dt, this.time, this.camera);
    for (const e of fireEvents) {
      if (e.type === 'spread') {
        this.stats.totalFires++;
        this._notify(`Fire has spread: ${e.fire.room} (${e.fire.zone.label})`, 'danger');
        this._log(`${e.fire.id} — fire spread to ${e.fire.zone.label}, ${e.fire.room}`, 'danger');
      }
      if (e.type === 'extinguished') {
        this.audio.extinguished();
        this._notify(`${e.fire.id} extinguished in ${e.fire.room}`, 'success');
        this._log(`${e.fire.id} extinguished (${e.fire.room})`, 'success');
      }
    }
    const sm = this.smoke.update(dt, this.time, this.fires.fires, this.office.doors, P);

    // hazards → health
    const hz = this.fires.hazardAt(P.position.x, P.position.z);
    const smokeDps = this.smoke.inhalationDps();
    const dmg = (hz.dps + smokeDps) * dt;
    this.health = Math.max(0, this.health - dmg);
    this.stats.exposure += hz.dps * dt;
    if (this.smoke.local > 0.3) {
      this.stats.smokeTime += dt;
      if (P.crouching) this.stats.crouchSmokeTime += dt;
    }
    this._hazard = hz;
    if ((hz.inFlames || hz.radiant > 0.45) && this.time - this._lastWarn > 4) {
      this._lastWarn = this.time;
      this.audio.warning();
      this._notify('DANGER — extreme heat! Back away from the fire.', 'danger');
    }

    // emergency state machine
    // Evacuation is complete only at an assembly point (not merely outside the door).
    const outside = !insideBuilding(P.position.x, P.position.z, 1.0);
    const atAssembly = outside && Object.values(EXITS).some((ex) => Math.hypot(ex.safe[0] - P.position.x, ex.safe[1] - P.position.z) < ASSEMBLY_RADIUS);
    if (outside && !this._wasOutside && em.state !== 'normal') {
      this._notify('You are outside. Keep moving to the assembly point.', 'success');
      if (!this._loggedExit) { this._loggedExit = true; this._log('Left the building', 'success'); }
    }
    this._wasOutside = outside;
    this._outside = outside;
    const safe = atAssembly;
    const emEvents = em.update(dt, { health: this.health, safe });
    // countdown warnings
    if (em.countdown != null) {
      for (const t of [60, 30, 10]) {
        if (em.countdown <= t && !this._cdWarned.has(t)) {
          this._cdWarned.add(t);
          this.audio.warning();
          this._notify(`${t} seconds left on the evacuation clock${outside ? '' : ' — get out now'}!`, t <= 30 ? 'danger' : 'warn');
        }
      }
    }
    for (const e of emEvents) this._handleEmergencyEvent(e);

    // routing (throttled)
    this._routeAcc += dt;
    if (this._routeAcc > 0.35) {
      this._routeAcc = 0;
      this.route = this.router.update(P.position.x, P.position.z, this.fires.fires, this.smoke);
      if (this.route && em.alarmActive) {
        const key = this.route.blockedExits.sort().join(',');
        if (key && key !== this._lastBlocked) this._notify(`Route to exit ${key} is blocked by fire — rerouting to exit ${this.route.exitId}.`, 'warn');
        this._lastBlocked = key;
      }
    }
    const showRoute = em.alarmActive && !safe;
    this.arrows.update(this.route, this.time, showRoute);

    // alarm effects
    this._updateStrobes(em.alarmActive, P.position);
    const fireLevel = this.fires.fires.reduce((a, f) => (f.active ? a + f.intensity / (1 + f.position.distanceTo(P.position) * 0.4) : a), 0);
    this.audio.update(this.time, { fireLevel, spraying: this.extinguisher.spraying });
    this.viewFireLight.intensity = Math.min(3, fireLevel * 3);

    this._emitState(false, dt, sm);
  }

  // Coaching for extinguisher use: tells the player whether the spray is effective and why not.
  _sprayHint(ex) {
    if (ex.hits.length) {
      const best = Math.max(...ex.hits.map((h) => h.eff));
      return { onTarget: true, text: best > 0.75 ? 'ON TARGET — sweep across the base' : 'Hitting the flames — aim lower, at the base' };
    }
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    let best = null;
    for (const f of this.fires.fires) {
      if (!f.active) continue;
      const to = new THREE.Vector3(f.position.x - this.camera.position.x, 0, f.position.z - this.camera.position.z);
      const d = to.length();
      const facing = to.normalize().dot(new THREE.Vector3(fwd.x, 0, fwd.z).normalize());
      if (facing > 0.5 && (!best || d < best.d)) best = { d, f };
    }
    if (!best) return { onTarget: false, text: 'No fire in front of you' };
    if (best.d > 7.5) return { onTarget: false, text: `Too far (${best.d.toFixed(1)} m) — move within 5 m` };
    if (!this.collision.lineOfSight(this.camera.position.x, this.camera.position.z, best.f.position.x, best.f.position.z)) return { onTarget: false, text: 'Obstructed — get a clear line to the fire' };
    return { onTarget: false, text: 'Missing — aim at the base of the flames' };
  }

  _handleEmergencyEvent(e) {
    const em = this.emergency;
    if (e.type === 'ignite') {
      const f = this.fires.ignite(this.scenario.ignite, 0.3, this.time);
      this.stats.totalFires++;
      this._log(`${f?.id ?? 'FIRE-01'} — ignition: ${this.scenario.name.toLowerCase()} (${f?.room ?? ''})`, 'danger');
      this.onEvent?.({ type: 'ignite', room: f?.room });
    } else if (e.type === 'alarm') {
      this.audio.setAlarm(true);
      this._log(e.source === 'player' ? 'You raised the fire alarm' : 'Smoke detectors triggered the fire alarm', e.source === 'player' ? 'success' : 'warn');
      if (e.source === 'player') this._notify('Fire alarm activated. Everyone is evacuating — good work.', 'success');
      else this._notify('Smoke detectors have triggered the fire alarm. EVACUATE!', 'danger');
      this._notify(`Evacuation clock started: ${EVAC_TIME} s until the building is untenable.`, 'info');
    } else if (e.type === 'end') {
      this._finish(e.outcome, e.reason);
    }
  }

  _finish(outcome, reason) {
    this.ended = true;
    this.input.enabled = false;
    this.input.firing = false;
    this.input.exitLock();
    this.audio.setAlarm(false);
    this.audio.update(this.time, { fireLevel: 0, spraying: false });
    if (outcome === 'evacuated') this.audio.success(); else this.audio.failure();
    const em = this.emergency;
    const P = this.player;
    let exitId = null, best = Infinity;
    for (const [id, e] of Object.entries(EXITS)) {
      const d = Math.hypot(e.door[0] - P.position.x, e.door[1] - P.position.z);
      if (d < best) { best = d; exitId = id; }
    }
    this._log(outcome === 'evacuated' ? 'Reached the assembly point — accounted for' : reason === 'health' ? 'Overcome by heat and smoke' : 'Evacuation clock expired', outcome === 'evacuated' ? 'success' : 'danger');
    const results = computeResults({
      timeline: this.timeline,
      outcome, reason, health: Math.round(this.health), countdown: em.countdown ?? EVAC_TIME,
      alarmTime: em.alarmTime, alarmSource: em.alarmSource,
      alarmDelay: em.alarmTime != null ? em.alarmTime - (em.ignitionTime ?? 0) : null,
      firesExtinguished: this.fires.totalExtinguished, totalFires: this.stats.totalFires, peakFires: this.fires.peakActive,
      exposure: this.stats.exposure, extinguisherUsed: this.extinguisher.used, accuracy: this.extinguisher.accuracy,
      doorsClosed: this.stats.doorsClosed, smokeTime: this.stats.smokeTime, crouchedInSmoke: this.stats.crouchSmokeTime > 3,
      evacTime: em.alarmTime != null ? em.time - em.alarmTime : em.time, scenarioName: this.scenario.name,
      exitId: outcome === 'evacuated' ? exitId : null, distance: P.distance,
    });
    this.lastResults = results;
    this.onEvent?.({ type: 'ended', results });
  }

  _updateStrobes(active, pos) {
    const strobe = this.materials.m.strobe;
    if (!active) { strobe.emissiveIntensity = 0.15; this.alarmLight.intensity = 0; return; }
    const ph = this.time % 1.0;
    const flash = ph < 0.09 || (ph > 0.18 && ph < 0.25);
    strobe.emissiveIntensity = flash ? 12 : 0.2;
    const room = roomAt(pos.x, pos.z);
    if (room) {
      this.alarmLight.position.set((room.x0 + room.x1) / 2, 2.6, (room.z0 + room.z1) / 2);
      if (room.id === 'corridor') this.alarmLight.position.x = Math.max(2, Math.min(38, pos.x));
      this.alarmLight.intensity = flash ? 14 : 0;
    } else this.alarmLight.intensity = 0;
  }

  // ------------------------------------------------------------------ interaction
  _updateInteraction() {
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    const hits = this.raycaster.intersectObjects(this.interactables, true);
    let target = null;
    for (const h of hits) {
      const it = h.object.userData.interact;
      if (!it) continue;
      if (!h.object.visible || (it.type === 'extinguisher' && !it.item.available)) continue;
      // line of sight check (don't interact through walls / glass)
      const back = this.raycaster.ray.direction.clone().multiplyScalar(-0.25).add(h.point);
      const cam = this.camera.position;
      const blocked = this.collision.segmentHits(cam.x, cam.z, back.x, back.z, isStructural, 1) > 0;
      if (blocked) break;
      target = it;
      break;
    }
    let prompt = null;
    if (target) {
      if (target.type === 'door') prompt = target.door.open ? 'Close door' : 'Open door';
      else if (target.type === 'extinguisher') prompt = this.extinguisher.held ? 'Swap for a full extinguisher' : 'Pick up fire extinguisher';
      else if (target.type === 'alarm') prompt = target.item.activated ? 'Alarm point already activated' : 'Activate fire alarm (Manual Call Point)';
    }
    this._prompt = prompt;
    if (target && this.input.wasPressed('KeyE')) this._interact(target);
  }

  _interact(t) {
    if (t.type === 'door') {
      const d = t.door;
      d.open = !d.open;
      this.audio.door(d.open);
      if (!d.open && this.emergency.state !== 'normal') this.stats.doorsClosed++;
    } else if (t.type === 'extinguisher') {
      const item = t.item;
      item.available = false;
      item.model.visible = false;
      this.extinguisher.pickUp();
      this._emptyWarned = false;
      this.audio.pickup();
      this._notify('Extinguisher ready: hold LEFT MOUSE to spray. Aim at the base of the flames.', 'info');
      this._log(`Picked up extinguisher ${item.id}`, 'info');
    } else if (t.type === 'alarm') {
      const item = t.item;
      if (item.activated) return;
      item.activated = true;
      item.mesh.userData.flag.visible = true;
      this.audio.alarmButton();
      const ev = this.emergency.triggerAlarm('player');
      for (const e of ev) this._handleEmergencyEvent(e);
      if (!ev.length) this._notify('Call point activated.', 'info');
    }
  }

  _animateDoors(dt) {
    for (const d of this.office.doors) {
      const target = d.open ? d.openAngle : 0;
      if (Math.abs(d.angle - target) < 1e-3) continue;
      d.angle += (target - d.angle) * Math.min(1, dt * 7);
      if (Math.abs(d.angle - target) < 0.01) d.angle = target;
      d.pivot.rotation.y = d.angle;
      const frac = Math.abs(d.angle / d.openAngle);
      d.closedCol.enabled = frac < 0.15;
      d.openCol.enabled = frac > 0.8;
    }
  }

  // Incident timeline for the debrief (time is seconds since the session started).
  _log(text, kind = 'info') { this.timeline.push({ t: this.emergency.time, text, kind }); }

  // ------------------------------------------------------------------ output
  _notify(text, kind = 'info') { this.onEvent?.({ type: 'notify', text, kind }); }

  _emitState(force, dt = 0, sm = null) {
    this._uiAcc += dt;
    this._mapAcc += dt;
    if (this._mapAcc > 0.066 || force) {
      this._mapAcc = 0;
      this.minimap.draw({
        doors: this.office.doors, extinguishers: this.office.extinguishers, callPoints: this.office.callPoints,
        fires: this.fires.fires, route: this.route, showRoute: this.emergency.alarmActive,
        player: { x: this.player.position.x, z: this.player.position.z, yaw: this.player.yaw },
      }, this.time);
    }
    if (this._uiAcc < 0.1 && !force) return;
    this._uiAcc = 0;
    const em = this.emergency;
    const P = this.player;
    const active = this.fires.activeFires;
    const maxI = active.reduce((a, f) => Math.max(a, f.intensity), 0);
    let nearest = Infinity;
    for (const f of active) nearest = Math.min(nearest, f.position.distanceTo(P.position));
    // direction to the next route waypoint relative to view
    let dirAngle = null, nextDist = null;
    if (this.route && this.route.points.length > 1) {
      let tgt = this.route.points[1];
      for (let i = 1; i < this.route.points.length; i++) {
        tgt = this.route.points[i];
        if (tgt.distanceTo(new THREE.Vector2(P.position.x, P.position.z)) > 1.2) break;
      }
      const ang = Math.atan2(-(tgt.x - P.position.x), -(tgt.y - P.position.z));
      dirAngle = ((P.yaw - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      nextDist = this.route.length;
    }
    const room = roomAt(P.position.x, P.position.z);
    const hz = this._hazard || { inFlames: false, radiant: 0 };
    this.onState?.({
      mode: this.mode,
      state: em.state,
      scenario: this.scenario?.name,
      elapsed: em.time,
      countdown: em.countdown,
      evacTotal: EVAC_TIME,
      alarmActive: em.alarmActive,
      alarmSource: em.alarmSource,
      objective: em.objective({
        holding: this.extinguisher.held, capacity: this.extinguisher.capacity, activeFires: active.length,
        maxIntensity: maxI, nearestFireDist: nearest, headInSmoke: this.smoke.headInSmoke, outside: this._outside,
      }),
      fires: {
        active: active.length,
        extinguished: this.fires.totalExtinguished,
        total: this.fires.fires.length,
        maxIntensity: maxI,
        list: active.slice().sort((a, b) => b.intensity - a.intensity).slice(0, 4)
          .map((f) => ({ id: f.id, room: f.room, intensity: f.intensity, danger: f.danger })),
        nearest: Number.isFinite(nearest) ? nearest : null,
      },
      health: this.health,
      visibility: this.smoke.visibility,
      roomSmoke: sm ? sm.roomSmoke : 0,
      headInSmoke: this.smoke.headInSmoke,
      evacStatus: em.state === 'ended' ? (em.outcome === 'evacuated' ? 'safe' : 'failed') : this._outside ? 'outside' : 'inside',
      crouching: P.crouching,
      sprinting: P.sprinting,
      room: room ? room.name : 'Outside',
      holding: this.extinguisher.held,
      capacity: this.extinguisher.capacity,
      spraying: this.extinguisher.spraying,
      spray: this._sprayFeedback || null,
      prompt: this._prompt,
      route: this.route && em.alarmActive ? {
        exitId: this.route.exitId, exitName: EXITS[this.route.exitId].name, distance: this.route.length,
        hazardous: this.route.hazardous, blocked: this.route.blockedExits,
      } : null,
      dirAngle: em.alarmActive ? dirAngle : null,
      nextDist,
      inFlames: hz.inFlames,
      radiant: hz.radiant,
      locked: this.input.locked,
      paused: this.paused,
      fps: Math.round(this.fps),
    });
  }

  _render() {
    if (this.mode === 'play') this._animateDoors(this._dt || 1 / 60);
    const r = this.renderer;
    r.clear();
    r.render(this.scene, this.camera);
    if (this.mode === 'play' && this.extinguisher.held && !this.ended) {
      r.clearDepth();
      r.render(this.viewScene, this.viewCamera);
    }
  }

  // ------------------------------------------------------------------ debug / test hooks
  // Advance the simulation deterministically without rendering (used by automated tests).
  debugAdvance(seconds, step = 1 / 30) {
    for (let t = 0; t < seconds && !this.ended; t += step) {
      this.time += step;
      this._dt = step;
      this._updatePlay(step);
      this._animateDoors(step);
      this.input.endFrame();
    }
  }

  debugTeleport(x, z, yaw = this.player.yaw, pitch = 0) {
    this.player.reset(x, z, yaw);
    this.player.pitch = pitch;
    this.player._apply();
  }

  dispose() {
    this._disposed = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resize);
    this.input.dispose();
    this.fires.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    this.envTex.dispose();
    this.renderer.dispose();
    this.audio.ctx?.close();
  }
}

export { ROOMS };
