// Loading-cost bench: FWorld.create, FDestruction.create, FSimulation.create, FRender.setWorld (stub GL), snapshot.
// usage: node gen-time.mjs <ferroRoot> <spec...>   spec = c:<0..17> (campaign v2) | l:<0..2> (historic)
import {load, time, makeWorld, stubCanvas} from './lib.mjs';
const root = process.argv[2], specs = process.argv.slice(3);
const W = load(root);
const out = [];
for (const spec of specs) {
  const [world, gen] = time(() => makeWorld(W, spec));
  const [, destr] = time(() => W.FDestruction.create(world));
  const brain = W.FBrain.create({mode: 'cpu'});
  const [sim, simMs] = time(() => W.FSimulation.create(world, {brain, armorSystem: true}));
  const {canvas} = stubCanvas();
  const r = W.FRender.create(canvas);
  const [, setWorld] = time(() => r.setWorld(sim.destruction.meshes, sim.destruction.lights, world.environment));
  const [snap, snapMs] = time(() => sim.snapshot());
  const [json, strMs] = time(() => JSON.stringify(snap));
  const [ok, restoreMs] = time(() => sim.restore(JSON.parse(json), {recover: true}));
  const [, validateMs] = time(() => W.FWorld.validate(world));
  out.push({spec, genMs: +gen.toFixed(1), destructionCreateMs: +destr.toFixed(1), simCreateMs: +simMs.toFixed(1), setWorldMs: +setWorld.toFixed(1), snapshotMs: +snapMs.toFixed(1), stringifyMs: +strMs.toFixed(1), snapshotChars: json.length, restoreOk: ok, restoreMs: +restoreMs.toFixed(1), validateMs: +validateMs.toFixed(1),
    meshes: world.meshes.length, colliders: world.colliders.length, destructibles: (world.destructibles || []).length, enemies: world.enemies.length, walkable: (world.walkable || []).length, navCells: sim.nav.cells.length, nx: sim.nav.nx, nz: sim.nav.nz,
    worldJsonChars: JSON.stringify(world).length});
}
console.log(JSON.stringify(out));
