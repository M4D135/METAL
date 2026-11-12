// Full-frame scene (sim.step + destruction sync + game.js models() + FRender.draw on a counting fake WebGL2),
// same chain as bench/rcpu/harness.mjs scene(), but every module can be the cumulative patched build.
import {fakeGL,loadModels,GLC,resetGL} from '../rcpu/harness.mjs';
import {loadAll,ROOT} from './build.mjs';
export {GLC,resetGL};
export function scene({variant='r1',world:spec=['camp',6],quality='auto',seed=96,simSpec,rendererSpec,patches={},hooks={},modelsRoot=ROOT,gameHook=null}={}){
  const r1=variant==='r1';
  const win=loadAll({sim:simSpec!==undefined?simSpec:(r1?{}:null),renderer:rendererSpec!==undefined?rendererSpec:(r1?{}:null),patches,hooks});
  const {FWorld,FSimulation,FBrain,FRender,FActors,FEffects,FMotion}=win;
  const world=spec[0]==='camp'?FWorld.create(seed,spec[1],{campaign:true,campaignVersion:2}):FWorld.create(seed,spec[1]);
  let brain=null;try{brain=FBrain.create({mode:'cpu'});}catch{}
  const sim=FSimulation.create(world,{armorSystem:true,...(brain?{brain}:{})});sim.setDifficulty?.(0);
  const gl=fakeGL();
  const canvas={width:300,height:150,clientWidth:1280,clientHeight:720,getContext:()=>gl,addEventListener(){},removeEventListener(){}};
  const renderer=FRender.create(canvas);renderer.resize(quality);
  renderer.setWorld(sim.destruction?.meshes||world.meshes,sim.destruction?.lights||world.lights,world.environment);
  let renderRevision=sim.state.destructionRevision??sim.destruction?.revision??-1;
  const motion=FMotion.create(),leftMotion=FMotion.create(),actorMotion=new Map(),systemMotion=new Map(),prefs={shadows:true,bloom:true,fov:74};
  const env={sim,world,quality,renderer,actorMotion,systemMotion,motion,leftMotion,prefs,clamp:FSimulation.clamp,FMotion,FActors,FEffects,window:{FEffects},innerWidth:1280,innerHeight:720};
  if(gameHook)gameHook(env,win);
  const game=loadModels(modelsRoot,env,{});
  const s=sim.state;
  if(s.inventory?.weapons){s.inventory.weapons.fill(true);if(s.inventory.ammo)s.inventory.ammo=s.inventory.ammo.map((v,i)=>[180,36,12,16,200][i]??v);}
  const input={moveX:0,moveY:1,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,weapon:0,sprint:true,assist:false};
  let frameIndex=0,leg=0;
  const stops=[...(world.enemies||[]).map(e=>[e.x,e.z]),...(world.cores||[]).map(c=>[c.x,c.z]),[world.exit.x,world.exit.z]];
  const route=[];{let cur=[world.spawn.x,world.spawn.z];const left=stops.slice();while(left.length){let bi=0,bd=Infinity;for(let k=0;k<left.length;k++){const d=Math.hypot(left[k][0]-cur[0],left[k][1]-cur[1]);if(d<bd){bd=d;bi=k;}}cur=left.splice(bi,1)[0];route.push(cur);}}
  const out={win,world,sim,renderer,game,gl,canvas,motion,input,actorMotion,systemMotion,route,env};
  out.syncDestruction=()=>{const d=sim.destruction,revision=s.destructionRevision??d?.revision;if(!d||revision===renderRevision)return false;renderer.updateWorld(d.meshes,revision,d.lights);renderRevision=revision;return true;};
  const T={sim:0,update:0,pose:0,models:0,lights:0,draw:0};out.T=T;
  // phase A: input + sim.step; phase B: presentation (poses, models, lights, draw). Split so two scenes can be interleaved.
  out.simPhase=(dt=1/60,{speed=7,sweep=45}={})=>{
    const i=frameIndex++,p=s.player,w=route[leg%route.length],dx=w[0]-p.x,dz=w[1]-p.z,d=Math.hypot(dx,dz);
    if(d<1.5)leg++;else{const k=Math.min(1,speed*dt/d);p.x+=dx*k;p.z+=dz*k;const y=sim.ground(p.x,p.z);if(Number.isFinite(y))p.y=y;}
    input.moveX=0;input.moveY=0;input.sprint=false;input.fire=(i%30)<12;input.dash=false;input.weapon=[0,2,1,3][Math.floor(i/300)%4];
    p.yaw=Math.atan2(dx,-dz)+Math.sin(i/sweep)*.9;p.pitch=Math.sin(i/70)*.12;
    const t=performance.now();sim.step(dt,input);const ms=performance.now()-t;T.sim+=ms;input.lookX=input.lookY=0;
    for(const e of s.events||[]){if(e.name==='shot'||e.name==='fracture')motion.impulse(e.name==='shot'?'shot':'fracture');}
    if(s.player.hp<50)s.player.hp=100;
    return ms;
  };
  out.viewPhase=(dt=1/60)=>{
    let t=performance.now();const changed=out.syncDestruction();const updateMs=performance.now()-t;T.update+=updateMs;
    t=performance.now();
    for(const e of s.enemies){const scale=e.type===3?Math.max(1,Number(e.bossScale)||1):1;if(e.deployed===false||e.hp<=0||(e.type!==1&&e.type!==2&&e.type!==3)||(e.x-s.player.x)**2+(e.z-s.player.z)**2>(scale>1?140:40)**2){actorMotion.delete(e.id);continue;}const pose=actorMotion.get(e.id)||{phase:e.id*.7,blend:0};pose.phase=(pose.phase+(e.moveSpeed||0)*dt*4.8/scale)%(Math.PI*2);pose.blend+=(Math.min(1,(e.moveSpeed||0)/.9)-pose.blend)*(1-Math.exp(-dt*15));actorMotion.set(e.id,pose);}
    const p=s.player,signals={time:s.time,lookYaw:.6,lookPitch:0,firing:input.fire};
    const view=motion.update(dt,s.locomotion||{},signals,true);leftMotion.update(dt,s.locomotion||{},{...signals,firing:false},true);
    const camera={pos:[p.x,(p.y||0)+1.62+view.height,p.z],yaw:p.yaw,pitch:p.pitch,roll:view.roll,fov:prefs.fov+view.fov};
    const poseMs=performance.now()-t;T.pose+=poseMs;
    t=performance.now();const dynamic=game.models(s.time,true,camera);const modelsMs=performance.now()-t;T.models+=modelsMs;
    t=performance.now();const lights=env.FEffects.lights(s);const lightsMs=performance.now()-t;T.lights+=lightsMs;
    const fx={time:s.time,flash:Math.max(s.flash||0,s.leftFlash||0),lights,damage:s.damage,pulse:0,shake:0,frameMs:16.7,shadows:prefs.shadows,bloom:prefs.bloom,horror:s.director,adaptive:false};
    t=performance.now();renderer.draw(camera,dynamic,fx);const drawMs=performance.now()-t;T.draw+=drawMs;
    s.events.length=0;
    return {changed,updateMs,modelsMs,lightsMs,drawMs,dynamic:dynamic.length,list:dynamic,camera,fx};
  };
  out.frame=(dt=1/60,o)=>{const simMs=out.simPhase(dt,o);return {simMs,...out.viewPhase(dt)};};
  return out;
}
