// Proof that the legacy motion profile is untouched by the FEEL-08/09 prototype: original vs patched simulation in lockstep on
// worlds that select the legacy profile (no progression, generation < 6), with jump presses in the input stream.
// Per-step FNV digest of player / enemies / bullets / events + final snapshot hash must be equal.
import {loadFast,fnv} from './lib.mjs';import {physPatches} from './phys.mjs';
const A=loadFast(),B=loadFast({patches:physPatches({})});
const f64=new Float64Array(1),u32=new Uint32Array(f64.buffer);const mix=(h,v)=>{f64[0]=v;h=Math.imul(h^u32[0],16777619);return Math.imul(h^u32[1],16777619);};
function digest(s,h){const p=s.player;for(const k of ['x','y','z','yaw','hp','airVX','airVY','airVZ','dash','heat'])h=mix(h,p[k]);h=mix(h,p.airborne?1:0);for(const e of s.enemies){h=mix(h,e.x);h=mix(h,e.z);h=mix(h,e.hp);h=mix(h,e.baseY);}for(const q of s.bullets){h=mix(h,q.x);h=mix(h,q.z);}h=mix(h,s.locomotion.speed);for(const e of s.events)for(const c of e.name)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function world(generation){const enemies=[{x:10,z:-12,type:0},{x:-9,z:-14,type:1},{x:4,z:-20,type:2},{x:-14,z:6,type:1}];
  return {seed:'legacy',stage:0,generation,spawn:{x:0,y:1.6,z:6,yaw:0},bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40},walkable:[{x:0,y:0,z:0,w:80,d:80},{x:0,y:1.6,z:8,w:8,d:8}],meshes:[],lights:[],
    colliders:[{minX:-3,maxX:-2,minZ:-6,maxZ:-5,minY:0,maxY:.7},{minX:5,maxX:9,minZ:-8,maxZ:-7.5,minY:0,maxY:2.6},{minX:-12,maxX:-11,minZ:-2,maxZ:2,minY:0,maxY:.9}],enemies,pickups:[],cores:[{x:30,z:30},{x:32,z:30},{x:34,z:30}],exit:{x:36,z:30}};}
const rows=[];
for(const [name,gen,opts] of [['génération 5 (avancé, profil legacy)',5,{}],['génération 3 (historique, profil legacy)',3,{}],['génération 6 (profil moderne, témoin)',6,{}]]){
  const a=A.FSimulation.create(world(gen),opts),b=B.FSimulation.create(world(gen),opts);let ha=2166136261,hb=2166136261,div=-1,jumps=0;
  const ia={moveX:0,moveY:1,sprint:true},ib={moveX:0,moveY:1,sprint:true};
  for(let i=0;i<3600;i++){for(const [inp,s] of [[ia,a.state],[ib,b.state]]){inp.moveX=Math.sin(i/70);inp.moveY=Math.cos(i/190)>-.3?1:-1;inp.sprint=(i%400)<300;inp.jump=(i%45)<3;inp.dash=(i%260)===0;inp.fire=(i%30)<8;inp.lookX=.012*Math.sin(i/33);if(s.player.hp<60)s.player.hp=100;}
    a.step(1/60,ia);b.step(1/60,ib);ha=digest(a.state,ha);hb=digest(b.state,hb);if(ha!==hb&&div<0)div=i;jumps+=b.state.events.filter(e=>e.name==='jump').length;a.state.events.length=0;b.state.events.length=0;}
  const sa=fnv(JSON.stringify(a.snapshot())),sb=fnv(JSON.stringify(b.snapshot()));
  rows.push({monde:name,profil:JSON.stringify(a.motionProfile).slice(0,44),'digest original':ha.toString(16),'digest prototype':hb.toString(16),'snapshot original':sa,'snapshot prototype':sb,identique:ha===hb&&sa===sb,'1er écart (pas)':div,'sauts prototype':jumps});
}
console.table(rows);
