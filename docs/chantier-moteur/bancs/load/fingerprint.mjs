// Cost of the two FNV fingerprints computed at every FSimulation.create / FDestruction.create (same code as simulation.js:236-239, destruction.js:132).
import {load, makeWorld, now} from './lib.mjs';
const [root, ...specs] = process.argv.slice(2);
const W = load(root);
for (const spec of specs) {
  const world = makeWorld(W, spec);
  for (let rep = 0; rep < 3; rep++) {
    let t = now();
    const identity = [world.seed, world.stage, world.spawn, world.bounds, world.colliders, world.enemies, world.cores, world.pickups, world.exit, world.hazards || [], world.walkable || [], world.mechanisms || [], world.doors || [], world.lifts || [], world.jumpPads || [], world.destructibles || [], world.pipes || [], world.traps || [], world.horrorSites || [], world.director || null];
    if (world.progression?.version === 1) identity.push(world.progression, world.encounters || [], world.shops || []);
    if (world.campaign === true) identity.push({campaign: true, campaignVersion: 2, index: world.index, chapter: world.chapter, trophies: world.trophies || []});
    const json = JSON.stringify(identity); const tj = now() - t; t = now();
    let f = 2166136261; for (const c of json) f = Math.imul(f ^ c.charCodeAt(0), 16777619); const tl = now() - t;
    t = now(); const defs = JSON.stringify([world.seed, world.stage, world.generation, world.destructibles.map(d => [d.id, d.bounds, d.meshes, d.colliders]), world.pipes || []]);
    let g = 2166136261; for (const c of defs) g = Math.imul(g ^ c.charCodeAt(0), 16777619); const td = now() - t;
    if (rep === 2) console.log(JSON.stringify({spec, simIdentityChars: json.length, stringifyMs: +tj.toFixed(1), fnvLoopMs: +tl.toFixed(1), destructionSignatureChars: defs.length, destructionSignatureMs: +td.toFixed(1)}));
  }
}
