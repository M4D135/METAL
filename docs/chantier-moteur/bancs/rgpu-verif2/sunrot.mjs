// Taux d'échec du cache soleil (variante suncache du 1er tour) selon la vitesse de rotation et de marche.
// Faux WebGL2 ; on compte les octets bufferData par image (pas de chronométrage).
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
import {build} from '../rgpu/patches.mjs';
const root=process.argv[2];
function mk(name){
  const counters={bytes:0,calls:0};
  const gl=new Proxy({FRAMEBUFFER_COMPLETE:0x8CD5,getShaderParameter:()=>true,getProgramParameter:()=>true,checkFramebufferStatus:()=>0x8CD5,getUniformLocation:()=>({}),createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),createTexture:()=>({}),createFramebuffer:()=>({}),createRenderbuffer:()=>({}),createVertexArray:()=>({}),bufferData:(t,d)=>{counters.bytes+=d?.byteLength||0;counters.calls++;},getExtension:()=>null,getShaderInfoLog:()=>'',getProgramInfoLog:()=>''},{get(t,k){if(k in t)return t[k];if(typeof k==='string'&&/^[A-Z0-9_]+$/.test(k))return 0x8000+k.length;return()=>{};}});
  const canvas={width:300,height:150,clientWidth:1440,clientHeight:932,getContext:t=>t==='webgl2'?gl:null,addEventListener(){},removeEventListener(){}};
  const ctx={window:{devicePixelRatio:2,innerWidth:1440,innerHeight:932},performance,console,Math,Date};vm.createContext(ctx);
  vm.runInContext(build(readFileSync(root+'/src/renderer.js','utf8'),name),ctx);
  for(const n of ['world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx);
  const {FWorld,FSimulation,FBrain,FRender}=ctx.window;
  const world=FWorld.create(96,0,{campaign:true,campaignVersion:2});
  const sim=FSimulation.create(world,{armorSystem:true,brain:FBrain.create({mode:'cpu'})});
  const r=FRender.create(canvas);r.resize('auto');r.setWorld(sim.destruction?.meshes||world.meshes,sim.destruction?.lights||world.lights,world.environment);
  return {r,counters};
}
const A=mk('base'),B=mk('suncache');
const cases=[['immobile',0,0],['rotation 2°/image (120°/s)',2,0],['rotation 5°/image (300°/s)',5,0],['rotation 10°/image (600°/s)',10,0],['marche 4 m/s',0,4],['sprint 7 m/s',0,7],['sprint 7 m/s + 2°/image',2,7]];
for(const [label,deg,speed] of cases){
  const res=[];
  for(const v of [A,B]){
    let yaw=1.7,x=-6.3,z=41.2,bytes=[],n=120;
    for(let i=0;i<n+10;i++){yaw+=deg*Math.PI/180;x+=Math.sin(yaw)*speed/60*0+speed/60;const cam={pos:[x,1.62,z],yaw,pitch:0,roll:0,fov:78.5};
      v.r.actorFilter(cam,{shadows:true});v.counters.bytes=0;v.r.draw(cam,[],{time:10+i/60,adaptive:false,lights:[],shadows:true,bloom:true});if(i>=10)bytes.push(v.counters.bytes);}
    bytes.sort((a,b)=>a-b);res.push({moy:Math.round(bytes.reduce((a,b)=>a+b,0)/n/1024),p90:Math.round(bytes[Math.floor(n*.9)]/1024),max:Math.round(bytes[n-1]/1024),zero:bytes.filter(b=>b<1024).length});
  }
  console.log(label.padEnd(30),'base Ko/image moy',res[0].moy,'p90',res[0].p90,'| suncache moy',res[1].moy,'p90',res[1].p90,'max',res[1].max,'| ratio moy',(res[1].moy/Math.max(1,res[0].moy)).toFixed(2),'ratio p90',(res[1].p90/Math.max(1,res[0].p90)).toFixed(2));
}
