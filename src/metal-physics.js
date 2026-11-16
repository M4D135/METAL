/* METAL — physical props, rubble and machine wrecks. Ordinary game rules only. */
(function(G){'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),copy=v=>JSON.parse(JSON.stringify(v));
function props(world,solids){
  const out=[],reserved=[world.spawn,world.exit,...world.cores,...world.enemies,...world.pickups,...world.mechanisms,...world.doors,...world.lifts,...world.jumpPads,...world.traps],types=[['crate',[.8,.8,.8],30,'wood',3],['case',[.6,.6,.6],45,'metal',0],['barrel',[.6,.9,.6],25,'metal',6],['pallet',[1.2,.14,1],15,'wood',3],['pipe',[.22,2,.22],12,'metal',0],['plate',[1.2,.04,.8],8,'metal',1],['block',[.4,.4,.4],60,'stone',2]];
  for(const room of world.rooms||[]){
    if(room.bossArena)continue;let made=0;
    for(let k=0;k<40&&made<10&&out.length<100;k++){
      const side=k%4,t=((Math.floor(k/4)*.61803398875+(world.seed%31)/31)%1-.5)*.68,x=room.x+(side<2?(side?1:-1)*(room.w/2-1.5):t*room.w),z=room.z+(side>=2?(side===3?1:-1)*(room.d/2-1.5):t*room.d),y=room.y||0;
      const type=types[(k+room.id+(world.seed>>>0))%types.length],size=type[1];
      if(reserved.some(q=>q&&Math.hypot(q.x-x,q.z-z)<2.4+Math.max(q.w||0,q.d||0)*.5)||out.some(q=>Math.hypot(q.pos[0]-x,q.pos[2]-z)<1.45))continue;
      const radius=Math.max(size[0],size[2])*.5+.12;
      if(solids.some(q=>q.maxY>y+.04&&q.minY<y+size[1]+.1&&x+radius>q.minX&&x-radius<q.maxX&&z+radius>q.minZ&&z-radius<q.maxZ))continue;
      if(type[0]==='barrel'&&Math.hypot(x-world.spawn.x,z-world.spawn.z)<6)continue;
      out.push({kind:type[0]==='barrel'?'barrel':'prop',shape:type[0]==='pipe'?'capsule':type[0]==='barrel'?'cylinder':'box',size:size.slice(),mass:type[2],material:type[3],mat:type[4],pos:[x,y+size[1]/2+.004,z],hp:type[0]==='barrel'?10:0});made++;
      if(type[0]==='crate'&&made<10){out.push({kind:'prop',shape:'box',size:[.6,.6,.6],mass:30,material:'wood',mat:3,pos:[x,y+1.104,z],hp:0});made++;}
    }
  }return out;
}
function create(world,solids,host={}){
  const F=G.FPhysics,s=host.state,options={bounded:true,geometry:!!G.FPhysicsGeometry&&host.geometry!==false,bounds:world.bounds,capacity:384,maxStatics:Math.max(4096,solids.length+(world.walkable||[]).length+128),maxContacts:8192,maxJoints:world.hordeVersion===1?96:24,ground:(world.walkable||[]).length?null:0,massMin:3,massMax:150};
  let phys=F.create(options),rows=[],systems=[],proxies=[],rigs=[],player=0,serial=0,tick=0,dirty=false,latestSolids=solids;
  const impactAt=new Float64Array((world.enemies?.length||0)+1).fill(-1000),energyBefore=new Float64Array(4096);
  const navMap=new Map(),navBoxes=[],navPending=new Map();
  const byHandle=new Map(),rub=new Map(),near=new Int32Array(384),sample=new Float64Array(18),pose=new Float64Array(7),rotation=new Float64Array(3),box={},hit={},pushed=new Int32Array(4096).fill(-1),soundAt=new Float64Array(4096).fill(-1000);
  const capsuleFrom=new Float64Array(3),capsuleDelta=new Float64Array(3),capsuleHit={},capsuleOptions={radius:.28,height:1.8,mask:10,statics:false,skin:.001};
  phys.setStatics(solids,world.walkable||[]);
  function add(def,asleep=false){
    const size=def.size,shape=def.body||(def.shape==='capsule'?'capsule':def.shape==='sphere'?'sphere':'box');
    const h=phys.addBody({shape,size,pos:def.pos,rot:def.rotation||[0,0,0],...(shape!=='box'?{radius:def.radius??size[0]/2,height:def.height??size[1]}:{}),mass:def.mass,material:def.material,group:def.group??2,...(def.mask!==undefined?{mask:def.mask}:{}),...(def.restitution!==undefined?{restitution:def.restitution}:{}),vel:def.velocity||[0,0,0],ang:def.angularVelocity||[0,0,0],asleep});if(h<0)return null;
    const q={id:++serial,handle:h,kind:def.kind,shape:def.shape,size:size.slice(),mat:def.mat??0,color:def.color?.slice(),rubbleId:def.rubbleId??null,projectileId:def.projectileId??null,hp:def.hp||0,fuse:-1,credit:-1000,profile:null};rows.push(q);byHandle.set(h,q);if(q.rubbleId!==null)rub.set(q.rubbleId,q);return q;
  }
  for(const q of props(world,solids))add(q,true);
  function system(key,size,pos){const handle=phys.addBody({size,pos,kinematic:true,group:8,mask:18});if(handle>=0)systems.push({key,handle});}
  for(const q of world.doors||[])system('door:'+q.id,[q.w,q.h,q.d],[q.x,(q.y||0)+q.h/2,q.z]);
  for(const q of world.lifts||[])system('lift:'+q.id,[q.w,.22,q.d],[q.x,q.minY-.11,q.z]);
  for(const q of world.traps||[])if(q.kind==='blade'||q.kind==='press')system('trap:'+q.id,[q.w,q.h||.3,q.d],[q.x,q.y+50,q.z]);
  if(s)player=phys.addBody({shape:'capsule',radius:.28,height:1.8,pos:[s.player.x,s.player.y+.9,s.player.z],kinematic:true,group:4,mask:18});
  if(s)for(let i=0;i<16;i++)proxies.push({handle:phys.addBody({shape:'capsule',radius:.38,height:1.8,pos:[world.spawn.x,-50,world.spawn.z],kinematic:true,group:4,mask:18}),enemy:-1});
  // Optional side-room mechanisms. Keep the access footprint of a previously checked prop.
  if(s)for(const original of rows.slice()){
    if(rigs.length>=6)break;if(original.kind!=='prop'||original.size[1]<.5)continue;
    const body=phys.body(original.handle),pos=body.pos.slice(),kind=rigs.length%4;
    if(rigs.some(q=>Math.hypot(q.anchor[0]-pos[0],q.anchor[2]-pos[2])<8))continue;
    const size=kind===0?[.8,.8,.8]:kind===1?[1.2,1.6,.12]:kind===2?[1.6,.12,.8]:original.size.slice();
    const center=[pos[0],pos[1]-original.size[1]/2+(kind===0?2.2:kind===1?.8:kind===2?.65:size[1]/2),pos[2]],extent=Math.max(size[0],size[2])/2;
    if(solids.some(q=>q.maxY>center[1]-size[1]/2+.01&&q.minY<center[1]+size[1]/2+.04&&center[0]+extent>q.minX&&center[0]-extent<q.maxX&&center[2]+extent>q.minZ&&center[2]-extent<q.maxZ))continue;
    remove(original);const q=add({kind:'prop',shape:'box',size,pos:center,mass:kind===0?150:30,material:'metal',mat:0},false);if(!q)continue;
    const anchor=kind===0?[center[0],center[1]+2.4,center[2]]:kind===1?[center[0]-.6,center[1],center[2]]:center.slice(),type=kind===0?'cable':kind===3?'weld':'hinge';
    const joint=phys.addJoint({type,a:0,b:q.handle,...(kind===0?{anchorA:anchor,max:2.4}:{worldAnchor:anchor}),axisA:kind===2?[0,0,1]:[0,1,0],axisB:kind===2?[0,0,1]:[0,1,0],limit:kind===2?.38:95*Math.PI/180,breakImpulse:kind===0?40:kind===3?55:400});
    rigs.push({handle:q.handle,joint,kind,anchor,base:center[1]-size[1]/2});
  }
  for(let i=0;i<rigs.length;i++){const rig=rigs[i],a=rig.anchor;if(rig.kind===0){system('fixed:'+i+':beam',[2.4,.16,.16],[a[0],a[1]+.08,a[2]]);for(const side of [-1,1])system('fixed:'+i+':'+side,[.12,a[1]-rig.base+1.8,.12],[a[0]+side*1.12,(a[1]+rig.base-1.8)/2,a[2]]);}else if(rig.kind===1)system('fixed:'+i,[.1,2,.1],a);else if(rig.kind===2)system('fixed:'+i,[.18,.6,.65],[a[0],a[1]-.35,a[2]]);}
  function remove(q){if(navMap.has(q.handle))navPending.set(q.handle,null);phys.removeBody(q.handle);byHandle.delete(q.handle);if(q.rubbleId!==null)rub.delete(q.rubbleId);const i=rows.indexOf(q);if(i>=0)rows.splice(i,1);}
  function query(x,y,z,r,height){box.minX=x-r;box.maxX=x+r;box.minY=y;box.maxY=y+height;box.minZ=z-r;box.maxZ=z+r;return phys.queryBox(box,near,10);}
  function blocked(actor,x,z,r,y,height=1.8){
    const exact=phys.sweepCapsule&&height>=r*2;let n;
    if(exact){capsuleFrom[0]=actor?.x??x;capsuleFrom[1]=y+.025;capsuleFrom[2]=actor?.z??z;capsuleDelta[0]=x-capsuleFrom[0];capsuleDelta[1]=0;capsuleDelta[2]=z-capsuleFrom[2];capsuleOptions.radius=r;capsuleOptions.height=Math.max(r*2,height-.05);capsuleOptions.ignoreInitial=false;capsuleOptions.allowExit=!!actor;phys.sweepCapsule(capsuleFrom,capsuleDelta,capsuleOptions,capsuleHit);n=capsuleHit.hit&&capsuleHit.handle?1:0;if(n)near[0]=capsuleHit.handle;}else n=query(x,y+.025,z,r,height-.05);let blocked=false;
    for(let j=0;j<n;j++){const h=near[j];if(!phys.sample(h,sample))continue;const dx=Math.max(sample[0]-x,0,x-sample[3]),dz=Math.max(sample[2]-z,0,z-sample[5]);if(!exact&&(dx*dx+dz*dz>=r*r||sample[4]<=y+.035||sample[1]>=y+height-.04))continue;
      blocked=true;const d=actor?Math.hypot(x-actor.x,z-actor.z):0,mass=sample[15];if(d>1e-6&&d<.5&&mass<60&&pushed[h&4095]!==tick){pushed[h&4095]=tick;const q=byHandle.get(h),force=Math.min(60,mass*Math.min(4,d*60)*.6);phys.impulse(h,x,y+.6,z,(x-actor.x)/d*force,0,(z-actor.z)/d*force);if(actor===s?.player&&q){q.credit=s.time;q.profile=s.activeProfile||null;}}
    }return blocked;
  }
  function support(x,z,r,ceiling){if(phys.sweepCapsule){capsuleFrom[0]=x;capsuleFrom[1]=ceiling+.03;capsuleFrom[2]=z;capsuleDelta[0]=0;capsuleDelta[1]=-Math.max(0,ceiling+100.03);capsuleDelta[2]=0;capsuleOptions.radius=r;capsuleOptions.height=Math.max(1.8,2*r);capsuleOptions.ignoreInitial=true;phys.sweepCapsule(capsuleFrom,capsuleDelta,capsuleOptions,capsuleHit);return capsuleHit.hit&&capsuleHit.ny>=.7?capsuleFrom[1]+capsuleDelta[1]*capsuleHit.fraction:-Infinity;}let y=-Infinity,n=query(x,-100,z,r,ceiling+100.08);for(let j=0;j<n;j++){phys.sample(near[j],sample);const dx=Math.max(sample[0]-x,0,x-sample[3]),dz=Math.max(sample[2]-z,0,z-sample[5]);if(dx*dx+dz*dz<r*r&&sample[4]<=ceiling+.025&&sample[4]>y)y=sample[4];}return y;}
  function shoot(point,direction,power,impulse,credit=true){
    const n=query(point[0],point[1]-.13,point[2],.13,.26);if(!n)return false;let q=null;for(let j=0;j<n&&!q;j++)q=byHandle.get(near[j]);if(!q)return false;
    const dir=direction||[0,1,0];phys.impulse(q.handle,point[0],point[1],point[2],dir[0]*impulse,dir[1]*impulse,dir[2]*impulse);
    if(credit){q.credit=s?.time||0;q.profile=s?.activeProfile||null;}if(q.kind==='barrel'){q.hp=Math.max(0,q.hp-power);if(!q.hp&&q.fuse<0)q.fuse=.15+q.id%5*.05;}return true;
  }
  function blast(point,radius,power,credit,profile){
    phys.blast(point[0],point[1],point[2],radius,power*22,14);
    const n=query(point[0],point[1]-radius,point[2],radius,2*radius);
    for(let j=0;j<n;j++){const q=byHandle.get(near[j]);if(!q)continue;phys.sample(q.handle,sample);const d=Math.hypot(sample[12]-point[0],sample[13]-point[1],sample[14]-point[2]);if(d>radius)continue;if(credit){q.credit=s?.time||0;q.profile=profile||s?.activeProfile||null;}if(q.kind==='barrel'){q.hp=Math.max(0,q.hp-power*(1-d/radius));if(!q.hp&&q.fuse<0)q.fuse=.15+q.id%5*.05;}}
  }
  // Rubble rolls like its shape (David, 16/11/2026): trunks and pipes are
  // capsules along their axis, foliage and balls are spheres, the rest boxes.
  function rubbleBody(q){const s=q.size;if(q.shape==='cylinder'&&s[1]>=Math.min(s[0],s[2])){const radius=Math.min(s[0],s[2])/2;return {body:'capsule',radius,height:Math.max(s[1],2*radius)};}if(q.shape==='sphere'||q.shape==='foliage')return {body:'sphere',radius:Math.max(.02,(s[0]+s[1]+s[2])/6)};return {};}
  function rubble(q){if(rub.has(q.id))return;q.size=q.size.map(v=>Math.min(4,Math.max(.04,v)));q.mass=clamp(q.mass,3,120);add({kind:'rubble',shape:'box',...rubbleBody(q),rubbleId:q.id,size:q.size.map(v=>Math.min(4,Math.max(.04,v))),pos:[q.x,q.y,q.z],rotation:q.rotation,mass:clamp(q.mass,3,120),material:q.material==='stone'||q.material==='wood'||q.material==='glass'?q.material:'metal',mat:q.mat,color:q.color,velocity:[q.vx,q.vy,q.vz],angularVelocity:q.angularVelocity},q.resting);}
  function rubblePose(q){const a=rub.get(q.id);if(!a||!phys.valid(a.handle))return false;phys.pose(a.handle,1,pose);phys.sample(a.handle,sample);F.quatToEuler(pose[3],pose[4],pose[5],pose[6],rotation);q.x=pose[0];q.y=pose[1];q.z=pose[2];q.vx=sample[6];q.vy=sample[7];q.vz=sample[8];for(let k=0;k<3;k++){q.rotation[k]=rotation[k];q.angularVelocity[k]=sample[9+k];}q.resting=phys.isAsleep(a.handle);return true;}
  // Humanoid machines fall as jointed bodies (David, 16/11/2026): torso,
  // head, arms and legs held by limited ball joints at the neck, shoulders
  // and hips, which a hard blow can tear apart. Their parts do not collide
  // with each other (group 64); the gun drops on its own.
  const RAGDOLL=64;
  function ragdoll(enemy,source){
    if(enemy.type!==1||!['endo','blade','kamikaze'].includes(enemy.variant))return false;
    const parts=G.FActors.build({...enemy,hp:1,hurt:0},{quality:'low',distance:1000,time:s.time}),pick=name=>parts.find(m=>m.actorPart===name),torso=pick('hum-torso');if(!torso)return false;
    const limbs=['hum-head','hum-arm--1','hum-arm-1','hum-leg--1','hum-leg-1'].map(pick).filter(Boolean),gun=enemy.horde?null:parts.filter(m=>/^(rifle-receiver|rocket-launcher)$/.test(m.actorPart))[0]||null,need=1+limbs.length+(gun?1:0);
    let excess=rows.filter(q=>q.kind==='wreck').length+need-48;for(const q of rows.slice())if(excess>0&&q.kind==='wreck'&&phys.isAsleep(q.handle)){remove(q);excess--;}if(excess>0)return true;
    const dx=enemy.x-source.x,dz=enemy.z-source.z,d=Math.hypot(dx,dz)||1,push=[dx/d*2.4,1.1,dz/d*2.4];
    // A kamikaze's own charges scatter its parts instead of folding them.
    const blown=enemy.variant==='kamikaze',middle=torso.p,scatter=m=>{const v=m.p.map((x,i)=>x-middle[i]),l=Math.hypot(v[0],v[2])||1;return [v[0]/l*5.5+push[0],3.2+Math.max(0,v[1])*2,v[2]/l*5.5+push[2]];};
    const body=(m,mass,spin)=>{const size=m.s.map(v=>Math.min(3,Math.max(.04,v))),q=add({kind:'wreck',shape:m.shape==='sphere'?'sphere':'box',size,pos:m.p,rotation:m.r,mass,material:'metal',mat:m.mat,color:m.color,velocity:blown&&m!==torso?scatter(m):push,angularVelocity:blown?[4,2,-3]:spin,group:RAGDOLL,mask:65535^RAGDOLL});if(q&&source.credit){q.credit=s.time;q.profile=source.profile||s.activeProfile||null;}return q;};
    const core=body(torso,24,[push[2]*.6,.3,-push[0]*.6]);if(!core)return true;const centre=phys.body(core.handle).pos;
    for(const m of limbs){
      const q=body(m,m.shape==='sphere'?4:7,[0,0,0]);if(!q)continue;
      // The joint sits at the end of the part nearest the torso.
      const [x,y,z]=m.r,a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),e=Math.sin(y),f=Math.cos(z),g=Math.sin(z),axis=[f*e*b-g*a,g*e*b+f*a,c*b],half=m.shape==='sphere'?m.s[1]/2:m.s[1]/2;
      const ends=m.shape==='sphere'?[[m.p[0],m.p[1]-half,m.p[2]]]:[-1,1].map(k=>m.p.map((v,i)=>v+axis[i]*half*k)),anchor=ends.sort((u,v)=>Math.hypot(u[0]-centre[0],u[1]-centre[1],u[2]-centre[2])-Math.hypot(v[0]-centre[0],v[1]-centre[1],v[2]-centre[2]))[0];
      if(!blown)phys.addJoint({type:'ball',a:core.handle,b:q.handle,worldAnchor:anchor,limit:m.shape==='sphere'?.6:1.25,breakImpulse:40});
    }
    if(gun)body(gun,6,[1.5,.4,-1]);
    return true;
  }
  // A guardian's broken joint drops its limb (David, 16/11/2026): every part
  // of that arm, with its shoulder gun, or of that leg falls at its true size
  // as rigid bodies welded together, and stays on the arena floor.
  function limbParts(enemy,joint){
    const side=joint%2?1:-1,arm=joint<2,human=!!enemy.bossLook,leg=side<0?0:2;
    const names=arm?(human?['hum-upper-','hum-fore-','hum-hand-','hum-arm-','endo-shoulder-','endo-upper-arm-','endo-elbow-','endo-hand-','liquid-blade-','titan-gun-','titan-gun-yoke-','titan-gun-rim-'].map(n=>n+side).concat(['endo-forearm-'+side+'-a','endo-forearm-'+side+'-b']):['custodian-shoulder-','custodian-barrel-','custodian-cannon-','custodian-gun-pivot-','custodian-receiver-','custodian-muzzle-','custodian-ammo-'].map(n=>n+side))
      :(human?['hum-thigh-','hum-shin-','hum-foot-','hum-leg-','endo-thigh-','endo-thigh-piston-','endo-hip-','endo-knee-','endo-foot-','endo-toe-'].map(n=>n+side).concat(['endo-shin-'+side+'-a','endo-shin-'+side+'-b']):['custodian-leg-','custodian-hip-','custodian-thigh-','custodian-knee-','custodian-shin-','custodian-piston-','custodian-boot-'].map(n=>n+leg));
    const size=enemy.bossScale||1,whole={...enemy,hp:1,hurt:0,joints:Array.isArray(enemy.joints)?enemy.joints.map((v,k)=>k===joint?1:v):undefined};
    return G.FActors.build(whole,{quality:'low',distance:size*20,time:s.time}).filter(m=>names.includes(m.actorPart));
  }
  function limb(enemy,joint,source){
    if(!G.FActors)return;const parts=limbParts(enemy,joint).sort((a,b)=>b.s[0]*b.s[1]*b.s[2]-a.s[0]*a.s[1]*a.s[2]).slice(0,10);if(!parts.length)return;
    let excess=rows.filter(q=>q.kind==='limb').length+parts.length-48;for(const q of rows.slice())if(excess>0&&q.kind==='limb'&&phys.isAsleep(q.handle)){remove(q);excess--;}
    const centre=parts[0].p,dx=centre[0]-enemy.x,dz=centre[2]-enemy.z,d=Math.hypot(dx,dz)||1,push=[dx/d*2.6,1.2,dz/d*2.6],made=[];
    for(const m of parts){const size=m.s.map(v=>Math.min(24,Math.max(.05,v))),q=add({kind:'limb',shape:m.shape,body:'box',size,pos:m.p,rotation:m.r,mass:clamp(size[0]*size[1]*size[2]*90,20,4000),material:'metal',mat:clamp(Math.round(m.mat||0),0,19),color:m.color,velocity:push,angularVelocity:[dz/d*.5,0,-dx/d*.5],group:RAGDOLL,mask:65535^RAGDOLL});if(q){made.push(q);if(source?.credit){q.credit=s.time;q.profile=source.profile||null;}}}
    for(let i=1;i<made.length;i++){const a=phys.body(made[0].handle),b=phys.body(made[i].handle);try{phys.addJoint({type:'weld',a:a.handle,b:b.handle,worldAnchor:b.pos.slice()});}catch(_){break;}}
  }
  function wreck(enemy,source){
    if(!G.FActors)return;if(!(enemy.bossScale>1)&&ragdoll(enemy,source))return;const giant=enemy.bossScale>1,meshes=G.FActors.build({...enemy,hp:1,hurt:0},{quality:'low',distance:1000,time:s.time}).filter(m=>m.shape!=='ring').sort((a,b)=>b.s[0]*b.s[1]*b.s[2]-a.s[0]*a.s[1]*a.s[2]).slice(0,giant?20:enemy.horde?3:5);
    const count=rows.filter(q=>q.kind==='wreck').length;let excess=count+meshes.length-48;for(const q of rows.slice())if(excess>0&&q.kind==='wreck'&&phys.isAsleep(q.handle)){remove(q);excess--;}
    let space=48-rows.filter(q=>q.kind==='wreck').length;
    const pieces=[];for(const m of meshes){if(space--<=0)break;const dx=m.p[0]-source.x,dz=m.p[2]-source.z,d=Math.hypot(dx,dz)||1,size=m.s.map(v=>Math.min(3,Math.max(.04,v))),q=add({kind:'wreck',shape:m.shape,size,pos:m.p,rotation:m.r,mass:clamp(size[0]*size[1]*size[2]*65,3,120),material:'metal',mat:m.mat,color:m.color,velocity:[dx/d*3,1+(space%3)*.3,dz/d*3],angularVelocity:[1+(space%3),.4,space%2?-2:2]});if(q){pieces.push(q);if(source.credit){q.credit=s.time;q.profile=source.profile||s.activeProfile||null;}}}
    for(let i=1;i<Math.min(pieces.length,giant?6:3);i++){const a=phys.body(pieces[i-1].handle),b=phys.body(pieces[i].handle);if(Math.hypot(a.pos[0]-b.pos[0],a.pos[1]-b.pos[1],a.pos[2]-b.pos[2])>(giant?2.4:1))continue;phys.addJoint({type:'ball',a:a.handle,b:b.handle,worldAnchor:a.pos.map((v,k)=>(v+b.pos[k])/2),breakImpulse:giant?120:45});}
  }
  function grenade(q){const row=add({kind:'grenade',projectileId:q.id,shape:'sphere',size:[.34,.34,.34],pos:[q.x,q.y,q.z],mass:3,group:16,material:'metal',mat:0,restitution:.42,velocity:[q.vx,q.vy,q.vz],angularVelocity:[2,1,3]},true);if(row)phys.setVelocity(row.handle,q.vx,q.vy,q.vz,2,1,3);return !!row;}
  function grenadePose(q){const row=rows.find(r=>r.projectileId===q.id);if(!row||!phys.sample(row.handle,sample))return false;q.x=sample[12];q.y=sample[13];q.z=sample[14];q.vx=sample[6];q.vy=sample[7];q.vz=sample[8];q.resting=phys.isAsleep(row.handle);return true;}
  function removeGrenade(id){const row=rows.find(r=>r.projectileId===id);if(row)remove(row);}
  function place(h,x,y,z){phys.sample(h,sample);const d=Math.hypot(x-sample[12],y-sample[13],z-sample[14]);if(d>2)phys.teleport(h,x,y,z);else if(d>1e-9)phys.setKinematic(h,x,y,z,0,0,0,1);}
  function carry(actor,dt){if(actor.airborne)return;const n=query(actor.x,actor.y-.08,actor.z,.28,.12);for(let j=0;j<n;j++){phys.sample(near[j],sample);if(Math.abs(sample[4]-actor.y)>.065)continue;const x=actor.x+sample[6]*dt,z=actor.z+sample[8]*dt,y=actor.y+sample[7]*dt;if(!host.blocked?.(x,z,.28,y)){actor.x=x;actor.y=y;actor.z=z;}break;}}
  function step(dt){
    tick++;if(dirty){phys.updateStatics(latestSolids,world.walkable||[]);dirty=false;}
    if(s){
      if(player)place(player,s.player.x,s.player.y+.9,s.player.z);let at=0;for(const e of s.enemies)if(e.hp>0&&e.deployed!==false&&!(e.bossScale>1)&&(e.combatEnabled||Math.hypot(e.x-s.player.x,e.z-s.player.z)<25)&&at<proxies.length){const q=proxies[at++];q.enemy=e.id;place(q.handle,e.x,(e.baseY||0)+.9,e.z);}while(at<proxies.length){const q=proxies[at++];q.enemy=-1;place(q.handle,world.spawn.x,-50,world.spawn.z);}
      for(const q of systems){if(q.key.startsWith('fixed:'))continue;let x,y,z;if(q.key.startsWith('door:')){const a=s.doors.find(a=>'door:'+a.id===q.key);x=a.x;y=(a.y||0)+a.h/2+(a.destroyed?1000:a.progress*(a.h+.25));z=a.z;}else if(q.key.startsWith('lift:')){const a=s.lifts.find(a=>'lift:'+a.id===q.key);x=a.x;y=a.y-.11;z=a.z;}else{const a=s.traps.find(a=>'trap:'+a.id===q.key),b=a.box;x=b?(b.minX+b.maxX)/2:a.x;y=b?(b.minY+b.maxY)/2:a.y+50;z=b?(b.minZ+b.maxZ)/2:a.z;}phys.setKinematic(q.handle,x,y,z,0,0,0,1);}
    }
    energyBefore.fill(0);for(const q of rows)if(phys.sample(q.handle,sample))energyBefore[q.handle&4095]=.5*sample[15]*(sample[6]*sample[6]+sample[7]*sample[7]+sample[8]*sample[8]);
    phys.step(dt);
    for(let i=rows.length-1;i>=0;i--){const q=rows[i];if(q.fuse>=0){q.fuse-=dt;if(q.fuse<=0){phys.sample(q.handle,sample);const point=[sample[12],sample[13],sample[14]],credit=s&&s.time-q.credit<3,profile=q.profile;remove(q);host.explode?.(point,3.2,24,35,credit?'player':'environment',false,-1,undefined,'blast',profile);continue;}}if(phys.sample(q.handle,sample)&&(sample[13]<-60||Math.abs(sample[12])>10000)){remove(q);continue;}}
    navigation();const events=phys.events;
    for(let i=0;i<events.count;i++)for(let side=0;side<2;side++){
      const actorHandle=side?events.b[i]:events.a[i],other=side?events.a[i]:events.b[i],row=byHandle.get(other);if(!row||energyBefore[other&4095]<=150)continue;
      const proxy=proxies.find(q=>q.handle===actorHandle),isPlayer=actorHandle===player,actor=isPlayer?s?.player:proxy&&proxy.enemy>=0?s?.enemies[proxy.enemy]:null;if(!actor||actor.hp<=0)continue;
      const id=isPlayer?0:actor.id+1,time=s.time;if(time-impactAt[id]<.5||isPlayer&&time-row.credit<.5)continue;
      const energy=Math.min(events.energy[i],energyBefore[other&4095]);if(energy<=150)continue;impactAt[id]=time;const point={x:events.point[i*3],y:events.point[i*3+1],z:events.point[i*3+2]},damage=Math.min(isPlayer?25:60,Math.sqrt(energy-150)*1.2);
      if(isPlayer)host.hurt?.(damage,true,point);else{host.damageEnemy?.(actor,damage,{...point,credit:time-row.credit<3,profile:row.profile,blast:true});if(actor.hp>0){actor.stun=Math.max(actor.stun,.25);actor.windup=0;actor.burstLeft=0;}}
    }
    let sounds=0;for(let i=0;i<events.count;i++){const h=events.a[i],at=h&4095;if(s&&sounds<6&&s.time-soundAt[at]>=.16){soundAt[at]=s.time;sounds++;host.emit?.('debrisLand',{x:events.point[i*3],y:events.point[i*3+1],z:events.point[i*3+2],material:F.MATERIALS[events.materialA[i]]?.name||'metal',power:Math.min(100,Math.sqrt(events.energy[i])*2)});}}
  }
  function navigation(reset=false){
    if(reset){navMap.clear();navPending.clear();}
    for(const q of rows){phys.sample(q.handle,sample);const old=navMap.get(q.handle),height=sample[4]-sample[1],wanted=phys.isAsleep(q.handle)&&sample[15]>=15&&height>=.43;
      if(wanted&&!old)navPending.set(q.handle,{handle:q.handle,minX:sample[0],minY:sample[1],minZ:sample[2],maxX:sample[3],maxY:sample[4],maxZ:sample[5],cost:sample[15]>=60?0:3,barrel:q.kind==='barrel'});else if(!wanted){if(old)navPending.set(q.handle,null);else navPending.delete(q.handle);}else if(old)navPending.delete(q.handle);
    }
    let count=0;for(const [handle,q] of navPending){if(!reset&&count++>=4)break;const old=navMap.get(handle);if(old&&!reset)host.navMark?.(old);navMap.delete(handle);if(q&&byHandle.has(handle)){navMap.set(handle,q);if(!reset)host.navMark?.(q);}navPending.delete(handle);}
    navBoxes.length=0;for(const q of navMap.values())navBoxes.push(q);
  }
  function navigationCost(x,z,r,y){let cost=1;for(const q of navBoxes)if(q.maxY>y+.43&&q.minY<y+1.8&&x+r>q.minX&&x-r<q.maxX&&z+r>q.minZ&&z-r<q.maxZ){if(!q.cost)return 0;cost=3;}return cost;}
  function navigationSegment(ax,az,bx,bz,r,y){for(const q of navBoxes){if(q.maxY<=y+.43||q.minY>=y+1.8)continue;let lo=0,hi=1;for(let k=0;k<2;k++){const p=k?az:ax,d=k?bz-az:bx-ax,min=(k?q.minZ:q.minX)-r,max=(k?q.maxZ:q.maxX)+r;if(Math.abs(d)<1e-12){if(p<min||p>max){hi=-1;break;}}else{let a=(min-p)/d,b=(max-p)/d;if(a>b){const t=a;a=b;b=t;}lo=Math.max(lo,a);hi=Math.min(hi,b);}}if(lo<=hi)return false;}return true;}
  navigation(true);
  function models(out,camera,alpha=1){
    for(const rig of rigs){if(!phys.valid(rig.handle)||Math.hypot(rig.anchor[0]-camera.pos[0],rig.anchor[2]-camera.pos[2])>65)continue;
      if(rig.kind===0){phys.pose(rig.handle,alpha,pose);const a=rig.anchor,b=pose,dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);if(phys.validJoint(rig.joint))out.push({shape:'cylinder',p:[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],s:[.035,length,.035],r:[Math.acos(clamp(dy/length,-1,1)),Math.atan2(dx,dz),0],mat:0});out.push({shape:'box',p:[a[0],a[1]+.08,a[2]],s:[2.4,.16,.16],r:[0,0,0],mat:0});for(const side of [-1,1])out.push({shape:'box',p:[a[0]+side*1.12,(a[1]+rig.base-1.8)/2,a[2]],s:[.12,a[1]-rig.base+1.8,.12],r:[0,0,0],mat:0});}
      else if(rig.kind===1)out.push({shape:'box',p:rig.anchor,s:[.1,2,.1],r:[0,0,0],mat:0});else if(rig.kind===2)out.push({shape:'box',p:[rig.anchor[0],rig.anchor[1]-.35,rig.anchor[2]],s:[.18,.6,.65],r:[0,0,0],mat:0});
    }
    for(const q of rows){if(q.kind==='rubble'||q.kind==='grenade')continue;phys.pose(q.handle,alpha,pose);if(Math.hypot(pose[0]-camera.pos[0],pose[2]-camera.pos[2])>65)continue;F.quatToEuler(pose[3],pose[4],pose[5],pose[6],rotation);out.push({shape:q.shape==='capsule'?'cylinder':q.shape,p:[pose[0],pose[1],pose[2]],s:q.size,r:Array.from(rotation),mat:q.mat,color:q.color,emissive:0});}}
  function snapshot(){return {version:1,serial,player,systems:copy(systems),rigs:copy(rigs),proxies:copy(proxies),impacts:Array.from(impactAt),navigation:copy({boxes:navBoxes,pending:Array.from(navPending)}),rows:copy(rows),physics:phys.snapshot()};}
  function restore(value){
    if(!value||value.version!==1||!Number.isInteger(value.serial)||value.serial<0||!Array.isArray(value.rows)||value.rows.length>384||!Array.isArray(value.systems)||JSON.stringify(value.systems)!==JSON.stringify(systems)||value.player!==player||!Array.isArray(value.rigs)||JSON.stringify(value.rigs)!==JSON.stringify(rigs)||!Array.isArray(value.proxies)||value.proxies.length!==proxies.length||!value.proxies.every((q,i)=>q.handle===proxies[i].handle&&Number.isInteger(q.enemy)&&q.enemy>=-1&&q.enemy<(world.enemies?.length||0))||!Array.isArray(value.impacts)||value.impacts.length!==impactAt.length||!value.impacts.every(v=>Number.isFinite(v)&&v>=-1000&&v<=1e9))throw Error('Invalid rigid bodies');
    const next=F.create({...options,geometry:typeof value.physics?.fp==='string'&&value.physics.fp.endsWith('/G1')});next.setStatics(latestSolids,world.walkable||[]);next.restore(value.physics);const handles=new Set(),ids=new Set(),rubbleIds=new Set(),projectileIds=new Set(),reserved=new Set([player,...systems.map(q=>q.handle),...proxies.map(q=>q.handle)]);for(const h of reserved)if(h&&(!next.sample(h,sample)||!(sample[16]&4)))throw Error('Invalid physical actor');
    for(const q of value.rows){if(!q||!Number.isInteger(q.id)||q.id<1||q.id>value.serial||ids.has(q.id)||handles.has(q.handle)||reserved.has(q.handle)||!next.valid(q.handle)||!['prop','barrel','rubble','wreck','grenade','limb'].includes(q.kind)||!(['box','bevel','sphere','octa','cylinder','capsule','ring'].includes(q.shape)||q.kind==='limb'&&/^metal-hum-[a-z0-9-]+$/.test(q.shape))||!Array.isArray(q.size)||q.size.length!==3||!q.size.every(v=>Number.isFinite(v)&&v>0&&v<=(q.kind==='limb'?24:4))||!Number.isFinite(q.hp)||q.hp<0||q.hp>10||!Number.isFinite(q.fuse)||q.fuse<-.1&&q.fuse!==-1||q.fuse>.36||!Number.isFinite(q.credit)||!['light','heavy',null].includes(q.profile))throw Error('Invalid physical metadata');if(!Number.isInteger(q.mat)||q.mat<0||q.mat>(q.kind==='limb'?19:12)||q.color!==undefined&&(!Array.isArray(q.color)||q.color.length!==3||!q.color.every(v=>Number.isFinite(v)&&v>=0&&v<=2)))throw Error('Invalid physical appearance');
      if(q.kind==='rubble'){if(!Number.isInteger(q.rubbleId)||q.rubbleId<1||rubbleIds.has(q.rubbleId))throw Error('Invalid rubble reference');rubbleIds.add(q.rubbleId);}else if(q.rubbleId!==null)throw Error('Unexpected rubble reference');
      if(q.kind==='grenade'){if(!Number.isInteger(q.projectileId)||q.projectileId<1||projectileIds.has(q.projectileId))throw Error('Invalid projectile reference');projectileIds.add(q.projectileId);}else if(q.projectileId!==null)throw Error('Unexpected projectile reference');
      next.sample(q.handle,sample);if(sample[16]&4)throw Error('Dynamic prop is kinematic');handles.add(q.handle);ids.add(q.id);}
    const nav=value.navigation;if(!nav||!Array.isArray(nav.boxes)||!Array.isArray(nav.pending)||nav.boxes.length>384||nav.pending.length>384)throw Error('Invalid physical navigation');const navValid=q=>q&&Number.isInteger(q.handle)&&q.handle>0&&[q.minX,q.maxX,q.minY,q.maxY,q.minZ,q.maxZ].every(Number.isFinite)&&q.minX<=q.maxX&&q.minY<=q.maxY&&q.minZ<=q.maxZ&&(q.cost===0||q.cost===3)&&typeof q.barrel==='boolean';if(!nav.boxes.every(navValid)||!nav.pending.every(q=>Array.isArray(q)&&q.length===2&&Number.isInteger(q[0])&&q[0]>0&&(q[1]===null||navValid(q[1])&&q[1].handle===q[0])))throw Error('Invalid physical navigation boxes');
    if(next.stats.bodies!==handles.size+systems.length+proxies.length+(player?1:0))throw Error('Unmapped bodies');phys=next;proxies=copy(value.proxies);impactAt.set(value.impacts);serial=value.serial;rows=copy(value.rows);byHandle.clear();rub.clear();for(const q of rows){byHandle.set(q.handle,q);if(q.rubbleId!==null)rub.set(q.rubbleId,q);}dirty=false;navMap.clear();navPending.clear();for(const q of nav.boxes)navMap.set(q.handle,copy(q));for(const [h,q] of nav.pending)navPending.set(h,copy(q));navBoxes.length=0;navBoxes.push(...navMap.values());
  }
  return {limb,get physics(){return phys;},get rows(){return rows;},navigationCost,navigationSegment,get navigationBoxes(){return navBoxes;},grenade,grenadePose,removeGrenade,obstacle:(x,z,r,y,height)=>blocked(null,x,z,r,y,height),blocked,carry,support,shoot,blast,rubble,rubblePose,wreck,step,models,snapshot,restore,hash:()=>phys.hash(),ray:(o,d,far)=>phys.ray(o,d,far,hit,10),digestInto(mix){mix(phys.hash());mix(rows);mix(impactAt);mix(navBoxes);for(const [h,q] of navPending){mix(h);mix(q);}},setSolids(value,area){latestSolids=value;phys.updateStatics(value,world.walkable||[],area);dirty=false;},removeRubble(id){const q=rub.get(id);if(q)remove(q);}};
}
G.MetalPhysics={create,props};
})(typeof window!=='undefined'?window:globalThis);
