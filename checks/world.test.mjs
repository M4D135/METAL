// Independent physical reachability checks. No WebGL, browser or dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const source = fileURLToPath(new URL('../src/world.js', import.meta.url));
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(source, 'utf8'), sandbox, { filename: source });
const { create } = sandbox.window.FWorld;
const seeds = [1, 7, 42, 96, 2026, 65535];
const radius = .28, spacing = .25;

function finiteNumbers(value, path = 'world') {
  if (typeof value === 'number') assert(Number.isFinite(value), `${path} is not finite`);
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) finiteNumbers(child, `${path}.${key}`);
  }
}

function reachability(world, label, avoidHazards = false) {
  const bounds = world.bounds;
  const width = Math.ceil((bounds.maxX - bounds.minX) / spacing);
  const depth = Math.ceil((bounds.maxZ - bounds.minZ) / spacing);
  assert(width > 0 && depth > 0 && width * depth < 1000000, `${label}: unreasonable bounds`);
  const floors = [...world.rooms, ...(world.corridors || [])];
  assert(floors.length, `${label}: no walkable floor areas`);
  const obstacles = world.colliders.filter(box => box.minY <= 1.8 && box.maxY >= .05);
  const px = x => bounds.minX + (x + .5) * spacing;
  const pz = z => bounds.minZ + (z + .5) * spacing;
  function free(x, z) {
    if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return false;
    if (!floors.some(f => Math.abs(x - f.x) <= f.w / 2 && Math.abs(z - f.z) <= f.d / 2)) return false;
    for (const box of obstacles) {
      // Shortest distance from a disc centre to the solid rectangle, including corners.
      const closestX = Math.max(box.minX, Math.min(x, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
      if ((x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2) return false;
    }
    if (avoidHazards && world.hazards.some(h => Math.hypot(x-h.x,z-h.z) < h.r+radius)) return false;
    return true;
  }
  const walkable = new Uint8Array(width * depth);
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) walkable[z * width + x] = Number(free(px(x), pz(z)));
  }
  function localCells(point) {
    const x = Math.floor((point.x - bounds.minX) / spacing);
    const z = Math.floor((point.z - bounds.minZ) / spacing);
    const result = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, zz = z + dz;
      if (xx < 0 || xx >= width || zz < 0 || zz >= depth) continue;
      const index = zz * width + xx;
      if (!walkable[index]) continue;
      // The actual object position must connect to the sampled cell without crossing a wall.
      let connected = true;
      for (let t = 0; t <= 1; t += .2) {
        if (!free(point.x + (px(xx) - point.x) * t, point.z + (pz(zz) - point.z) * t)) {
          connected = false; break;
        }
      }
      if (connected) result.push(index);
    }
    return result;
  }

  assert(free(world.spawn.x, world.spawn.z), `${label}: spawn collides or has no floor`);
  const starts = localCells(world.spawn);
  assert(starts.length, `${label}: spawn has no accessible grid cell`);
  const visited = new Uint8Array(width * depth), queue = new Uint32Array(width * depth);
  let head = 0, tail = 1;
  queue[0] = starts[0]; visited[starts[0]] = 1;
  while (head < tail) {
    const index = queue[head++], x = index % width, z = Math.floor(index / width);
    const candidates = [x ? index - 1 : -1, x + 1 < width ? index + 1 : -1,
      z ? index - width : -1, z + 1 < depth ? index + width : -1];
    for (const next of candidates) {
      if (next < 0 || visited[next] || !walkable[next]) continue;
      // No diagonal corner-cutting; midpoints protect thin geometry between grid centres.
      const xx = next % width, zz = Math.floor(next / width);
      if (!free((px(x) + px(xx)) / 2, (pz(z) + pz(zz)) / 2)) continue;
      visited[next] = 1; queue[tail++] = next;
    }
  }
  const targets = [
    ...world.cores.map((p, i) => ({ ...p, role: `relay ${i + 1}` })),
    { ...world.exit, role: 'exit' },
    ...world.enemies.map((p, i) => ({ ...p, role: `enemy ${i + 1}` })),
    ...world.pickups.map((p, i) => ({ ...p, role: `pickup ${i + 1}` })),
    ...world.rooms.map((p,i)=>({...p,role:`room ${i+1} centre`})),
    ...world.corridors.map((p,i)=>({...p,role:`corridor ${i+1} centre`}))
  ];
  for (const target of targets) {
    assert(free(target.x, target.z), `${label}: ${target.role} collides at ${target.x},${target.z}`);
    assert(localCells(target).some(index => visited[index]),
      `${label}: ${target.role} is unreachable from spawn at ${target.x},${target.z}`);
  }
  // Every declared graph link has a genuinely open centre line between its rooms.
  // This catches a blocked doorway even when another loop still reaches the room.
  for (const link of world.connections) {
    const distance=Math.hypot(link.x2-link.x1,link.z2-link.z1),steps=Math.ceil(distance/spacing);
    for(let i=0;i<=steps;i++)assert(free(link.x1+(link.x2-link.x1)*i/steps,link.z1+(link.z2-link.z1)*i/steps),
      `${label}: declared connection ${link.from}-${link.to} is physically blocked`);
  }
  return { accessibleCells: tail, targets: targets.length };
}

