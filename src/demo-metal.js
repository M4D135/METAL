/* METAL — isolated demonstration scenes and views, using ordinary game rules. */
(function(G){'use strict';
  function loadout(index,active='light'){
    const E=G.FEconomy,P=G.MetalProfiles,profiles=P.fresh(),weapons=[false,false,false,index>0,true];
    for(let i=0;i<index;i++){const id=i%2?'heavy':'light',q=profiles.classes[id],r=E.bossReward(i),owner=P.owner(r.weaponUpgrade,id),old=q.economy;q.economy=E.grantBossReward(old,i);if(owner!==id){q.economy.weaponUpgrades[r.weaponUpgrade]=old.weaponUpgrades[r.weaponUpgrade];profiles.classes[owner].economy.weaponUpgrades[r.weaponUpgrade]++;}if(r.weapon!==null)weapons[r.weapon]=true;}
    // The heavy launcher is collected in world one before its mandatory breach.
    profiles.active=active;const ammo=P.ammoCaps(profiles.classes).map((v,i)=>weapons[i]?v:0);
    return {profiles,inventory:{weapons,ammo},economy:profiles.classes[active].economy,equipment:{right:4,left:null},campaign:{version:2,claimedBossRewards:Array.from({length:index},(_,i)=>i),discovered:[['pistol',4],['smg',0],['shotgun',1],['grenade',3],['rocket',2]].filter(([,i])=>weapons[i]).map(([name])=>name)}};
  }
  // Short scenes that open on a fight (David, 16/11/2026): assaults drop the
  // heavy into a guarded room, boss scenes start at the arena gate.
  function scenes(seed=96,bench=false){const list=[{index:4,boss:true,maxSeconds:100},{index:7,assault:true,horde:true,maxSeconds:80},{index:17,boss:true,maxSeconds:100},{index:13,assault:true,maxSeconds:80},{index:12,boss:true,maxSeconds:100},{index:11,boss:true,maxSeconds:100}];if(bench)return [{index:0,maxSeconds:60},{index:6,maxSeconds:60},{index:12,boss:true,maxSeconds:60}].map((q,i)=>({...q,id:'bench-'+i,seed}));return list.map((q,i)=>({...q,id:'scene-'+i,seed}));}
  function active(scene){return scene.boss?(scene.index%2?'heavy':'light'):'heavy';}
  // A spot where the player's body fits, scanned around a room centre.
  function freeSpot(source,x,y,z){
    const solid=(px,pz)=>(source.colliders||[]).some(c=>px+.35>c.minX&&px-.35<c.maxX&&pz+.35>c.minZ&&pz-.35<c.maxZ&&y+1.8>c.minY&&y+.05<c.maxY);
    for(const r of [0,2,3.5,5])for(let k=0;k<(r?8:1);k++){const a=k*Math.PI/4,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(!solid(px,pz))return {x:px,z:pz};}
    return null;
  }
  function world(source,scene){
    if(scene.boss){const a=source.bossArena;return {...source,spawn:{x:a.x-24,y:a.y,z:a.z+.3,yaw:Math.PI/2}};}
    if(!scene.assault)return source;
    // The most guarded encounter whose room has room for the player.
    const fights=(source.encounters||[]).filter(q=>q.trigger&&q.waves?.length).map(q=>({q,count:q.waves.reduce((n,w)=>n+w.enemyIds.length,0)})).sort((a,b)=>b.count-a.count);
    // A horde scene starts the room's horde at once, alongside its guards.
    const encounters=scene.horde?(source.encounters||[]).map(q=>q.horde?{...q,after:undefined}:q):source.encounters;
    for(const {q} of fights){const t=q.trigger,y=t.y||0,spot=freeSpot(source,t.x,y,t.z);if(spot){const s=source.spawn;return {...source,encounters,spawn:{x:spot.x,y,z:spot.z,yaw:Math.atan2(t.x-s.x,s.z-t.z)}};}}
    return source;
  }
  function progress(sim,pilot){const s=sim.state,b=s.enemies.find(e=>e.bossScale>1);return [pilot.goalKey,pilot.distanceProgress,s.relays,s.kills,s.mechanisms.filter(m=>m.active).length,b?Math.ceil(30*b.hp/b.maxHp):0,s.activeProfile].join('|');}
  function camera(sim,seed){
    const p=sim.state.player,b=()=>sim.state.enemies.find(e=>e.hp>0&&e.bossScale>1),look=(out,pos,to)=>{G.FDemo.lookAt(pos,to,out);out.pos=pos;out.roll=0;out.fov=74;};
    const drone=()=>sim.state.activeProfile==='light',body=()=>[p.x,p.y+(drone()?1.45:1.3),p.z];
    // The nearest machine in combat, for shots that frame both sides of a fight.
    const foe=()=>{let best=null,d=30;for(const e of sim.state.enemies){if(e.hp<=0||e.deployed===false||e.bossScale>1||!(e.active||e.awareness==='engage'))continue;const q=Math.hypot(e.x-p.x,e.z-p.z);if(q<d){d=q;best=e;}}return best;};
    const fighting=()=>!!foe()||!!b()?.bossAwake;
    const d=G.FDemo.director({seed,shots:[
      {id:'eyes',weight:()=>fighting()?14:22,duration:[4,7],pose(c,t,target,o){Object.assign(o,c.eyes);o.pos=c.eyes.pos.slice();}},
      // Third person, over the heavy's shoulder or behind the drone.
      {id:'chase',weight:34,duration:[6,10],pose(c,t,target,o){const y=p.yaw,s=Math.sin(y),k=Math.cos(y),side=drone()?0:.8,back=drone()?3:3.4,eye=[p.x,p.y+1.62,p.z];look(o,[eye[0]-s*back+k*side,eye[1]+.6,eye[2]+k*back+s*side],[eye[0]+s*24,eye[1]+Math.sin(p.pitch)*24,eye[2]-k*24]);}},
      {id:'orbit',weight:()=>fighting()?22:10,duration:[5,8],transition:'fly',pose(c,t,target,o){const a=sim.state.time*.32+seed,r=7.5,q=body();look(o,[q[0]+Math.sin(a)*r,q[1]+2.6,q[2]+Math.cos(a)*r],q);}},
      // Side view of the exchange of fire between the player and a machine.
      {id:'action',weight:()=>foe()?40:0,valid:()=>!!foe(),duration:[4,7],pose(c,t,target,o){const e=foe()||p,q=body(),m=[(q[0]+e.x)/2,(q[1]+(e.y||q[1]))/2,(q[2]+e.z)/2],dx=e.x-q[0],dz=e.z-q[2],l=Math.hypot(dx,dz)||1,span=Math.max(7,l*.9);look(o,[m[0]-dz/l*span,m[1]+3.2,m[2]+dx/l*span],m);}},
      {id:'drone',weight:()=>drone()?24:0,valid:drone,duration:[4,6],pose(c,t,target,o){const y=p.yaw,q=body();look(o,[q[0]+Math.sin(y)*5.5+Math.cos(y)*1.4,q[1]-.4,q[2]-Math.cos(y)*5.5+Math.sin(y)*1.4],q);}},
      {id:'watch',weight:6,duration:[5,7],transition:'fly',pose(c,t,target,o){look(o,[p.x-6,p.y+4,p.z+7],[p.x,p.y+1.4,p.z]);}},
      {id:'guardian',weight:()=>b()?.bossAwake?30:0,valid:()=>!!b()?.bossAwake,duration:[5,8],transition:'fly',pose(c,t,target,o){const e=b(),a=sim.state.time*.08;look(o,[e.x+Math.sin(a)*26,e.baseY+8,e.z+Math.cos(a)*26],[e.x,e.baseY+e.bossScale*1.6,e.z]);}},
      // Low angle from the player's side: the giant towers over the frame.
      {id:'colossus',weight:()=>b()?.bossAwake?32:0,valid:()=>!!b()?.bossAwake,duration:[4,7],pose(c,t,target,o){const e=b(),dx=p.x-e.x,dz=p.z-e.z,l=Math.hypot(dx,dz)||1,r=Math.min(l+4,1.5*e.bossScale+14);look(o,[e.x+dx/l*r+dz/l*3,e.baseY+.6,e.z+dz/l*r-dx/l*3],[e.x,e.baseY+e.bossScale*1.9,e.z]);}},
      {id:'arrival',weight:100,valid:()=>sim.state.time<4,duration:[4,4],pose(c,t,target,o){look(o,[p.x-4,p.y+6,p.z+9],[p.x,p.y+1.4,p.z]);}}
    ]});
    const close={pos:[0,0,0],yaw:0,pitch:0,roll:0,fov:74};
    function fit(pose){const from=[p.x,p.y+1.4,p.z],delta=pose.pos.map((v,i)=>v-from[i]),len=Math.hypot(...delta);if(len<=.01)return true;const dir=delta.map(v=>v/len),reach=Math.max(0,sim.ray(from,dir,len)-.3);if(reach<.8)return false;if(reach<len)pose.pos=from.map((v,i)=>v+dir[i]*reach);return true;}
    return {update(dt,eyes){const frame=d.update(dt,{eyes}),pose=frame.pose;if(frame.shot==='eyes'||fit(pose))return {shot:frame.shot,pose};const y=p.yaw,s=Math.sin(y),k=Math.cos(y),eye=[p.x,p.y+1.62,p.z];look(close,[eye[0]-s*1.7+k*.5,eye[1]+.45,eye[2]+k*1.7+s*.5],[eye[0]+s*20,eye[1],eye[2]-k*20]);return fit(close)?{shot:'chase',pose:close}:{shot:'eyes',pose:eyes};},reset:()=>d.reset(seed)};
  }
  G.MetalDemo={loadout,scenes,world,progress,camera,active};
})(typeof window!=='undefined'?window:globalThis);
