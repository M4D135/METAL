import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const context={};vm.createContext(context);
vm.runInContext(readFileSync(fileURLToPath(new URL('../src/motion.js',import.meta.url)),'utf8'),context);
const M=context.FMotion,close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,a+' != '+b);
const moving={speed:5,forward:4,strafe:2,stridePhase:1.2,moveBlend:1,sprintBlend:.7,dashBlend:.2,accelForward:3};
function sequence(fps){
  const motion=M.create();
  for(let i=0;i<fps;i++){if(i===fps/2)motion.impulse('fracture');motion.update(1/fps,moving,{time:0,lookYaw:1.5,lookPitch:.8},true);}
  return JSON.parse(JSON.stringify(motion.view));
}
test('Presentation damping and recoil have the same result at 20, 60 and 120 FPS',()=>{
  const a=sequence(20),b=sequence(60),c=sequence(120);
  for(const v of [b,c]){
    for(const key of ['height','roll','fov'])close(a[key],v[key]);
    for(const key of ['offset','rotation'])for(let i=0;i<3;i++)close(a.weapon[key][i],v.weapon[key][i]);
  }
});
test('Walking animation settles after actual movement stops, even with a retained stride phase',()=>{
  const motion=M.create();
  for(let i=0;i<60;i++)motion.update(1/60,moving,{time:0},true);
  for(let i=0;i<60;i++)motion.update(1/60,{speed:0,stridePhase:1.2,moveBlend:0},{time:0},true);
  assert.ok(Math.abs(motion.view.height)<.00001);assert.ok(Math.abs(motion.view.roll)<.00001);
  assert.ok(motion.view.weapon.offset.every(v=>Math.abs(v)<.00001));
  assert.ok(motion.view.weapon.rotation.every(v=>Math.abs(v)<.00001));
});
test('Reduced motion fixes camera height, horizon and field of view immediately',()=>{
  const motion=M.create();
  for(let i=0;i<30;i++)motion.update(1/60,moving,{time:3,lookYaw:8},true);
  assert.ok(motion.view.fov>1);
  motion.update(0,moving,{time:3,lookYaw:8},false);
  assert.equal(motion.view.height,0);assert.equal(motion.view.roll,0);assert.equal(motion.view.fov,0);
});
test('Recoil moves the weapon, stays bounded and returns to rest without moving the aim',()=>{
  const motion=M.create();motion.impulse('fracture');let peak=0;
  for(let i=0;i<120;i++){
    const v=motion.update(1/120,{}, {time:0},true);
    peak=Math.max(peak,v.weapon.offset[2]);
    assert.equal(v.roll,0);assert.equal(v.height,0);assert.equal(v.fov,0);
    assert.ok(v.weapon.offset.every(Number.isFinite));
  }
  assert.ok(peak>.03&&peak<.065);
  assert.ok(Math.abs(motion.view.weapon.offset[2])<.000001);
});
test('Run and dash field-of-view transitions are progressive and bounded',()=>{
  const motion=M.create(),loc={...moving,sprintBlend:1,dashBlend:1};
  const first=motion.update(1/60,loc,{},true).fov;
  assert.ok(first>0&&first<1);
  for(let i=0;i<120;i++){const v=motion.update(1/60,loc,{},true);assert.ok(v.fov<=10.00001);}
  assert.ok(motion.view.fov>9.99);
  motion.reset();assert.equal(motion.view.fov,0);assert.ok(motion.view.weapon.offset.every(v=>v===0));
});
test('Weapon mount follows the rolled camera and preserves local assembly distances',()=>{
  const camera={pos:[5,1.62,10],yaw:0,pitch:0,roll:Math.PI/2};
  const mount=M.mount(camera,[.2,-.3,-.5]),a=M.place(mount,[0,0,0]),b=M.place(mount,[.12,0,-.4],Math.PI/2);
  [5.3,1.82,9.5].forEach((v,i)=>close(a.p[i],v));
  close(Math.hypot(...a.p.map((v,i)=>b.p[i]-v)),Math.hypot(.12,.4));
  close(a.r[2],Math.PI/2);close(b.r[0],Math.PI/2);close(b.r[2],Math.PI/2);
});
test('Arbitrary yaw/pitch/roll mounts remain orthonormal, including the Euler singularity',()=>{
  for(const yaw of [-Math.PI/2,0,Math.PI/2,2.7]){
    const frame=M.mount({pos:[1,2,3],yaw,pitch:.41,roll:.018},[.2,-.3,-.5],[.07,-.02,.03]);
    for(let i=0;i<3;i++){
      close(Math.hypot(...frame.axes[i]),1);
      for(let j=i+1;j<3;j++)close(frame.axes[i].reduce((s,v,k)=>s+v*frame.axes[j][k],0),0);
    }
    const item=M.place(frame,[.1,0,-.3],Math.PI/2);
    assert.ok(item.p.every(Number.isFinite));assert.ok(item.r.every(Number.isFinite));
  }
});

test('Rocket recoil and nearby blast settle, with all camera shake disabled by reduced motion',()=>{
  const motion=M.create(),loc={};motion.impulse('rocket');motion.impulse('blast',1);let kick=0,shake=0;
  for(let i=0;i<120;i++){const v=motion.update(1/60,loc,{time:i/60},true);kick=Math.max(kick,v.weapon.offset[2]);shake=Math.max(shake,Math.abs(v.height)+Math.abs(v.roll));assert(v.weapon.offset.every(Number.isFinite));}
  assert(kick>.065&&kick<.10);assert(shake>0&&shake<.02);assert(Math.abs(motion.view.weapon.offset[2])<1e-8);
  motion.impulse('blast',1);const reduced=motion.update(1/60,moving,{time:1},false);assert.equal(reduced.height,0);assert.equal(reduced.roll,0);assert.equal(reduced.fov,0);
});
