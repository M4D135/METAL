// RCPU contre-verification : chargeur independant (realm principal, numeros de ligne conserves),
// faux WebGL2 compteur, traces de camera parametrables. Ne modifie jamais le depot (lecture seule).
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

export const EXPORT_LINE='window.FRender={create,foliageTriangles};';
export function rendererSource(root,{internals=false,patch=null}={}){
  let src=readFileSync(root+'/src/renderer.js','utf8');
  if(patch)src=patch(src);
  if(internals){
    if(src.split(EXPORT_LINE).length!==2)throw new Error('export line not found');
    src=src.replace(EXPORT_LINE,EXPORT_LINE+'window.__x={spatialIndex,visible,pack,packIndexed,packEffects,surfaceFlags,outdoorAt,environmentInfo,cameraAxes,detailRanges,extendedDistance,names,metadata,resolutionGovernor};');
  }
  return src;
}
export function load(root,{names=['renderer','world','destruction','economy','brain','simulation','actors','effects','motion'],internals=false,patch=null,win=null}={}){
  win=win||{innerWidth:1280,innerHeight:720,devicePixelRatio:2};
  for(const n of names){
    const src=n==='renderer'?rendererSource(root,{internals,patch}):readFileSync(root+'/src/'+n+'.js','utf8');
    vm.runInThisContext('(function(window){'+src+'\n})',{filename:n+'.js'})(win);
  }
  return win;
}
export function loadRendererOnly(root,opts={}){
  const win={innerWidth:1280,innerHeight:720,devicePixelRatio:2};
  vm.runInThisContext('(function(window){'+rendererSource(root,opts)+'\n})',{filename:'renderer-'+(opts.tag||'x')+'.js'})(win);
  return win;
}

export function counters(){return {calls:0,bufferData:0,bufferBytes:0,subData:0,subBytes:0,draws:0,instances:0,triangles:0,attrib:0};}
// Plain object (no Proxy) so that the per-call overhead stays tiny and equal for every variant.
export function fakeGL(C){
  const gl={};let id=0,n=100;
  const K='ARRAY_BUFFER BACK BLEND CLAMP_TO_EDGE COLOR_ATTACHMENT0 COMPILE_STATUS CULL_FACE DEPTH_ATTACHMENT DEPTH_COMPONENT DEPTH_COMPONENT24 DEPTH_TEST DYNAMIC_DRAW ELEMENT_ARRAY_BUFFER FLOAT FRAGMENT_SHADER FRAMEBUFFER LEQUAL LINEAR LINK_STATUS NEAREST NONE ONE_MINUS_SRC_ALPHA POLYGON_OFFSET_FILL RENDERBUFFER RGBA RGBA8 SRC_ALPHA STATIC_DRAW TEXTURE_2D TEXTURE_MAG_FILTER TEXTURE_MIN_FILTER TEXTURE_WRAP_S TEXTURE_WRAP_T TEXTURE0 TEXTURE1 TEXTURE2 TRIANGLES UNSIGNED_BYTE UNSIGNED_INT UNSIGNED_SHORT VERTEX_SHADER'.split(' ');
  for(const k of K)gl[k]=++n;
  gl.FRAMEBUFFER_COMPLETE=36053;gl.COLOR_BUFFER_BIT=16384;gl.DEPTH_BUFFER_BIT=256;
  const F='activeTexture attachShader bindBuffer bindFramebuffer bindRenderbuffer bindTexture bindVertexArray blendFunc clear clearColor compileShader cullFace deleteBuffer deleteFramebuffer deleteProgram deleteRenderbuffer deleteShader deleteTexture deleteVertexArray depthFunc depthMask disable drawBuffers enable enableVertexAttribArray framebufferRenderbuffer framebufferTexture2D linkProgram polygonOffset readBuffer renderbufferStorage shaderSource texImage2D texParameteri uniform1f uniform1fv uniform1i uniform2f uniform3fv uniform4f uniformMatrix4fv useProgram vertexAttribDivisor viewport'.split(' ');
  for(const f of F)gl[f]=function(){C.calls++;};
  for(const f of 'createBuffer createFramebuffer createProgram createRenderbuffer createShader createTexture createVertexArray'.split(' '))gl[f]=function(){C.calls++;return {id:++id};};
  gl.getUniformLocation=function(p,name){C.calls++;return {name};};
  gl.getShaderParameter=gl.getProgramParameter=function(){C.calls++;return true;};
  gl.getShaderInfoLog=gl.getProgramInfoLog=function(){return '';};
  gl.checkFramebufferStatus=function(){C.calls++;return 36053;};
  gl.getParameter=function(){return 4096;};gl.getExtension=function(){return null;};gl.isContextLost=function(){return false;};
  gl.bufferData=function(t,data){C.calls++;C.bufferData++;C.bufferBytes+=data&&data.byteLength||0;};
  gl.bufferSubData=function(t,o,data){C.calls++;C.subData++;C.subBytes+=data&&data.byteLength||0;};
  gl.vertexAttribPointer=function(){C.calls++;C.attrib++;};
  gl.drawElementsInstanced=function(m,count,type,off,inst){C.calls++;C.draws++;C.instances+=inst;C.triangles+=count/3*inst;};
  gl.drawArrays=function(){C.calls++;C.draws++;};
  return gl;
}
export function makeCanvas(gl){return {width:300,height:150,clientWidth:1280,clientHeight:720,getContext:()=>gl,addEventListener(){},removeEventListener(){}};}

