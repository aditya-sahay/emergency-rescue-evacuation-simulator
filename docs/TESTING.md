# Testing

This document describes how the simulator was tested. It keeps **automated testing** (scripted,
repeatable, results recorded below) separate from **manual testing** (performed by a person in a
browser).

---

## 1. Automated end-to-end tests

### 1.1 What the suite is

`tests/e2e.mjs` is an end-to-end test script that drives the **real application** in a real browser:

- It uses **puppeteer-core** (development dependency) to launch the locally installed **Google
  Chrome** in headless mode.
- WebGL is provided by **SwiftShader**, a CPU software renderer, so no GPU is needed.
- The script loads the app (by default the production build at `http://localhost:4173/`) and clicks
  the real UI.
- It reads engine state through the instance exposed for testing as `window.__ers`.

Two debug hooks make the tests fast and deterministic:

- `debugAdvance(seconds)` steps the simulation in fixed 1/30 s increments without waiting for real
  time.
- `debugTeleport(x, z, yaw, pitch)` places the player.

Headless browsers cannot grant pointer lock in the normal way, so the suite sets `allowUnlocked` to let
the simulation run without the mouse being captured. Section 1.5 explains how pointer-lock behaviour
is covered.

### 1.2 How to run it

```bash
npm install
npm run build
npm run preview          # serves the build on http://localhost:4173 — leave it running
npm run test:e2e         # in a second terminal
```

Optional environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `CHROME_PATH` | macOS Chrome location | Path to a Chrome/Chromium executable |
| `APP_URL` | `http://localhost:4173/` | Test a different URL, e.g. `http://localhost:5173/` for `npm run dev` |
| `OUT_DIR` | `tests/screenshots` | Where the suite saves screenshots (git-ignored) |

The script prints `PASS`/`FAIL` for each check, then a summary, then any browser console errors or
warnings. It exits with code 1 if any check fails.

### 1.3 Checks performed (36)

| # | Check | Area |
|---|---|---|
| 1 | HUD rendered after start | UI / start-up |
| 2 | Fire ignites after start delay | Fire / emergency |
| 3 | WASD forward movement (walk ≈ 3 m/s) | Player |
| 4 | Sprint is faster | Player |
| 5 | Wall collision stops player | Collision |
| 6 | Furniture collision (reception desk) | Collision |
| 7 | Jump & gravity | Physics |
| 8 | Slides along walls at an angle | Collision |
| 9 | Mouse look rotates; spurious spikes ignored | Camera / input |
| 10 | Door prompt & open with E | Interaction (raycast) |
| 11 | Can walk through opened door | Interaction / collision |
| 12 | Manual call point raises alarm | Emergency |
| 13 | Evacuation route + arrows active | Evacuation |
| 14 | Extinguisher pickup | Extinguisher |
| 15 | Spraying reduces fire intensity & capacity | Extinguisher / fire |
| 16 | Spray feedback reports ON TARGET when hitting | Extinguisher / UI |
| 17 | Spray feedback coaches when missing | Extinguisher / UI |
| 18 | Fire marked extinguished at zero intensity | Fire |
| 19 | Extinguisher stops when empty | Extinguisher |
| 20 | Losing pointer lock (Esc in browser) opens pause menu | Pause / input |
| 21 | Resume closes pause menu | Pause |
| 22 | Refused re-lock shows click-to-continue (unlocked, running, no menu) | Input / UI |
| 23 | Esc while mouse not captured opens pause menu | Pause / input |
| 24 | Outside the door is not yet safe (go to assembly point) | Evacuation |
| 25 | Safe zone detection → evacuated | Evacuation |
| 26 | Results screen shown | UI |
| 27 | Debrief incident timeline lists key events | UI / scoring |
| 28 | Restart resets the session | Session |
| 29 | Fire propagates between zones over time | Fire spread |
| 30 | Smoke detectors auto-trigger alarm | Emergency |
| 31 | Fire light dimmed when walls block view (no glow through walls) | Rendering |
| 32 | Fire exposure damages health | Hazards |
| 33 | Failure state (health/time) | Emergency |
| 34 | Failure results screen | UI |
| 35 | Main menu returns | UI |
| 36 | New session routing is independent of the previous session | Evacuation |

