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

// Generation 4 intentionally replaces the enclosed v0.2/v0.3 footprints.
// Checkpoint compatibility is explicit, rather than asserting the old coordinates.
const generation = 4;
const softGroundDetails = new Set(['grass','fern','fern_leaf','undergrowth','pebble',
  'mineral','mushroom','flower','flower_stem','ivy']);

function finiteNumbers(value, path = 'world') {
  if (typeof value === 'number') assert(Number.isFinite(value), `${path} is not finite`);
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) finiteNumbers(child, `${path}.${key}`);
  }
}

function outdoorIntegrity(world,label) {
  const outside=world.rooms.filter(r=>r.outdoor),paths=world.corridors.filter(c=>c.outdoor),env=world.environment;
  assert.equal(outside.length,5,`${label}: missing genuinely open-air regions`);
  assert(world.rooms.filter(r=>!r.outdoor).length>=3,`${label}: no coherent indoor buildings remain`);
  assert(paths.length>=7,`${label}: outdoor regions are isolated decorative pockets`);
  assert(world.rooms[0].outdoor,`${label}: spawn still hides the outdoor environment`);
  assert.equal(env.outdoorZones.length,outside.length+paths.length,`${label}: renderer outdoor mask is incomplete`);
  assert.equal(JSON.stringify(world.walkable),JSON.stringify(world.rooms.concat(world.corridors).map(({x,z,w,d})=>({x,z,w,d}))),
    `${label}: tactical navigation and rendered floors disagree`);
  for(const key of ['skyTop','skyBottom','fog','sunColor','ambient'])assert(env[key].length===3&&env[key].every(c=>c>=0&&c<=1),`${label}: invalid ${key}`);
  assert(Math.abs(Math.hypot(...env.sunDirection)-1)<1e-8&&env.sunDirection[1]>.3,`${label}: sun direction is not a unit direction above ground`);
  assert(env.wind>0&&['pollen','ash','motes'].includes(env.weather),`${label}: missing outdoor atmosphere`);
  const canopy=new Set(['canopy','arch_ivy']),silhouettes=new Set(['trunk','canopy','branch','boulder','rock_core','cliff','hill','boundary']);
  for(const mat of [8,9,10,11])assert(world.meshes.some(m=>m.mat===mat&&m.outdoor),`${label}: missing natural material ${mat}`);
  for(const m of world.meshes) {
    if(silhouettes.has(m.category))assert(!m.detail,`${label}: essential outdoor silhouette disappears at low quality`);
    assert(!(m.outdoor&&['cable_tray','door_mechanism'].includes(m.category)),`${label}: indoor ceiling systems leaked into an open-air region`);
    if(canopy.has(m.category))assert(m.mat===11,`${label}: foliage lacks the natural material/wind path`);
  }
  for(const [i,region] of world.rooms.concat(world.corridors).entries()) {
    if(!region.outdoor)continue;
    const name=i<world.rooms.length?'room-'+region.id:'corridor-'+(i-world.rooms.length);
    const floors=world.meshes.filter(m=>m.region===name&&m.category==='outdoor_floor');
    assert.equal(floors.length,1,`${label}: outdoor region ${name} lacks a continuous ground plane`);
    assert(Math.abs(floors[0].p[1]+floors[0].s[1]/2)<1e-8&&floors[0].s[0]>=region.w&&floors[0].s[2]>=region.d,
      `${label}: outdoor floor ${name} has a hidden step or gap`);
    assert(world.outdoorBoundaries.filter(b=>b.region===name).length>=2,`${label}: outdoor region ${name} lacks visible retaining limits`);
    // A vertical ray above every circulation centre must actually reach the sky.
    // Merely adding a sky-coloured ceiling or foliage around a roof will fail.
    for(const m of world.meshes) {
      if(m.p[1]+m.s[1]/2<2.1)continue;
      assert(!(Math.abs(m.p[0]-region.x)<m.s[0]/2&&Math.abs(m.p[2]-region.z)<m.s[2]/2&&m.p[1]-m.s[1]/2<16),
        `${label}: outdoor centre ${name} is still roofed by ${m.category||m.shape}`);
    }
  }
  for(const b of world.outdoorBoundaries) {
    const mesh=world.meshes[b.mesh],solid=world.colliders.find(c=>c.mesh===b.mesh);
    assert(mesh&&mesh.outdoor&&mesh.solid&&mesh.category==='boundary'&&solid,`${label}: invisible/unphysical outdoor boundary`);
    assert(b.height>=.7&&b.thickness>=.5,`${label}: outdoor border cannot physically stop the player`);
  }
  const trees=world.trees.filter(t=>t.solid);
  assert(trees.length>=10&&new Set(world.trees.map(t=>t.species)).size>=2,`${label}: insufficient tree silhouettes/species`);
  assert.equal(world.natureStats.playableTrees,trees.length,`${label}: inaccurate nature statistics`);
  let substantial=0;
  for(const t of trees) {
    const m=world.meshes[t.mesh],c=world.colliders.find(c=>c.mesh===t.mesh);
    assert(m.category==='trunk'&&m.mat===10&&!m.detail&&c,`${label}: a large tree can be walked through`);
    assert(c.minY<=0&&c.maxY>1.62,`${label}: tree is not solid at firing height`);
    assert(c.minX<t.x&&c.maxX>t.x&&c.minZ<t.z&&c.maxZ>t.z,`${label}: trunk collider is detached from its visible trunk`);
    if(c.maxX-c.minX>=.65)substantial++;
  }
  assert(substantial>=5,`${label}: no trees wide enough to provide tactical cover`);
  const visibleFromSpawn=trees.filter(t=>t.z<world.spawn.z&&Math.abs(t.x-world.spawn.x)<(world.spawn.z-t.z)*.9&&Math.hypot(t.x-world.spawn.x,t.z-world.spawn.z)<20);
  assert(visibleFromSpawn.length,`${label}: the initial forward view has no tree silhouette`);
  assert(world.meshes.some(m=>m.outdoor&&m.category===(world.stage===1?'cliff':'hill')),`${label}: missing raised landscape outside the walking surface`);
}

