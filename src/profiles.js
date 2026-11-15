/* METAL — two complementary classes. Rules are opt-in for new expeditions;
 * historical worlds retain their geometry, arsenal and checkpoint identity. */
(function(G){
  'use strict';
  const names=['light','heavy'],weapons={light:[4,1,0],heavy:[4,3,2]};
  const level=xp=>1+Math.min(19,Math.floor(Math.sqrt(xp/100)));
  const capacity=xp=>4+.2*(level(xp)-1);
  function fresh(economy){
    return {version:1,active:'light',classes:Object.fromEntries(names.map(id=>[id,{xp:0,weapon:4,left:null,economy:G.FEconomy.campaign(economy||G.FEconomy.fresh())}])),jetpack:{fuel:4,recharge:0}};
  }
  function copy(value){
    if(!value||value.version!==1||!names.includes(value.active)||!value.classes)return null;
    const classes={};
    for(const id of names){
      const q=value.classes[id],economy=q&&G.FEconomy.campaign(q.economy);
      if(!q||!Number.isSafeInteger(q.xp)||q.xp<0||q.xp>1e7||!weapons[id].includes(q.weapon)||q.left!==null&&(!weapons[id].includes(q.left)||q.left===q.weapon)||!economy)return null;
      classes[id]={xp:q.xp,weapon:q.weapon,left:q.left,economy};
    }
    const j=value.jetpack,limit=capacity(classes.light.xp);
    if(!j||!Number.isFinite(j.fuel)||j.fuel<0||j.fuel>limit||!Number.isFinite(j.recharge)||j.recharge<0||j.recharge>.4)return null;
    return {version:1,active:value.active,classes,jetpack:{fuel:j.fuel,recharge:j.recharge}};
  }
  const owns=(profiles,inventory)=>names.every(id=>{const q=profiles.classes[id];return inventory.weapons[q.weapon]&&(q.left===null||inventory.weapons[q.left]);});
  const owner=(weapon,active='light')=>weapon===4?active:weapon===2||weapon===3?'heavy':'light';
  function ammoCaps(classes){const a=G.FEconomy.ammoCaps(classes.light.economy,{campaign:true}),b=G.FEconomy.ammoCaps(classes.heavy.economy,{campaign:true});return a.map((v,i)=>owner(i)==='heavy'?b[i]:v);}
  const allowed=(profile,weapon)=>weapons[profile]?.includes(weapon)===true;
  function canDamage(group,bullet,source){
    if(group.profileProtected)return false;
    if(group.kind==='wall'||group.kind==='roof'||group.profileRequired==='heavy')return !bullet&&source?.owner==='player'&&source.profile==='heavy';
    return true;
  }
  function world(w){
    if(!w.campaign||w.campaignVersion!==2)throw Error('Profiles require the current campaign');
    const corridor=w.corridors.find(c=>c.arenaPath),arena=w.bossArena;
    if(!corridor||!arena)throw Error('Profiles require a connected guardian arena');
    const region='corridor-'+w.corridors.indexOf(corridor),left=corridor.x-corridor.w/2,right=corridor.x+corridor.w/2,y=corridor.y,z=corridor.z,depth=corridor.d;
    const add=(p,size,category,color,solid=false)=>{
      const index=w.meshes.length,mesh={shape:'box',p,s:size,mat:category==='profile-signal'?4:1,r:[0,0,0],color,outdoor:true,region,category,structural:true};
      if(category==='profile-signal')mesh.emissive=.45;w.meshes.push(mesh);
      let collider=-1;if(solid){mesh.solid=true;collider=w.colliders.length;w.colliders.push({minX:p[0]-size[0]/2,maxX:p[0]+size[0]/2,minY:p[1]-size[1]/2,maxY:p[1]+size[1]/2,minZ:p[2]-size[2]/2,maxZ:p[2]+size[2]/2,mesh:index});}
      return {index,collider};
    };
    // A visible reinforced tunnel prevents flying over either lock. Its walls
    // and the arena perimeter have to remain intact: an explosive side breach
    // must not bypass the light class's power relay.
    const protectedMeshes=new Set(w.outdoorBoundaries.filter(b=>w.meshes[b.mesh]?.region===region||w.meshes[b.mesh]?.region==='room-'+arena.room).map(b=>b.mesh));
    for(const g of w.destructibles)if(g.meshes.some(i=>protectedMeshes.has(i)))g.profileProtected=true;
    const steel=[.23,.29,.32],orange=[.95,.43,.12],cyan=[.22,.83,.84];
    add([corridor.x,y+6.65,z],[corridor.w+.8,.3,depth+.8],'profile-roof',steel,true);
    for(const sign of [-1,1])add([corridor.x,y+3.25,z+sign*depth/2],[corridor.w+.8,6.5,.32],'profile-side',steel,true);
    const wallX=left+2.2,wall=add([wallX,y+3.25,z],[.65,6.5,depth],'profile-breach',steel,true),members=[wall.index];
    for(const side of [-1,1])for(let i=-2;i<=2;i++)members.push(add([wallX+side*.334,y+1.6+i*.32,z],[.018,.12,depth*.78],'profile-signal',orange).index);
    for(const i of members)w.meshes[i].destructibleId='profile-breach';
    w.outdoorBoundaries.push({mesh:wall.index});
    w.destructibles.push({id:'profile-breach',kind:'wall',profileRequired:'heavy',strength:18,meshes:members,colliders:[wall.collider]});
    const mechanism={id:'profile-power',name:'Relais aérien · léger',x:corridor.x+.2,y:y+3.2,z:z-depth/2+.95,required:true,profileRequired:'light'};
    w.mechanisms.push(mechanism);
    add([mechanism.x,mechanism.y-.12,mechanism.z],[1.5,.24,1.5],'profile-platform',steel,true);
    add([mechanism.x,mechanism.y+.55,mechanism.z-.35],[.48,1.1,.36],'profile-relay',steel);
    add([mechanism.x,mechanism.y+.83,mechanism.z-.155],[.37,.34,.04],'profile-signal',cyan);
    w.walkable.push({x:mechanism.x,z:mechanism.z,w:1.5,d:1.5,y:mechanism.y});
    w.doors.push({id:'profile-door',x:right-1.3,y,z,w:.5,d:depth,h:6.5,requires:mechanism.id,profileProtected:true});
    for(const side of [-1,1])add([right-1.3,y+3.2,z+side*(depth/2-.18)],[.65,6.4,.17],'profile-signal',cyan);
    // The launcher is obtainable before the first required breach, independent
    // of boss rewards. Its finite ammunition follows the expedition inventory.
    if(w.index===0)w.pickups.push({id:'profile-launcher',kind:'weapon',weapon:3,amount:8,x:w.spawn.x+1,y:w.spawn.y||0,z:w.spawn.z,profileRequired:'heavy',profileUnlock:true});
    w.pickups.push({id:'profile-breach-ammo',kind:'ammo',weapon:3,amount:8,x:left-1.2,y,z:z+.9,profileRequired:'heavy'});
    for(const e of w.enemies)if(e.type===3&&e.bossScale>1)e.profileRequired=w.index%2?'heavy':'light';
    w.profileVersion=1;
    w.profileGoals={breach:'profile-breach',mechanism:mechanism.id,door:'profile-door',boss:w.index%2?'heavy':'light',entry:{x:left-1,y,z},after:{x:right+1,y,z}};
    return w;
  }
  G.MetalProfiles={names,weapons,owns,owner,ammoCaps,level,capacity,fresh,copy,allowed,canDamage,world};
})(typeof window!=='undefined'?window:globalThis);
