import {loadFast,WORLDS,fnv} from '../saut/lib.mjs';
const W=loadFast();const G=12;
for(const [label,i,o] of WORLDS){const world=W.FWorld.create(96,i,o);
  const bs=world.outdoorBoundaries.map(b=>world.colliders.find(c=>c.mesh===b.mesh));let cross=0,min=1e9;
  for(const pad of world.jumpPads||[]){const T=Math.min(2.5,Math.max(.7,Number(pad.flightTime)||1.5)),vx=(pad.target.x-pad.x)/T,vz=(pad.target.z-pad.z)/T,vy=(pad.target.y-pad.y)/T+G*T/2;let hit=false;
    for(let t=0;t<=T;t+=T/200){const x=pad.x+vx*t,z=pad.z+vz*t,y=pad.y+vy*t-G*t*t/2;for(const c of bs){const dx=x<c.minX?c.minX-x:x>c.maxX?x-c.maxX:0,dz=z<c.minZ?c.minZ-z:z>c.maxZ?z-c.maxZ:0,d=Math.hypot(dx,dz);if(c.minY<y+1.8){min=Math.min(min,d);if(d<.28)hit=true;}}}
    if(hit)cross++;}
  console.log(label,'stage',world.stage,'colliders',world.colliders.length,'hash géométrie',fnv(JSON.stringify([world.colliders,world.walkable])),'ennemis',world.enemies.length,'pads',(world.jumpPads||[]).length,'vols de pad coupant un clip',cross,'marge mini',min.toFixed(2));}
// autre graine
for(const seed of [7,1234]){const world=W.FWorld.create(seed,0,{campaign:true,campaignVersion:2});console.log('graine',seed,'hash',fnv(JSON.stringify([world.colliders,world.walkable])),'murets',world.outdoorBoundaries.length);}
