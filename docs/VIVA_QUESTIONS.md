# Viva Questions and Answers

These questions are prepared for the CGVR laboratory viva. Each answer explains the general concept
and then **how this project actually uses it**, with references to the source files.

---

## A. Computer graphics fundamentals

**1. What is computer graphics, and what is the difference between raster and vector graphics?**

Computer graphics is the generation and manipulation of images by computer.

- **Raster graphics** represent an image as a grid of pixels.
- **Vector graphics** describe it with geometric primitives (lines, curves, polygons) that are
  resolution-independent.

GPUs render 3D scenes by **rasterisation**: they project triangles onto the screen and fill the pixels
they cover. In this project, all 3D content is triangle meshes rasterised by WebGL. Some 2D elements
are drawn as vectors on a canvas and then rasterised into textures. These include the evacuation
plans, the minimap and the signage.

**2. What is the graphics rendering pipeline?**

1. Vertex data (positions, normals, UVs) is processed by the **vertex shader**. It transforms each
   vertex by the model, view and projection matrices into clip space.
2. Primitives are assembled and clipped.
3. A perspective divide and the viewport transform produce screen coordinates.
4. **Rasterisation** generates fragments.
5. The **fragment shader** computes each fragment's colour (lighting, textures).
6. Per-fragment tests (depth, blending) write to the framebuffer.

Three.js generates these shaders for its built-in materials. The project also writes its own GLSL
vertex and fragment shaders for the particle system (`ParticleSystem.js`).

**3. What is a scene graph?**

A scene graph is a hierarchical tree of objects. Each node has a local transform, and its world
transform is the product of its ancestors' transforms.

In Three.js the scene graph is made of `Object3D` nodes. Doors use it directly: each door leaf is a
child of a **pivot** group placed at the hinge. Rotating the pivot about Y therefore swings the whole
door, including its handles and glass panel, about the hinge.

**4. What is a mesh?**

A mesh is geometry plus a material. The geometry here is `BufferGeometry`: typed arrays of vertex
positions, normals, UV coordinates and triangle indices. The material defines how the surface responds
to light.

The project builds thousands of meshes procedurally, then merges every mesh that shares a material
into one, using `Batcher.js` and `BufferGeometryUtils.mergeGeometries`. This reduces the whole office
to about 78 draw calls.

**5. Why does reducing draw calls matter?**

Every draw call has CPU and driver overhead for state changes and validation. Thousands of small draw
calls become CPU-bound long before the GPU is busy. Batching static geometry by material (about 90
merged meshes for the whole level), drawing each particle pool as one `Points` call, and using an
`InstancedMesh` for route arrows keeps the frame cheap.

---

## B. Transformations and coordinate systems

**6. Which coordinate system does the project use?**

A right-handed world coordinate system in **metres**:

- X points east;
- Y points up;
- Z points south.

The building spans x ∈ [0, 40] and z ∈ [0, 24]. Real-world units make dimensions intuitive: doors are
2.1 m high, desks 0.74 m, eye height 1.65 m.

**7. Explain the model, view and projection transformations.**

| Matrix | Maps | Example in this project |
|---|---|---|
| **Model** | Object (local) space → world space | A chair's parts are defined around its own origin; the model matrix places and rotates it |
| **View** | World space → camera space | The inverse of the camera's world transform |
| **Projection** | Camera space → clip space | Applies perspective |

The vertex shader computes `gl_Position = P · V · M · vertex`.

The project's `Builder` composes model matrices hierarchically: `parentMatrix × T × R × S`.

**8. How are rotations represented, and why does the order of Euler angles matter?**

Rotations are composed from Euler angles and stored as quaternions in `Matrix4.compose`. Rotations do
not commute, so applying yaw before pitch gives a different result from pitch before yaw.

- The camera uses order **YXZ**: yaw about the world up axis first, then pitch. This is the correct
  first-person behaviour, and it prevents unwanted roll.
- Leaf blades also use YXZ: tilt outward first, then turn around the stem.

**9. What is homogeneous coordinate representation, and why is it used?**

A 3D point is written as (x, y, z, 1) and a direction as (x, y, z, 0). This lets translation,
rotation, scaling and perspective all be expressed as 4×4 matrix multiplications, so they can be
concatenated into a single matrix. Perspective projection depends on the w component: after the
projection matrix is applied, dividing by w produces the foreshortening effect.

---

## C. Projection and camera

**10. What is perspective projection, and how does it differ from orthographic projection?**

- **Perspective** projection maps a view frustum to clip space, so objects shrink in proportion to
  their distance. It matches human vision.
