# Demonstration Guide (3–5 minutes)

This script covers a live demonstration of the simulator using the **Break-room fire** scenario. Each
step lists **what to do** and **what to say**. Approximate timings are given; the whole demo fits in
about 4 minutes, with time for questions.

---

## Before the demo (preparation checklist)

- [ ] Run `npm install` once, then start the app with `npm run dev`. Alternatively, run
      `npm run build && npm run preview` for the optimised build.
- [ ] Open the app in **Chrome or Edge**, in **full screen** (`F11`, or `Ctrl+Cmd+F` on macOS).
- [ ] Turn on sound at a moderate volume.
- [ ] Open **Settings** and choose **Medium** (or **Low** on a weak laptop).
- [ ] Do one practice run, so you know where the call point and extinguisher are.
- [ ] Optional: open `README.md` or `docs/PROJECT_REPORT.md` in another tab for architecture
      questions.

**Key locations in the Break-room fire scenario.** You start in the **Director's Office** (north-east)
and the fire starts on the **kitchen counter** (south side of the corridor).

| Item | Where to find it |
|---|---|
| Nearest call point | On the **corridor wall of the kitchen**, just west of the kitchen door. A second one is **next to the server-room door** |
| Nearest extinguisher | On the **north corridor wall opposite the kitchen**, near the Finance Office door |
| Usual safest exit | **Exit B**, the east end of the corridor |

---

## Step 1 — Landing page (≈ 30 s)

**Do:** Leave the landing page visible. The background is a live 3D fly-through.

**Say:**
> "This is the Emergency Rescue & Evacuation Simulator, a first-person 3D fire-safety training
> application that runs entirely in the browser. It's built with Three.js on WebGL, with React for the
> interface. Everything you see is generated in code: the office, the furniture, the textures, the
> signage and even the sound effects. There are no downloaded 3D models or image files. The background
> here is the real-time engine flying through the office."

**Do:** Point at the scenario buttons, then select **Break-room fire**.

## Step 2 — Start and explore (≈ 30 s)

**Do:** Click **Start Simulation**. Walk out of the Director's Office into the corridor. Look around.

**Say:**
> "I'm in first person. WASD moves me, the mouse looks around using the Pointer Lock API, Shift
> sprints, and C crouches. Collision detection stops me walking through walls or furniture. Notice the
> lighting: physically based materials, shadow mapping from a directional light, image-based lighting,
> and soft contact shadows under the furniture that approximate ambient occlusion. There are real
> safety details too: EXIT signs, red extinguishers, alarm call points, and this 'You are here'
> evacuation plan, which is generated from the same floor-plan data as the level itself."

**Do:** Briefly point at the HUD: status, timer, minimap, health and visibility bars.

## Step 3 — The fire starts; raise the alarm (≈ 40 s)

**Do:** After about 4 seconds the status turns **Smoke detected**. Walk west along the corridor toward
the kitchen. Look at the red **Manual Call Point** on the kitchen's corridor wall, wait for the
`[E] Activate fire alarm` prompt, and press **E**.

**Say:**
> "A fire has started in the break room. The first correct action is to raise the alarm. I'm
> looking at a manual call point. The prompt appears because a ray cast from the centre of the screen
> hits it. I press E. Now the alarm sounds, the strobes flash, and a 180-second evacuation clock
> starts. If I hadn't done this, the smoke detectors would trigger it after 30 seconds, but I'd lose
> points."

## Step 4 — Fight the small fire with the extinguisher (≈ 60 s)

**Do:** Pick up the extinguisher on the **north corridor wall** (`E`). Enter the kitchen and stand
about **3 m** from the fire. First aim **high** and hold the left mouse button briefly, to show the
amber *"Aim at the base"* hint. Then aim at the **base** of the flames until the crosshair turns
**green** and shows **ON TARGET**. Keep spraying until the fire is extinguished.

**Say:**
> "The fire is still small, so with a clear escape route behind me I can tackle it. The extinguisher
> has limited capacity, about 13 seconds. If I aim at the top of the flames, the system tells me I'm
> missing. That's an analytic cone test along my view direction. When I aim at the base the crosshair
> turns green and the intensity drops. The flames, embers, smoke and spray are GPU particle systems:
> flames use additive blending so they glow, smoke uses normal blending so it darkens the scene. At
> zero intensity the fire is marked extinguished, with steam."

*If the fire has already spread (for example, because the demo took longer), say:*
> "The fire has spread. The spread is computed from heat transfer between combustible zones, and
> walls and closed doors reduce it. When a fire gets this big, the right decision is to evacuate."

## Step 5 — Evacuate (≈ 50 s)

**Do:** Turn toward the green floor arrows and follow them east along the corridor. On the way, close
an open door with `E`. If there is smoke, press `C` to crouch.

**Say:**
> "Now I evacuate. The green arrows and the compass come from Dijkstra's shortest-path algorithm on a
> navigation graph, with extra cost near fires and smoke, so the route avoids danger and re-plans if
> an exit becomes blocked. Closing doors matters: a closed door is a wall in the heat-transfer and
> smoke models, so it really does slow the spread. Smoke collects as a descending layer under the
> ceiling, so crouching keeps visibility and health up."

**Do:** Exit through **Exit B**. Point at the status chip: **OUTSIDE — GO TO ASSEMBLY**.

**Say:**
> "Getting out of the door isn't enough. Just as in a real drill, I have to reach the assembly point
> and be accounted for."

**Do:** Walk into the green **assembly point** circle.

## Step 6 — Results and debrief (≈ 40 s)

**Do:** Show the results screen. Point at the rating, score breakdown, statistics, suggestions and
incident timeline.

**Say:**
> "The debrief scores the response: a safe evacuation, time remaining, health, raising the alarm
> myself, fires extinguished, extinguisher accuracy, doors closed, and a penalty for heat exposure. It
> gives personalised improvement suggestions and an incident timeline of exactly what happened when.
> For training, that feedback is the most valuable part."

## Step 7 — Wrap-up (≈ 20 s)

**Say:**
> "To summarise: procedural 3D modelling, PBR lighting and shadows, particle systems with custom
> shaders, collision detection, raycasting, physics and pathfinding, all combined into a real-time
> simulation that responds to your decisions. It's tested by an automated suite of 36 end-to-end
> checks that drive the real application in headless Chrome. Thank you. I'm happy to take questions."

---

## Optional extras (if time allows or if asked)

| Show | How | Talking point |
|---|---|---|
| **Failure case** | Restart; stand near the fire without acting until health drops | Heat and smoke damage; failure debrief and tips |
| **Pause menu** | Press `Esc` | Pointer-lock release pauses the game; Resume / Restart / Settings |
| **Quality settings** | Settings → Low / High | Shadow-map size, pixel ratio and particle-count trade-offs |
| **Other scenario** | *Corridor copier fire* | The fire is in the escape corridor itself, so the router picks a different exit |
| **Code tour** | `src/engine/environment/layout.js`, `systems/FireSystem.js` | Data-driven level; heat-transfer spread formula |

## If something goes wrong

| Problem | Recovery |
|---|---|
| The mouse is not captured | Click the 3D view once |
| Pressed Esc by accident | Click **Resume** (wait a second if "Click to continue" appears, then click) |
| The fire spread too far to extinguish | Explain the spread model and switch to the evacuation part (Step 5) |
| The game is slow | Settings → **Low**; close other browser tabs |
| Got lost | Look at the minimap and follow the green arrows after the alarm |
