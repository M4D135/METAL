import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Override only to reproduce the regression against an exact historical blob.
const source=readFileSync(process.env.METAL_CAMERA_SOURCE||new URL('../src/camera.js',import.meta.url),'utf8');
const context={};vm.runInNewContext(source,context,{filename:'camera.js'});
const {MetalCamera}=context;
const player={x:0,y:0,z:0,yaw:0,pitch:0},open=(o,d,far)=>far;
function walls(list){return (o,d,far)=>{let best=far;for(const q of list){let lo=0,hi=best;for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-9){if(o[k]<q.min[k]||o[k]>q.max[k]){hi=-1;break;}}else{let a=(q.min[k]-o[k])/d[k],c=(q.max[k]-o[k])/d[k];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)break;}}if(hi>=lo&&lo>=0&&lo<best)best=lo;}return best;};}
const near=walls([{min:[-5,-1,.5],max:[5,5,.7]}]);
const middle=walls([{min:[-5,-1,1.5],max:[5,5,1.7]}]);
function settle(c,p=player,ray=open,options={}){let f;for(let i=0;i<180;i++)f=c.frame(p,ray,1/60,options);return f;}
const direction=(yaw,pitch)=>[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
const same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));

// Existing camera behaviour, tested without loading unrelated avatar/mesh code.
test('first-person eye and ordinary mode transitions retain their positions and single easing',()=>{
  const c=MetalCamera.create();c.reset(false);
  let f=settle(c);same(f.pos,[0,1.62,0]);assert.equal(f.thirdPerson,false);
  c.set(true);f=c.frame(player,open,1/60);assert(f.distance>0&&f.distance<3.2);assert.equal(f.clearance,f.distance);
  f=settle(c);assert(f.thirdPerson);assert.equal(f.distance,3.2);assert(f.pos[2]>3.1&&f.pos[0]>.7&&f.pos[1]>2);
  c.set(false);f=settle(c);assert.equal(f.distance,0);assert.equal(f.thirdPerson,false);
});
test('third-person crosshair follows the firing ray without changing player state',()=>{
  const wall=walls([{min:[-60,-5,-26],max:[60,40,-25]}]);
  for(const [yaw,pitch] of [[0,0],[.7,.2],[-.4,-.35],[2.6,.5]]){
    const c=MetalCamera.create(),p={x:2,y:1,z:-3,yaw,pitch},before={...p};c.reset(true);
    const f=settle(c,p,wall);assert(f.thirdPerson);same(p,before);
    const eye=[p.x,p.y+1.62,p.z],aim=direction(yaw,pitch),reach=Math.min(120,wall(eye,aim,120));
    const target=eye.map((v,k)=>v+aim[k]*Math.max(5,reach)),toward=target.map((v,k)=>v-f.pos[k]),length=Math.hypot(...toward),view=direction(f.yaw,f.pitch);
    assert(toward.reduce((n,v,k)=>n+v/length*view[k],0)>1-1e-6);
  }
});
test('back and shoulder sweeps keep the camera on the player side of walls',()=>{
  const c=MetalCamera.create();c.reset(true);
  let f=settle(c,player,middle);assert(f.thirdPerson);assert(f.pos[2]<1.5);assert(f.clearance<1.5);
  f=settle(c,player,near);assert.equal(f.thirdPerson,false);
  f=settle(c);assert(f.thirdPerson);
  f=settle(c,player,walls([{min:[.4,-1,-5],max:[.6,5,5]}]));assert(f.thirdPerson);assert(f.pos[0]<.4);
});
test('looking up respects the ground clearance',()=>{
  const c=MetalCamera.create();c.reset(true);assert(settle(c,{...player,pitch:1.1},open,{ground:()=>0}).pos[1]>=.3-1e-9);
});
test('drone follow rig remains centred and closer than the heavy',()=>{
  const c=MetalCamera.create();c.reset(true);const f=settle(c,player,open,{profile:'light'});
  assert(f.thirdPerson);assert(Math.abs(f.pos[0])<1e-9);assert.equal(f.distance,2.7);
});

