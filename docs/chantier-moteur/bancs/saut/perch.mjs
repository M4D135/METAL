// (e) Perched player vs the real AI: 20 s passive on a perch (collider top reached by the explorer) against the same 20 s
// standing at the foot of that perch. Paired per perch, fresh deterministic simulation each time. Baseline AI and "parade" AI.
import {readFileSync,existsSync,writeFileSync} from 'node:fs';import {loadFast,WORLDS,mean,q} from './lib.mjs';
const labels=(process.argv[2]||'v2-00').split(','),MAXP=+process.argv[3]||20,SECS=+process.argv[4]||20;
const parade={simulation:[
  // P2: goal brought back to the nearest free point towards the enemy when the target cell is inside a collider (player on a perch)
  ["const path=route(e,x,z);if(!path)return false;\n      e.goalX=x;e.goalZ=z;e.path=path;","if(blocked(x,z,radius(e))){const bx=e.x-x,bz=e.z-z,bd=Math.hypot(bx,bz)||1;for(let k=1;k<=10;k++){const nx=x+bx/bd*k*.35,nz=z+bz/bd*k*.35;if(!blocked(nx,nz,radius(e))){x=nx;z=nz;break;}}}\n      const path=route(e,x,z);if(!path)return false;\n      e.goalX=x;e.goalZ=z;e.path=path;"],
  // P1: the rush may start against a target up to 1.7 m higher (segment tested up to 1 m short of the perch) and connects as a leap
  ["if(!e.airborne&&d<11.5&&d>1&&Math.abs(e.aimY-1.45-e.baseY)<.65&&segmentFree(e.x,e.z,e.aimX,e.aimZ,.38)){","const dyR=e.aimY-1.45-e.baseY;if(!e.airborne&&d<11.5&&d>1&&(Math.abs(dyR)<.65&&segmentFree(e.x,e.z,e.aimX,e.aimZ,.38)||dyR>=.65&&dyR<RUSHV&&d>1.6&&segmentFree(e.x,e.z,e.aimX-dx/d*1.1,e.aimZ-dz/d*1.1,.38))){"],
  ["if(!e.rushHit&&Math.abs(e.baseY-p.y)<.9&&Math.hypot(e.x-p.x,e.z-p.z)<.9&&","if(!e.rushHit&&(Math.abs(e.baseY-p.y)<.9&&Math.hypot(e.x-p.x,e.z-p.z)<.9||p.y-e.baseY>=.9&&p.y-e.baseY<RUSHV&&Math.hypot(e.x-p.x,e.z-p.z)<1.45)&&"],
  ["const freshAir=()=>","const RUSHV=1.7;const freshAir=()=>"]]};
