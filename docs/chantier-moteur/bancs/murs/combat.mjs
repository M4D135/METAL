// Combat automatique apparié : A (comportement d'origine) et B (règle « murs = armes lourdes ») avancent en
// alternance dans le même processus, avec le même pilote. Compte les révisions de destruction par minute,
// les ruptures par source et par genre, les gravats et le temps des pas.
// usage : node combat.mjs <def R1|R2|R3> [secondes=60]   env : SCEN=filtre  ERR=erreur de visée (rad)  ENEMY=0|1 BOSS=0|1 DOORS=0|1
import {loadFast,loadoutV2,q,mean} from './lib.mjs';import {patchesA,patchesB,armoredIds,classify} from './proto.mjs';
const DEF=process.argv[2]||'R2',SECONDS=+process.argv[3]||60,STEPS=Math.round(SECONDS*60),ERR=process.env.ERR!==undefined?+process.env.ERR:.05;
const RULE={enemy:process.env.ENEMY!=='0',boss:process.env.BOSS!=='0',steam:false},DOORS=process.env.DOORS!=='0';
const A=loadFast({patches:patchesA}),B=loadFast({patches:patchesB});
const SCEN=[
  ['w01 pistolet',0,4],['w02 pompe',1,1],['w03 mitraillette',2,0],['w03 pompe',2,1],['w05 mitraillette',4,0],['w10 mitraillette',9,0],['w10 pompe',9,1],['w10 pistolet',9,4],
].filter(s=>!process.env.SCEN||s[0].includes(process.env.SCEN));
function build(W,index,weapon,armored){
  const world=W.FWorld.create(96,index,{campaign:true,campaignVersion:2});if(armored)world.armored=armoredIds(world,DEF);
  const carry=loadoutV2(W,index);if(Number.isInteger(weapon)&&!carry.inventory.weapons[weapon])throw new Error('arme '+weapon+' absente au monde '+(index+1));
  let brain=null;try{brain=W.FBrain.create({mode:'cpu'});}catch{}
  const sim=W.FSimulation.create(world,{...carry,armorSystem:true,...(brain?{brain}:{})});sim.selectWeapon(weapon);
  return {world,sim,log:{breaks:{},impacts:{},deflected:{},revs:0,revSteps:[],fallen:0,doors:{hit:0,broken:0,deflected:0}},kinds:new Map(world.destructibles.map(g=>[g.id,classify(world,g)]))};
}
function hooks(inst){
  globalThis.__SRC='joueur:balle';globalThis.__RULE=inst.isB?RULE:{enemy:true,boss:true,steam:true};globalThis.__DOORS_ARMORED=inst.isB&&DOORS;
  globalThis.__LOG=(g,bullet,amount,state)=>{const c=inst.kinds.get(g.id),label=(c.kind+'|'+(c.cat||'mat'+c.mat)),key=globalThis.__SRC+' -> '+label,t=state>0?inst.log.breaks:state<0?inst.log.deflected:inst.log.impacts;t[key]=(t[key]||0)+1;};
  globalThis.__REV=(result,fallen)=>{inst.log.revs++;inst.log.fallen+=fallen;inst.revNow=true;};
  globalThis.__DOORLOG=(d,power,broken)=>{if(broken===false&&globalThis.__DOORS_ARMORED)inst.log.doors.deflected++;else{inst.log.doors.hit++;if(broken)inst.log.doors.broken++;}};
}
function makeBot(inst,weapon){
  const {sim,world}=inst,s=sim.state,p=s.player,enc=s.encounters.filter(q=>!world.rooms?.[q.zoneId]?.bossArena);let tour=0;
  return (i,input)=>{
    p.hp=Math.max(p.hp,70);if(s.inventory.ammo[weapon]<8&&weapon!==4)s.inventory.ammo[weapon]=sim.ammoCaps[weapon];
    if(enc.length&&i%600===0){const e=enc[tour++%enc.length];p.x=e.trigger.x;p.z=e.trigger.z;p.y=sim.ground(p.x,p.z);}
    let best=null,bd=1e9;
    for(const e of s.enemies){if(!(e.hp>0)||e.deployed===false||e.sleeping)continue;const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<bd&&d<34&&Math.abs(e.baseY-p.y)<4&&sim.sight(p.x,p.z,e.x,e.z,p.y+1.62,e.y)){best=e;bd=d;}}
    input.moveX=Math.sin(i/90);input.moveY=best?.2:1;input.sprint=!best;input.dash=false;
    if(best){const err=ERR*(Math.sin(i*.37)+.6*Math.sin(i*.113+1.3)),dx=best.x-p.x,dz=best.z-p.z;p.yaw=Math.atan2(dx,-dz)+err;p.pitch=Math.atan2(best.y-(p.y+1.62),Math.hypot(dx,dz))+err*.5*Math.cos(i*.21);input.fire=true;}
    else{input.fire=(i%45)<6;p.yaw+=.02;p.pitch=0;}   // sans cible : courtes rafales de reconnaissance en tournant
  };
}
const out=[];
for(const [label,index,weapon] of SCEN){
  const a=build(A,index,weapon,false),b=build(B,index,weapon,true);a.isB=false;b.isB=true;
  const botA=makeBot(a,weapon),botB=makeBot(b,weapon),ia={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0},ib={...ia};
  const t={a:[],b:[]},spk={a:[],b:[]};let maxRubble={a:0,b:0},rubbleSum={a:0,b:0};
  const one=(inst,bot,input,i,key)=>{hooks(inst);inst.revNow=false;bot(i,input);const t0=performance.now();inst.sim.step(1/60,input);const dt=performance.now()-t0;t[key].push(dt);if(inst.revNow)spk[key].push(dt);const r=inst.sim.state.debris.filter(d=>d.structural).length;maxRubble[key]=Math.max(maxRubble[key],r);rubbleSum[key]+=r;inst.sim.state.events.length=0;};
  for(let i=0;i<STEPS;i++){if(i&1){one(b,botB,ib,i,'b');one(a,botA,ia,i,'a');}else{one(a,botA,ia,i,'a');one(b,botB,ib,i,'b');}}
  const mins=SECONDS/60,sum=o=>Object.values(o).reduce((x,y)=>x+y,0),top=(o,n=6)=>Object.entries(o).sort((x,y)=>y[1]-x[1]).slice(0,n).map(([k,v])=>k+' ×'+v).join(' ; ');
  const row=(inst,key)=>({revPerMin:+(inst.log.revs/mins).toFixed(1),breaks:sum(inst.log.breaks),impacts:sum(inst.log.impacts),deflected:sum(inst.log.deflected),fallen:inst.log.fallen,rubbleMax:maxRubble[key],rubbleMean:+(rubbleSum[key]/STEPS).toFixed(1),shots:inst.sim.state.shots,hits:inst.sim.state.hits,kills:inst.sim.state.kills,
    stepMean:+mean(t[key]).toFixed(3),p99:+q(t[key],.99).toFixed(2),max:+Math.max(...t[key]).toFixed(1),over4:t[key].filter(v=>v>4).length,over8:t[key].filter(v=>v>8).length,revStepMean:spk[key].length?+mean(spk[key]).toFixed(2):null,revStepMax:spk[key].length?+Math.max(...spk[key]).toFixed(1):null,doors:inst.log.doors,states:inst.sim.destruction.snapshot().states.length});
  const ra=row(a,'a'),rb=row(b,'b');
  console.log('\n== '+label+' (monde '+(index+1)+', '+SECONDS+' s, déf '+DEF+', murs blindés '+b.world.armored.length+'/'+b.world.destructibles.length+') ==');
  console.log('A origine :',JSON.stringify(ra));console.log('B règle   :',JSON.stringify(rb));
  console.log('A ruptures par source -> genre :',top(a.log.breaks,10));console.log('B ruptures par source -> genre :',top(b.log.breaks,10));console.log('B impacts déviés (murs) :',top(b.log.deflected,6));
  out.push({label,index,weapon,def:DEF,seconds:SECONDS,A:ra,B:rb,breaksA:a.log.breaks,breaksB:b.log.breaks,deflectedB:b.log.deflected});
}
import {writeFileSync} from 'node:fs';writeFileSync(new URL('./combat-'+DEF+(process.env.TAG||'')+'.json',import.meta.url),JSON.stringify(out,null,1));
