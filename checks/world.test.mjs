// Independent physical reachability checks. No WebGL, browser or dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const fmathSource = fileURLToPath(new URL('../src/fmath.js', import.meta.url));
const passagesSource = fileURLToPath(new URL('../src/passages.js', import.meta.url));
const source = fileURLToPath(new URL('../src/world.js', import.meta.url));
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(fmathSource, 'utf8'), sandbox, { filename: fmathSource });
vm.runInNewContext(readFileSync(passagesSource, 'utf8'), sandbox, { filename: passagesSource });
vm.runInNewContext(readFileSync(source, 'utf8'), sandbox, { filename: source });
const { create } = sandbox.window.FWorld;
const seeds = [1, 7, 42, 96, 2026, 65535];
const radius = .28, spacing = .25;

// Generation 6 adds staged encounters, physical entry cover and finite supplies.
// Checkpoint compatibility is explicit, rather than asserting the old coordinates.
const generation = 6;
const softGroundDetails = new Set(['grass','fern','fern_leaf','undergrowth','pebble',
  'mineral','mushroom','flower','flower_stem','ivy']);

function finiteNumbers(value, path = 'world') {
  if (typeof value === 'number') assert(Number.isFinite(value), `${path} is not finite`);
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) finiteNumbers(child, `${path}.${key}`);
  }
}