export function makeWorld(win,spec,seed=96){
  const [kind,idx]=spec.split(':');
  const world=kind==='camp'?win.FWorld.create(seed,+idx,{campaign:true,campaignVersion:2}):win.FWorld.create(seed,+idx);
  let brain=null;try{brain=win.FBrain.create({mode:'cpu'});}catch{}
  const sim=win.FSimulation.create(world,{armorSystem:true,...(brain?{brain}:{})});
  return {world,sim};
}

// Greedy route spawn -> enemies/cores -> exit, walked at `speed` m/s; heading turns at most `turnRate` rad/s.
// yawProfile(i, heading) returns the camera yaw. Ground height from sim.ground.
export function cameraTrace(world,sim,{frames=1500,speed=7,turnRate=Math.PI,profile='sweep45',fov=74}={}){
  const stops=[...(world.enemies||[]).map(e=>[e.x,e.z]),...(world.cores||[]).map(c=>[c.x,c.z]),[world.exit.x,world.exit.z]];
  const route=[];{let cur=[world.spawn.x,world.spawn.z];const left=stops.slice();while(left.length){let bi=0,bd=Infinity;for(let k=0;k<left.length;k++){const d=Math.hypot(left[k][0]-cur[0],left[k][1]-cur[1]);if(d<bd){bd=d;bi=k;}}cur=left.splice(bi,1)[0];route.push(cur);}}
  let x=world.spawn.x,z=world.spawn.z,leg=0,heading=null;const dt=1/60,out=[];
  let flickPhase=0;
  for(let i=0;i<frames;i++){
    const w=route[leg%route.length],dx=w[0]-x,dz=w[1]-z,d=Math.hypot(dx,dz);
    if(d<1.5)leg++;else{const k=Math.min(1,speed*dt/d);x+=dx*k;z+=dz*k;}
    const target=Math.atan2(dx,-dz);
    if(heading===null)heading=target;else{let a=target-heading;a=Math.atan2(Math.sin(a),Math.cos(a));heading+=Math.max(-turnRate*dt,Math.min(turnRate*dt,a));}
    let yaw=heading,pitch=Math.sin(i/70)*.12;
    if(profile==='sweep45')yaw+=Math.sin(i/45)*.9;
    else if(profile==='sweep12')yaw+=Math.sin(i/12)*.9;
    else if(profile==='flick'){ // tracking + periodic 100 deg flick in 8 frames, return over 30 frames
      const c=i%90;flickPhase=c<8?c/8:c<38?1-(c-8)/30:0;yaw+=Math.sin(i/40)*.35+flickPhase*1.75;
    }else if(profile==='still'){x=world.spawn.x;z=world.spawn.z;yaw=(world.spawn.yaw||0)+Math.sin(i/120)*.3;}
    const y=sim.ground(x,z);const gy=Number.isFinite(y)?y:0;
    out.push({pos:[x,gy+1.62,z],yaw,pitch,roll:0,fov});
  }
  return out;
}
export function quant(a){const v=a.slice().sort((x,y)=>x-y),q=p=>v[Math.min(v.length-1,Math.floor(v.length*p))];const mean=v.reduce((x,y)=>x+y,0)/Math.max(1,v.length);return {n:v.length,mean:+mean.toFixed(4),p50:+q(.5).toFixed(4),p95:+q(.95).toFixed(4),p99:+q(.99).toFixed(4),max:+(v[v.length-1]??0).toFixed(4)};}
