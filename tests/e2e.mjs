import puppeteer from 'puppeteer-core';
const OUT = process.env.OUT_DIR || 'tests/screenshots';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.APP_URL || 'http://localhost:4173/';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720'],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction(() => window.__ers && document.querySelector('.landing'), { timeout: 60000 });

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };
const ev = (fn) => page.evaluate(fn);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- start
await page.click('.btn.primary.big');
await ev(() => { const e = window.__ers; e.allowUnlocked = true; e.startSession('kitchen'); });
await sleep(300);
check('HUD rendered after start', await ev(() => !!document.querySelector('.hud .status-card')));
let r = await ev(() => { const e = window.__ers; e.debugAdvance(5); return { st: e.emergency.state, fires: e.fires.fires.map((f) => f.zoneId) }; });
check('Fire ignites after start delay', r.st === 'fire' && r.fires[0] === 'k1', JSON.stringify(r));

// --- movement
r = await ev(() => {
  const e = window.__ers; e.debugTeleport(5, 11.5, -Math.PI / 2);
  const x0 = e.player.position.x;
  e.input.keys.add('KeyW'); e.debugAdvance(1); e.input.keys.delete('KeyW');
  return { moved: e.player.position.x - x0 };
});
check('WASD forward movement (walk ≈3 m/s)', r.moved > 2.2 && r.moved < 3.5, `moved ${r.moved.toFixed(2)} m`);
r = await ev(() => {
  const e = window.__ers; e.debugTeleport(5, 11.5, -Math.PI / 2);
  const x0 = e.player.position.x;
  e.input.keys.add('KeyW'); e.input.keys.add('ShiftLeft'); e.debugAdvance(1); e.input.keys.clear();
  return { moved: e.player.position.x - x0 };
});
check('Sprint is faster', r.moved > 4, `moved ${r.moved.toFixed(2)} m`);

// --- collision with walls (walk north into wall z=10 at x=14)
r = await ev(() => {
  const e = window.__ers; e.debugTeleport(14, 11.5, 0);
  e.input.keys.add('KeyW'); e.debugAdvance(2); e.input.keys.clear();
  return { z: e.player.position.z };
});
check('Wall collision stops player', r.z > 10.3, `z=${r.z.toFixed(3)} (wall face at 10.1)`);
// furniture collision: walk into the reception desk
r = await ev(() => {
  const e = window.__ers; e.debugTeleport(6.5, 4.4, -Math.PI / 2);
  e.input.keys.add('KeyW'); e.debugAdvance(2); e.input.keys.clear();
  return { x: e.player.position.x };
});
check('Furniture collision (reception desk)', r.x < 8.9, `x=${r.x.toFixed(2)}`);
// gravity + jump
r = await ev(() => {
  const e = window.__ers; e.debugTeleport(5, 11.5, 0);
  e.input.pressed.add('Space'); e.debugAdvance(0.2); const y1 = e.player.position.y; e.debugAdvance(1.2);
  return { y1, y2: e.player.position.y };
});
check('Jump & gravity', r.y1 > 0.3 && r.y2 === 0, JSON.stringify(r));

// wall sliding: walking diagonally into a wall should slide along it, not stick
r = await ev(() => {
  const e = window.__ers; e.debugTeleport(14, 10.7, Math.PI / 4);
  const x0 = e.player.position.x;
  e.input.keys.add('KeyW'); e.debugAdvance(1); e.input.keys.clear();
  return { dx: x0 - e.player.position.x, z: e.player.position.z };
});
check('Slides along walls at an angle', r.dx > 1.2 && r.z > 10.3, JSON.stringify(r));
// spurious mouse spikes are ignored, normal motion rotates the view
r = await ev(() => {
  const e = window.__ers; e.debugTeleport(5, 11.5, 0);
  const inp = e.input; const wasLocked = inp.locked; inp.locked = true;
  inp._mm({ movementX: 5000, movementY: 0 }); e.debugAdvance(0.05); const yawSpike = e.player.yaw;
  inp._mm({ movementX: 100, movementY: 0 }); e.debugAdvance(0.05); const yawNormal = e.player.yaw;
  inp.locked = wasLocked;
  return { yawSpike, yawNormal };
});
check('Mouse look rotates; spurious spikes ignored', Math.abs(r.yawSpike) < 1e-6 && r.yawNormal < -0.1, JSON.stringify(r));