- **Orthographic** projection maps a box, and size is independent of distance.

The player camera is a `PerspectiveCamera` (72° vertical FOV, near 0.1 m, far 250 m). The sun's
**shadow camera** is orthographic, because a directional light's rays are parallel.

**11. What are the near and far clipping planes, and why did you change the near plane?**

They bound the view frustum. Depth-buffer precision is non-linear, roughly proportional to `z²/near`,
so a very small near plane wastes precision near the camera and loses it in the distance.

The near plane was raised from 0.05 m to 0.1 m. With the smaller value, floor decals placed 1 cm above
the floor (contact shadows, AO gradients) were lost to **z-fighting** on 16-bit depth buffers. The
player's 0.32 m collision radius means walls never come closer than the new near plane, so nothing is
clipped.

**12. How is the first-person camera controlled?**

- The **Pointer Lock API** provides unbounded relative mouse deltas (`movementX/Y`).
- These are scaled by the sensitivity and accumulated into **yaw** and **pitch**. Pitch is clamped to
  ±83° so the view cannot flip.
- The camera is placed at the player's position plus eye height and head-bob, with rotation
  `(pitch, yaw, 0)` in YXZ order (`PlayerController._apply`).
- Mouse events larger than 400 px are discarded, guarding against a known Chrome glitch that would
  snap the view.

**13. How is the extinguisher drawn so that it never clips into walls?**

**Two-pass rendering.**

1. The world is rendered with the main camera.
2. **Only the depth buffer is cleared** (`renderer.clearDepth()`).
3. A separate scene containing the extinguisher view model is rendered with its own camera (60° FOV,
   near 0.01 m).

Because the depth buffer was reset, the held object always appears in front of the world.

---

## D. Lighting, shading and shadows

**14. Which lighting model is used?**

`MeshStandardMaterial`, a **physically based rendering (PBR)** metalness/roughness model. It combines
Lambertian diffuse with a Cook–Torrance/GGX microfacet specular term, and it conserves energy. Surfaces
are described by base colour, metalness and roughness. For example:

| Surface | Metalness | Roughness |
|---|---|---|
| Brushed aluminium | 0.75 | 0.35 |
| Polished floor tile | low | 0.32 |
| Carpet | — | 1.0 |

**15. Which light sources are in the scene?**

| Light | Role |
|---|---|
| A shadow-casting **directional light** | Daylight |
| A **hemisphere light** | Sky/ground ambient gradient |
| **Image-based lighting** from a PMREM-filtered `RoomEnvironment` | Soft ambient light and reflections |
| Five fill **point lights** | Local fill in large rooms |
| **Emissive** ceiling panels | Visible light sources |
| Four pooled **flickering fire point lights** | Fire glow |
| A flashing red **alarm point light** | Alarm strobe |

**16. What is image-based lighting (IBL) and PMREM?**

IBL lights objects using an environment image instead of only point sources, which produces realistic
ambient light and reflections. A **Prefiltered Mipmapped Radiance Environment Map (PMREM)** stores
progressively blurred versions of that environment in its mip levels, so rough surfaces can sample a
blurrier level than shiny ones.

The project generates the environment procedurally from Three.js's `RoomEnvironment`, so no HDR image
file is needed.

**17. How does shadow mapping work?**

1. The scene is rendered **from the light's point of view** into a depth texture: the shadow map.
2. When the scene is shaded from the camera, each fragment is transformed into light space and its
   depth is compared with the stored depth. If it is farther, the fragment is in shadow.

**PCF (percentage-closer filtering)** averages several comparisons to soften the edges.

In this project:

- The sun uses a 2048² map (Medium) or 4096² map (High), with an orthographic shadow camera covering
  the site.
- **Bias** and **normal bias** are tuned against shadow acne.
- Ceilings, the roof and ceiling fixtures do not cast shadows. Otherwise the overhead light would be
  blocked entirely, and fixtures would project floating squares onto the floor. That second problem
  was a real defect, found and fixed during testing.

**18. What is tone mapping, and why use ACES?**

Lighting calculations produce high-dynamic-range values that can exceed what a display can show.
Tone mapping compresses that range into displayable values. The **ACES filmic** curve keeps highlights
(fire, emissive panels) from clipping harshly and gives a cinematic contrast. The output is converted
to the sRGB colour space.

**19. Did you implement ambient occlusion? How?**

Yes, as an **approximation**. Ambient occlusion darkens areas where ambient light is blocked:
corners, contact points and the floor under objects.

