# Development Checklist

Status as of this delivery. ✅ = implemented and verified (automated test or visual check).

## Setup
- ✅ Inspected the environment and created a new `emergency-rescue-simulator/` directory (nothing overwritten)
- ✅ Vite + React + Three.js; all dependencies checked for permissive licences
- ✅ `npm install`, `npm run dev`, `npm run build` all work

## Environment
- ✅ Office floor plan: reception, 2 offices, conference room, open plan, break room, server/print room, HR, corridor
- ✅ Walls with baseboards, exterior windows with mullions, glass partitions with privacy bands
- ✅ Hinged interactive doors; exit doorways with canopies
- ✅ Procedural furniture: desks, monitors, chairs, conference table, sofas, shelves, cabinets, kitchen, server racks, copiers, plants
- ✅ Ceiling tiles, light panels, smoke detectors, alarm strobes, EXIT signs, extinguishers, call points
- ✅ Exterior: grounds, parking, cars, trees, lamp posts, hedges (boundary), assembly points
- ✅ PBR materials, procedural textures, shadows, IBL environment, ACES tone mapping

## Player
- ✅ First-person camera, Pointer Lock mouse look
- ✅ WASD movement, sprint, crouch, jump, gravity
- ✅ Collision with walls, doors and furniture (sub-stepped)
- ✅ E to interact, LMB to use equipment, Esc to pause

## Fire & smoke
- ✅ Fire objects (ID, position, intensity, spread rate, fuel, status, smoke rate, danger level)
- ✅ Growth over time; heat-transfer propagation between combustible zones (walls/closed doors attenuate)
- ✅ Flame, smoke and steam particles; glow, scorch and danger-ring decals; flickering fire lights
- ✅ Room-level smoke model, descending smoke layer, visibility and fog, inhalation damage

## Extinguisher
- ✅ Find and pick up; first-person view model
- ✅ Capacity gauge; hold LMB to spray; discharge particles
- ✅ Range, cone, base-of-fire aim and line-of-sight effectiveness
- ✅ Stops when empty; on-screen P.A.S.S. instructions

## Emergency & evacuation
- ✅ Emergency manager state machine; manual call points; automatic detector alarm
- ✅ Alarm sounder, flashing strobes and red alarm light, countdown, objectives
- ✅ Danger zones and warnings; safe-zone detection; success and failure states
- ✅ Danger-aware Dijkstra routing to 3 exits; floor arrows, HUD compass, minimap route, blocked-exit notices

## UI
- ✅ Landing page with 3D fly-through, scenario selection, instructions, settings, about
- ✅ HUD: status, timer, objective, fire status, health, visibility/smoke, extinguisher, minimap, prompts, notifications
- ✅ Pause menu: resume, restart, instructions, settings, main menu
- ✅ Results: outcome, time, fires extinguished, exposure, extinguisher usage, score breakdown, rating, suggestions, best score

## Quality
- ✅ Modular architecture (see README)
- ✅ Quality presets, batched geometry (~78 draw calls), pooled particles and lights
- ✅ Automated e2e suite: 36/36 passing, no console errors (dev and production)
- ✅ Layout validation: spawns, nav graph and equipment reachability
- ✅ README with install, run, features, architecture, licences and deployment instructions
- ✅ Netlify / Vercel configuration; GitHub Pages instructions

## Refinement pass
- ✅ Environment fixes: ceiling fixtures no longer cast floating floor shadows, glazed exit doors,
  no wall cracks at window joints, depth precision (near plane 0.1 m)
- ✅ Environment additions: approximated AO (vertex-alpha contact shadows and corner gradients),
  leafy plants, smooth trees, hedges, skyline, room plates, "You are here" evacuation plans, HVAC grilles, clocks
- ✅ Controls: mouse-spike filtering, Esc pauses while the mouse isn't captured, no key carry-over on resume
- ✅ Fire: light occlusion (no glow through walls), embers, spray on-target and coaching feedback
- ✅ Evacuation: assembly-point completion, status chip, route hysteresis (reset per session), countdown warnings
- ✅ UI: incident timeline in the debrief, sticky results actions at 720p, keyboard focus styles
- ✅ Tests: 24 → 36 checks, all passing, no console errors

## Not implemented (see README → Known limitations)
- ⬜ NPC occupants
- ⬜ Multi-storey building / stairs
- ⬜ Physically accurate CFD smoke or combustion (out of scope by design)
