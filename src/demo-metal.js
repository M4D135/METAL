/* METAL — isolated demonstration scenes and views, using ordinary game rules. */
(function(G){'use strict';
  function loadout(index,active='light'){
    const E=G.FEconomy,P=G.MetalProfiles,profiles=P.fresh(),weapons=[false,false,false,index>0,true];
    for(let i=0;i<index;i++){const id=i%2?'heavy':'light',q=profiles.classes[id],r=E.bossReward(i),owner=P.owner(r.weaponUpgrade,id),old=q.economy;q.economy=E.grantBossReward(old,i);if(owner!==id){q.economy.weaponUpgrades[r.weaponUpgrade]=old.weaponUpgrades[r.weaponUpgrade];profiles.classes[owner].economy.weaponUpgrades[r.weaponUpgrade]++;}if(r.weapon!==null)weapons[r.weapon]=true;}
    // The heavy launcher is collected in world one before its mandatory breach.
    profiles.active=active;const ammo=P.ammoCaps(profiles.classes).map((v,i)=>weapons[i]?v:0);
    return {profiles,inventory:{weapons,ammo},economy:profiles.classes[active].economy,equipment:{right:4,left:null},campaign:{version:2,claimedBossRewards:Array.from({length:index},(_,i)=>i),discovered:[['pistol',4],['smg',0],['shotgun',1],['grenade',3],['rocket',2]].filter(([,i])=>weapons[i]).map(([name])=>name)}};
  }
  function scenes(seed=96,bench=false){const list=[{index:6,maxSeconds:240},{index:12,boss:true,maxSeconds:120},{index:15,maxSeconds:240},{index:1,maxSeconds:240},{index:4,boss:true,maxSeconds:120},{index:11,boss:true,maxSeconds:120}];if(bench)return [{index:0,maxSeconds:60},{index:6,maxSeconds:60},{index:12,boss:true,maxSeconds:60}].map((q,i)=>({...q,id:'bench-'+i,seed}));return list.map((q,i)=>({...q,id:'scene-'+i,seed}));}
  function world(source,scene){if(!scene.boss)return source;const a=source.bossArena;return {...source,spawn:{x:a.x-24,y:a.y,z:a.z+.3,yaw:Math.PI/2}};}
  function progress(sim,pilot){const s=sim.state,b=s.enemies.find(e=>e.bossScale>1);return [pilot.goalKey,pilot.distanceProgress,s.relays,s.kills,s.mechanisms.filter(m=>m.active).length,b?Math.ceil(30*b.hp/b.maxHp):0,s.activeProfile].join('|');}
  function camera(sim,seed){
    const p=sim.state.player,b=()=>sim.state.enemies.find(e=>e.hp>0&&e.bossScale>1),look=(out,pos,to)=>{G.FDemo.lookAt(pos,to,out);out.pos=pos;out.roll=0;out.fov=74;};
    const d=G.FDemo.director({seed,shots:[
      {id:'eyes',weight:60,duration:[12,25],pose(c,t,target,o){Object.assign(o,c.eyes);o.pos=c.eyes.pos.slice();}},
      {id:'watch',weight:15,duration:[6,9],transition:'fly',pose(c,t,target,o){look(o,[p.x-6,p.y+4,p.z+7],[p.x,p.y+1.4,p.z]);}},
      {id:'guardian',weight:()=>b()?.bossAwake?40:0,valid:()=>!!b()?.bossAwake,duration:[6,10],transition:'fly',pose(c,t,target,o){const e=b(),a=sim.state.time*.08;look(o,[e.x+Math.sin(a)*26,e.baseY+8,e.z+Math.cos(a)*26],[e.x,e.baseY+e.bossScale*1.6,e.z]);}},
      {id:'arrival',weight:100,valid:()=>sim.state.time<4,duration:[4,4],pose(c,t,target,o){look(o,[p.x-4,p.y+6,p.z+9],[p.x,p.y+1.4,p.z]);}}
    ]});
    return {update(dt,eyes){const frame=d.update(dt,{eyes}),pose=frame.pose;if(frame.shot!=='eyes'){const from=[p.x,p.y+1.4,p.z],delta=pose.pos.map((v,i)=>v-from[i]),len=Math.hypot(...delta);if(len>.01){const dir=delta.map(v=>v/len),reach=Math.max(0,sim.ray(from,dir,len)-.3);if(reach<.8)return {shot:'eyes',pose:eyes};if(reach<len)pose.pos=from.map((v,i)=>v+dir[i]*reach);}}return {shot:frame.shot,pose};},reset:()=>d.reset(seed)};
  }
  G.MetalDemo={loadout,scenes,world,progress,camera};
})(typeof window!=='undefined'?window:globalThis);
