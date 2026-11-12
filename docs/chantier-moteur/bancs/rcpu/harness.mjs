// RCPU harness: real world + real simulation + game.js models() + FRender WebGL2 path on a counting no-op GL.
// Modules are evaluated in the MAIN realm (vm.runInThisContext with a wrapper on line 1) so that global
// lookups (Math, Float32Array...) do not go through vm-context interceptors and line numbers stay exact.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {patchRenderer} from './proto.mjs';

export const GLC = {calls:0,bufferData:0,bufferBytes:0,dynBytes:0,staticBytes:0,subData:0,subBytes:0,draws:0,instanced:0,instances:0,triangles:0,uniforms:0,attribPtr:0,binds:0};
export function resetGL(){for(const k in GLC)GLC[k]=0;}

const CONSTS='TEXTURE_2D FRAMEBUFFER ARRAY_BUFFER DEPTH_TEST CULL_FACE TRIANGLES STATIC_DRAW RENDERBUFFER POLYGON_OFFSET_FILL TEXTURE0 FLOAT DEPTH_BUFFER_BIT UNSIGNED_BYTE RGBA8 RGBA NONE NEAREST LINEAR ELEMENT_ARRAY_BUFFER DYNAMIC_DRAW DEPTH_COMPONENT24 DEPTH_ATTACHMENT COLOR_ATTACHMENT0 CLAMP_TO_EDGE BLEND VERTEX_SHADER UNSIGNED_SHORT UNSIGNED_INT TEXTURE2 TEXTURE1 TEXTURE_WRAP_T TEXTURE_WRAP_S TEXTURE_MIN_FILTER TEXTURE_MAG_FILTER SRC_ALPHA ONE_MINUS_SRC_ALPHA LINK_STATUS LEQUAL FRAGMENT_SHADER DEPTH_COMPONENT COLOR_BUFFER_BIT BACK COMPILE_STATUS STREAM_DRAW'.split(' ');
export function fakeGL(){
  const gl={};let n=100,id=0;
  for(const k of CONSTS)gl[k]=++n;
  gl.FRAMEBUFFER_COMPLETE=36053;gl.COLOR_BUFFER_BIT=16384;gl.DEPTH_BUFFER_BIT=256;
  const noop=()=>{GLC.calls++;};
  const fns='enable disable bindFramebuffer useProgram uniform1i bindTexture viewport deleteProgram bindVertexArray activeTexture texParameteri drawArrays enableVertexAttribArray deleteShader clear uniform4f texImage2D polygonOffset framebufferTexture2D drawBuffers depthMask deleteVertexArray deleteTexture deleteBuffer bindRenderbuffer attachShader vertexAttribDivisor uniform1fv uniform1f shaderSource renderbufferStorage readBuffer linkProgram framebufferRenderbuffer depthFunc deleteRenderbuffer deleteFramebuffer cullFace compileShader clearColor blendFunc pixelStorei scissor colorMask'.split(' ');
  for(const f of fns)gl[f]=noop;
  for(const f of ['createBuffer','createVertexArray','createFramebuffer','createTexture','createShader','createRenderbuffer','createProgram'])gl[f]=()=>{GLC.calls++;return {id:++id};};
  gl.getUniformLocation=(p,name)=>{GLC.calls++;return {name};};
  gl.getShaderParameter=gl.getProgramParameter=()=>{GLC.calls++;return true;};
  gl.getShaderInfoLog=gl.getProgramInfoLog=()=>'';
  gl.checkFramebufferStatus=()=>{GLC.calls++;return 36053;};
  gl.getExtension=()=>null;gl.getParameter=()=>4096;gl.isContextLost=()=>false;
  gl.uniform3fv=gl.uniform2f=gl.uniformMatrix4fv=()=>{GLC.calls++;GLC.uniforms++;};
  gl.bindBuffer=()=>{GLC.calls++;GLC.binds++;};
  gl.vertexAttribPointer=()=>{GLC.calls++;GLC.attribPtr++;};
  gl.bufferData=(target,data,usage)=>{GLC.calls++;GLC.bufferData++;const b=data&&data.byteLength||0;GLC.bufferBytes+=b;if(usage===gl.DYNAMIC_DRAW)GLC.dynBytes+=b;else GLC.staticBytes+=b;};
  gl.bufferSubData=(target,offset,data)=>{GLC.calls++;GLC.subData++;GLC.subBytes+=data&&data.byteLength||0;};
  gl.drawElementsInstanced=(mode,count,type,offset,instances)=>{GLC.calls++;GLC.draws++;GLC.instanced++;GLC.instances+=instances;GLC.triangles+=count/3*instances;};
  gl.drawArrays=()=>{GLC.calls++;GLC.draws++;};
  return gl;
}

