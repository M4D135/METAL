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

// Captured from the released v0.2 generator before the art pass. These fields
// determine checkpoint compatibility, collision, objectives and enemy placement.
const physicsV02 = {
  "1:0": "f8936a31bcc8bc99b94f3f785950b3c585f72b0ad711e041324e4359630e3d0c",
  "1:1": "477106c9c190b164216ddb479197536eae24b5008d4cb7a4e74b87b9858c78c5",
  "1:2": "c4f7f98b2e7a163a603ad490203b523a5995727ef107d782f361284cb2df20ce",
  "7:0": "e7273feb6750c723475a25266bb365fcab10818f09701d0304a797e38826f0f9",
  "7:1": "9b86b76ddf1c4feec3d6a7123af93a73dd57622819aeb15c3b993cf83baefa7a",
  "7:2": "ab0af19907ef9affb76c0efa954300e5cbf5ebb6faabb0147a94d8db98d99c26",
  "42:0": "ba52d6c85ae9ae56e1b7c239f82c0152b06d53bc43ce71e5b5d7d02ec420b565",
  "42:1": "365e60d8bad85604eb57fa77fcc51692821c4d3f1ce099f3174c335d1f773613",
  "42:2": "57db35ed85e1622f3a83104f9dc43bdaec5dc9b41cc44cc5197b23c364b584a3",
  "96:0": "bf944a6d8d2f3997a194d141c4c32d45980c895bfe04913f748283e1b13ae5d0",
  "96:1": "bd5d184c8728c8e5392a67d862083ca0205c172274175a7ee948aafcd128d355",
  "96:2": "1666d98d6521b34b1056babffa93d38171de74b8f3ffba2beb8d8f485ba3db2c",
  "2026:0": "d7a87fc12c21b476deb54f77b95fc029b8acec2db21a413556544c64b7be7acb",
  "2026:1": "71ab0fdbc8b468f16da26fa52b8cd5ab2a8e12d9de2c7f022f76bc93f9f60914",
  "2026:2": "d3d90a108c76b2b67e0efd78ca72b551cc5a2c277edbed91fe6a36f540090813",
  "65535:0": "c09b25d5147f916dc4c65936f55b89e88f341caca782c794b6bf1e33da15a016",
  "65535:1": "0216393c60d31ca0751e5d120426f9124025413cb62c568889b44a8cdd379672",
  "65535:2": "f3c54df1b7fa2bc8b244e1efb3c5ccc0d09f3390aee3cf9d5673a2eb1e445c2d"
};

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
  assert(world.meshes.length<=12000&&world.colliders.length<=350,`${label}: stage exceeds geometry budget`);
  const physics=JSON.stringify([world.seed,world.stage,world.spawn,world.bounds,world.colliders,world.enemies,world.cores,world.pickups,world.exit,world.hazards||[]]);
  assert.equal(createHash('sha256').update(physics).digest('hex'),physicsV02[`${seed}:${stage}`],
    `${label}: decorative pass changed released collision/checkpoint data`);
  const details=world.detailStats;
  assert(details&&Number.isInteger(details.base)&&details.base>0&&details.base<world.meshes.length,`${label}: no layered art pass`);
  assert.equal(details.added,world.meshes.length-details.base,`${label}: inaccurate detail count`);
  const tiers=[0,0,0],categoryCounts={};
  for(const [i,mesh] of world.meshes.entries()){
    const level=mesh.detail||0;
    assert([0,1,2].includes(level),`${label}: renderer cannot classify this detail tier`);
    assert(mesh.p.length===3&&mesh.s.length===3&&mesh.s.every(n=>n>0),`${label}: invalid mesh dimensions`);
    tiers[level]++;
    if(i<details.base)assert.equal(level,0,`${label}: original architecture was made disposable detail`);
    else{
      assert(level>0&&typeof mesh.category==='string',`${label}: new dressing has no LOD/category`);
      categoryCounts[mesh.category]=(categoryCounts[mesh.category]||0)+1;
      if(level===2)assert(Math.max(...mesh.s)<=.35,`${label}: large silhouette incorrectly hidden with micro detail`);
      // Only floor markings, existing solid footprints and wall-attached fittings
      // may receive low details. New free-standing obstacles would be misleading.
      if(mesh.p[1]<1.95&&mesh.p[1]+mesh.s[1]/2>.08){
        const nearSolid=world.colliders.some(c=>{
          if(c.minY>mesh.p[1]+.3||c.maxY<.05)return false;
          const x=Math.max(c.minX,Math.min(mesh.p[0],c.maxX)),z=Math.max(c.minZ,Math.min(mesh.p[2],c.maxZ));
          return Math.hypot(mesh.p[0]-x,mesh.p[2]-z)<=.19;
        });
        assert(nearSolid,`${label}: low decoration ${mesh.category} is detached from collision geometry at ${mesh.p}`);
      }
    }
  }
  assert.deepEqual(tiers,Array.from(details.tiers),`${label}: inaccurate tier counts`);
  assert.equal(JSON.stringify(categoryCounts),JSON.stringify(details.categories),`${label}: inaccurate category counts`);
  for(const category of ['pipe','flange','elbow','clamp','cable_tray','cable','floor_drain','panel','screen','gauge','door_mechanism','louver','vent','equipment','hazard_marking'])
    assert(categoryCounts[category]>0,`${label}: missing promised industrial system ${category}`);
  for(const room of world.rooms)assert(details.regions['room-'+room.id]>100,`${label}: room ${room.id} was left without an art pass`);
  for(const [i] of world.corridors.entries())assert(details.regions['corridor-'+i]>30,`${label}: corridor ${i} was left without fittings`);
  assert(world.ambience.length<=40,`${label}: excessive ambient animation sources`);
  for(const a of world.ambience){
    assert(['steam','sparks','drip','beacon','screen'].includes(a.type)&&a.scale>0,`${label}: invalid ambient emitter`);
    assert(a.color.length===3&&a.color.every(c=>c>=0&&c<=1),`${label}: invalid ambient colour`);
    if(['steam','sparks','drip'].includes(a.type))assert(a.y>=2.6,`${label}: ambient plume obscures combat at eye height`);
    if(a.type==='screen')assert(a.width>0&&a.height>0&&Math.abs(Math.hypot(...a.normal)-1)<1e-8,`${label}: screen animation lacks its surface orientation`);
  }
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
  summary.push({ seed, stage,meshes:world.meshes.length,tiers,ambientSources:world.ambience.length, ...entry });
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
    'boss progression and arena clearance', 'geometry budgets',
    'released v0.2 physics/checkpoint data unchanged', 'LOD silhouettes preserved',
    'wall-attached low details', 'industrial detail categories', 'ambient surface orientation'],
  meshes:{min:Math.min(...summary.map(s=>s.meshes)),max:Math.max(...summary.map(s=>s.meshes))},
  representativeStages:summary.filter(s=>s.seed===96).map(s=>({stage:s.stage,meshes:s.meshes,tiers:s.tiers,ambientSources:s.ambientSources})),
  accessibleCells: { min: Math.min(...summary.map(s => s.accessibleCells)),
    max: Math.max(...summary.map(s => s.accessibleCells)) },
  targetsChecked: summary.reduce((sum, s) => sum + s.targets, 0)
}, null, 2));