Screen-space AO (GTAO/SSAO) was evaluated and rejected. It would render the transparent glass and the
particles into its depth pass and produce artifacts, and its cost could not be verified on target
hardware. Instead the project uses two baked-style techniques:

- **contact-shadow decals** under every piece of furniture;
- **gradient strips** where walls meet the floor and ceiling.

Both use **per-vertex alpha**, not textures, so they look the same on every GPU.

**20. Point lights from fires don't cast shadows. How do you stop fire light showing through walls?**

Each frame the engine tests **line of sight** from the camera to each fire, using a 2D segment-versus-
wall test. If walls block the view, that fire's light intensity is smoothly reduced to 22%. Its range
is also kept short (3.5–8 m). An automated test verifies the visibility factor in both cases.

---

## E. Textures and materials

**21. How were textures created without any image files?**

Procedurally, on an HTML **canvas** (`textures.js`), then uploaded as `CanvasTexture`s. Examples:

| Texture | Technique |
|---|---|
| Wood | Sinusoidal grain lines plus noise |
| Marble | Random Bézier veins |
| Carpet | Random fibre speckles |
| Tiles | Per-tile shading and grout lines |
| Signs, screens, clock face | Drawn with canvas text and shape primitives |

A **seeded pseudo-random generator** makes the textures identical on every run. Colour textures are
tagged sRGB, and data textures are kept linear.

**22. What is UV mapping, and what is "world-space box projection"?**

UV coordinates map each vertex to a point in a 2D texture. Merged boxes of different sizes would
stretch a standard 0–1 UV texture. The batcher instead **recomputes UVs from world position**. For
each vertex it looks at the dominant axis of the normal:

| Dominant normal axis | UV taken from |
|---|---|
| Y | (x, z) |
| X | (z, y) |
| Z | (x, y) |

The result is divided by a per-material scale (for example 0.6 m for carpet tiles), so a texture
always has the same real-world size on every surface.

**23. What are mipmapping and anisotropic filtering?**

- **Mipmapping** stores pre-downscaled versions of a texture. Distant or oblique surfaces sample a
  smaller level, which avoids aliasing and shimmer.
- **Anisotropic filtering** improves sampling on surfaces viewed at a grazing angle, such as floors.

The procedural textures in the project use anisotropy 8.

---

## F. Particle systems, fire and smoke

**24. What is a particle system?**

A particle system models fuzzy phenomena (fire, smoke, spray) as many small, short-lived primitives.
Each particle has a position, velocity, lifetime, size and colour, and is updated by simple rules.
Reeves introduced the technique in 1983.

In this project (`ParticlePool`), each particle stores position, velocity, remaining and maximum life,
start and end size, colour, and room bounds. Pools are preallocated typed arrays used as a **ring
buffer**, so nothing is allocated at run time.

**25. How are the particles rendered on the GPU?**

Each pool is one `THREE.Points` object with a custom GLSL `ShaderMaterial`:

- The **vertex shader** computes a **perspective-correct point size**:

  ```
  gl_PointSize = size × viewportHeight / (2·tan(fov/2)) / −z_view
  ```

  so a particle behaves like an object of fixed world-space size.
- The **fragment shader** multiplies the per-particle RGBA colour by a sprite texture sampled at
  `gl_PointCoord`, and applies fog.

**26. Why do flames use additive blending but smoke uses normal blending?**

Flames emit light. **Additive blending** sums overlapping particles, so dense areas saturate toward
white-yellow like a real flame core, and particle order doesn't matter.

Smoke absorbs and scatters light. It must **darken** what is behind it, which requires normal alpha
blending.

Both disable depth writes, so particles don't incorrectly hide one another.

**27. How is the fire animated to look alive?**

- Flame particles rise under **buoyancy** with **drag**, plus **turbulence**: sinusoidal lateral
  forces that depend on position and time.
- Colour moves through a gradient over each particle's life: white-yellow → orange → red →
  transparent.
- Size shrinks as particles rise. The sprite is a teardrop shape.
- **Embers** are tiny, fast, long-lived sparks.
- The fire's point light **flickers**, using products of sines at different frequencies.
- An additive floor glow pulses, and a scorch mark grows over time.

Emission rate, emission radius, initial speed and particle size all scale with the fire's intensity.

**28. How does fire spread in your simulation? Is it random?**

No, it is **deterministic heat transfer**. Fire can exist at 29 combustible zones. Every 0.25 s, each
unburnt zone gains heat from every active fire within 7 m:

```
gain = I · 3.2 · flammability · A / (1 + d²/8)
```

- `A` is 1 for a clear path, 0.12 through one wall or closed door, and 0.03 through two or more
  (counted with segment-versus-box tests).