function heightAt(world,x,z) {
  let fallback=null;
  for(const f of world.walkable)if(Math.abs(x-f.x)<=f.w/2+1e-7&&Math.abs(z-f.z)<=f.d/2+1e-7){if(f.substrate||f.fallback){fallback=f.y;continue;}return f.y+(x-f.x)*f.slopeX+(z-f.z)*f.slopeZ;}
  return fallback;
}
function physicalGrid(world,label,{avoidHazards=false,closedDoors=[],sealed=false}={}) {
  const b=world.bounds,width=Math.ceil((b.maxX-b.minX)/spacing),depth=Math.ceil((b.maxZ-b.minZ)/spacing),count=width*depth;
  assert(count<1000000,`${label}: unreasonable navigation extent`);
  const px=i=>b.minX+(i+.5)*spacing,pz=i=>b.minZ+(i+.5)*spacing;
  const solids=world.colliders.concat(closedDoors.map(d=>({minX:d.x-d.w/2,maxX:d.x+d.w/2,minZ:d.z-d.d/2,maxZ:d.z+d.d/2,minY:d.y,maxY:d.y+d.h})));
  const size=3,buckets=new Map();
  for(const c of solids)for(let z=Math.floor((c.minZ-radius)/size);z<=Math.floor((c.maxZ+radius)/size);z++)for(let x=Math.floor((c.minX-radius)/size);x<=Math.floor((c.maxX+radius)/size);x++) {
    const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(c);
  }
  const clear=(x,z,y)=>!(buckets.get(Math.floor(x/size)+','+Math.floor(z/size))||[]).some(c=>{
    if(c.minY>=y+1.8||c.maxY<=y+.05)return false;
    const dx=Math.max(c.minX-x,0,x-c.maxX),dz=Math.max(c.minZ-z,0,z-c.maxZ);return dx*dx+dz*dz<radius*radius;
  })&&(!avoidHazards||!world.hazards.some(h=>Math.abs(h.y-y)<1&&Math.hypot(h.x-x,h.z-z)<h.r+radius));
  const free=(x,z)=>{const y=heightAt(world,x,z);return y!==null&&clear(x,z,y);};
  const height=new Float32Array(count),mask=new Uint8Array(count),seen=new Uint8Array(count),queue=new Uint32Array(count);
  for(let z=0;z<depth;z++)for(let x=0;x<width;x++) {
    const i=z*width+x,y=heightAt(world,px(x),pz(z));height[i]=y===null?NaN:y;mask[i]=y!==null&&clear(px(x),pz(z),y)?1:0;
  }
  const index=(x,z)=>Math.floor((z-b.minZ)/spacing)*width+Math.floor((x-b.minX)/spacing);
  const first=index(world.spawn.x,world.spawn.z);
  assert(mask[first],`${label}: spawn starts in physical collision`);
  let head=0,tail=1;seen[first]=1;queue[0]=first;
  while(head<tail) {
    const id=queue[head++],x=id%width,z=Math.floor(id/width);
    for(const n of [x?id-1:-1,x+1<width?id+1:-1,z?id-width:-1,z+1<depth?id+width:-1]) {
      if(n<0||seen[n])continue;
      const xx=n%width,zz=Math.floor(n/width),nx=px(xx),nz=pz(zz),mx=(px(x)+nx)/2,mz=(pz(z)+nz)/2;
      // Missing floor must not act as a synthetic wall. A reachable exposed edge
      // must be physically sealed by a visible solid at the player's real height.
      if(sealed&&!Number.isFinite(height[n]))assert(!clear(nx,nz,height[id])||!clear(mx,mz,height[id]),`${label}: unsealed edge at ${nx},${height[id]},${nz}`);
      if(!mask[n]||Math.abs(height[n]-height[id])>.4)continue;
      const my=heightAt(world,mx,mz);
      if(my===null||!clear(mx,mz,my)||Math.abs(my-height[id])>.4||Math.abs(my-height[n])>.4)continue;
      seen[n]=1;queue[tail++]=n;
    }
  }
  const reachable=p=>{
    if(!free(p.x,p.z))return false;
    const ix=Math.floor((p.x-b.minX)/spacing),iz=Math.floor((p.z-b.minZ)/spacing),y=heightAt(world,p.x,p.z);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++) {
      const x=ix+dx,z=iz+dz;if(x<0||z<0||x>=width||z>=depth)continue;
      const id=z*width+x;if(!seen[id]||Math.abs(height[id]-y)>.4)continue;
      let okay=true,prior=y;
      for(let step=1;step<=4;step++) {
        const t=step/4,xx=p.x+(px(x)-p.x)*t,zz=p.z+(pz(z)-p.z)*t,yy=heightAt(world,xx,zz);
        if(yy===null||Math.abs(yy-prior)>.4||!clear(xx,zz,yy)){okay=false;break;}prior=yy;
      }
      if(okay)return true;
    }
    return false;
  };
  return {reachable,free,clear,accessibleCells:tail};
}
function outdoorIntegrity(world,label) {
  const outside=world.rooms.filter(r=>r.outdoor),paths=world.corridors.filter(c=>c.outdoor),env=world.environment;
  assert.equal(outside.length,6,`${label}: missing open-air regions`);
  assert(world.rooms.filter(r=>!r.outdoor).length>=3&&paths.length>=7,`${label}: environment variety lost`);
  assert(world.rooms[0].outdoor,`${label}: spawn hides the outdoor environment`);
  assert.equal(env.outdoorZones.length,outside.length+paths.length,`${label}: outdoor mask incomplete`);
  for(const key of ['skyTop','skyBottom','fog','sunColor','ambient'])assert(env[key].length===3&&env[key].every(c=>c>=0&&c<=1),`${label}: invalid ${key}`);
  assert(Math.abs(Math.hypot(...env.sunDirection)-1)<1e-8&&env.sunDirection[1]>.3,`${label}: invalid sun`);
  assert(env.wind>0&&['pollen','ash','motes'].includes(env.weather),`${label}: missing atmosphere`);
  const silhouettes=new Set(['trunk','canopy','branch','boulder','rock_core','cliff','hill','boundary']);
  for(const mat of [8,9,10,11])assert(world.meshes.some(m=>m.mat===mat&&m.outdoor),`${label}: missing natural material ${mat}`);
  for(const m of world.meshes) {
    if(silhouettes.has(m.category))assert(!m.detail,`${label}: essential silhouette lost at low quality`);
    assert(!(m.outdoor&&['cable_tray','door_mechanism'].includes(m.category)),`${label}: indoor systems outside`);
    if(['canopy','arch_ivy'].includes(m.category))assert(m.mat===11,`${label}: foliage lost wind/material`);
  }
  for(const [i,r] of world.rooms.concat(world.corridors).entries()) {
    const region=i<world.rooms.length?'room-'+r.id:'corridor-'+(i-world.rooms.length);
    const floors=world.meshes.filter(m=>m.region===region&&m.ground);
    assert(floors.length,`${label}: ${region} has no rendered walkable ground`);
    if(!r.liftId) {
      const f=floors.find(m=>['floor','outdoor_floor'].includes(m.category));
      assert(f&&(r.bossArena||f.s[0]>=r.w-.001&&f.s[2]>=r.d-.001),`${label}: ${region} ground has a gap`);
      if(r.bossArena)for(let x=r.x-r.w/2+.5;x<r.x+r.w/2;x+=2)for(let z=r.z-r.d/2+.5;z<r.z+r.d/2;z+=2)assert(floors.some(m=>Math.abs(x-m.p[0])<=m.s[0]/2+.001&&Math.abs(z-m.p[2])<=m.s[2]/2+.001),`${label}: arena tile gap`);
      // Analytic top-plane height of the renderer's tilted box, independently
      // compared against the declared physical linear surface at three points.
      const kx=Math.tan(f.r?.[2]||0),kz=-Math.tan(f.r?.[0]||0),normalY=Math.cos(f.r?.[0]||0)*Math.cos(f.r?.[2]||0);
      for(const t of [-.4,0,.4]) {
        const x=r.x+(r.slopeX?t*r.w:0),z=r.z+(r.slopeZ?t*r.d:0),visual=f.p[1]+f.s[1]/(2*normalY)+(x-f.p[0])*kx+(z-f.p[2])*kz;
        assert(Math.abs(visual-heightAt(world,x,z))<.003,`${label}: ${region} visual/physical slope disagree`);
      }
    }
    if(!r.outdoor)continue;
    assert(world.outdoorBoundaries.filter(b=>b.region===region).length>=2,`${label}: ${region} no visible boundaries`);
    const y=heightAt(world,r.x,r.z);
    // Ground meshes and remote retaining walls are not roofs. A real object over
    // the circulation centre at head height would fail this vertical sky ray.
    for(const m of world.meshes) {
      if(m.ground||m.p[1]+m.s[1]/2<y+2.1)continue;
      const mandatoryGate=m.category==='gate_header';
      if(mandatoryGate)continue;
      assert(!(Math.abs(m.p[0]-r.x)<m.s[0]/2&&Math.abs(m.p[2]-r.z)<m.s[2]/2&&m.p[1]-m.s[1]/2<y+16),`${label}: outdoor centre ${region} roofed by ${m.category||m.shape}`);
    }
  }
  for(const b of world.outdoorBoundaries) {
    const m=world.meshes[b.mesh],c=world.colliders.find(c=>c.mesh===b.mesh);
    assert(m?.outdoor&&m.solid&&m.category==='boundary'&&c,`${label}: invisible/unphysical boundary`);
    assert(b.height>=.7&&b.thickness>=.48,`${label}: boundary cannot physically stop player`);
  }
  const trees=world.trees.filter(t=>t.solid);
  assert(trees.length>=10&&new Set(world.trees.map(t=>t.species)).size>=2,`${label}: tree variety lost`);
  assert.equal(world.natureStats.playableTrees,trees.length,`${label}: inaccurate tree stats`);
  let substantial=0;
  for(const t of trees) {
    const m=world.meshes[t.mesh],c=world.colliders.find(c=>c.mesh===t.mesh);
    assert(m.category==='trunk'&&m.mat===10&&!m.detail&&c,`${label}: walk-through tree`);
    assert(c.minY<=t.y+.001&&c.maxY>t.y+1.62,`${label}: trunk not solid at raised firing height`);
    if(c.maxX-c.minX>=.65)substantial++;
  }
  assert(substantial>=5,`${label}: no substantial tree cover`);
  assert(trees.some(t=>t.z<world.spawn.z&&Math.abs(t.x-world.spawn.x)<(world.spawn.z-t.z)*.9&&Math.hypot(t.x-world.spawn.x,t.z-world.spawn.z)<20),`${label}: no tree in initial forward view`);
  botanicalIntegrity(world,label);
}
function botanicalIntegrity(world,label){
  assert.equal(world.natureStats.treeModelVersion,2);
  const endpoints=m=>{
    const [x,y,z]=m.r||[0,0,0],axis=[Math.cos(z)*Math.sin(y)*Math.sin(x)-Math.sin(z)*Math.cos(x),Math.sin(z)*Math.sin(y)*Math.sin(x)+Math.cos(z)*Math.cos(x),Math.cos(y)*Math.sin(x)];
    return [-1,1].map(sign=>m.p.map((v,i)=>v+sign*axis[i]*m.s[1]/2));
  };
  const segmentDistance=(p,a,b)=>{const axis=b.map((v,i)=>v-a[i]),length=axis.reduce((n,v)=>n+v*v,0),u=Math.max(0,Math.min(1,p.reduce((n,v,i)=>n+(v-a[i])*axis[i],0)/length));return Math.hypot(...p.map((v,i)=>v-a[i]-u*axis[i]));};
  for(const tree of world.trees){
    assert.equal(tree.modelVersion,2);
    const parts=world.meshes.slice(tree.mesh,tree.mesh+tree.meshCount),bare=tree.species==='dead',pine=tree.species==='pine';
    assert.equal(parts.length,bare?17:pine?23:31,`${label}: botanical polish adds draw instances`);
    const crowns=parts.filter(m=>m.category==='canopy');assert.equal(crowns.length,bare?0:pine?4:9);
    assert(crowns.every(m=>m.shape==='foliage'&&m.mat===11&&!m.detail),`${label}: a crown still uses a primitive blob or vanishes at low quality`);
    assert.equal(parts.filter(m=>m.category==='trunk').length,3,`${label}: upper trunk has no natural bend`);
    const stems=parts.filter(m=>m.mat===10&&m.shape==='cylinder'),ends=stems.map(endpoints),base=parts[0];
    const attached=new Set();
    for(let i=0;i<stems.length;i++)if(ends[i].some(p=>p.every((v,k)=>Math.abs(v-base.p[k])<=base.s[k]/2+.02)))attached.add(i);
    for(let pass=0;pass<stems.length;pass++)for(let i=0;i<stems.length;i++)if(!attached.has(i)&&ends[i].some(p=>Array.from(attached).some(j=>segmentDistance(p,...ends[j])<=stems[j].s[0]/2+.015)))attached.add(i);
    assert.equal(attached.size,stems.length,`${label}: branch or fork floats away from its tree`);
    assert(parts.filter(m=>m.category==='twig').length>=(bare?5:8),`${label}: branches have no smaller forks`);
    for(let i=0;i<stems.length;i++)if(['branch','twig'].includes(stems[i].category))assert(Math.min(...ends[i].map(p=>p[1]))-stems[i].s[0]/2>=tree.y+2.1,`${label}: new branch clips a walking body`);
  }
}
function machineryAndTerrain(world,label) {
  assert.equal(world.enemies.length,[120,140,170][world.stage],`${label}: not exactly tenfold actual enemies`);
  assert(world.routeLength>[260,264,348][world.stage]*1.59,`${label}: stage length did not increase substantially`);
  assert.equal(world.mechanisms.length,3,`${label}: missing mechanisms`);
  assert.equal(world.lifts.length,2,`${label}: missing usable lifts`);
  assert.equal(world.doors.length,3,`${label}: missing real gates`);
  assert.deepEqual([...new Set(world.rooms.map(r=>r.y))].sort((a,b)=>a-b),[0,3.2,6.4],`${label}: no three-level playable relief`);
  assert(world.walkable.filter(f=>f.slopeX||f.slopeZ).length>=3,`${label}: no usable ramp network`);
  for(const f of world.walkable) {
    for(const k of ['x','z','w','d','y','slopeX','slopeZ'])assert(Number.isFinite(f[k]),`${label}: malformed walkable ${k}`);
    assert(Math.hypot(f.slopeX,f.slopeZ)<.4,`${label}: unwalkable ramp angle`);
  }
  assert(Math.hypot(world.spawn.x-world.mechanisms[0].x,world.spawn.z-world.mechanisms[0].z)<2.6,`${label}: entry mechanism too far away`);
  const ids=new Set(world.mechanisms.map(m=>m.id));
  for(const d of world.doors)assert(ids.has(d.requires)&&d.h>2.5&&Math.max(d.w,d.d)>=5,`${label}: gate is not tied to a control or doesn't block corridor`);
  for(const l of world.lifts) {
    assert(ids.has(l.requires)&&l.maxY-l.minY>=3.2&&l.speed>0,`${label}: lift has no powered travel`);
    const f=world.walkable.find(f=>f.liftId===l.id);
    assert(f&&f.y===l.minY,`${label}: static high floor fills lift shaft`);
    assert(Math.abs(heightAt(world,l.lowerCall.x,l.lowerCall.z)-l.minY)<.001&&Math.abs(heightAt(world,l.upperCall.x,l.upperCall.z)-l.maxY)<.001,`${label}: controls not on their real docks`);
    for(const c of world.colliders)if(c.maxY>l.minY&&c.minY<l.maxY+1.85)assert(c.maxX<=l.x-l.w/2+1e-8||c.minX>=l.x+l.w/2-1e-8||c.maxZ<=l.z-l.d/2+1e-8||c.minZ>=l.z+l.d/2-1e-8,`${label}: static solid obstructs lift passenger`);
  }
  for(const e of world.enemies)assert(Number.isInteger(e.zoneId)&&Number.isInteger(e.squadId)&&['flanker','suppressor','assault'].includes(e.role),`${label}: garrison lacks local scheduling/tactics`);
  // The control itself has a physical pedestal. Use the reachable position in
  // front of it, then progressively open its gate. No control can lock itself out.
  const active=new Set();let grid;
  for(let pass=0;pass<4;pass++) {
    grid=physicalGrid(world,label+' gate pass '+pass,{closedDoors:world.doors.filter(d=>!active.has(d.requires))});
    if(pass===0)for(const d of world.doors)assert(!grid.free(d.x,d.z),`${label}: closed gate does not physically block its centre`);
    let changed=false;
    for(const m of world.mechanisms)if(!active.has(m.id)&&grid.reachable({x:m.x,z:m.z+.95})){active.add(m.id);changed=true;}
    if(!changed)break;
  }
  assert.equal(active.size,3,`${label}: circular locked mechanism dependency`);
}
function jumpPadIntegrity(world,label) {
  assert.equal(world.jumpPads.length,3,`${label}: expected three real launch pads`);
  assert(new Set(world.jumpPads.map(p=>p.id)).size===3,`${label}: duplicate pad identifiers`);
  const closed=world.doors.map(d=>({minX:d.x-d.w/2,maxX:d.x+d.w/2,minZ:d.z-d.d/2,maxZ:d.z+d.d/2,minY:d.y,maxY:d.y+d.h}));
  const boxes=world.colliders.concat(closed),radius=.38;
  const clear=(x,y,z)=>!boxes.some(c=>{
    if(c.minY>=y+1.8-1e-7||c.maxY<=y+.025)return false;
    const dx=Math.max(c.minX-x,0,x-c.maxX),dz=Math.max(c.minZ-z,0,z-c.maxZ);return dx*dx+dz*dz<radius*radius;
  });
  const first=world.jumpPads[0];assert(Math.hypot(first.x-world.spawn.x,first.z-world.spawn.z)>first.r+3&&Math.hypot(first.x-world.spawn.x,first.z-world.spawn.z)<14,`${label}: introduction pad hidden or triggered at spawn`);
  assert(world.jumpPads.some(p=>p.target.y-p.y>=3.2),`${label}: pads do not use traversable relief`);
  for(const pad of world.jumpPads) {
    assert(pad.r>=1&&pad.r<=1.3&&pad.flightTime>=1.1&&pad.flightTime<=1.8,`${label}: invalid ballistic launch parameters`);
    assert(Math.abs(heightAt(world,pad.x,pad.z)-pad.y)<1e-6&&Math.abs(heightAt(world,pad.target.x,pad.target.z)-pad.target.y)<1e-6,`${label}: source/landing is not on its real surface`);
    const landingRoom=world.rooms.find(r=>Math.abs(pad.target.x-r.x)<r.w/2&&Math.abs(pad.target.z-r.z)<r.d/2);
    assert(landingRoom&&landingRoom.y===pad.target.y,`${label}: pad lands on moving platform or ramp`);
    for(const dx of [-1.5,0,1.5])for(const dz of [-1.5,0,1.5])assert(clear(pad.target.x+dx,pad.target.y,pad.target.z+dz)&&Math.abs(heightAt(world,pad.target.x+dx,pad.target.z+dz)-pad.target.y)<1e-7,`${label}: 3m landing zone blocked`);
    assert(!world.enemies.some(e=>Math.hypot(e.x-pad.x,e.z-pad.z)<2||Math.hypot(e.x-pad.target.x,e.z-pad.target.z)<2),`${label}: mob spawned in pad or arrival zone`);
    assert(!world.hazards.some(h=>Math.hypot(h.x-pad.target.x,h.z-pad.target.z)<h.r+1.5),`${label}: pad throws player into unavoidable vent`);
    const starts=[[0,0]];for(let j=0;j<16;j++)starts.push([Math.cos(j*Math.PI/8)*pad.r,Math.sin(j*Math.PI/8)*pad.r]);
    for(const [ox,oz] of starts){
      const sx=pad.x+ox,sz=pad.z+oz,T=pad.flightTime,vy=(pad.target.y-pad.y)/T+6*T;
      assert(clear(sx,pad.y,sz),`${label}: trigger disc touches a solid`);
      const samples=Math.ceil(T/.008);
      for(let i=0;i<=samples;i++){
        const t=T*i/samples,x=sx+(pad.target.x-sx)*t/T,z=sz+(pad.target.z-sz)*t/T,y=pad.y+vy*t-6*t*t;
        assert(x-radius>world.bounds.minX&&x+radius<world.bounds.maxX&&z-radius>world.bounds.minZ&&z+radius<world.bounds.maxZ,`${label}: ballistic arc escapes level bounds`);
        assert(clear(x,y,z),`${label}: ${pad.id} arc hits solid at ${x},${y},${z} (launch offset ${ox},${oz})`);
        const floor=heightAt(world,x,z);
        assert(floor!==null&&y>=floor-.025,`${label}: arc enters an elevated floor before target`);
      }
    }
  }
  for(const r of world.rooms.filter(r=>!r.outdoor))assert(world.colliders.some(c=>world.meshes[c.mesh].category==='ceiling'&&world.meshes[c.mesh].region==='room-'+r.id&&Math.abs(c.minY-r.y-r.h)<1e-7),`${label}: indoor ceiling does not stop airborne heads`);
}
function reachability(world,label,avoidHazards=false) {
  const grid=physicalGrid(world,label,{avoidHazards,sealed:!avoidHazards});
  for(const d of world.doors)assert(grid.free(d.x,d.z),`${label}: opened gate still blocked by static geometry`);
  const targets=[...world.cores,world.exit,...world.enemies,...world.pickups,...world.rooms,...world.corridors,...world.lifts.flatMap(l=>[l.lowerCall,l.upperCall]),...world.mechanisms.map(m=>({x:m.x,z:m.z+.95})),...world.jumpPads.flatMap(p=>[p,p.target]),...world.shops,...world.encounters.flatMap(q=>q.spawnEntries)];
  for(const [i,p] of targets.entries())assert(grid.reachable(p),`${label}: target ${i} unreachable at ${p.x},${heightAt(world,p.x,p.z)},${p.z}`);
  for(const [i,c] of world.connections.entries()) {
    if(c.liftId)continue;
    const steps=Math.ceil(Math.hypot(c.x2-c.x1,c.z2-c.z1)/spacing);let prior=null;
    for(let j=0;j<=steps;j++) {
      const x=c.x1+(c.x2-c.x1)*j/steps,z=c.z1+(c.z2-c.z1)*j/steps,y=heightAt(world,x,z);
      const inChamber=world.rooms.some(r=>Math.abs(x-r.x)<r.w/2-.1&&Math.abs(z-r.z)<r.d/2-.1);
      if(!inChamber)assert(grid.free(x,z),`${label}: corridor ${i} centre line physically blocked`);
      if(prior!==null)assert(Math.abs(y-prior)<.4,`${label}: corridor ${i} contains a step instead of a ramp`);prior=y;
    }
  }
  return {accessibleCells:grid.accessibleCells,targets:targets.length};
}