// Per-line accumulators for renderer instrumentation (draw body lines 1534-1584 at commit 673d6b2).
export const PROF={lines:new Map(),inner:new Map(),slots:[0,1,2,3].map(()=>({calls:0,repacks:0,entries:0,repackEntries:0})),enabled:false};
let last=0,lastInner=0;const now=()=>performance.now();
const __R=()=>{last=now();};
const __L=line=>{const t=now();PROF.lines.set(line,(PROF.lines.get(line)||0)+t-last);last=t;};
const __B=()=>{lastInner=now();};
const __M=key=>{const t=now();PROF.inner.set(key,(PROF.inner.get(key)||0)+t-lastInner);lastInner=t;};
const __S=(slot,same,n)=>{const q=PROF.slots[slot];q.calls++;q.entries+=n;if(!same){q.repacks++;q.repackEntries+=n;}};
export function resetProf(){PROF.lines.clear();PROF.inner.clear();for(const q of PROF.slots)q.calls=q.repacks=q.entries=q.repackEntries=0;}

function instrumentRenderer(src){
  const L=src.split('\n');const at=n=>n-1;
  const must=(n,snippet)=>{if(!L[at(n)].includes(snippet))throw new Error('renderer line '+n+' changed: expected '+snippet);};
  must(1534,'if(disposed||stats.contextLost) return;');must(1545,'worldIndex.query(eye,ranges)');must(1576,'renderStatic(shown,0)');must(1411,'if(!same)');
  must(1436,'worldIndex.query(p,[32,18,0])');must(1457,'});');must(1415,'packEffects');
  L[at(1534)]='__R();'+L[at(1534)];
  for(let n=1535;n<=1584;n++){if(n===1539)continue;L[at(n)]+=';__L('+n+');';}
  L[at(1411)]+=';__S(slot,same,entries.length);';
  L[at(1423)]='__B();'+L[at(1423)];L[at(1435)]+=";__M(torchAxes?'torch.setup':'lamp.setup');";L[at(1436)]+=";__M(torchAxes?'torch.query':'lamp.query');";L[at(1438)]+=";__M(torchAxes?'torch.render':'lamp.render');";
  L[at(1441)]='__B();'+L[at(1441)];L[at(1453)]+=";__M('sun.setup');";L[at(1457)]+=";__M('sun.query');";L[at(1458)]+=";__M('sun.render');";
  L[at(1415)]='__B();'+L[at(1415)];L[at(1415)]+=";__M('fx.pack');";L[at(1420)]+=";__M('fx.render');";
  return L.join('\n');
}

export function loadModules(root,{instrument=false,proto=null,names=['renderer','world','destruction','economy','brain','simulation','actors','effects','motion']}={}){
  const win={innerWidth:1280,innerHeight:720,devicePixelRatio:2};
  for(const n of names){
    let src=readFileSync(root+'/src/'+n+'.js','utf8');
    if(n==='renderer'&&instrument)src=instrumentRenderer(src);
    if(n==='renderer'&&proto)src=patchRenderer(src,proto);
    const fn=vm.runInThisContext('(function(window,__L,__R,__S,__B,__M){'+src+'\n})',{filename:n+'.js'});
    fn(win,__L,__R,__S,__B,__M);
  }
  return win;
}

// game.js models() and helpers, lines 240 and 249..586 (commit 673d6b2), evaluated with explicit closure inputs.
export const GPROF={ms:new Map(),count:new Map(),frames:0};
let gLast=0,gLen=0;
const __GR=()=>{gLast=performance.now();gLen=0;GPROF.frames++;};
const __G=(line,len)=>{const t=performance.now();GPROF.ms.set(line,(GPROF.ms.get(line)||0)+t-gLast);GPROF.count.set(line,(GPROF.count.get(line)||0)+len-gLen);gLast=t;gLen=len;};
export function resetGProf(){GPROF.ms.clear();GPROF.count.clear();GPROF.frames=0;}
export function loadModels(root,env,{instrument=false}={}){
  const g=readFileSync(root+'/src/game.js','utf8').split('\n');
  if(instrument){g[418]='__GR();'+g[418];for(const n of [419,420,427,432,451,452,458,465,466,467,472,584])g[n-1]+=';__G('+n+',out.length);';}
  if(!g[239].includes('const m=(shape,p,s,mat'))throw new Error('game.js line 240 changed');
  if(!g[417].includes('function models(t,playing,camera)'))throw new Error('game.js line 418 changed');
  if(!g[586].includes('function renderHUD'))throw new Error('game.js line 587 changed');
  const body=[g[239],...g.slice(248,586)].join('\n');
  const factory=vm.runInThisContext('(function(env,__G,__GR){let {sim,world,quality,renderer,actorMotion,systemMotion,motion,leftMotion,prefs,clamp,FMotion,FActors,FEffects,window,innerWidth,innerHeight}=env;let shieldLift=0;\n'+body+'\nreturn {models,setShield(v){shieldLift=v;},setQuality(q){quality=q;}};})',{filename:'game-models.js'});
  return factory(env,__G,__GR);
}

