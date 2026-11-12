# FERRO procedural FPS — internal module contract

## 0.4 Horizons: varied environments and tactical enemies (current)

User asks for substantially more varied decor, intelligent mobs, and outdoor areas with trees. Root owns integration in game/audio/UI, motion module, build/docs/publishing. World owner ferro_world_v04 owns world.js + world tests; AI owner ferro_ai_v04 owns simulation.js + simulation tests; renderer owner ferro_render_v04 owns renderer.js. No agent git/push/Sites actions.

Three mixed outdoor/indoor settings: reclaimed woodland outpost (outdoors visible from spawn), rocky quarry/foundry, and overgrown gardens/observatory with final guardian. Real open-sky walkable areas, procedural trees/vegetation, coherent terrain boundaries and background relief. Traversal remains horizontal; do not add invisible stairs or walk-through visible trunks. Physics and layouts MAY change for this request; world.generation=4 and root must handle old checkpoints explicitly. Keep 3relays/stage, boss gate, original runtime/no imported assets, 1,400,000-byte HTML budget. Mesh budget <=16000; colliders <=500; detail tiers retained, major vegetation silhouettes must survive Economy.

World and renderer coordinate setWorld(meshes,lights,environment). Proposed natural mats8 soil/grass,9 stone,10 bark,11 foliage. rooms/corridors.outdoor and environment.outdoorZones rects identify regions. environment includes biome,skyTop,skyBottom,fog,sunDirection,sunColor,ambient,wind,weather; exact additions must be messaged to root. Any optional foliage sway must remain consistent across render/shadow paths. Preserve highp depth reads, receiver-plane PCF, camera.roll, fallback rendering and visible shadow fixes.

AI improves decisions rather than HP/damage: perception and sound, last-known position memory, nearby ally alerts, actual navigable flank/cover routes, group spacing and readable committed attacks. Preserve all movement/collision/combat invariants; tests must demonstrate behaviors, not only assigned labels. New awareness/tactic presentation fields are separate from attackState. Validate/safely reset tactical state in checkpoints, without hidden player knowledge. Root retains checkpoint/settings UI, adds biome ambiance and readable enemy animation cues.

## 0.3 detail and motion pass (current ownership and limits)

User asks for very dense level detail, prettier lighting with more shadows, and smoother animated movement. Preserve the industrial cyan/bronze identity, all procedural content, the 1,400,000-byte standalone budget, existing progression and private hosting.

World owner: src/world.js and checks/world.test.mjs. Enrich existing geometry with deterministic detail from an independent RNG so navigation, colliders, objective/enemy placements and checkpoint signatures remain stable where possible. Keep colliders <=350; allow <=12,000 static meshes with distance/detail filtering. Optional mesh.detail 0|1|2 (default0): architecture, medium dressing, micro detail. Renderer may cull detail by distance/quality. Optional world.ambience [{type:'steam'|'sparks'|'drip'|'beacon'|'screen',x,y,z,phase,scale,color:[r,g,b]}] for root animation; no invisible collision changes or blocked routes.

Renderer owner: src/renderer.js only. Support mesh.detail for WebGL and Canvas with distance/quality culling or spatial batches. Substantially improve actual shadows/contact depth and material richness while preserving API and safe Economy mode. Optional camera.roll radians (default0) must work in WebGL and Canvas and be applied consistently with root weapon basis. Coordinate with world owner about visibility ranges. Renderer QA artifacts outside repo, no browser bypass or browser flags.

Motion owner: src/simulation.js and checks/simulation.test.mjs. Smooth acceleration, responsive braking, analogue movement, coherent walk/run/dash transitions, no mouse aim latency. Expose real velocity and locomotion state for root camera/weapon animation; document exact API. Preserve collision safety, combat, old checkpoint restore if feasible, and no movement creep after restore. Add meaningful regression checks for frame-rate independence, direction reversal/braking, wall sliding/diagonals and checkpoint motion.

Root owns src/game.js, src/audio.js, src/index.html, src/style.css, build and docs. Root integrates damped camera/weapon motion, ambient detail animations, input handling and optional reduced motion. Agents do not commit, push, change other owners' files or call Sites mutations.

## 0.2 integration additions (override original limits/ownership below)

Budget stays 1,400,000 bytes for standalone HTML; improve play and art rather than chasing the 0.1 size. Static mesh budget 2600 and colliders 350 per stage. Three stages must have different connected topologies and distinct architecture; preserve walkable flat ground and existing APIs.

World agent owns src/world.js and checks/world.test.mjs. World may add `machinery: [{type:'fan'|'piston'|'reactor',x,y,z,size,speed,axis:'x'|'y'|'z'}]`, `hazards:[{x,z,r,period,active,phase,type:'vent'}]`. Static nozzle etc is world geometry; root animates jets/fans. Hazards phase t=(time+phase)%period; hot when t<active, warning when t>period-.85. Keep them out of essential corridor centre lines and away from spawn/relays/exit. Third stage includes one enemy type3 (boss) with optional `boss:true`; normal types remain0..2. Root implements boss mesh. Exits require 3 relays plus boss destroyed if one exists.