const A=loadFast(),B=loadFast({patches:parade});
function run(Wn,world,pos,secs){
  let brain=null;try{brain=Wn.FBrain.create({mode:'cpu'});}catch(e){}
  const sim=Wn.FSimulation.create(world,{brain}),s=sim.state,p=s.player;p.x=pos[0];p.y=pos[1];p.z=pos[2];
  let dmg=0,wait=0,tot=0,rushes=0,rushHits=0,shots=0,engaged=0;const was=new Map();const input={};
  for(let i=0;i<secs*60;i++){
    const hp=p.hp,ar=s.armor?s.armor.points:0;sim.step(1/60,input);
    if(s.dead){dmg+=hp;s.dead=false;p.hp=sim.stats.maxHp;}else{dmg+=Math.max(0,hp-p.hp)+Math.max(0,ar-(s.armor?s.armor.points:0));p.hp=sim.stats.maxHp;}
    p.x=pos[0];p.z=pos[2];if(!p.airborne)p.y=pos[1];
    for(const ev of s.events)if(ev.name==='enemyShot')shots++;s.events.length=0;
    let eng=0;for(const e of s.enemies){if(!(e.hp>0)||e.deployed===false||e.sleeping||e.type===3||!e.hasMemory)continue;eng++;tot++;
      if(e.moveSpeed===0&&e.path.length===0&&!(e.windup>0||e.burstLeft>0||e.rushTime>0))wait++;
      const r=e.rushTime>0;if(r&&!was.get(e.id))rushes++;was.set(e.id,r);if(e.rushHit&&r&&!was.get('h'+e.id)){rushHits++;was.set('h'+e.id,true);}if(!r)was.set('h'+e.id,false);}
    engaged=Math.max(engaged,eng);
  }
  return {dmg,wait:tot?wait/tot:NaN,rushes,rushHits,shots,engaged};
}
const all=[];
for(const label of labels){
  const entry=WORLDS.find(w=>w[0]===label),file=new URL('./out/'+label+'-JC.json',import.meta.url);if(!existsSync(file)){console.log(label,'no JC output yet');continue;}
  const data=JSON.parse(readFileSync(file,'utf8'));const world=A.FWorld.create(96,entry[1],entry[2]);const probe=A.FSimulation.create(world,{});
  const lifts=world.lifts||[],deployed=world.enemies.filter(e=>e.deployed!==false&&e.type!==3);
  const cand=[];for(const [x,y,z,h] of data.perches){if(h<.9||h>2.7)continue;if(lifts.some(l=>Math.abs(x-l.x)<l.w/2+.5&&Math.abs(z-l.z)<l.d/2+.5))continue;
    let best=1e9,rusher=1e9;for(const e of deployed){if(Math.abs((e.y||0)-(y-h))>1)continue;const d=Math.hypot(e.x-x,e.z-z);if(d<best)best=d;if(e.type===1&&d<rusher)rusher=d;}
    if(best<5||best>18)continue;cand.push({x,y,z,h,best,rusher});}
  cand.sort((a,c)=>(a.rusher<16?0:1)-(c.rusher<16?0:1)||a.best-c.best);const chosen=[];
  for(const c of cand){if(chosen.length>=MAXP)break;if(chosen.every(o=>Math.hypot(o.x-c.x,o.z-c.z)>3.5))chosen.push(c);}
  const rows=[];
  for(const c of chosen){
    let foot=null;for(const r of [1.1,1.6,2.2,3])for(let k=0;k<12&&!foot;k++){const fx=c.x+Math.cos(k*Math.PI/6)*r,fz=c.z+Math.sin(k*Math.PI/6)*r,g=probe.ground(fx,fz);if(Math.abs(g-(c.y-c.h))<.25&&!probe.blocked(fx,fz,.28,g))foot=[fx,g,fz];}
    if(!foot)continue;
    const row={h:c.h,near:+c.best.toFixed(1),rusher:+c.rusher.toFixed(1)};
    for(const [tag,Wn] of [['base',A],['parade',B]]){const up=run(Wn,world,[c.x,c.y,c.z],SECS),dn=run(Wn,world,foot,SECS);row[tag]={up,dn};}
    rows.push(row);all.push({label,...row});
  }
  const sum=(tag,k,w)=>rows.reduce((n,r)=>n+r[tag][w][k],0);
  const line=tag=>{const up=sum(tag,'dmg','up'),dn=sum(tag,'dmg','dn');return `${tag}: dégâts perché ${up.toFixed(0)} / sol ${dn.toFixed(0)} (ratio ${(up/dn).toFixed(2)}) · perchoirs réduisant >30 % : ${rows.filter(r=>r[tag].dn.dmg>0&&r[tag].up.dmg<.7*r[tag].dn.dmg).length}/${rows.filter(r=>r[tag].dn.dmg>0).length} · attente perché ${(100*mean(rows.map(r=>r[tag].up.wait).filter(Number.isFinite))).toFixed(0)} % / sol ${(100*mean(rows.map(r=>r[tag].dn.wait).filter(Number.isFinite))).toFixed(0)} % · ruées perché ${sum(tag,'rushes','up')} (touches ${sum(tag,'rushHits','up')}) / sol ${sum(tag,'rushes','dn')} (touches ${sum(tag,'rushHits','dn')}) · tirs perché ${sum(tag,'shots','up')} / sol ${sum(tag,'shots','dn')}`;};
  console.log(label,'perchoirs',rows.length,'hauteurs',rows.map(r=>r.h).join(' '));console.log('  '+line('base'));console.log('  '+line('parade'));
}
writeFileSync(new URL('./out/perch-'+labels.join('_')+'.json',import.meta.url),JSON.stringify(all));
