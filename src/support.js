/* METAL: versioned support-drone rules and original procedural cockpit.
 * No engine source, asset download or browser dependency in the rules. */
(function(G){'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const RULES=Object.freeze({version:1,laserDamage:.10,laserRange:36,laserDelay:.24,laserHeat:.10,laserCooling:.24,stamina:5,staminaRecovery:1.25,sprintRest:.65,dockSeconds:.65,hackSeconds:1.5,combatCap:20,fragmentCap:5});
 function fresh(){return {stamina:RULES.stamina,rest:0,exhausted:false,sprinting:false,heat:0,overheated:false,cooldown:0,target:null,progress:0};}
 function copy(q){
  if(!q||Object.keys(q).sort().join(',')!==Object.keys(fresh()).sort().join(','))return null;
  for(const [key,max] of [['stamina',5],['rest',.65],['heat',1],['cooldown',.24],['progress',1.5]])if(!Number.isFinite(q[key])||q[key]<0||q[key]>max+1e-8)return null;
  if(!['exhausted','sprinting','overheated'].every(k=>typeof q[k]==='boolean')||q.target!==null&&typeof q.target!=='string')return null;
  return {...q};
 }
 function sprint(q,dt,wants){
  dt=clamp(Number(dt)||0,0,.05);q.sprinting=false;
  if(q.exhausted&&q.stamina>=1)q.exhausted=false;
  if(wants&&!q.exhausted&&q.stamina>0){q.sprinting=true;q.stamina=Math.max(0,q.stamina-dt);q.rest=RULES.sprintRest;if(q.stamina<1e-9){q.stamina=0;q.exhausted=true;}return true;}
  const resting=Math.min(dt,q.rest);q.rest=Math.max(0,q.rest-dt);q.stamina=Math.min(RULES.stamina,q.stamina+(dt-resting)*RULES.staminaRecovery);return false;
 }
 function upgradeWorld(w){
  if(w.supportDroneVersion!==1)return w;
  const c=w.corridors.find(c=>c.arenaPath),g=w.destructibles.find(g=>g.id==='profile-breach');if(!c||!g)throw Error('Support drone requires the authored class corridor');
  const y=c.y||0,x=c.x-c.w/2+2.2,z=c.z,depth=c.d,holeZ=z-depth/2+1.15;
  const part=(p,s,category,solid=false,color=[.24,.30,.32])=>{const i=w.meshes.length;w.meshes.push({shape:'box',p,s,r:[0,0,0],mat:1,color,region:'corridor-'+w.corridors.indexOf(c),category,structural:true,outdoor:true});if(solid)w.colliders.push({minX:p[0]-s[0]/2,maxX:p[0]+s[0]/2,minY:p[1]-s[1]/2,maxY:p[1]+s[1]/2,minZ:p[2]-s[2]/2,maxZ:p[2]+s[2]/2,mesh:i});return i;};
  // Preserve the corridor and original IDs, but make the lower slab a door.
  // A high, physically open duct fits a 0.56 x 0.48 m drone, not the heavy.
  const slab=w.meshes[g.meshes[0]];slab.p=[x,y+5.7,z];slab.s=[.65,1.6,depth];
  const collider=w.colliders[g.colliders[0]];collider.minY=y+4.9;collider.maxY=y+6.5;g.profileProtected=true;
  for(let i=1;i<g.meshes.length;i++)w.meshes[g.meshes[i]].p[1]=y+5.1+(i%5)*.25;
  const lo=z-depth/2,hi=z+depth/2,a=holeZ-.55,b=holeZ+.55;
  if(a>lo)part([x,y+4.225,(lo+a)/2],[.65,1.35,a-lo],'drone-duct-frame',true);
  if(hi>b)part([x,y+4.225,(hi+b)/2],[.65,1.35,hi-b],'drone-duct-frame',true);
  for(const side of [-1,1])part([x+side*.34,y+3.57,holeZ],[.028,.045,1.1],'drone-duct-tag',false,[.22,.78,.83]);
  w.doors.push({id:'profile-bypass-door',x,y,z,w:.65,h:3.55,d:depth,requires:'profile-dock',access:'drone-dock',profileRequired:'heavy'});
  const dock={id:'profile-dock',name:'Socle-clé du drone',x:x+1.4,y:y+2.6,z:holeZ,required:true,profileRequired:'light',activation:'dock'};
  w.mechanisms.push(dock);part([dock.x,dock.y+1.10,dock.z],[1.05,.09,1.05],'drone-dock',false,[.18,.27,.29]);
  part([dock.x,dock.y+1.15,dock.z],[.72,.015,.72],'drone-dock-tag',false,[.25,.75,.8]);
  const terminal=w.mechanisms.find(m=>m.id==='profile-power');terminal.activation='hack';terminal.name='Terminal du drone · maintenir Interagir';
  for(const e of w.enemies)if(e.type===3&&e.bossScale>1)e.profileRequired='heavy';
  w.profileGoals={...w.profileGoals,breach:'profile-bypass-door',dock:dock.id,duct:{x,y:y+2.8,z:holeZ,w:1.1,h:1.35},boss:'heavy'};
  return w;
 }
 // Geometry uses the camera basis; the centre of the image remains unobstructed.
 function cockpit(camera,{aspect=1.6,flash=0}={}){
  const out=[],tan=Math.tan((camera.overlayFov||camera.fov||74)*Math.PI/360),width=.66*tan*Math.max(.55,aspect),steel=[.40,.48,.50],dark=[.075,.11,.13],cyan=[.25,.83,.89];
  const frame=G.FMotion.mount(camera);
  const add=(shape,p,size,color,mat=19,r=[0,0,0],glow=0,kind='cockpit')=>{const pose=G.FMotion.place(frame,p,r),m=G.FRender.mesh(shape,pose.p,size,mat,pose.r,glow);m.color=color;m.overlay=true;m.surface='object';m.supportPart=kind;out.push(m);};
  for(const side of [-1,1]){
   const x=side*width*.88;
   add('bevel',[side*width*.98,-.23,-.66],[.055,.36,.065],dark,0,[0,0,side*-.18]);
   add('box',[side*width*.94,-.37,-.63],[.10,.026,.12],steel);
   add('box',[side*width*.97,-.17,-.70],[.012,.18,.015],cyan,4,[0,0,side*-.18],.35);
   // External, mirrored laser pods. No hands or pistol grips inside the ship.
   add('bevel',[x,-.21,-.70],[.13,.15,.33],steel,19,[0,0,side*.25],0,'laser-housing');
   add('cylinder',[x,-.19,-.92],[.075,.24,.075],dark,7,[Math.PI/2,0,0],0,'laser-emitter');
   add('ring',[x,-.19,-1.04],[.10,.03,.10],cyan,4,[Math.PI/2,0,0],.5+flash,'laser-lens');
   add('box',[x-side*.055,-.15,-.77],[.015,.025,.21],cyan,4,[0,0,0],.35,'laser-strip');
  }
  add('bevel',[0,-.415,-.61],[width*1.65,.045,.075],dark,0);
  return out;
 }
 function beam(from,to,age){
  const d=to.map((v,i)=>v-from[i]),len=Math.hypot(...d);if(!(len>.01))return null;
  const m=G.FRender.mesh('box',from.map((v,i)=>(v+to[i])/2),[.012,.012,len],4,[-Math.atan2(d[1],Math.hypot(d[0],d[2])),Math.atan2(d[0],d[2]),0],1.5);
  m.color=[.18,.92,1];m.fx=true;m.alpha=clamp(1-age/.09,0,1);m.supportPart='laser-beam';return m;
 }
 function markers(world,state,player){
  const out=[];
  const glyph=(x,y,z,light,active)=>{const color=active?[.4,.65,.5]:light?[.2,.82,.88]:[.94,.58,.2];
   const add=(p,s,r=[0,0,0])=>{const m=G.FRender.mesh('box',p,s,4,r,.20);m.color=color;m.supportPart='access-tag';out.push(m);};
   if(light){for(const side of [-1,1])add([x+side*.13,y+.018,z],[.24,.025,.045],[0,side*.5,0]);add([x,y+.018,z+.14],[.06,.025,.22]);}
   else for(let i=-1;i<=1;i++)add([x+i*.12,y+.018,z],[.065,.025,.34]);
  };
  for(const m of state.mechanisms||[])if(Math.hypot(m.x-player.x,m.z-player.z)<18)glyph(m.x,(m.y||0)+(m.activation==='dock'?1.16:.02),m.z,m.profileRequired==='light',m.active);
  for(const d of state.doors||[])if(!d.destroyed&&Math.hypot(d.x-player.x,d.z-player.z)<14){glyph(d.x-(d.w<d.d?1.1:0),d.y||0,d.z-(d.w>=d.d?1.1:0),true,d.open);}
  return out;
 }
 G.MetalSupport={RULES,fresh,copy,sprint,upgradeWorld,cockpit,beam,markers};
})(typeof window!=='undefined'?window:globalThis);
