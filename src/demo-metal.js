/* METAL — isolated demonstration scenes and views, using ordinary game rules. */
(function(G){'use strict';
  function loadout(index,active='light'){
    const E=G.FEconomy,P=G.MetalProfiles,profiles=P.fresh(),weapons=[false,false,false,index>0,true];
    for(let i=0;i<index;i++){const id=i%2?'heavy':'light',q=profiles.classes[id],r=E.bossReward(i),owner=P.owner(r.weaponUpgrade,id),old=q.economy;q.economy=E.grantBossReward(old,i);if(owner!==id){q.economy.weaponUpgrades[r.weaponUpgrade]=old.weaponUpgrades[r.weaponUpgrade];profiles.classes[owner].economy.weaponUpgrades[r.weaponUpgrade]++;}if(r.weapon!==null)weapons[r.weapon]=true;}
    // The heavy launcher is collected in world one before its mandatory breach.
    profiles.active=active;const ammo=P.ammoCaps(profiles.classes).map((v,i)=>weapons[i]?v:0);
    return {profiles,inventory:{weapons,ammo},economy:profiles.classes[active].economy,equipment:{right:4,left:null},campaign:{version:2,claimedBossRewards:Array.from({length:index},(_,i)=>i),discovered:[['pistol',4],['smg',0],['shotgun',1],['grenade',3],['rocket',2]].filter(([,i])=>weapons[i]).map(([name])=>name)}};
  }
  // Live gameplay with the current simulation, not old prerecorded inputs.
  // The title loop concentrates on regular firefights; no boss showcase.
  function scenes(seed=96,bench=false){return [7,13,3,10,16,5].slice(0,bench?3:6).map((index,i)=>({id:'combat-'+i,index,roomSlot:i,seed:(seed+[0,37,101,173,251,389][i])>>>0,assault:true,combatOnly:true,profile:i===1?'light':'heavy',maxSeconds:32}));}
  function active(scene){return scene.profile||(scene.boss?(scene.index%2?'heavy':'light'):'heavy');}
  function clearLine(source,a,b,radius=0){
    for(const q of source.colliders||[]){let lo=0,hi=1;for(let k=0;k<3;k++){const key=['X','Y','Z'][k],d=b[k]-a[k],min=q['min'+key]-radius,max=q['max'+key]+radius;if(Math.abs(d)<1e-9){if(a[k]<min||a[k]>max){hi=-1;break;}}else{let x=(min-a[k])/d,y=(max-a[k])/d;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(hi<lo)break;}}if(lo<=hi)return false;}return true;
  }
  function safeSpot(source,x,y,z){
    if(!(source.walkable||[]).some(f=>Math.abs(x-f.x)<f.w/2-.6&&Math.abs(z-f.z)<f.d/2-.6&&Math.abs(y-(f.y||0))<.1))return false;
    if(!clearLine(source,[x,y+.05,z],[x,y+1.8,z],.38))return false;
    for(const q of source.traps||[]){const tx=q.kind==='blade'&&q.axis!=='z'?(q.travel||1.65):0,tz=q.kind==='blade'&&q.axis==='z'?(q.travel||1.65):0;if(Math.abs(x-q.x)<(q.w||1)/2+tx+2&&Math.abs(z-q.z)<(q.d||1)/2+tz+2)return false;}
    for(const q of source.jumpPads||[])if(Math.hypot(x-q.x,z-q.z)<(q.r||1.15)+2)return false;
    const a=source.bossArena;return !a||Math.hypot(x-a.x,z-a.z)>a.r+8;
  }
  function world(source,scene){
    if(scene.boss){const a=source.bossArena;return {...source,spawn:{x:a.x-24,y:a.y,z:a.z+.3,yaw:Math.PI/2}};}
    if(!scene.assault)return source;
    let best=null;const rooms=new Map();
    for(const room of source.rooms||[]){
      if(room.bossArena)continue;
      const guards=(source.enemies||[]).filter(e=>e.type!==3&&e.deployed!==false&&(e.zoneId===room.id||Math.hypot(e.x-room.x,e.z-room.z)<Math.min(room.w,room.d)/2)&&Math.abs((e.y||0)-(room.y||0))<.2);
      if(!guards.length)continue;
      const candidates=[];
      for(const radius of [5.5,8,10])for(let k=0;k<16;k++){
        const angle=k*Math.PI/8,x=room.x+Math.cos(angle)*radius,z=room.z+Math.sin(angle)*radius,y=room.y||0;
        if(!safeSpot(source,x,y,z)||guards.some(e=>Math.hypot(x-e.x,z-e.z)<5))continue;
        const visible=guards.filter(e=>clearLine(source,[x,y+1.62,z],[e.x,(e.y||0)+1.1,e.z]));if(!visible.length)continue;
        const nearest=visible.reduce((a,e)=>Math.hypot(a.x-x,a.z-z)<Math.hypot(e.x-x,e.z-z)?a:e),distance=Math.hypot(nearest.x-x,nearest.z-z);
        const space=[0,1,2,3,4,5,6,7].filter(j=>{const a=j*Math.PI/4,px=x+Math.cos(a)*2,pz=z+Math.sin(a)*2;return safeSpot(source,px,y,pz)&&clearLine(source,[x,y+.9,z],[px,y+.9,pz],.4);}).length;
        const score=visible.length*3+space*2-Math.abs(distance-11)-Math.abs(room.id-(scene.index%3+1))*.5;
        candidates.push({x,y,z});const previous=rooms.get(room.id);if(!previous||score>previous.score)rooms.set(room.id,{score,spawn:{x,y,z,yaw:Math.atan2(nearest.x-x,z-nearest.z)},room,candidates});
      }
    }
    const choices=Array.from(rooms.values()).sort((a,b)=>a.room.id-b.room.id);best=choices[(scene.roomSlot||0)%choices.length];
    if(!best)return source;
    const patrol=best.candidates.filter(q=>Math.hypot(q.x-best.spawn.x,q.z-best.spawn.z)>3).filter((_,i)=>i%3===0).slice(0,8);
    return {...source,spawn:best.spawn,attractPatrol:patrol};
  }
  function activity(sim){let lastShot=sim.state.shots,lastKill=sim.state.kills,lastAction=sim.state.time;return {done(){const s=sim.state;if(s.shots!==lastShot||s.kills!==lastKill){lastAction=s.time;lastShot=s.shots;lastKill=s.kills;}return s.time>=12&&s.time-lastAction>4;}};}
  function progress(sim,pilot){const s=sim.state,b=s.enemies.find(e=>e.bossScale>1);return [pilot.goalKey,pilot.distanceProgress,s.relays,s.kills,s.mechanisms.filter(m=>m.active).length,b?Math.ceil(30*b.hp/b.maxHp):0,s.activeProfile].join('|');}
  function camera(sim,seed){
    const follow=G.MetalCamera?.create();follow?.reset(false);
    return {update(dt,eyes){
      // Long readable first-person sequences, briefly over the shoulder.
      // The same swept follow rig as play handles walls and recovery.
      const third=sim.state.time%24>=9;follow?.set(third);
      if(!follow)return {shot:'eyes',pose:eyes};
      const p={...sim.state.player,x:eyes.pos[0],y:eyes.pos[1]-1.62,z:eyes.pos[2],yaw:eyes.yaw,pitch:eyes.pitch};
      const q=follow.frame(p,(o,d,far)=>sim.ray(o,d,far),dt,{profile:sim.state.activeProfile||'heavy',ground:(x,z)=>sim.ground(x,z)});
      return q.thirdPerson?{shot:'chase',pose:{pos:q.pos,yaw:q.yaw,pitch:q.pitch,roll:0,fov:eyes.fov||74}}:{shot:'eyes',pose:eyes};
    },reset:()=>follow?.reset(false)};
  }
  G.MetalDemo={loadout,scenes,world,progress,camera,active,activity};
})(typeof window!=='undefined'?window:globalThis);
