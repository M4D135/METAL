// Re-creates ground() inside the same vm context with the same floors/traps and times variants.
import vm from 'node:vm';import {load,SCENARIOS,build} from './lib.mjs';
const ctx=load();const [label,idx,opts]=SCENARIOS[+process.argv[2]||0];const {world,sim}=build(ctx,idx,opts);
ctx.__world=world;ctx.__traps=sim.state.traps;
const code=`(()=>{
const world=__world,floors=world.walkable;let trapStates=__traps;
const floorGX=Math.floor(world.bounds.minX/8),floorGZ=Math.floor(world.bounds.minZ/8),floorGW=Math.floor(world.bounds.maxX/8)-floorGX+1,floorGD=Math.floor(world.bounds.maxZ/8)-floorGZ+1;
const floorBuckets=Array.from({length:floorGW*floorGD},()=>[]);
for(const f of floors){const x0=Math.max(0,Math.floor((f.x-f.w/2-1e-7)/8)-floorGX),x1=Math.min(floorGW-1,Math.floor((f.x+f.w/2+1e-7)/8)-floorGX),z0=Math.max(0,Math.floor((f.z-f.d/2-1e-7)/8)-floorGZ),z1=Math.min(floorGD-1,Math.floor((f.z+f.d/2+1e-7)/8)-floorGZ);for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)floorBuckets[z*floorGW+x].push(f);}
function ground(x,z,activeTraps=trapStates){
  if(!floors.length)return 0;
  let y=-Infinity,flat=-Infinity,fallback=-Infinity;
  const gx=Math.floor(x/8)-floorGX,gz=Math.floor(z/8)-floorGZ,local=gx>=0&&gx<floorGW&&gz>=0&&gz<floorGD?floorBuckets[gz*floorGW+gx]:floors;
  for(const f of local)if(Math.abs(x-f.x)<=f.w/2+1e-7&&Math.abs(z-f.z)<=f.d/2+1e-7){
    const h=(f.y||0)+(x-f.x)*(f.slopeX||0)+(z-f.z)*(f.slopeZ||0);
    if(f.substrate||f.fallback)fallback=Math.max(fallback,h);else if(!f.slopeX&&!f.slopeZ)flat=Math.max(flat,h);else y=Math.max(y,h);
  }
  let result=Number.isFinite(flat)?flat:Number.isFinite(y)?y:fallback;
  for(const t of activeTraps)if(t.kind==='floor'&&Math.abs(x-t.x)<t.w/2&&Math.abs(z-t.z)<t.d/2&&Math.abs(result-t.y)<.1)result=t.y-(t.travel||.85)*t.progress;
  return result;
}
function groundNoTraps(x,z){
  if(!floors.length)return 0;
  let y=-Infinity,flat=-Infinity,fallback=-Infinity;
  const gx=Math.floor(x/8)-floorGX,gz=Math.floor(z/8)-floorGZ,local=gx>=0&&gx<floorGW&&gz>=0&&gz<floorGD?floorBuckets[gz*floorGW+gx]:floors;
  for(const f of local)if(Math.abs(x-f.x)<=f.w/2+1e-7&&Math.abs(z-f.z)<=f.d/2+1e-7){
    const h=(f.y||0)+(x-f.x)*(f.slopeX||0)+(z-f.z)*(f.slopeZ||0);
    if(f.substrate||f.fallback)fallback=Math.max(fallback,h);else if(!f.slopeX&&!f.slopeZ)flat=Math.max(flat,h);else y=Math.max(y,h);
  }
  return Number.isFinite(flat)?flat:Number.isFinite(y)?y:fallback;
}
// Uniform-shape copies (one hidden class), same arithmetic.
const uni=floors.map(f=>({x:f.x,z:f.z,hw:f.w/2+1e-7,hd:f.d/2+1e-7,y:f.y||0,sx:f.slopeX||0,sz:f.slopeZ||0,kind:f.substrate||f.fallback?2:(!f.slopeX&&!f.slopeZ)?0:1}));
const uniBuckets=floorBuckets.map(l=>l.map(f=>uni[floors.indexOf(f)]));
function groundUniform(x,z){
  let y=-Infinity,flat=-Infinity,fallback=-Infinity;
  const gx=Math.floor(x/8)-floorGX,gz=Math.floor(z/8)-floorGZ,local=gx>=0&&gx<floorGW&&gz>=0&&gz<floorGD?uniBuckets[gz*floorGW+gx]:uni;
  for(let i=0;i<local.length;i++){const f=local[i];if(Math.abs(x-f.x)<=f.hw&&Math.abs(z-f.z)<=f.hd){
    const h=f.y+(x-f.x)*f.sx+(z-f.z)*f.sz;
    if(f.kind===2)fallback=Math.max(fallback,h);else if(f.kind===0)flat=Math.max(flat,h);else y=Math.max(y,h);
  }}
  return Number.isFinite(flat)?flat:Number.isFinite(y)?y:fallback;
}
function only(x,z){const gx=Math.floor(x/8)-floorGX,gz=Math.floor(z/8)-floorGZ;return gx>=0&&gx<floorGW&&gz>=0&&gz<floorGD?floorBuckets[gz*floorGW+gx].length:0;}
return {ground,groundNoTraps,groundUniform,only};})()`;
const F=vm.runInContext(code,ctx);const b=world.bounds,N=1e6;ctx.__xs=new Float64Array(N);ctx.__zs=new Float64Array(N);
let seed=12345;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296;};
for(let i=0;i<N;i++){ctx.__xs[i]=b.minX+rnd()*(b.maxX-b.minX);ctx.__zs[i]=b.minZ+rnd()*(b.maxZ-b.minZ);}
ctx.__F=F;ctx.__sim=sim;
const timer=name=>vm.runInContext(`(()=>{const g=${name};let acc=0;for(let i=0;i<2e5;i++)acc+=g(__xs[i],__zs[i]);const r=[];for(let k=0;k<5;k++){const t=performance.now();for(let i=0;i<__xs.length;i++)acc+=g(__xs[i],__zs[i]);r.push((performance.now()-t)/__xs.length*1e6);}r.sort((a,b)=>a-b);return [r[2],acc];})()`,ctx);
for(const name of ['__sim.ground','__F.ground','__F.groundNoTraps','__F.groundUniform','__F.only']){const [ns,acc]=timer(name);console.log(label,name.padEnd(20),ns.toFixed(1)+' ns/call','checksum',acc.toFixed(2));}