for(const profile of ['heavy','light']){
  test(profile+': removing a wall eases the camera out instead of teleporting',()=>{
    const c=MetalCamera.create(),options={profile};c.reset(true);const a=settle(c,player,near,options);
    const b=c.frame(player,open,1/60,options),limit=MetalCamera.rigs[profile].distance;
    assert(b.clearance>a.clearance);assert(b.clearance<limit-.1,'no one-frame return to the full boom');
    assert(Math.abs(b.clearance-(a.clearance+(limit-a.clearance)*(1-Math.exp(-12/60))))<1e-12);
    assert.equal(settle(c,player,open,options).clearance,limit);
  });
  test(profile+': inward obstruction remains immediate while recovery is active',()=>{
    const c=MetalCamera.create(),options={profile};c.reset(true);settle(c,player,near,options);
    for(let i=0;i<10;i++)c.frame(player,open,1/60,options);
    const f=c.frame(player,near,1/60,options);assert(f.clearance<=.32+1e-12);assert.equal(f.thirdPerson,false);
  });
}
test('outward recovery is independent of 20/60/120 Hz at equal elapsed time',()=>{
  const values=[];
  for(const hz of [20,60,120]){
    const c=MetalCamera.create();c.reset(true);const a=settle(c,player,near);let f;
    for(let i=0;i<hz/4;i++)f=c.frame(player,open,1/hz);
    const expected=3.2-(3.2-a.clearance)*Math.exp(-12*.25);assert(Math.abs(f.clearance-expected)<1e-12);values.push(f.clearance);
  }
  assert(Math.max(...values)-Math.min(...values)<1e-12);
});
test('zero elapsed time does not advance outward recovery',()=>{
  const c=MetalCamera.create();c.reset(true);const a=settle(c,player,near),b=c.frame(player,open,0);
  assert.equal(a.clearance,b.clearance);
});
test('negative elapsed time does not advance recovery',()=>{
  const c=MetalCamera.create();c.reset(true);const a=settle(c,player,near);assert.equal(c.frame(player,open,-1).clearance,a.clearance);
});
test('a closing wall retracts even when elapsed time is zero',()=>{
  const c=MetalCamera.create();c.reset(true);settle(c);assert(c.frame(player,near,0).clearance<=.32+1e-12);
});
test('reset discards collision recovery from the preceding view',()=>{
  const c=MetalCamera.create();c.reset(true);settle(c,player,near);c.reset(true);assert.equal(c.frame(player,open,0).clearance,3.2);
  c.reset(false);same(c.frame(player,open,0).pos,[0,1.62,0]);
});
test('returning to first person during recovery never leaves a stale boom',()=>{
  const c=MetalCamera.create();c.reset(true);settle(c,player,near);c.frame(player,open,1/60);c.set(false);
  const f=settle(c);assert.equal(f.clearance,0);same(f.pos,[0,1.62,0]);
});
test('moving obstacles never let the recovering eye exceed the current clearance',()=>{
  const c=MetalCamera.create();c.reset(true);settle(c,player,near);
  let previous=.32;
  for(let i=0;i<600;i++){
    const wallZ=.25+Math.abs(Math.sin(i*.031))*4,ray=walls([{min:[-5,-5,wallZ],max:[5,5,wallZ+.2]}]);
    const f=c.frame(player,ray,[1/20,1/60,1/120][i%3]),bound=Math.min(3.2,wallZ-.18);
    assert(f.clearance>=0&&f.clearance<=bound+1e-12);
    if(bound<previous)assert(Math.abs(f.clearance-bound)<1e-12,'inward motion is not eased');previous=f.clearance;
  }
});
test('visibility hysteresis prevents flicker in the ambiguous clearance band',()=>{
  const c=MetalCamera.create();c.reset(true);settle(c,player,near);
  const wall=walls([{min:[-5,-1,.98],max:[5,5,1.2]}]);
  assert.equal(settle(c,player,wall).thirdPerson,false);
  settle(c);assert.equal(settle(c,player,wall).thirdPerson,true);
});
test('retained output positions are not reused or mutated by later frames',()=>{
  const c=MetalCamera.create();c.reset(true);const a=settle(c),saved=Array.from(a.pos),b=c.frame({...player,x:100,yaw:1},open,1/60);
  assert.notEqual(a.pos,b.pos);same(a.pos,saved);
});
test('separate cameras do not share collision recovery',()=>{
  const a=MetalCamera.create(),b=MetalCamera.create();a.reset(true);b.reset(true);settle(a,player,near);
  assert.equal(b.frame(player,open,0).clearance,3.2);assert(a.frame(player,open,1/60).clearance<3.2);
});
test('actor range callback keeps its unit aim and origin contract',()=>{
  const c=MetalCamera.create(),p={...player,x:2,y:3,z:4,yaw:.3,pitch:.2};c.reset(true);let calls=0;
  const f=settle(c,p,open,{actorRange:(o,d,far)=>{calls++;same(o,[2,4.62,4]);assert(Math.abs(Math.hypot(...d)-1)<1e-12);assert.equal(far,120);return 8;}});
  assert(calls>0);assert(Math.abs(f.range-8)<1e-9);
});
test('unknown profile retains the heavy fallback',()=>{
  const a=MetalCamera.create(),b=MetalCamera.create();a.reset(true);b.reset(true);
  same(settle(a,player,open,{profile:'unknown'}),settle(b));
});