// --- door interaction (conference door, closed initially)
r = await ev(() => {
  const e = window.__ers; e.debugTeleport(23.5, 11.4, 0, -0.15);
  e._updateInteraction();
  const prompt = e._prompt;
  e.input.pressed.add('KeyE'); e._updateInteraction(); e.input.endFrame(); e.debugAdvance(1.0);
  const d = e.office.doors.find((d) => d.id === 'dConf');
  return { prompt, open: d.open, closedCol: d.closedCol.enabled };
});
check('Door prompt & open with E', r.prompt === 'Open door' && r.open && !r.closedCol, JSON.stringify(r));
r = await ev(() => {
  const e = window.__ers; e.debugTeleport(23.5, 11.5, 0);
  e.input.keys.add('KeyW'); e.debugAdvance(1.5); e.input.keys.clear();
  return { z: e.player.position.z };
});
check('Can walk through opened door', r.z < 9.6, `z=${r.z.toFixed(2)}`);

// --- manual call point (MCP4 at 27, 12.88 on server wall)
r = await ev(() => {
  const e = window.__ers; e.debugTeleport(27, 12.0, Math.PI, -0.25);
  e._updateInteraction();
  const prompt = e._prompt;
  e.input.pressed.add('KeyE'); e._updateInteraction(); e.input.endFrame();
  return { prompt, st: e.emergency.state, src: e.emergency.alarmSource, cd: e.emergency.countdown, alarmOn: e.audio.alarmOn };
});
check('Manual call point raises alarm', r.st === 'alarm' && r.src === 'player' && r.cd > 170, JSON.stringify(r));
r = await ev(() => { const e = window.__ers; e.debugAdvance(1); return { strobe: e.materials.m.strobe.emissiveIntensity, arrows: e.arrows.mesh.count, route: e.route && e.route.exitId, len: e.route && e.route.length }; });
check('Evacuation route + arrows active', r.arrows > 0 && !!r.route, JSON.stringify(r));

// --- extinguisher pickup (X2 at 20, 10.12)
r = await ev(() => {
  const e = window.__ers; e.debugTeleport(20, 11.1, 0, -0.62);
  e._updateInteraction();
  const prompt = e._prompt;
  e.input.pressed.add('KeyE'); e._updateInteraction(); e.input.endFrame();
  return { prompt, held: e.extinguisher.held, cap: e.extinguisher.capacity };
});
check('Extinguisher pickup', r.held && r.cap === 100, JSON.stringify(r));
await page.screenshot({ path: `${OUT}/f1-holding.png` });

// --- suppression on the kitchen fire
r = await ev(() => {
  const e = window.__ers;
  const f = e.fires.fires.find((f) => f.zoneId === 'k1');
  const before = f.intensity;
  e.debugTeleport(22.3, 16.0, -Math.PI / 2, -0.5);
  e.input.firing = true; e.debugAdvance(1.5);
  const mid = f.intensity;
  return { before, mid, cap: e.extinguisher.capacity, onT: e.extinguisher.onTargetTime, fb: e._sprayFeedback };
});
check('Spraying reduces fire intensity & capacity', r.mid < r.before - 0.2 && r.cap < 90, JSON.stringify(r));
check('Spray feedback reports ON TARGET when hitting', r.fb && r.fb.onTarget === true, JSON.stringify(r.fb));
r = await ev(() => {
  const e = window.__ers;
  e.debugTeleport(22.3, 16.0, Math.PI / 2, -0.5); // facing away from the fire
  e.debugAdvance(0.2);
  const away = e._sprayFeedback;
  e.debugTeleport(22.3, 16.0, -Math.PI / 2, 0.6); // facing the fire but aiming at the ceiling
  e.debugAdvance(0.2);
  const high = e._sprayFeedback;
  e.debugTeleport(22.3, 16.0, -Math.PI / 2, -0.5);
  return { away, high };
});
check('Spray feedback coaches when missing', r.away && !r.away.onTarget && r.high && !r.high.onTarget && /base/.test(r.high.text), JSON.stringify(r));
await page.screenshot({ path: `${OUT}/f2-spraying.png` });
r = await ev(() => {
  const e = window.__ers;
  e.debugAdvance(5);
  e.input.firing = false;
  const k = e.fires.fires.filter((f) => f.zone.room.id === 'kitchen');
  return { fires: e.fires.fires.map((f) => [f.zoneId, +f.intensity.toFixed(2), f.extinguished]), ext: e.fires.totalExtinguished, cap: e.extinguisher.capacity };
});
check('Fire marked extinguished at zero intensity', r.ext >= 1, JSON.stringify(r));
r = await ev(() => { const e = window.__ers; e.input.firing = true; e.debugAdvance(15); e.input.firing = false; return { cap: e.extinguisher.capacity, spraying: e.extinguisher.spraying }; });
check('Extinguisher stops when empty', r.cap === 0, JSON.stringify(r));

