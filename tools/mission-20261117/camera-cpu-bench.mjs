import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import vm from 'node:vm';

const opts={baseline:null,candidate:resolve('src/camera.js'),frames:20000,reps:9,warmups:3};
for(let i=2;i<process.argv.length;i++){
  const key=process.argv[i].replace(/^--/,'');
  if(!Object.hasOwn(opts,key)||i+1>=process.argv.length)throw Error('Usage: node camera-cpu-bench.mjs --baseline PATH [--candidate PATH --frames N --reps N --warmups N]');
  opts[key]=process.argv[++i];
}
if(!opts.baseline)throw Error('--baseline PATH is required');
for(const key of ['frames','reps','warmups']){
  opts[key]=Number(opts[key]);
  if(!Number.isSafeInteger(opts[key])||opts[key]<(key==='warmups'?0:1)||opts[key]>(key==='frames'?1000000:100))throw Error('Invalid '+key);
}
function load(path){const context={Math};vm.runInNewContext(readFileSync(path,'utf8'),context,{filename:path});return context.MetalCamera;}
const apis=[load(opts.baseline),load(opts.candidate)],normal=value=>JSON.parse(JSON.stringify(value));
const median=xs=>{const a=xs.slice().sort((x,y)=>x-y),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;};
const open=(o,d,far)=>far;
let equivalent=0,callbackChecks=0;
// Both cameras receive identical inputs. Dynamic obstacle release is deliberately
// excluded here: that is the behaviour corrected by camera-recovery.test.mjs.
for(const profile of ['heavy','light'])for(const third of [false,true]){
  const cameras=apis.map(api=>api.create());for(const c of cameras)c.reset(third);
  for(let i=0;i<2500;i++){
    if(i%250===0)for(const c of cameras)c.set((i/250)%2===0?third:!third);
    const p={x:Math.sin(i*.01)*3,y:Math.cos(i*.07),z:Math.cos(i*.02)*5,yaw:i*.017,pitch:Math.sin(i*.03)};
    const traces=[[],[]],options={profile,ground:()=>-10},dt=[1/20,1/60,1/120][i%3];
    const frames=cameras.map((c,index)=>c.frame(p,(o,d,far)=>{traces[index].push([Array.from(o),Array.from(d),far]);return far;},dt,options));
    assert.deepEqual(normal(frames[0]),normal(frames[1]),'free motion output differs');
    assert.deepEqual(normal(traces[0]),normal(traces[1]),'callback arguments/order differ');
    equivalent++;callbackChecks+=traces[0].length;
  }
}
// Static backward obstruction: scalar arithmetic must preserve its clearance.
for(const limit of [.2,.5,1.5,3]){
  const cameras=apis.map(api=>api.create());for(const c of cameras)c.reset(true);
  const ray=(o,d,far)=>d[2]>.9?Math.min(limit,far):far,p={x:0,y:0,z:0,yaw:0,pitch:0};
  for(let i=0;i<1000;i++){
    const frames=cameras.map(c=>c.frame(p,ray,1/60));
    assert.deepEqual(normal(frames[0]),normal(frames[1]),'static obstacle output differs');equivalent++;
  }
}
const cases=[{name:'first-person',third:false,profile:'heavy'},{name:'heavy-third-person',third:true,profile:'heavy'},{name:'drone-third-person',third:true,profile:'light'}];
const report={node:process.version,platform:process.platform,arch:process.arch,frames:opts.frames,reps:opts.reps,warmups:opts.warmups,equivalentFrames:equivalent,callbackChecks,kind:'camera CPU microbenchmark, no rendering or game FPS',results:[]};
function sample(api,q){
  const camera=api.create(),player={x:3,y:2,z:-5,yaw:.7,pitch:.2},options={profile:q.profile};camera.reset(q.third);
  for(let i=0;i<180;i++)camera.frame(player,open,1/60,options);
  let checksum=0;const cpu=process.cpuUsage(),start=performance.now();
  for(let i=0;i<opts.frames;i++){
    player.yaw=.7+(i%480)*.001;
    const frame=camera.frame(player,open,1/60,options);checksum+=frame.pos[0]+frame.pos[1]+frame.pos[2]+frame.yaw+frame.pitch;
  }
  const wallMs=performance.now()-start,used=process.cpuUsage(cpu);return {wallMs,cpuMs:(used.user+used.system)/1000,checksum};
}
for(const q of cases){
  for(let i=0;i<opts.warmups;i++)for(const api of apis)sample(api,q);
  const samples=[[],[]];
  for(let i=0;i<opts.reps;i++)for(const index of (i%2?[1,0]:[0,1]))samples[index].push(sample(apis[index],q));
  const checksum=samples[0][0].checksum;for(const runs of samples)for(const result of runs)assert.equal(result.checksum,checksum,'benchmark states differ');
  const variants=samples.map(runs=>({medianCPUms:median(runs.map(r=>r.cpuMs)),medianWallMs:median(runs.map(r=>r.wallMs)),samples:runs}));
  report.results.push({scenario:q.name,variants,cpuDeltaPercent:variants[0].medianCPUms>0?100*(variants[1].medianCPUms/variants[0].medianCPUms-1):null});
}
console.log(JSON.stringify(report,null,2));
