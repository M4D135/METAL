# FERRO procedural FPS — internal module contract

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