export const timers={};
export function timed(name,fn){timers[name]={ms:0,calls:0,samples:[]};return function(...args){const t=performance.now();const r=fn.apply(this,args);const d=performance.now()-t;const q=timers[name];q.ms+=d;q.calls++;return r;};}

// Build a complete scene: world, simulation, renderer (fake WebGL2 or fake Canvas2D), game models.
export function scene(root,{world:spec=['camp',6],quality='auto',instrument=false,canvas2d=false,wrap=true,seed=96,proto=null}={}){
  const win=loadModules(root,{instrument,proto});
  const {FWorld,FSimulation,FBrain,FRender,FActors,FEffects,FMotion}=win;
  const t0=performance.now();
  const world=spec[0]==='camp'?FWorld.create(seed,spec[1],{campaign:true,campaignVersion:2}):FWorld.create(seed,spec[1]);
  const genMs=performance.now()-t0;
  let brain=null;try{brain=FBrain.create({mode:'cpu'});}catch{}
  const sim=FSimulation.create(world,{armorSystem:true,...(brain?{brain}:{})});sim.setDifficulty?.(0);
  const gl=fakeGL();
  const ctx2d=canvas2d?new Proxy({},{get(target,name){if(name in target)return target[name];return (...a)=>{GLC.calls++;return name.startsWith('create')?{addColorStop(){}}:undefined;};},set(t,k,v){t[k]=v;return true;}}):null;
  const canvas={width:300,height:150,clientWidth:1280,clientHeight:720,getContext:kind=>canvas2d?(kind==='2d'?ctx2d:null):gl,addEventListener(){},removeEventListener(){}};
  const renderer=FRender.create(canvas);renderer.resize(quality);
  const t1=performance.now();
  renderer.setWorld(sim.destruction?.meshes||world.meshes,sim.destruction?.lights||world.lights,world.environment);
  const setWorldMs=performance.now()-t1;
  let renderRevision=sim.state.destructionRevision??sim.destruction?.revision??-1;
  const motion=FMotion.create(),leftMotion=FMotion.create();
  const actorMotion=new Map(),systemMotion=new Map();
  const prefs={shadows:true,bloom:true,fov:74};
  const FA=wrap?{build:timed('actors.build',FActors.build)}:FActors;
  const FE=wrap?{build:timed('effects.build',FEffects.build),lights:FEffects.lights,flash:FEffects.flash}:FEffects;
  const R=wrap?Object.assign(Object.create(null),renderer,{actorFilter:timed('renderer.actorFilter',renderer.actorFilter)}):renderer;
  const game=loadModels(root,{sim,world,quality,renderer:R,actorMotion,systemMotion,motion,leftMotion,prefs,clamp:FSimulation.clamp,FMotion,FActors:FA,FEffects:FE,window:{FEffects:FE},innerWidth:1280,innerHeight:720},{instrument});
  const s=sim.state;
  // Give the bench player every weapon so explosions/destruction happen like in later worlds.
  if(s.inventory?.weapons){s.inventory.weapons.fill(true);if(s.inventory.ammo)s.inventory.ammo=s.inventory.ammo.map((v,i)=>[180,36,12,16,200][i]??v);}
  const input={moveX:0,moveY:1,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,weapon:0,sprint:true,assist:false};
  let frameIndex=0;
  // "tour": greedy nearest-neighbour route through every enemy start, relay and the exit (combat-heavy stress path).
  const stops=[...(world.enemies||[]).map(e=>[e.x,e.z]),...(world.cores||[]).map(c=>[c.x,c.z]),[world.exit.x,world.exit.z]];
  const route=[];{let cur=[world.spawn.x,world.spawn.z];const left=stops.slice();while(left.length){let bi=0,bd=Infinity;for(let k=0;k<left.length;k++){const d=Math.hypot(left[k][0]-cur[0],left[k][1]-cur[1]);if(d<bd){bd=d;bi=k;}}cur=left.splice(bi,1)[0];route.push(cur);}}
  let leg=0;
  const out={win,world,sim,renderer,game,gl,canvas,motion,genMs,setWorldMs,input,actorMotion,systemMotion,route};
  out.syncDestruction=()=>{const d=sim.destruction,revision=s.destructionRevision??d?.revision;if(!d||revision===renderRevision)return false;renderer.updateWorld(d.meshes,revision,d.lights);renderRevision=revision;return true;};
  // One 60 Hz frame: scripted input, sim.step, destruction sync, presentation springs, models(), draw().
  out.frame=(dt=1/60,{god=true,script=true,tour=false,speed=7,sweep=45}={})=>{
    const i=frameIndex++;
    if(tour){
      const p=s.player,w=route[leg%route.length],dx=w[0]-p.x,dz=w[1]-p.z,d=Math.hypot(dx,dz);
      if(d<1.5)leg++;else{const k=Math.min(1,speed*dt/d);p.x+=dx*k;p.z+=dz*k;const y=sim.ground(p.x,p.z);if(Number.isFinite(y))p.y=y;}
      input.moveX=0;input.moveY=0;input.sprint=false;input.fire=(i%30)<12;input.dash=false;input.weapon=[0,2,1,3][Math.floor(i/300)%4];
      p.yaw=Math.atan2(dx,-dz)+Math.sin(i/sweep)*.9;p.pitch=Math.sin(i/70)*.12;
    }else if(script){input.moveX=Math.sin(i/90);input.moveY=1;input.fire=(i%20)<6;input.dash=(i%240)===0;input.weapon=[0,2,1,3][Math.floor(i/300)%4];input.sprint=true;s.player.yaw+=0.01;s.player.pitch=Math.sin(i/70)*.12;}
    const ts=performance.now();sim.step(dt,input);input.lookX=input.lookY=0;input.dash=false;
    for(const e of s.events||[]){if(e.name==='shot'||e.name==='fracture')motion.impulse(e.name==='shot'?'shot':'fracture');}
    if(god&&s.player.hp<50)s.player.hp=100;
    const simMs=performance.now()-ts;
    const tu=performance.now();const changed=out.syncDestruction();const updateMs=performance.now()-tu;
    for(const e of s.enemies){const scale=e.type===3?Math.max(1,Number(e.bossScale)||1):1;if(e.deployed===false||e.hp<=0||(e.type!==1&&e.type!==2&&e.type!==3)||(e.x-s.player.x)**2+(e.z-s.player.z)**2>(scale>1?140:40)**2){actorMotion.delete(e.id);continue;}const pose=actorMotion.get(e.id)||{phase:e.id*.7,blend:0};pose.phase=(pose.phase+(e.moveSpeed||0)*dt*4.8/scale)%(Math.PI*2);pose.blend+=(Math.min(1,(e.moveSpeed||0)/.9)-pose.blend)*(1-Math.exp(-dt*15));actorMotion.set(e.id,pose);}
    const p=s.player,signals={time:s.time,lookYaw:.6,lookPitch:0,firing:input.fire};
    const view=motion.update(dt,s.locomotion||{},signals,true);leftMotion.update(dt,s.locomotion||{},{...signals,firing:false},true);
    const camera={pos:[p.x,(p.y||0)+1.62+view.height,p.z],yaw:p.yaw,pitch:p.pitch,roll:view.roll,fov:prefs.fov+view.fov};
    const tm=performance.now();const dynamic=game.models(s.time,true,camera);const modelsMs=performance.now()-tm;
    const tl=performance.now();const lights=FEffects.lights(s);const lightsMs=performance.now()-tl;
    const fx={time:s.time,flash:Math.max(s.flash||0,s.leftFlash||0),lights,damage:s.damage,pulse:0,shake:0,frameMs:16.7,shadows:prefs.shadows,bloom:prefs.bloom,horror:s.director,adaptive:false};
    const td=performance.now();renderer.draw(camera,dynamic,fx);const drawMs=performance.now()-td;
    return {i,simMs,updateMs,changed,modelsMs,lightsMs,drawMs,dynamic:dynamic.length,camera,list:dynamic,fx};
  };
  return out;
}

export function stats(a){const v=a.slice().sort((x,y)=>x-y),q=p=>v[Math.min(v.length-1,Math.floor(v.length*p))];const mean=v.reduce((x,y)=>x+y,0)/v.length;return {mean:+mean.toFixed(3),p50:+q(.5).toFixed(3),p95:+q(.95).toFixed(3),p99:+q(.99).toFixed(3),max:+v[v.length-1].toFixed(3)};}