// --- pausing. In a real browser Esc releases pointer lock and the lock-change handler pauses;
// synthetic key events can't release the lock, so that path is exercised with exitPointerLock().
const pauseState = () => ev(() => ({ paused: window.__ers.paused, menu: !!document.querySelector('.panel.pause') }));
const clickResume = () => page.evaluate(() => [...document.querySelectorAll('.panel.pause button')].find((b) => b.textContent.includes('Resume'))?.click());
await ev(() => { if (document.pointerLockElement) document.exitPointerLock(); else window.__ers.pause(); });
await sleep(400);
r = await pauseState();
check('Losing pointer lock (Esc in browser) opens pause menu', r.paused && r.menu, JSON.stringify(r));
await clickResume();
await sleep(400);
r = await pauseState();
check('Resume closes pause menu', !r.paused && !r.menu, JSON.stringify(r));
// reach a clean precondition: mouse NOT captured, game running, no menu (the click-to-continue state).
// Real Chrome refuses to re-lock for ~1 s after Esc; reproduce that by stubbing requestLock for this check.
await ev(() => { const i = window.__ers.input; i.__req = i.requestLock; i.requestLock = () => {}; if (document.pointerLockElement) document.exitPointerLock(); });
await sleep(400);
if ((await pauseState()).paused) { await clickResume(); await sleep(400); }
// the HUD snapshot refreshes on simulated time; software rendering is slow, so poll rather than sleep
await page.waitForFunction(() => !!document.querySelector('.click-overlay'), { timeout: 8000 }).catch(() => {});
r = await ev(() => ({ locked: window.__ers.input.locked, paused: window.__ers.paused, menu: !!document.querySelector('.panel.pause'), overlay: !!document.querySelector('.click-overlay'), ended: window.__ers.ended, health: Math.round(window.__ers.health), hud: !!document.querySelector('.hud') }));
check('Refused re-lock shows click-to-continue (unlocked, running, no menu)', !r.locked && !r.paused && !r.menu && r.overlay, JSON.stringify(r));
await page.keyboard.press('Escape');
await sleep(400);
r = await pauseState();
check('Esc while mouse not captured opens pause menu', r.paused && r.menu, JSON.stringify(r));
await ev(() => { const i = window.__ers.input; i.requestLock = i.__req; });
await clickResume();
await sleep(400);
await ev(() => { window.__ers.paused = false; });

// --- leaving the building is not enough: must reach the assembly point
r = await ev(() => {
  const e = window.__ers; e.debugTeleport(42.0, 11.5, -Math.PI / 2); e.debugAdvance(0.5);
  const o = e.emergency.objective({ outside: e._outside });
  return { ended: e.ended, outside: e._outside, title: o.title };
});
check('Outside the door is not yet safe (go to assembly point)', !r.ended && r.outside && /assembly/i.test(r.title), JSON.stringify(r));

// --- evacuation via exit B
r = await ev(() => {
  const e = window.__ers; e.debugTeleport(38.5, 11.5, -Math.PI / 2);
  e.input.keys.add('KeyW'); e.debugAdvance(3); e.input.keys.clear();
  return { ended: e.ended, x: e.player.position.x, outcome: e.emergency.outcome, res: e.lastResults && { score: e.lastResults.score, rating: e.lastResults.rating } };
});
check('Safe zone detection → evacuated', r.ended && r.outcome === 'evacuated', JSON.stringify(r));
await sleep(600);
check('Results screen shown', await ev(() => !!document.querySelector('.results .outcome.win')));
r = await ev(() => [...document.querySelectorAll('.timeline li .tl-text')].map((n) => n.textContent));
check('Debrief incident timeline lists key events', r.some((t) => /ignition/.test(t)) && r.some((t) => /raised the fire alarm/.test(t)) && r.some((t) => /extinguished/.test(t)) && r.some((t) => /assembly point/.test(t)), JSON.stringify(r));
await page.screenshot({ path: `${OUT}/f3-results.png` });