- Heat also cools at 0.15 per second.
- A zone ignites when its accumulated heat reaches 10.

Intensity itself grows logistically: `dI/dt = rate·(0.35 + I)·(1 − I)`.

**29. How is smoke modelled and rendered?**

**Modelling.** Each room has a smoke concentration. Fires add smoke in proportion to their intensity,
divided by the room's floor area. Smoke flows between each room and the corridor in proportion to the
concentration difference: fast through open doorways, very slow through closed doors. There is also
slight ventilation.

**Rendering** happens at three scales:

1. smoke particles near fires, which rise, spread along the ceiling and stay in their room;
2. a per-room **smoke layer**: two transparent planes that descend from the ceiling as concentration
   rises;
3. **exponential-squared fog**, whose density depends on whether the player's eyes are inside the
   layer. That dependency is why crouching improves visibility.

**30. How does the extinguisher decide whether it is hitting the fire?**

It uses an **analytic cone test** instead of a raycast.

1. For each fire, the vector from the camera to two target points (the base of the flames and the upper
   flames) is projected onto the camera's forward direction. This gives the distance along the aim
   direction and the perpendicular distance from it.
2. A point is hit if the perpendicular distance is within a tolerance that grows with fire size and
   distance.
3. Effectiveness is highest at the base, falls off beyond 5 m, and is zero without line of sight.
4. Intensity falls at `0.2 × effectiveness` per second.

The result also drives the green "ON TARGET" crosshair and the coaching hints.

---

## G. Collision detection, raycasting and physics

**31. How is collision detection implemented, and why not use a physics engine?**

Every obstacle a walking person meets in an office is full-height, so collision is solved exactly in
2D. The player is a **circle** (radius 0.32 m), and obstacles are **axis-aligned bounding boxes**.

- **Broad phase:** a **uniform spatial hash grid** with 2 m cells returns only the nearby boxes.
- **Narrow phase:** each nearby box gets a circle-versus-AABB test (clamp the centre to the box to find
  the closest point) and is pushed out along the penetration direction.

A general rigid-body engine would add size and complexity for no benefit here.

**32. What is tunnelling, and how did you prevent it?**

Tunnelling is when a fast-moving object passes completely through a thin obstacle within a single
frame, so no overlap is ever detected. The controller prevents this by splitting each frame's
displacement into sub-steps of at most 0.1 m and resolving collisions after each one. That step is
smaller than the 0.2 m wall thickness.

**33. How does wall sliding work?**

Collision resolution removes only the component of movement that **penetrates** the wall, by pushing
the circle back out along the surface normal. The component parallel to the wall is kept, so moving
diagonally into a wall slides along it. An automated test checks this.

**34. How are gravity and jumping implemented?**

With explicit (semi-implicit Euler) integration on the vertical axis:

- `vy −= g·dt` with g = 22 m/s² (slightly stronger than real gravity, for responsive game feel);
- `y += vy·dt`;
- reaching the floor (y = 0) zeroes `vy` and sets `onGround`;
- a jump sets `vy` = 5.2 m/s, which gives about 0.6 m of height (`v²/2g`).

Horizontal acceleration is reduced in the air (3 instead of 14), and movement uses exponential
smoothing toward the target speed, so it behaves the same at any frame rate.

**35. What is raycasting, and where do you use it?**

Raycasting finds the intersections of a ray with scene geometry.

- **Interaction:** every frame a ray is cast from the camera through the screen centre
  (`Raycaster.setFromCamera` with NDC (0, 0)), up to 2.7 m, against interactive meshes: door leaves,
  extinguishers and call points. The hit is confirmed with a line-of-sight test, so you cannot
  interact through glass or walls.
- **2D segment tests** (slab method against AABBs) are used for heat attenuation, spray and radiant
  heat occlusion, light occlusion, and choosing visible navigation nodes for routing.

**36. What is the slab method?**

It is a ray/segment-versus-AABB intersection test. For each axis, it computes the parameter values `t`
at which the segment enters and leaves the pair of planes ("slab") bounding the box on that axis. The
segment intersects the box if the overlap of these intervals, `[max(t_enter), min(t_exit)]`, is
non-empty and lies within [0, 1]. `CollisionWorld.segmentHits` implements it in 2D.

---

## H. Pathfinding and evacuation

**37. Which algorithm finds the evacuation route, and why?**

**Dijkstra's shortest-path algorithm** on a weighted graph: 38 hand-placed navigation nodes and 39
edges. Dijkstra is optimal for non-negative edge costs and trivially fast on a graph this small.