const summary = [], signatures = new Set(), topologyIds = new Set(), topologyGraphs = new Map(), footprints = new Map();
for (const seed of seeds) for (let stage = 0; stage < 3; stage++) {
  const label = `seed ${seed}, stage ${stage}`;
  const world = create(seed, stage), repeated = create(seed, stage);
  finiteNumbers(world);
  const serialized = JSON.stringify(world);
  assert.equal(serialized, JSON.stringify(repeated), `${label}: nondeterministic generation`);
  signatures.add(createHash('sha256').update(serialized).digest('hex'));
  assert.equal(world.cores.length, 3, `${label}: expected three required relays`);
  assert(world.meshes.length<=2600&&world.colliders.length<=350,`${label}: stage exceeds geometry budget`);
  topologyIds.add(world.topologyId);
  const graph=world.connections.map(c=>[Math.min(c.from,c.to),Math.max(c.from,c.to)].join('-')).sort().join(',');
  if(topologyGraphs.has(stage))assert.equal(topologyGraphs.get(stage),graph,`${label}: seed changed the promised safe topology`);
  else topologyGraphs.set(stage,graph);
  if(!footprints.has(stage))footprints.set(stage,world.rooms.map(r=>`${r.x}:${r.z}`).join(','));
  assert(world.connections.length>=world.rooms.length,`${label}: no exploration loop`);
  const connected=new Set([world.rooms[0].id]);
  for(let pass=0;pass<world.rooms.length;pass++)for(const edge of world.connections){
    assert(edge.width>=3,`${label}: passage narrower than three metres`);
    const a=world.rooms.find(r=>r.id===edge.from),b=world.rooms.find(r=>r.id===edge.to);
    assert(a&&b,`${label}: connection references a missing room`);
    assert(a.x===b.x||a.z===b.z,`${label}: unsupported diagonal corridor`);
    const gap=a.z===b.z?Math.abs(a.x-b.x)-(a.w+b.w)/2:Math.abs(a.z-b.z)-(a.d+b.d)/2;
    assert(gap>=3,`${label}: corridor does not separate its chambers`);
    if(connected.has(a.id)||connected.has(b.id)){connected.add(a.id);connected.add(b.id);}
  }
  assert.equal(connected.size,world.rooms.length,`${label}: topology has a disconnected chamber`);
  for (const box of world.colliders) {
    assert(box.minX <= box.maxX && box.minY <= box.maxY && box.minZ <= box.maxZ,
      `${label}: reversed collider bounds`);
  }
  const entryRoom=world.rooms[0];
  const inEntry=p=>Math.abs(p.x-entryRoom.x)<entryRoom.w/2&&Math.abs(p.z-entryRoom.z)<entryRoom.d/2;
  assert(!world.enemies.some(inEntry),`${label}: enemy inside the safe spawn chamber`);
  assert(world.machinery.length>0,`${label}: missing animated machinery`);
  for(const machine of world.machinery){
    assert(['fan','piston','reactor'].includes(machine.type),`${label}: unsupported machine`);
    assert(['x','y','z'].includes(machine.axis)&&machine.size>0&&machine.speed>0,`${label}: invalid machine transform`);
  }
  assert(stage===0?world.hazards.length===0:world.hazards.length>=3,`${label}: unexpected hazard progression`);
  for(const hazard of world.hazards){
    assert.equal(hazard.type,'vent',`${label}: unsupported hazard`);
    assert(hazard.r>0&&hazard.active>0&&hazard.active<hazard.period-.85&&hazard.phase>=0&&hazard.phase<hazard.period,`${label}: no safe warning/recovery window`);
    assert(!inEntry(hazard),`${label}: hazard inside the safe spawn chamber`);
    for(const point of [world.spawn,...world.cores,world.exit])assert(Math.hypot(hazard.x-point.x,hazard.z-point.z)>hazard.r+2,`${label}: hazard covers a required objective`);
    const room=world.rooms.find(r=>Math.abs(hazard.x-r.x)<r.w/2&&Math.abs(hazard.z-r.z)<r.d/2);
    assert(room,`${label}: hazard placed outside a chamber`);
    assert(Math.abs(hazard.x-room.x)>hazard.r+1&&Math.abs(hazard.z-room.z)>hazard.r+1,`${label}: hazard blocks an essential circulation axis`);
  }
  const bosses=world.enemies.filter(e=>e.type===3);
  assert.equal(bosses.length,stage===2?1:0,`${label}: incorrect boss progression`);
  if(stage===2){
    assert.equal(bosses[0].boss,true,`${label}: missing boss marker`);
    const arena=world.rooms.find(r=>r.archetype==='arena');
    assert(arena&&arena.w>=20&&arena.d>=20,`${label}: boss arena lacks manoeuvring space`);
    assert(Math.abs(bosses[0].x-arena.x)<arena.w/2&&Math.abs(bosses[0].z-arena.z)<arena.d/2,`${label}: boss outside the final arena`);
    assert(Math.abs(world.exit.x-arena.x)<arena.w/2&&Math.abs(world.exit.z-arena.z)<arena.d/2,`${label}: exit outside the final arena`);
    for(const box of world.colliders.filter(b=>b.minY<3&&b.maxY>.1)){
      const x=Math.max(box.minX,Math.min(bosses[0].x,box.maxX)),z=Math.max(box.minZ,Math.min(bosses[0].z,box.maxZ));
      assert(Math.hypot(x-bosses[0].x,z-bosses[0].z)>=1.2,`${label}: boss starts intersecting architecture`);
    }
  }
  const entry = reachability(world, label);
  if(world.hazards.length)reachability(world,label+' with every vent hot',true);
  summary.push({ seed, stage, ...entry });
}
assert.equal(signatures.size, seeds.length * 3, 'Seeds/stages unexpectedly produce identical worlds');
assert.equal(topologyIds.size,3,'Stages must have distinct topology identities');
assert.equal(new Set(topologyGraphs.values()).size,3,'Stages reuse the same graph with recoloured rooms');
assert.equal(new Set(footprints.values()).size,3,'Stages reuse the same room footprint');
console.log(JSON.stringify({
  status: 'PASS', cases: summary.length, radius, spacing,
  checks: ['finite values', 'determinism', 'spawn clearance', 'independent flood fill',
    'all relays reachable', 'exit reachable', 'enemy and pickup placement',
    'distinct stage graphs and footprints', 'every corridor physically connected',
    'all objectives accessible with every vent hot', 'safe hazard warning windows',
    'boss progression and arena clearance', 'geometry budgets'],
  accessibleCells: { min: Math.min(...summary.map(s => s.accessibleCells)),
    max: Math.max(...summary.map(s => s.accessibleCells)) },
  targetsChecked: summary.reduce((sum, s) => sum + s.targets, 0)
}, null, 2));