// Flood the collision space WITHOUT a floor constraint. If a wall or path-end
// seam is missing, this search can escape into a gap and proves the bug instead
// of hiding it behind a synthetic "must be in a room" navigation restriction.
function sealedBoundaries(world,label) {
  const b={minX:world.bounds.minX-1,maxX:world.bounds.maxX+1,minZ:world.bounds.minZ-1,maxZ:world.bounds.maxZ+1};
  const width=Math.ceil((b.maxX-b.minX)/spacing),depth=Math.ceil((b.maxZ-b.minZ)/spacing),count=width*depth;
  const px=i=>b.minX+(i+.5)*spacing,pz=i=>b.minZ+(i+.5)*spacing;
  const boxes=world.colliders.filter(c=>c.minY<1.8&&c.maxY>.05),bucketSize=2,buckets=new Map();
  for(const c of boxes)for(let z=Math.floor((c.minZ-radius)/bucketSize);z<=Math.floor((c.maxZ+radius)/bucketSize);z++)for(let x=Math.floor((c.minX-radius)/bucketSize);x<=Math.floor((c.maxX+radius)/bucketSize);x++) {
    const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(c);
  }
  const onFloor=(x,z)=>world.walkable.some(f=>Math.abs(x-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2);
  const free=(x,z)=>!(buckets.get(Math.floor(x/bucketSize)+','+Math.floor(z/bucketSize))||[]).some(c=>{
    const dx=Math.max(c.minX-x,0,x-c.maxX),dz=Math.max(c.minZ-z,0,z-c.maxZ);return dx*dx+dz*dz<radius*radius;
  });
  const mask=new Uint8Array(count),seen=new Uint8Array(count),queue=new Uint32Array(count);
  for(let z=0;z<depth;z++)for(let x=0;x<width;x++)mask[z*width+x]=Number(free(px(x),pz(z)));
  const first=Math.floor((world.spawn.z-b.minZ)/spacing)*width+Math.floor((world.spawn.x-b.minX)/spacing);
  assert(mask[first],`${label}: boundary search starts in collision`);
  let head=0,tail=1;seen[first]=1;queue[0]=first;
  while(head<tail) {
    const id=queue[head++],x=id%width,z=Math.floor(id/width);
    assert(onFloor(px(x),pz(z)),`${label}: physical movement escapes the ground at ${px(x)},${pz(z)}`);
    for(const n of [x?id-1:-1,x+1<width?id+1:-1,z?id-width:-1,z+1<depth?id+width:-1]) {
      if(n<0||seen[n]||!mask[n])continue;
      const xx=n%width,zz=Math.floor(n/width);if(!free((px(x)+px(xx))/2,(pz(z)+pz(zz))/2))continue;
      seen[n]=1;queue[tail++]=n;
    }
  }
  return tail;
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

const summary = [], signatures = new Set(), topologyIds = new Set(), topologyGraphs = new Map(), footprints = new Map(), biomes = new Set();
for (const seed of seeds) for (let stage = 0; stage < 3; stage++) {
  const label = `seed ${seed}, stage ${stage}`;
  const world = create(seed, stage), repeated = create(seed, stage);
  finiteNumbers(world);
  const serialized = JSON.stringify(world);
  assert.equal(serialized, JSON.stringify(repeated), `${label}: nondeterministic generation`);
  signatures.add(createHash('sha256').update(serialized).digest('hex'));
  assert.equal(world.cores.length, 3, `${label}: expected three required relays`);
  assert(world.meshes.length<=16000&&world.colliders.length<=500,`${label}: stage exceeds geometry budget`);
  assert.equal(world.generation,generation,`${label}: changed topology lacks a checkpoint generation marker`);
  outdoorIntegrity(world,label);
  sealedBoundaries(world,label);
  biomes.add(world.environment.biome);
  const details=world.detailStats;
  assert(details&&Number.isInteger(details.base)&&details.base>0&&details.base<world.meshes.length,`${label}: no layered art pass`);
  assert.equal(details.added,world.meshes.length-details.base,`${label}: inaccurate detail count`);
  const tiers=[0,0,0],categoryCounts={};
  for(const [i,mesh] of world.meshes.entries()){
    const level=mesh.detail||0;
    assert([0,1,2].includes(level),`${label}: renderer cannot classify this detail tier`);
    assert(mesh.p.length===3&&mesh.s.length===3&&mesh.s.every(n=>n>0),`${label}: invalid mesh dimensions`);
    assert.equal(typeof mesh.outdoor,'boolean',`${label}: ambiguous indoor/outdoor light assignment`);
    tiers[level]++;
    if(i<details.base)assert.equal(level,0,`${label}: original architecture was made disposable detail`);
    else{
      assert(level>0&&typeof mesh.category==='string',`${label}: new dressing has no LOD/category`);
      categoryCounts[mesh.category]=(categoryCounts[mesh.category]||0)+1;
      if(level===2)assert(Math.max(...mesh.s)<=.35,`${label}: large silhouette incorrectly hidden with micro detail`);
      // Leaves, grass and small stones are permeable ground cover. Large rigid
      // details must still be attached to a genuinely collidable body.
      if(softGroundDetails.has(mesh.category)) {
        assert(mesh.outdoor&&mesh.p[1]+mesh.s[1]/2<2.4&&Math.max(...mesh.s)<1.2,
          `${label}: decorative vegetation masquerades as large solid cover`);
      } else if(mesh.p[1]<1.95&&mesh.p[1]+mesh.s[1]/2>.08){
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
    const mesh=world.meshes[box.mesh];
    assert(mesh&&mesh.solid&&mesh.shape==='box'&&!mesh.detail,`${label}: collider has no essential visible solid mesh`);
    for(const [axis,i] of [['X',0],['Y',1],['Z',2]]) {
      assert(Math.abs(box['min'+axis]-(mesh.p[i]-mesh.s[i]/2))<1e-8&&Math.abs(box['max'+axis]-(mesh.p[i]+mesh.s[i]/2))<1e-8,
        `${label}: collider and visible mesh disagree on ${axis}`);
    }
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
  summary.push({ seed, stage,meshes:world.meshes.length,colliders:world.colliders.length,trees:world.natureStats.trees,outdoorRooms:world.natureStats.outdoorRooms,tiers,ambientSources:world.ambience.length, ...entry });
}
assert.equal(signatures.size, seeds.length * 3, 'Seeds/stages unexpectedly produce identical worlds');
assert.equal(topologyIds.size,3,'Stages must have distinct topology identities');
assert.equal(new Set(topologyGraphs.values()).size,3,'Stages reuse the same graph with recoloured rooms');
assert.equal(new Set(footprints.values()).size,3,'Stages reuse the same room footprint');
assert.equal(biomes.size,3,'Stages reuse the same outdoor ecology');
console.log(JSON.stringify({
  status: 'PASS', cases: summary.length, radius, spacing,
  checks: ['finite values', 'determinism', 'spawn clearance', 'independent flood fill',
    'all relays reachable', 'exit reachable', 'enemy and pickup placement',
    'distinct stage graphs and footprints', 'every corridor physically connected',
    'all objectives accessible with every vent hot', 'safe hazard warning windows',
    'boss progression and arena clearance', 'geometry budgets',
    'explicit generation 4 checkpoint identity', 'LOD silhouettes preserved',
    'collision geometry visible', 'solid trunks at eye height', 'real open sky at spawn',
    'three distinct outdoor biomes', 'sealed visible outdoor boundaries',
    'flat continuous outdoor floors', 'industrial and natural detail systems',
    'wall-attached rigid details', 'ambient surface orientation'],
  meshes:{min:Math.min(...summary.map(s=>s.meshes)),max:Math.max(...summary.map(s=>s.meshes))},
  representativeStages:summary.filter(s=>s.seed===96).map(s=>({stage:s.stage,meshes:s.meshes,colliders:s.colliders,trees:s.trees,outdoorRooms:s.outdoorRooms,tiers:s.tiers,ambientSources:s.ambientSources})),
  accessibleCells: { min: Math.min(...summary.map(s => s.accessibleCells)),
    max: Math.max(...summary.map(s => s.accessibleCells)) },
  targetsChecked: summary.reduce((sum, s) => sum + s.targets, 0)
}, null, 2));