- A virtual start node at the player is linked to every node it can see within 14 m.
- The three assembly-point nodes are compared, and the cheapest is chosen.

A\* would need a single target and a heuristic, and offers no benefit at this scale.

**38. How does the route avoid fire and smoke?**

Each edge's cost is its **length plus a danger penalty**. The edge is sampled every 0.75 m:

- samples close to a fire add a large cost;
- if the fire is large, the edge is marked **blocked** (+400);
- nearby fires add a tapering cost;
- each sample adds 1.5 × the room's smoke concentration.

The algorithm therefore prefers a longer clear route over a short one through fire.

**39. Why add hysteresis to the route choice?**

Without it, when two exits have nearly equal cost, small changes (fire growth, the player moving)
would make the chosen route flip several times per second, and the arrows would flicker. The router
keeps the current exit unless another is at least **15% cheaper**. This state is reset at the start of
each session; a test guards against an earlier bug in which it carried over between sessions.

---

## I. Three.js, WebGL and real-time rendering

**40. What is the relationship between WebGL and Three.js?**

**WebGL** is the low-level browser API for the GPU, based on OpenGL ES. It deals in buffers, shaders
and draw calls. **Three.js** is a library on top of WebGL that provides:

- a scene graph, cameras, geometry and material classes;
- lights and shadows, loaders, a raycaster;
- generation of the GLSL shaders for its built-in materials.

The project uses Three.js for productivity, and drops to raw GLSL where needed (particles).

**41. What makes this a real-time interactive simulation?**

Simulation and rendering run in a single `requestAnimationFrame` loop, targeting the display refresh
rate. Each frame reads input, advances the simulation by the elapsed time (clamped to 50 ms), and
renders. Every action (opening a door, spraying, crouching) affects the next frame.

The techniques that keep each frame within budget are:

- batching (≈78 draw calls);
- one draw call per particle pool;
- a constant light count, so shaders are never recompiled;
- throttled routing (≈3 Hz) and UI updates (10 Hz);
- a minimap pre-rendered once;
- allocation-free hot paths.

**42. What is the difference between a fixed light count and adding lights dynamically, and why does it matter?**

In Three.js, the number of lights is compiled into the shader programs. Adding or removing a light
forces every affected material to **recompile**, which causes a noticeable stutter. The project creates
a fixed pool of 4 fire lights at start-up and only changes their position and intensity, so fires can
appear and disappear without any recompilation.

---

## J. Architecture and design decisions

**43. Why use React for the UI but not for the 3D scene?**

React is well suited to declarative 2D interfaces: menus, the HUD, results. But React's reconciliation
should not run inside a 60 fps render loop. The engine is plain imperative JavaScript with its own loop
and pushes a small state snapshot to React about 10 times per second. This keeps frame timing
independent of UI re-renders, and lets the engine be tested on its own.

**44. Why Three.js instead of Unity or Unreal?**

- The brief excluded proprietary engines and required free tools.
- A browser application needs **no installation** and runs from a link on any desktop.
- Three.js gives direct control over rendering, which suits a project where all content is generated
  procedurally.
- The production bundle is small (≈225 kB gzipped).

**45. What does "data-driven level design" mean in your project?**

The entire floor plan is plain data in `layout.js`: rooms, wall runs with gaps, doors, exits, the
navigation graph, combustible zones, equipment positions and scenarios. The following are all
**generated from that single source**, so they can never disagree with each other:

- the 3D geometry and the collision boxes;
- the minimap and the evacuation-plan signs;
- the fire zones and the routing graph.

**46. How did you test a 3D application automatically?**

An end-to-end suite (`tests/e2e.mjs`) uses puppeteer-core to drive headless Chrome, with a software
WebGL renderer, against the real build. Test hooks advance the simulation deterministically
(`debugAdvance`) and position the player (`debugTeleport`). The tests then check engine state and the
DOM.

There are 36 checks, covering movement, collision, doors, alarm, extinguisher, fire spread, routing,
assembly-point detection, results, pause/pointer-lock handling, and the absence of console errors. The
latest run passed all 36.

**47. What are the main limitations, and how would you extend the project?**

**Limitations:**

- Fire and smoke are gameplay models, not CFD.
- AO is approximated.
- Single floor, no NPCs, desktop only.

**Extensions:**

- **WebXR**, for head-mounted displays and tracked controllers to aim the extinguisher.
- NPC crowd evacuation.
- Multiple floors.
- Extinguisher types matched to fire classes.
- A grid-based smoke solver.
- Instructor tools for scenario editing and replay.
