// RESTE-verif: endurance run. Does per-frame cost drift with duration, and with which state does it correlate?
import {scene} from './scene.mjs';import {q} from './build.mjs';
const [variant='r1',N='9000',w='camp:6',WIN='600']=process.argv.slice(2);const [kind,idx]=w.split(':');
const S=scene({variant,world:[kind,+idx]});const s=S.sim.state;
console.log('world enemies',S.world.enemies.length,'pickups',s.pickups.length,'route',S.route.length);
let tm=[],td=[],ts=[],len=0,supply=0;
const near=(c,r=73)=>(c.x-s.player.x)**2+(c.z-s.player.z)**2<r*r;
for(let i=0;i<+N;i++){
  const f=S.frame();tm.push(f.modelsMs);td.push(f.drawMs);ts.push(f.simMs);len+=f.dynamic;
  supply+=s.loot.filter(c=>!c.taken&&near(c)).length;
  if((i+1)%+WIN===0){globalThis.gc?.();const d=S.sim.destruction;
    console.log(String(i+1).padStart(6),'loot',s.loot.length,'untaken',s.loot.filter(c=>!c.taken).length,'nearLoot/frame',(supply/+WIN).toFixed(1),'alive',s.enemies.filter(e=>e.hp>0).length,'deployed',s.enemies.filter(e=>e.hp>0&&e.deployed!==false).length,'debris',s.debris.length,'part',s.particles.length,'list',(len/+WIN).toFixed(0),'| models med',(1e3*q(tm,.5)).toFixed(0),'p10',(1e3*q(tm,.1)).toFixed(0),'draw p10',(1e3*q(td,.1)).toFixed(0),'sim p10',(1e3*q(ts,.1)).toFixed(0),'| heap MB',(process.memoryUsage().heapUsed/1048576).toFixed(1),'rev',s.destructionRevision??d?.revision,'meshes',d?.meshes?.length,'coll',d?.colliders?.length,'kills',s.kills,'ammo',s.inventory?.ammo?.join('/'));
    tm=[];td=[];ts=[];len=0;supply=0;}
}