The suite also records **all browser console errors and warnings and page exceptions** during the run,
and reports them at the end.

### 1.4 Latest recorded result

| Target | Result |
|---|---|
| Production build (`npm run preview`, port 4173) | **36 passed, 0 failed — no console errors/warnings** |
| Development server (`npm run dev`) | **36 passed, 0 failed — no console errors/warnings** (recorded during the refinement phase) |
| `npm run build` | Succeeds (Vite 5.4) |

The production-build result above was re-run while preparing this documentation for submission.

### 1.5 How pointer lock is tested

Real browsers release pointer lock when the user presses `Esc`. Puppeteer's synthetic key events
cannot trigger this browser-level behaviour. The suite therefore covers both real code paths
explicitly:

1. **Losing the lock** is simulated with `document.exitPointerLock()`. The test asserts that the pause
   menu opens, as the lock-change handler should make it do.
2. **Refused re-lock:** real Chrome refuses to re-capture the mouse for about one second after `Esc`.
   The test reproduces this by temporarily stubbing `requestLock`. It then asserts that the
   *Click to continue* overlay appears with the game running unpaused, and that pressing `Esc` in this
   state opens the pause menu.

## 2. Layout validation (automated, separate script)

During development a separate validation script (not part of `npm run test:e2e`) checked the level
data against the built collision world. It confirmed that:

- all **4 scenario spawn points** are free of obstacles;
- no **navigation node** lies inside an obstacle, and no **navigation edge** passes through furniture
  or walls (closed doors excluded, because the player opens them);
- all **7 extinguishers** and **5 manual call points** can be reached, and each shows its interaction
  prompt from in front of it.

## 3. Visual verification (automated screenshots, reviewed manually)

During development, screenshots of every room, the exterior, fire, smoke, extinguishing, evacuation
and results screens were captured with headless Chrome and **inspected by eye**. This process found
and fixed several defects:

- ceiling light fixtures casting floating shadow squares onto the floor;
- exit doors rendering as solid slabs;
- hairline cracks at window joints;
- floor decals lost to depth-buffer precision;
- contact shadows that were too faint to see.

The screenshots in [`docs/screenshots/`](screenshots/) come from this process. Because they were
rendered by a software renderer, the FPS values in their HUDs are not representative.

## 4. Manual testing

The author manually tested the major gameplay features in a desktop browser:

- starting scenarios;
- first-person movement and mouse look;
- doors;
- raising the alarm;
- using the extinguisher;
- fire spread;
- evacuation and the results screen.

These manual tests were not scripted, so this document records no item-by-item results for them.

**Suggested manual test checklist** (for anyone re-verifying the project on new hardware):

| # | Step | Expected result |
|---|---|---|
| 1 | Open the app | Landing page with moving 3D background; no errors |
| 2 | Start "Break-room fire" | Mouse is captured; HUD visible; status *Normal operations* |
| 3 | Move with WASD, look with the mouse | Smooth movement; cannot walk through walls or desks |
| 4 | Press `Esc` | Pause menu opens; **Resume** returns to the game |
| 5 | Wait 4 s | Status *Smoke detected*; fire appears in the kitchen |
| 6 | Press `E` at a red call point | Alarm sounds; strobes flash; countdown starts; green arrows appear |
| 7 | Pick up an extinguisher, spray the base of the fire | Crosshair turns green; fire shrinks; *extinguished* message |
| 8 | Close a door with `E` | Door swings shut; it blocks movement |
| 9 | Follow the arrows outside | *Outside — go to assembly* status |
| 10 | Enter the green assembly circle | Results screen with rating, breakdown and timeline |
| 11 | Click **Retry scenario** | New session starts cleanly |

## 5. What is not covered

- **Frame rate on real GPUs.** Performance has not been benchmarked across hardware. In-game render
  cost was measured at about 78 draw calls and 117k triangles.
- **Real pointer-lock behaviour** cannot be automated (see §1.5). It is covered by the manual checklist.
- **Audio output** is not asserted automatically.
- **Browsers other than Chrome** are not covered by the automated suite.
- **Mobile and touch devices** are not supported.