Simulation agent owns src/simulation.js and checks/simulation.test.mjs. Preserve old methods/state and add state `weapon:0|1` (0 Impulse,1 Fracture), player `pulseCooldown`, enemy `windup` seconds, `attackState`, `yaw`, `stun` optional, state `bossAlive`, `score`, `combo`, `comboTime`, `pulseVisual` seconds. Input `weapon:0|1` selects, `pulse:boolean` triggers radial shock with damage/knockback/projectile clearing and cooldown. Keep input.fire and dash. New audio event names may be `fracture`, `pulse`, `enemyShot`, `bossPhase`, `combo`; root routes optional methods safely. Shotgun has close range spread and slower fire, heat resource. Existing enemies retain default HP3,5,4; boss~30HP (3D height~1.8 radius~1.2). Give attacks readable windup, varied behaviour and dodgeable projectiles. Preserve pure simulation, clamp, collision, 3D ray semantics. Add `snapshot()` and `restore(snapshot)` on simulation object, validated serializable versioned state, no DOM/storage; root owns localStorage. Support optional world.hazards and boss. Add hazard state array if convenient. Tests must assert changes rather than trivially mirror them.

Renderer agent exclusively owns src/renderer.js. Same API plus optional fx.pulse number. Improve depth/material contrast/metal detail and subtle glow; if adding shadows or passes, keep WebGL2 compatibility, qualitylow performance and Canvas2D fallback. All procedural. Root owns src/game.js, src/audio.js, index/style, build/docs/integration. No other file edits/commits/push by agents.

All original code, no external engine, assets, fonts, images or audio files. Browser JavaScript, scripts concatenated inline by tools/build.py. Modules are IIFEs installing globals. True WebGL 3D geometry; no Doom-style raycaster. World units metres, floor y=0, eye y=1.6. Camera forward = [sin(yaw)*cos(pitch), sin(pitch), -cos(yaw)*cos(pitch)], right=[cos(yaw),0,sin(yaw)].

## Renderer, owner renderer agent

`window.FRender.create(canvas)` returns `{setWorld(meshes,lights),draw(camera,dynamic,fx),resize(quality),dispose(),stats}`. Camera `{pos:[x,y,z],yaw,pitch,fov:75}` (fov degrees). fx `{time,flash,damage,shake}` numeric. Dynamic is array of mesh descriptors. `stats` includes drawCalls, triangles where practical. setWorld caches static meshes; draw does not rebuild static geometry.

Mesh descriptor `{shape:'box'|'sphere'|'cylinder'|'octa'|'ring',p:[x,y,z],s:[sx,sy,sz],r:[rx,ry,rz],mat:0..7,emissive:0..3,color:[r,g,b] (optional)}`. Box spans -0.5 to 0.5, sphere radius 0.5, cylinder y axis height 1 radius .5, octa radius .5, ring in XZ plane radius .5. r radians optional. Material IDs: 0 graphite metal, 1 rust bronze, 2 floor tiles, 3 pale concrete, 4 cyan energy, 5 amber energy, 6 red danger, 7 black rubber. Procedural material shading in shaders, analytic patterns/no downloaded textures. Lights `{p:[x,y,z],color:[r,g,b],power:number}`. Handle WebGL creation failure with clear thrown Error.

## World, owner world agent

`window.FWorld.create(seed,stage=0)` returns serializable `{seed,stage,title,meshes,lights,colliders,rooms,spawn,exit,cores,enemies,pickups,bounds}`. colliders are axis-aligned solid boxes `{minX,maxX,minZ,maxZ,minY,maxY}`; collision uses player's y~0..1.8. Every solid wall included; decorative ground blockers included, ceiling excluded. Bounds `{minX,maxX,minZ,maxZ}`. Room `{x,z,w,d,name}` w,d width/depth, connected by navigable corridors min width 3. Spawn `{x,z,yaw}` safe. Exit `{x,z}` floor marker root adds dynamic door/core. Core `{x,z,id}` THREE per stage, collectible at distance <1.4 no key press. Enemies `{x,z,type:0|1|2}` root adds hp etc. Pickups `{x,z,type:'health'}`. Root creates dynamic visible models of cores, enemies, exit and pickups. World must place no static solids at these points. Interesting connected industrial level (~60m x 60m), guaranteed reachability all objectives/spawns. Spawn room safe, enemies do not spawn there. Entrance opening, bridges/upper pipes may be decorative; traversal ground only for this first version. Seed affects dressing/layout room geometry within guaranteed topology, no impossible random labyrinth. Total static meshes ~1500 max, colliders ~200 max. Export `FWorld.validate(world)` returning useful checks if convenient.

## Audio, owner audio agent

`window.FAudio.create()` returns `{start(),resume(),setMuted(bool),setThreat(0..1),tick(dt),shot(),hit(),hurt(),kill(),pickup(),core(),win(),step(speed),dispose()}`. WebAudio only, no imported samples. Lazy browser audio context after user action, safe if blocked. Procedural subtle evolving ambient synth plus punchy spatial-feeling effects, no harsh volume spikes. Missing support should be harmless. No timers leaking after dispose. All calls safe.

## Root ownership

Root writes src/game.js, src/style.css, src/index.html, tools/build.py, docs, tests/checks. Agents exclusively own renderer.js, world.js, audio.js respectively; no changes to root files. Report API decisions promptly. No git commits/push by agents.
