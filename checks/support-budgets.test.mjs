import test from 'node:test';import assert from 'node:assert/strict';import {loadRealm} from '../tools/realm-loader.mjs';
const {FSimulation:S,MetalSupport:D,FWorld:W,MetalDemo:MD}=loadRealm({modules:['fmath','passages','renderer','support','profiles','world','destruction','economy','physics-geometry','simulation','demo-metal']}).window;
const alive=e=>e.hp>0;
const piece=(i=0,size=[6,3,.25])=>({structural:true,sourceId:'source-'+i,shape:'box',material:'stone',mat:3,p:[0,2,0],size,rotation:[0,.2,.1],velocity:[1,1,0],seed:i});
test('small wall fragments are actual source cells below .75m, no more than five per object',()=>{const a=piece(),out=S.wreckage([a],{small:true});assert(out.length>0&&out.length<=5);for(const q of out){assert(q.size.every(v=>v<=.75+1e-9));assert.equal(q.size[2],.25);assert.equal(q.sourceId,a.sourceId);assert.deepEqual(q.rotation,a.rotation);assert.equal(q.mat,a.mat);}assert(out.reduce((n,q)=>n+q.mass,0)<a.size.reduce((n,v)=>n*v,28),'unmodelled remainder is dust, not extra physics');});
test('one multi-object blast never bypasses the 16-fragment event budget',()=>{for(const small of [false,true])for(const n of [1,5,16,24,100]){const out=S.wreckage(Array.from({length:n},(_,i)=>piece(i)),{small});assert(out.length<=16);for(let i=0;i<n;i++)assert(out.filter(q=>q.sourceId==='source-'+i).length<=5);}});
test('new gameplay budgets remain explicit and frozen',()=>{assert.equal(D.RULES.combatCap,20);assert.equal(D.RULES.fragmentCap,5);assert(Object.isFrozen(D.RULES));});

// Lot 03 (17/11/2026): the candidate machine ceiling must be a real budget, not
// a decoration, and it must never strand a horde or a boss objective.
test('the active-machine ceiling bounds every creation path and never strands a horde',()=>{
  assert.equal(D.RULES.combatCap,20,'the candidate ceiling stays documented and frozen');
  for(const index of [0,8,17]){
    const w=W.create(96,index,{campaign:true,campaignVersion:2,profiles:true,combatVersion:1,hordeVersion:1,supportDroneVersion:1});
    const sim=S.create(w,MD.loadout(index,'heavy',true),{brain:null});
    const horde=sim.state.encounters.find(q=>q.horde),base=sim.state.encounters.find(c=>c.id===horde.after),p=sim.state.player;
    assert(horde&&base,'each world owns one horde behind its own room fight');
    const ceiling=Math.max(horde.maxActive,S.campaignPolicy(index,sim.state.inventory,16,2).maxActive);
    // The room fight ends as in play: deployed machines destroyed by real ordnance.
    let serial=900;
    for(const v of base.waves)for(const id of v.enemyIds){const e=sim.state.enemies[id];e.deployed=true;e.encounterReleased=true;
      sim.state.projectiles.push({id:++serial,kind:'grenade',owner:'player',profile:'heavy',x:e.x,y:e.baseY+1,z:e.z,vx:0,vy:0,vz:0,age:0,life:4,fuse:.001,radius:.17,blastRadius:2.4,damage:400,terrainPower:0,travel:0,bounces:0,resting:true});}
    sim.step(1/60);sim.state.events.length=0;
    assert(base.waves.every(v=>v.enemyIds.every(id=>sim.state.enemies[id].hp===0)),'the room is cleared');
    p.x=horde.trigger.x;p.z=horde.trigger.z;p.y=horde.trigger.y||0;
    let peak=0,steps=0;
    const roster=horde.waves.flatMap(v=>v.enemyIds);
    // The player clears each wave with real ordnance; the budget must let the
    // next wave in instead of stranding the objective.
    for(const wave of horde.waves){
      for(let i=0;i<60*30&&wave.enemyIds.some(id=>sim.state.enemies[id].deployed===false);i++){
        p.hp=100;sim.state.dead=false;sim.step(1/60);sim.state.events.length=0;
        peak=Math.max(peak,sim.state.aiStats.awake);steps++;
      }
      for(const id of wave.enemyIds){const e=sim.state.enemies[id];e.deployed=true;e.encounterReleased=true;
        sim.state.projectiles.push({id:++serial,kind:'grenade',owner:'player',profile:'heavy',x:e.x,y:e.baseY+1,z:e.z,vx:0,vy:0,vz:0,age:0,life:4,fuse:.001,radius:.17,blastRadius:2.4,damage:400,terrainPower:0,travel:0,bounces:0,resting:true});}
      for(let i=0;i<60*6;i++){p.hp=100;sim.state.dead=false;sim.step(1/60);sim.state.events.length=0;peak=Math.max(peak,sim.state.aiStats.awake);steps++;}
    }
    assert(peak>0,'machines actually wake up in world '+index);
    assert(peak<=ceiling,index+': '+peak+' active machines over a ceiling of '+ceiling);
    assert(roster.every(id=>sim.state.enemies[id].deployed),index+': every horde machine was eventually deployed');
    assert(horde.wave>=horde.waves.length-1,index+': the waves kept coming (wave '+horde.wave+' of '+horde.waves.length+')');
    // The budget must not make the objective impossible: every deployed machine,
    // horde included, stays killable with real ordnance.
    for(const e of sim.state.enemies)if(e.hp>0&&e.deployed){
      sim.state.projectiles.push({id:++serial,kind:'grenade',owner:'player',profile:'heavy',x:e.x,y:e.baseY+1,z:e.z,vx:0,vy:0,vz:0,age:0,life:4,fuse:.001,radius:.17,blastRadius:2.4,damage:400,terrainPower:0,travel:0,bounces:0,resting:true});
    }
    for(let i=0;i<60*10;i++){p.hp=100;sim.state.dead=false;sim.step(1/60);sim.state.events.length=0;peak=Math.max(peak,sim.state.aiStats.awake);}
    assert.equal(sim.state.enemies.filter(e=>e.hp>0&&e.deployed&&e.type!==3).length,0,index+': the horde room stays clearable');
    assert(peak<=ceiling,index+': '+peak+' active machines over a ceiling of '+ceiling+' while clearing');
    sim.dispose?.();
  }
});