function encountersAndSupplies(world,label){
  const depth=new Map([[0,0]]);for(let pass=0;pass<world.rooms.length;pass++)for(const edge of world.connections)for(const [a,b] of [[edge.from,edge.to],[edge.to,edge.from]])if(depth.has(a)&&(!depth.has(b)||depth.get(b)>depth.get(a)+1))depth.set(b,depth.get(a)+1);
  const initial=new Set([...depth].filter(([id,n])=>id&&n===1).map(([id])=>id)),ordinary=world.enemies.filter(e=>!e.boss&&!e.bossWave),ids=new Set(),budget=[];
  assert.equal(world.progression.version,1);assert.equal(world.progression.maxActive,[8,10,12][world.stage]);
  assert.equal(world.progression.weaponSlots,4);
  assert.deepEqual(Array.from(world.progression.ammoCaps),[180,36,12,16]);
  if(world.stage===0){assert.deepEqual(Array.from(world.progression.startWeapons),[true,false,false,false]);assert.deepEqual(Array.from(world.progression.startAmmo),[48,0,0,0]);}
  assert.equal(world.encounters.length,world.rooms.length-2);assert.equal(world.encounterBays.length,world.encounters.length);
  assert.equal(ordinary.filter(e=>e.deployed).length,[6,8,8][world.stage],`${label}: initial crowd is not paced`);
  const hit=(a,b,c)=>{let low=0,high=1;for(const [k,min,max] of [[0,c.minX,c.maxX],[1,c.minY,c.maxY],[2,c.minZ,c.maxZ]]){const d=b[k]-a[k];if(Math.abs(d)<1e-9){if(a[k]<min||a[k]>max)return false;}else{const x=(min-a[k])/d,y=(max-a[k])/d;low=Math.max(low,Math.min(x,y));high=Math.min(high,Math.max(x,y));if(low>high)return false;}}return high>0&&low<.999;};
  const clear=(x,y,z,r=.38)=>!world.colliders.some(c=>c.minY<y+1.8&&c.maxY>y+.05&&Math.hypot(Math.max(c.minX-x,0,x-c.maxX),Math.max(c.minZ-z,0,z-c.maxZ))<r);
  for(const q of world.encounters){
    const room=world.rooms[q.zoneId],bay=world.encounterBays.find(b=>b.zoneId===q.zoneId),cover=world.colliders.find(c=>c.mesh===bay.coverMesh),mesh=world.meshes[bay.coverMesh];
    assert(room&&!room.bossArena&&room.id!==0&&cover&&mesh.solid&&mesh.destructibleId&&mesh.category==='reinforcement_baffle',`${label}: reinforcement has no real destructible entry cover`);
    assert(world.destructibles.find(g=>g.id===mesh.destructibleId)?.freestanding,`${label}: a low service screen incorrectly supports the roof`);
    assert(world.destructibles.filter(g=>g.kind==='roof').every(g=>!g.supports.includes(mesh.destructibleId)),`${label}: a roof hangs from a disconnected service screen`);
    const parentId=world.connections.flatMap(c=>c.from===room.id?[c.to]:c.to===room.id?[c.from]:[]).filter(id=>depth.get(id)<depth.get(room.id)).sort((a,b)=>a-b)[0],parent=world.rooms[parentId];
    assert.deepEqual(Array.from(bay.normal),[Math.sign(room.x-parent.x),Math.sign(room.z-parent.z)],`${label}: entry cover faces away from the actual approach`);
    assert(q.waveGap>=3&&q.maxActive>=Math.max(...q.waves.map(w=>w.enemyIds.length))&&q.maxActive<=6);
    assert.equal(q.spawnEntries.length,4);
    for(const [j,p] of q.spawnEntries.entries()){
      assert.equal(p.y,room.y);assert(clear(p.x,p.y,p.z,.38));assert(Math.abs(heightAt(world,p.x,p.z)-p.y)<.001);
      assert((p.x-bay.x)*bay.normal[0]+(p.z-bay.z)*bay.normal[1]>=1.89,`${label}: a heavy barrel can emerge through entry cover`);
      for(const other of q.spawnEntries.slice(j+1))assert(Math.hypot(p.x-other.x,p.z-other.z)>=1.5-1e-7,`${label}: reserve entries overlap`);
    }
    // Independently find a real, walkable observation position that hides every
    // body/head sample behind the screen. Turning the camera cannot reveal it.
    let hidden=false;
    for(const d of [9,10,11,12,13,14])for(const t of [0,-1.2,1.2,-2.4,2.4]){
      const x=bay.x-bay.normal[0]*d+bay.normal[1]*t,z=bay.z-bay.normal[1]*d-bay.normal[0]*t,y=heightAt(world,x,z);
      if(y===null||Math.abs(y-room.y)>.01||!clear(x,y,z,.28)||q.spawnEntries.some(p=>Math.hypot(x-p.x,z-p.z)<10))continue;
      const origin=[x,y+1.62,z];
      if(q.spawnEntries.every(p=>[.2,1.1,2.15].every(h=>[[-.9,0],[.9,0],[0,-.9],[0,.9],[0,0]].every(([dx,dz])=>hit(origin,[p.x+dx,p.y+h,p.z+dz],cover)))))hidden=true;
    }
    assert(hidden,`${label}: ${q.id} has no safely occluded observation/entry pair`);
    let hp=0;const drops=[0,0,0,0];
    for(const [wave,w] of q.waves.entries()){
      assert(w.enemyIds.length>=3&&w.enemyIds.length<=6,`${label}: combat wave is packed or singleton`);
      for(const id of w.enemyIds){assert(Number.isInteger(id)&&id>=0&&id<world.enemies.length&&!ids.has(id),`${label}: duplicate or invalid finite enemy ID`);ids.add(id);
        const e=world.enemies[id];assert(!e.boss&&!e.bossWave&&e.encounterId===q.id&&e.wave===wave&&e.zoneId===q.zoneId);
        assert.equal(e.deployed,initial.has(q.zoneId)&&wave===0,`${label}: reserve is physical before deployment`);
        if(initial.has(q.zoneId)||depth.get(q.zoneId)===2&&wave===0)assert(!e.weapon,`${label}: explosive specialist precedes the available launcher`);
        if(!e.deployed)assert(q.spawnEntries.some(p=>Math.hypot(p.x-e.x,p.z-e.z)<.001&&p.y===e.y));
        hp+=[3,5,4][e.type];if(e.drop){assert([0,1,2,3].includes(e.drop.weapon)&&Number.isInteger(e.drop.amount)&&e.drop.amount>0&&e.drop.amount<=4);drops[e.drop.weapon]+=e.drop.amount;}
      }
    }
    const supplies=world.pickups.filter(p=>p.zoneId===q.zoneId&&['ammo','weapon'].includes(p.kind)),ammo=[0,0,0,0];for(const p of supplies)ammo[p.weapon]+=p.amount;
    // Expected usable damage assumes 45% missed cells, only 2.4 damage from a
    // 5.74-pellet shell and 5.5 from an 8.5 blast. No future loot, incoming ammo,
    // store purchase, upgrade or free melee damage is needed for this reserve.
    // Grenades are extra choices; no perfect rebound or dual
    // firing is required to make the original per-portion budget sufficient.
    const expected=ammo[0]*.55+ammo[1]*2.4+ammo[2]*5.5;
    assert(expected>=hp*1.10,`${label}: ${q.id} ammo budget assumes perfect aim or future kills (${expected}/${hp})`);
    const firstHP=q.waves[0].enemyIds.reduce((n,id)=>n+[3,5,4][world.enemies[id].type],0);
    assert(ammo[0]*.55>=firstHP,`${label}: first wave needs a weapon that has not been found`);
    budget.push({zone:q.zoneId,waves:q.waves.map(w=>w.enemyIds.length),hp,ammo,finiteDrops:drops,conservativeDamage:+expected.toFixed(1),margin:+(expected/hp-1).toFixed(3)});
  }
  assert.equal(ids.size,ordinary.length);for(const [i,e] of world.enemies.entries())if(!e.boss&&!e.bossWave)assert(ids.has(i));
  for(const [i,e] of ordinary.filter(e=>e.deployed).entries())for(const other of ordinary.filter(e=>e.deployed).slice(i+1))assert(Math.hypot(e.x-other.x,e.z-other.z)>1.8,`${label}: opening patrol bodies are packed`);
  const pickupIds=new Set();for(const p of world.pickups){assert(!pickupIds.has(p.id)&&typeof p.id==='string');pickupIds.add(p.id);assert(['health','ammo','weapon'].includes(p.kind));assert(Number.isInteger(p.amount)&&p.amount>0&&p.amount<=180);if(['ammo','weapon'].includes(p.kind))assert([0,1,2,3].includes(p.weapon));assert(Math.abs(heightAt(world,p.x,p.z)-p.y)<.01,`${label}: supply floats above its actual floor`);}
  const weapons=world.pickups.filter(p=>p.kind==='weapon');assert.equal(weapons.filter(p=>p.weapon===1).length,2);for(const zone of initial)assert(weapons.some(p=>p.weapon===1&&p.zoneId===zone));
  for(const [zone,n] of depth)if(n===2&&!world.rooms[zone].bossArena)assert(weapons.some(p=>p.weapon===2&&p.zoneId===zone),`${label}: branch has explosive threats before a reachable Rupture rack`);
  for(const p of weapons)assert(p.weapon===1?depth.get(p.zoneId)===1:p.weapon===2?depth.get(p.zoneId)===2:depth.get(p.zoneId)>=2&&p.zoneId===world.shops[1].zoneId);
  const cells=world.pickups.filter(p=>p.id==='arsenal-smg-cells'),grenades=world.pickups.filter(p=>p.weapon===3);assert.equal(cells.length,1);assert.equal(depth.get(cells[0].zoneId),1);assert.equal(cells[0].kind,'ammo');assert.equal(cells[0].weapon,0);assert.equal(cells[0].amount,24);
  assert.equal(grenades.length,3);assert.equal(grenades.filter(p=>p.kind==='weapon').length,1);assert.equal(grenades.filter(p=>p.kind==='ammo').length,2);assert.equal(grenades.reduce((n,p)=>n+p.amount,0),12);
  assert(world.enemies.filter(e=>e.weapon==='grenade').every(e=>e.drop.weapon===3&&e.drop.amount===1));
  const newSupplies=world.pickups.filter(p=>p.id.startsWith('arsenal-'));assert.equal(newSupplies.length,4);
  for(const p of newSupplies){assert(clear(p.x,p.y,p.z,.75));for(const q of world.pickups)if(p!==q)assert(Math.hypot(p.x-q.x,p.z-q.z)>1.35,`${label}: new equipment overlaps an old pickup`);for(const q of world.encounters.flatMap(e=>e.spawnEntries))assert(Math.hypot(p.x-q.x,p.z-q.z)>1.65,`${label}: new equipment blocks a reserve entry`);}
  const arena=world.rooms.find(r=>r.bossArena),boss=world.enemies.at(-1),bossAmmo=[0,0,0,0];
  for(const p of world.pickups.filter(p=>p.zoneId===arena.id&&p.kind==='ammo'))bossAmmo[p.weapon]+=p.amount;
  assert.equal(world.pickups.filter(p=>p.zoneId===arena.id&&p.kind==='ammo').length,13);assert.equal(bossAmmo[3],4);
  assert(bossAmmo[0]*1.6>=boss.maxHp+18*1.8,`${label}: boss plus guards lack a conservative heart-shot resupply`);
  assert.equal(world.shops.length,3);assert.equal(new Set(world.shops.map(s=>s.id)).size,3);
  for(const shop of world.shops){assert(shop.name&&Number.isFinite(shop.y));assert(clear(shop.x,shop.y,shop.z,.38));assert(Math.abs(heightAt(world,shop.x,shop.z)-shop.y)<.01);assert.equal(shop.z,shop.terminal.z+1.05);const m=world.meshes.find(m=>m.category==='shop_terminal'&&m.p[0]===shop.terminal.x&&m.p[2]===shop.terminal.z);assert(m&&m.indestructible&&m.solid&&!m.destructibleId,`${label}: a destroyed building can remove the shop`);assert(world.colliders.some(c=>world.meshes[c.mesh]===m));}
  for(const pipe of world.pipes){
    const m=world.meshes[pipe.nozzleMesh];assert(m&&m.category==='pressure_nozzle'&&m.destructibleId===pipe.destructibleId);
    const rx=m.r[0],ry=m.r[1],axis=[Math.sin(ry)*Math.sin(rx),Math.cos(rx),Math.cos(ry)*Math.sin(rx)];
    for(let j=0;j<3;j++)assert(Math.abs(m.p[j]+axis[j]*m.s[1]/2-pipe.nozzle[j])<1e-7,`${label}: hot jet starts in empty air`);
    const base=[m.p[0]-axis[0]*m.s[1]/2,m.p[1]-axis[1]*m.s[1]/2,m.p[2]-axis[2]*m.s[1]/2];assert(Math.abs(base[0]-pipe.x)<.275&&Math.abs(base[2]-pipe.z)<.275,`${label}: nozzle is disconnected from its pressure manifold`);
  }
  return {budget,bossAmmo,arsenal:{slots:4,openingCache:cells[0].zoneId,grenadeRack:grenades.find(p=>p.kind==='weapon').zoneId,grenadeCaches:grenades.filter(p=>p.kind==='ammo').map(p=>p.zoneId),floorGrenades:12,finiteGrenadierDrops:8}};
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
  assert(world.meshes.length<=18000&&world.colliders.length<=512,`${label}: stage exceeds geometry budget`);
  assert.equal(world.generation,generation,`${label}: changed topology lacks a checkpoint generation marker`);
  outdoorIntegrity(world,label);
  machineryAndTerrain(world,label);
  jumpPadIntegrity(world,label);
  const economy=encountersAndSupplies(world,label);
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
    else if(mesh.structural){assert.equal(level,0,`${label}: persistent new structure is detail culled`);assert.equal(typeof mesh.category,'string');}
    else{
      assert(level>0&&typeof mesh.category==='string',`${label}: new dressing has no LOD/category`);
      categoryCounts[mesh.category]=(categoryCounts[mesh.category]||0)+1;
      if(level===2)assert(Math.max(...mesh.s)<=.35,`${label}: large silhouette incorrectly hidden with micro detail`);
      // Leaves, grass and small stones are permeable ground cover. Large rigid
      // details must still be attached to a genuinely collidable body.
      if(softGroundDetails.has(mesh.category)) {
        assert(mesh.outdoor&&mesh.p[1]+mesh.s[1]/2-(heightAt(world,mesh.p[0],mesh.p[2])||0)<2.4&&Math.max(...mesh.s)<1.2,
          `${label}: decorative vegetation masquerades as large solid cover`);
      } else if(mesh.p[1]-(heightAt(world,mesh.p[0],mesh.p[2])||0)<1.95&&mesh.p[1]+mesh.s[1]/2-(heightAt(world,mesh.p[0],mesh.p[2])||0)>.08){
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
  for(const [i,c] of world.corridors.entries())if(!c.liftId)assert(details.regions['corridor-'+i]>30,`${label}: corridor ${i} was left without fittings`);
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
  assert.equal(bosses.length,1,`${label}: each sector needs its own colossal guardian`);
  const boss=bosses[0],arena=world.rooms.find(r=>r.bossArena);
  assert(boss.boss&&arena&&arena.outdoor&&arena.h===0&&arena.w>=60&&arena.d>=60,`${label}: colossal arena is not open and large enough`);
  assert.equal(world.enemies.at(-1),boss,`${label}: unstable boss identity`);
  assert.equal(boss.bossScale,[5.4,7.2,9][stage]);assert.equal(boss.maxHp,[130,180,240][stage]);
  assert(boss.bossKind&&boss.bossName&&boss.arena.r===28);
  assert(Math.hypot(boss.x-arena.x,boss.z-arena.z)<.01&&boss.y===arena.y);
  const radius=boss.bossScale*1.5,height=boss.bossScale*3.18;
  for(const box of world.colliders.filter(b=>b.minY<boss.y+height&&b.maxY>boss.y+.1)){
    const x=Math.max(box.minX,Math.min(boss.x,box.maxX)),z=Math.max(box.minZ,Math.min(boss.z,box.maxZ));
    assert(Math.hypot(x-boss.x,z-boss.z)>=Math.max(23,radius),`${label}: giant's initial envelope intersects a prop`);
  }
  const waves=world.enemies.filter(e=>e.bossWave);assert.equal(waves.length,6);
  for(const wave of [1,2])assert.equal(waves.filter(e=>e.bossWave===wave).length,3);
  for(const e of waves)assert(e.type===0&&e.bossId===world.enemies.length-1&&Math.hypot(e.x-boss.x,e.z-boss.z)>23&&Math.hypot(e.x-boss.x,e.z-boss.z)<28,`${label}: reinforcement overlaps giant or arena boundary`);
  for(const [weapon,count] of [['grenade',8],['rocket',6]]){const selected=world.enemies.filter(e=>e.weapon===weapon);assert.equal(selected.length,count);assert(selected.every(e=>e.type===1));assert.equal(new Set(selected.map(e=>e.squadId)).size,count);}
  const substrate=world.walkable.filter(f=>f.substrate);assert.equal(substrate.length,1);assert(substrate[0].fallback&&substrate[0].y===-.25);
  for(const f of world.walkable.filter(f=>f.slopeX||f.slopeZ))assert(Math.abs(heightAt(world,f.x,f.z)-f.y)<.001,`${label}: substrate flattened a ramp`);
  assert(world.meshes.some(m=>m.category==='substrate'&&m.ground&&m.terrain));
  // Décision de David du 13/11 : les pièges ne sont plus trois machines décoratives
  // posées dans une cour, mais des barrières massives sur le chemin obligatoire.
  // Une barrière (« coupe ») est un lot solidaire : deux lames au moins, une presse
  // pleine largeur et des pics. Le banc checks/traps-mandatory.test.mjs prouve qu'il
  // barre bien le passage ; ici on vérifie seulement la consistance de la batterie.
  const trapBarriers=new Map();
  for(const t of world.traps){if(!trapBarriers.has(t.barrier))trapBarriers.set(t.barrier,[]);trapBarriers.get(t.barrier).push(t);}
  assert(world.traps.length>=4,`${label}: le secteur ne pose pas une batterie de pièges à la hauteur du danger demandé`);
  for(const [id,list] of trapBarriers){
    assert(list.filter(t=>t.kind==='blade').length>=2,`${label}: la barrière ${id} n'a pas assez de lames pour barrer le couloir`);
    assert(list.some(t=>t.kind==='press')&&list.some(t=>t.kind==='spikes'),`${label}: la barrière ${id} n'est pas une machine complète`);
    assert(new Set(list.map(t=>t.period)).size===1&&new Set(list.map(t=>t.phase)).size===1,`${label}: la barrière ${id} ne se lève pas d'un seul bloc`);
  }
  assert.equal(world.pipes.length,4);
  const ids=new Set(world.destructibles.map(d=>d.id)),owned=new Set();
  for(const d of world.destructibles){assert(d.meshes.length>0&&d.strength>0);for(const i of d.meshes){assert(!owned.has(i),`${label}: decoration belongs to two destructible bodies`);owned.add(i);assert.equal(world.meshes[i].destructibleId,d.id);}}
  for(const [i,m] of world.meshes.entries())if(!m.terrain&&!m.ground&&!m.indestructible)assert(owned.has(i),`${label}: undestroyable loose object`);
  for(const a of world.traps.concat(world.pipes)){assert(ids.has(a.destructibleId));assert(!inEntry(a));assert(a.damage>0);}
  for(const roof of world.destructibles.filter(g=>g.kind==='roof'))assert(roof.supports.length&&roof.supports.every(id=>ids.has(id)),`${label}: roof has no physical support graph`);
  const monuments=world.meshes.filter(m=>m.region?.startsWith('arena-monument-'));
  assert(monuments.length>=48&&monuments.length<=80,`${label}: monumental silhouette budget`);
  assert.equal(monuments.filter(m=>m.category==='arena_pier').length,6);
  for(const m of monuments){assert(!m.detail&&m.destructibleId);const x=Math.max(0,Math.abs(m.p[0]-arena.x)-m.s[0]/2),z=Math.max(0,Math.abs(m.p[2]-arena.z)-m.s[2]/2);assert(Math.hypot(x,z)>27,`${label}: monument clips giant movement envelope`);}
  assert.equal(world.destructibles.filter(g=>g.kind==='roof'&&g.region.startsWith('arena-monument-')).length,3);
  const periodic=world.pipes.find(p=>p.period>0),nozzle={x:periodic.x+periodic.dx*.54,z:periodic.z+periodic.dz*.54};
  for(const q of [world.spawn,world.exit,...world.cores,...world.pickups,...world.mechanisms,...world.lifts.flatMap(l=>[l.lowerCall,l.upperCall]),...world.jumpPads.flatMap(p=>[p,p.target])]){
    assert(Math.hypot(q.x-nozzle.x,q.z-nozzle.z)>3.2,`${label}: ambient explosion can destroy a mission control`);
    const projection=Math.max(0,Math.min(2.92,(q.x-nozzle.x)*periodic.dx+(q.z-nozzle.z)*periodic.dz));
    assert(Math.hypot(q.x-nozzle.x-periodic.dx*projection,q.z-nozzle.z-periodic.dz*projection)>1.8,`${label}: periodic hot jet covers objective`);
  }
  // Les ancres du directeur sont les conduites de pression et les machines de piège
  // assez loin du départ. Leur nombre suit désormais la densité des barrières.
  assert.equal(world.horrorSites.length,world.pipes.length+world.traps.filter(t=>Math.hypot(t.x-world.spawn.x,t.z-world.spawn.z)>16).length);
  for(const h of world.horrorSites){assert(ids.has(h.destructibleId)&&['alarm','steam','collapse'].includes(h.kind)&&h.radius===3);assert(Math.hypot(h.x-world.spawn.x,h.z-world.spawn.z)>16);}

  const entry = reachability(world, label);
  if(world.hazards.length)reachability(world,label+' with every vent hot',true);
  summary.push({ seed, stage, economy,meshes:world.meshes.length,colliders:world.colliders.length,trees:world.natureStats.trees,outdoorRooms:world.natureStats.outdoorRooms,tiers,ambientSources:world.ambience.length, ...entry });
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
    'three colossal guardians, open arenas and scripted-wave clearance', 'geometry budgets',
    'explicit generation 6 checkpoint identity', 'LOD silhouettes preserved',
    'collision geometry visible', 'solid trunks at eye height', 'real open sky at spawn',
    'three distinct outdoor biomes', 'sealed visible outdoor boundaries',
    'continuous 3D ramps and terraces', 'tenfold individually simulated garrisons', 'progressive mechanism unlock reachability', 'two unobstructed elevator shafts with ramp alternatives', 'ballistic launch discs and 3m landing zones', 'real ceilings stop airborne bodies', 'industrial and natural detail systems',
    'wall-attached rigid details', 'ambient surface orientation', 'monumental arena silhouettes outside giant envelope', 'ambient explosions preserve mission controls', 'seven real horror cue anchors', 'small sequenced encounters and four physically hidden entries', 'finite per-encounter ammo budgets with missed-shot margin', 'progressive weapon racks on both opening branches', 'three reachable persistent workshops', 'real connected steam nozzles', 'branched trees with shared irregular crown geometry', 'four firearms, an early ammunition cache and two finite grenade caches'],
  meshes:{min:Math.min(...summary.map(s=>s.meshes)),max:Math.max(...summary.map(s=>s.meshes))},
  representativeStages:summary.filter(s=>s.seed===96).map(s=>({stage:s.stage,meshes:s.meshes,colliders:s.colliders,trees:s.trees,outdoorRooms:s.outdoorRooms,tiers:s.tiers,ambientSources:s.ambientSources,economy:s.economy})),
  accessibleCells: { min: Math.min(...summary.map(s => s.accessibleCells)),
    max: Math.max(...summary.map(s => s.accessibleCells)) },
  targetsChecked: summary.reduce((sum, s) => sum + s.targets, 0)
}, null, 2));