// --- restart & fire spread without intervention
await page.click('.results .btn.primary');
await sleep(300);
r = await ev(() => {
  const e = window.__ers; e.allowUnlocked = true;
  e.debugTeleport(36, 6, 0);
  e.debugAdvance(5);
  const t0 = e.fires.fires.length;
  e.debugAdvance(70);
  return { restarted: !e.ended, t0, t1: e.fires.fires.length, active: e.fires.activeFires.length, st: e.emergency.state, src: e.emergency.alarmSource, rooms: [...new Set(e.fires.fires.map((f) => f.room))], smoke: e.smoke.rooms.map((r) => [r.id, +r.smoke.toFixed(2)]) };
});
check('Restart resets the session', r.restarted && r.t0 === 1, JSON.stringify({ t0: r.t0 }));
check('Fire propagates between zones over time', r.t1 > 1, JSON.stringify(r));
check('Smoke detectors auto-trigger alarm', r.st === 'alarm' && r.src === 'detector');
r = await ev(() => { const e = window.__ers; e.debugTeleport(23, 12, 0); e.debugAdvance(0.5); return { route: e.route && e.route.exitId, blocked: e.route && e.route.blockedExits, haz: e.route && e.route.hazardous, pts: e.route && e.route.points.map((p) => [+p.x.toFixed(1), +p.y.toFixed(1)]) }; });
console.log('   route from corridor centre:', JSON.stringify(r));
await page.screenshot({ path: `${OUT}/f4-spread.png` });
r = await ev(() => {
  const e = window.__ers;
  const f = e.fires.activeFires[0];
  e.debugTeleport(26.5, 5, Math.PI); e.debugAdvance(1.5);           // conference room: walls between camera and fire
  const hidden = f.lightVis;
  e.debugTeleport(f.position.x - 2.5, f.position.z, -Math.PI / 2); e.debugAdvance(1.5); // same room, clear view
  const visible = f.lightVis;
  return { hidden: +hidden.toFixed(2), visible: +visible.toFixed(2) };
});
check('Fire light dimmed when walls block view (no glow through walls)', r.hidden < 0.3 && r.visible > 0.9, JSON.stringify(r));
r = await ev(() => { const e = window.__ers; e.debugTeleport(22, 16, -Math.PI / 2); const h0 = e.health; e.debugAdvance(2); return { h0, h1: e.health }; });
check('Fire exposure damages health', r.h1 < r.h0, JSON.stringify(r));
r = await ev(() => { const e = window.__ers; e.debugAdvance(200); return { ended: e.ended, outcome: e.emergency.outcome, reason: e.emergency.failReason }; });
check('Failure state (health/time)', r.ended && r.outcome === 'failed', JSON.stringify(r));
await sleep(500);
check('Failure results screen', await ev(() => !!document.querySelector('.results .outcome.lose')));
await page.screenshot({ path: `${OUT}/f5-fail.png` });

// --- back to menu
await page.click('.results .btn.ghost');
await sleep(400);
check('Main menu returns', await ev(() => !!document.querySelector('.landing')));

// routing must not carry state between sessions (hysteresis is per session)
r = await ev(() => {
  const e = window.__ers;
  e.startSession('kitchen'); e.debugTeleport(46, 11.5, 0); e.debugAdvance(0.5);   // bias towards exit B
  e.startSession('server'); e.debugAdvance(0.5);
  const fresh = e.route && e.route.exitId;
  e.router.route = null; e.router.update(e.player.position.x, e.player.position.z, e.fires.fires, e.smoke);
  return { fresh, expected: e.router.route.exitId };
});
check('New session routing is independent of the previous session', r.fresh === r.expected, JSON.stringify(r));


console.log(`\n${pass} passed, ${fail} failed`);
console.log(logs.length ? logs.join('\n') : 'No console errors/warnings.');
await browser.close();
process.exit(fail ? 1 : 0);
