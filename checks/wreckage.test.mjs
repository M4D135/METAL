// Destruction leaves the broken object in a few physical pieces, without a
// cloud of chips (David, 16/11/2026).
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const ctx={window:{},TextEncoder,TextDecoder};vm.createContext(ctx);
for(const n of ['fmath','passages','renderer','profiles','world','destruction','economy','simulation'])vm.runInContext(readFileSync(new URL('../src/'+n+'.js',import.meta.url),'utf8'),ctx,{filename:n+'.js'});
const {FSimulation:S,FWorld:W}=ctx.window;
const volume=q=>q.size[0]*q.size[1]*q.size[2];
// The engine's halving of one mesh along a local axis, as in source fragmentation.
function halves(q,axis,times){
  let list=[q];
  for(let t=0;t<times;t++)list=list.flatMap(r=>{const [x,y,z]=r.rotation,a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z),m=[e*c,e*d*b-f*a,e*d*a+f*b,f*c,f*d*b+e*a,f*d*a-e*b,-d,c*b,c*a],s=r.size.slice();s[axis]/=2;return [-1,1].map(sign=>({...r,size:s.slice(),p:r.p.map((v,k)=>v+sign*m[k*3+axis]*s[axis]/2)}));});
  return list;
}
const slab=(extra={})=>({structural:true,sourceId:'wall-1',shape:'box',material:'stone',mat:3,p:[2,1.5,-6],size:[6,3,.2],rotation:[0,0,0],velocity:[0,.5,1],angularVelocity:[.3,.2,.1],seed:7,...extra});

test('Tiles of one broken mesh are joined, then cut into at most five large pieces',()=>{
  for(const rotation of [[0,0,0],[0,.7,0],[.2,1.1,-.3]]){
    const source=slab({rotation}),tiles=[...halves(source,0,3)].flatMap(q=>halves(q,1,2));assert.equal(tiles.length,32);
    const out=S.wreckage(tiles);assert(out.length>=2&&out.length<=5,'pieces '+out.length);
    assert(Math.abs(out.reduce((n,q)=>n+volume(q),0)-volume(source))<1e-6,'no material lost');
    assert(out.every(q=>q.fragmented&&q.size.every(v=>v<=4+1e-9)&&Math.max(...q.size)>=1.5),'large pieces under the rigid-body limit');
    assert(out.every(q=>q.mass>0&&q.mass<=160&&q.structural&&q.sourceId==='wall-1'));
  }
});

test('Chips are dropped, every object keeps a piece and an event stays small',()=>{
  const chips=Array.from({length:12},(_,i)=>({x:0,y:1,z:0,size:[.05,.04,.06],velocity:[1,2,0],life:1,seed:i}));
  assert.equal(S.wreckage(chips).length,0);
  const many=Array.from({length:30},(_,i)=>slab({sourceId:'crate-'+i,size:[.8,1.4,.8],p:[i*2,0.7,0]}));
  const out=S.wreckage([...chips,...many]);assert.equal(out.length,24,'one piece for each of the first 24 objects');
  const walls=Array.from({length:6},(_,i)=>slab({sourceId:'wall-'+i,p:[i*8,1.5,-6]}));
  const few=S.wreckage(walls);assert(few.length<=16&&new Set(few.map(q=>q.sourceId)).size===6);
  const tree=[{...slab({sourceId:'tree',shape:'cylinder',size:[.6,8,.6],material:'wood'})},...Array.from({length:22},(_,i)=>slab({sourceId:'tree',shape:'foliage',size:[1.2-i*.03,1,1.2-i*.03],p:[0,6+i*.1,0],material:'wood'}))];
  const t=S.wreckage(tree);assert(t.length<=5,'a tree breaks into a few pieces: '+t.length);assert(t.some(q=>q.shape==='cylinder'));
});

test('A grenade on real scenery leaves a few physical pieces, not a hundred fragments',()=>{
  const w=W.create(96,0,{campaign:true,campaignVersion:2,combatVersion:1,profiles:true}),sim=S.create(w,{});let worst=0,checked=0;
  for(const kind of ['tree','pipe','wall','support']){
    for(const g of w.destructibles.filter(d=>d.kind===kind).slice(0,3)){
      const m=w.meshes[g.meshes[0]],before=new Set(sim.state.debris);
      sim.state.projectiles.push({id:900+checked,kind:'grenade',owner:'player',x:m.p[0],y:m.p[1],z:m.p[2],vx:0,vy:0,vz:0,age:0,life:4,fuse:.001,radius:.17,blastRadius:3.6,damage:0,terrainPower:55,travel:0,bounces:0,resting:true});
      sim.step(.025);const fresh=sim.state.debris.filter(q=>!before.has(q));checked++;
      assert(fresh.every(q=>q.structural),'no chips from a break');worst=Math.max(worst,fresh.length);
      for(let i=0;i<20;i++)sim.step(.025);
    }
  }
  assert(checked>=8);assert(worst<=16,'worst event '+worst);sim.dispose?.();
});
