// Conservative pre-model culling: verify real pass matrices and unchanged
// software drawing commands, including offscreen projected-shadow casters.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const rendererSource=readFileSync(new URL('../src/renderer.js',import.meta.url),'utf8');
const actorSource=readFileSync(new URL('../src/actors.js',import.meta.url),'utf8');
const actorContext={window:{}};vm.runInNewContext(actorSource,actorContext);
const build=actorContext.window.FActors.build,HEIGHT=[1.35,1.05,1.6,1.8];
const environment={biome:'woodland',sunDirection:[-.48,.78,.36],wind:0,outdoorZones:[{x:0,z:0,w:200,d:200}]};
const lights=[{p:[-6,7,0],color:[.4,.8,1],power:12},{p:[15,8,-9],color:[1,.5,.2],power:10},{p:[3,4,20],color:[.4,1,.7],power:8}];
const box=(p,s,extra={})=>({shape:'box',p,s,mat:0,...extra});
function actor(type,x=0,y=0,z=0,extra={}){return {id:type+1,type,x,z,baseY:y,y:y+HEIGHT[type],yaw:.7,hp:10,moveSpeed:2,awareness:'engage',attackState:'aim',windup:.3,windupMax:.8,aimX:x+2,aimY:y+6,aimZ:z-4,...extra};}
function corners(m){
  const [rx,ry,rz]=m.r||[0,0,0],cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz),out=[];
  for(const a of [-.5,.5])for(const b of [-.5,.5])for(const c of [-.5,.5]){
    let x=a*m.s[0],y=b*m.s[1],z=c*m.s[2];[y,z]=[cx*y-sx*z,sx*y+cx*z];[x,z]=[cy*x+sy*z,-sy*x+cy*z];
    out.push([cz*x-sz*y+m.p[0],sz*x+cz*y+m.p[1],z+m.p[2]]);
  }
  return out;
}
function clipOutside(points,matrix){
  const clip=points.map(p=>[0,1,2,3].map(row=>matrix[row]*p[0]+matrix[row+4]*p[1]+matrix[row+8]*p[2]+matrix[row+12]));
  return [0,1,2].some(axis=>[-1,1].some(sign=>clip.every(p=>p[3]+sign*p[axis]<-1e-5)));
}
function gpu(){
  const matrices=[],constants={FRAMEBUFFER_COMPLETE:36053,COLOR_BUFFER_BIT:16384,DEPTH_BUFFER_BIT:256};let id=0;
  const gl=new Proxy(constants,{get(target,name){
    if(name in target)return target[name];if(/^[A-Z_0-9]+$/.test(name))return name;
    return (...args)=>{
      if(name==='getUniformLocation')return {name:args[1],program:args[0]};
      if(name.startsWith('create'))return {id:++id};
      if(name==='getShaderParameter'||name==='getProgramParameter')return true;
      if(name==='checkFramebufferStatus')return 36053;
      if(name==='uniformMatrix4fv'&&args[0].name==='uViewProjection')matrices.push(Array.from(args[2]));
    };
  }});
  const surface={width:963,height:601,clientWidth:963,clientHeight:601,getContext:()=>gl,addEventListener(){},removeEventListener(){}};
  const window={innerWidth:963,innerHeight:601,devicePixelRatio:1};vm.runInNewContext(rendererSource,{window});
  return {renderer:window.FRender.create(surface),matrices,surface};
}
function software(){
  const calls=[],gradient={addColorStop(...args){calls.push(['colorStop',...args]);}};
  const ctx=new Proxy({}, {get(target,name){if(name in target)return target[name];return (...args)=>{calls.push([name,...args]);return name.startsWith('create')?gradient:undefined;};},set(target,name,value){calls.push(['set',name,value===gradient?'gradient':value]);target[name]=value;return true;}});
  const surface={width:960,height:600,clientWidth:960,clientHeight:600,getContext:kind=>kind==='2d'?ctx:null};
  const window={innerWidth:960,innerHeight:600,devicePixelRatio:1};vm.runInNewContext(rendererSource,{window});
  return {renderer:window.FRender.create(surface),calls};
}

test('game actor bounds enclose every detailed pose, flying supports and telegraphs',()=>{
  for(let type=0;type<4;type++)for(const distance of [3,18,50])for(const state of ['idle','aim','burst','rush','stunned','airborne'])for(let i=0;i<7;i++){
    const e=actor(type,2,3.2,-3,{yaw:i*.91,attackState:state,stun:state==='stunned'?.5:0,airborne:state==='airborne',airVY:i*4-12,aimY:3.2+(i%2?9:-2)});
    const meshes=build(e,{time:2.5,phase:i*.87,blend:1,distance,quality:'high',backend:'webgl2'}),center=[e.x,e.baseY+1.6,e.z],r=type===3?4.5:3.5;
    for(const m of meshes)for(const p of corners(m))assert(Math.hypot(...p.map((v,k)=>v-center[k]))<r,`${type}/${state}/${m.actorPart} escapes game bound`);
    // Largest charge ring, three forward warning dashes, and stun halo.
    const ring=type===3?2.86:1.04;
    const cues=[box([e.x,e.baseY+.07,e.z],[ring*2,.08,ring*2]),box([e.x,e.baseY+[2,2.25,2.35,3.35][type],e.z],[1.05,1.05,1.05])];
    for(let j=1;j<=3;j++)cues.push(box([e.x+Math.sin(e.yaw)*(j*.65+.5),e.baseY+.065,e.z-Math.cos(e.yaw)*(j*.65+.5)],[.11,.04,.3],{r:[0,-e.yaw,0]}));
    for(const m of cues)for(const p of corners(m))assert(Math.hypot(...p.map((v,k)=>v-center[k]))<r,'telegraph escapes game bound');
  }
});

test('GPU rejection cannot enter any actual camera, lamp, torch or sun clip volume',()=>{
  const {renderer:r,matrices}=gpu();let rejected=0,checked=0,retainedForShadow=0;
  for(const outdoors of [false,true])for(const quality of ['auto','high','low']){
    r.setWorld([box([0,-.2,0],[100,.4,100],{ground:true})],lights,outdoors?environment:null);r.resize(quality);
    for(let frame=0;frame<6;frame++){
      const camera={pos:[frame*3-8,[1.6,4.8,8,11,5.3,1.6][frame],frame*-2],yaw:frame*1.1,pitch:[0,.4,-.6,.9,-.3,0][frame],roll:frame*.05,fov:[40,75,110,58,95,75][frame]};
      const fx={time:frame+.3,shake:.2,shadows:frame!==4,adaptive:false};
      const keep=r.actorFilter(camera,fx),withoutShadows=r.actorFilter(camera,{...fx,shadows:false});
      matrices.length=0;r.draw(camera,[],fx);assert(matrices.length>0);
      for(let i=0;i<140;i++){
        const x=(i*37%241)-120,z=(i*61%241)-120,y=(i%5)*3.2,type=i%4,radius=type===3?4.5:3.5;
        if(keep(x,y+1.6,z,radius)){if(!withoutShadows(x,y+1.6,z,radius))retainedForShadow++;continue;}
        rejected++;const e=actor(type,x,y,z,{airborne:i%3===0,yaw:i*.6,aimY:y+(i%2?10:-4)});
        const model=build(e,{time:3,phase:i,blend:1,distance:3,backend:'webgl2',quality:'high'});
        for(const m of model)for(const matrix of matrices){checked++;assert(clipOutside(corners(m),matrix),`culled ${m.actorPart} enters a real pass, ${quality}/${outdoors}/${frame}/${i}`);}
      }
    }
  }
  assert(rejected>1500&&checked>100000,'coverage must reject a meaningful distant population');
  assert(retainedForShadow>0,'fixtures must retain off-camera shadow casters');
});

test('GPU camera-edge sweeps preserve actors during turns, zoom and vertical travel',()=>{
  const {renderer:r,matrices}=gpu();r.setWorld([],[],null);r.resize('auto');
  let decisions=0,rejections=0;
  for(const fov of [40,74,110])for(const height of [1.62,4.82,8.02])for(const yaw of [0,.27,Math.PI/2]){
    const camera={pos:[0,height,0],yaw,pitch:0,fov},fx={shadows:false,adaptive:false};
    const keep=r.actorFilter(camera,fx);matrices.length=0;r.draw(camera,[],fx);
    for(const depth of [.05,4,18,40,178,185])for(const offset of [-5,-2,-.1,0,.1,2,5])for(const sign of [-1,1]){
      const side=sign*(Math.tan(fov*Math.PI/360)*963/601*depth+offset),x=Math.cos(yaw)*side+Math.sin(yaw)*depth,z=Math.sin(yaw)*side-Math.cos(yaw)*depth;
      const base=height-1.62,e=actor(1,x,base,z,{yaw:yaw+Math.PI,airborne:height>5});decisions++;
      if(keep(x,base+1.6,z,3.5))continue;
      rejections++;for(const m of build(e,{distance:3,time:2,phase:1,blend:1,backend:'webgl2'}))assert(clipOutside(corners(m),matrices[0]),'camera boundary clips visible actor geometry');
    }
  }
  assert(decisions>2000&&rejections>100);
});

test('software filtering preserves the exact draw command sequence and shadow ranking',()=>{
  const {renderer:r,calls}=software();let culled=0;
  const floor=box([0,-.15,0],[90,.3,90],{mat:2,ground:true});
  const props=Array.from({length:40},(_,i)=>box([Math.cos(i)*((i%8)+2),1,Math.sin(i)*((i%8)+2)],[.7,2,.7]));
  const actors=Array.from({length:24},(_,i)=>actor(i%4,Math.cos(i*.71)*(6+i*1.3),(i%3)*3.2,Math.sin(i*.71)*(6+i*1.3)));
  for(const outdoors of [false,true])for(const quality of ['auto','high','low'])for(const shadows of [false,true]){
    r.setWorld([floor,...props],lights,outdoors?environment:null);r.resize(quality);
    const camera={pos:[1,5.1,4],yaw:.6,pitch:-.2,roll:.07,fov:75},fx={time:3,shadows};
    const models=actors.map(e=>build(e,{time:3,phase:.5,blend:.8,distance:18,backend:'canvas2d',quality}));
    const keep=r.actorFilter(camera,fx),kept=models.filter((_,i)=>keep(actors[i].x,actors[i].baseY+1.6,actors[i].z,actors[i].type===3?4.5:3.5));
    culled+=models.length-kept.length;
    r.draw(camera,models.flat(),fx);calls.length=0;r.draw(camera,models.flat(),fx);const before=JSON.stringify(calls);
    calls.length=0;r.draw(camera,kept.flat(),fx);assert.equal(JSON.stringify(calls),before,`${quality}/${outdoors}/${shadows} changes software pixels or order`);
  }
  assert(culled>80,'software optimization is not active');
});

test('sparse software scenes preserve potential casters and reset after world changes',()=>{
  const {renderer:r}=software(),camera={pos:[0,1.6,0],yaw:0,pitch:0,fov:75};r.resize('auto');
  const props=Array.from({length:30},(_,i)=>box([Math.sin(i)*3,1,Math.cos(i)*3],[.6,2,.6]));
  r.setWorld(props,lights,environment);assert.equal(r.actorFilter(camera)(0,1.6,30,3.5),false);
  r.setWorld([],lights,environment);assert.equal(r.actorFilter(camera)(0,1.6,30,3.5),true,'removed static ranking reused across setWorld');
  assert.equal(r.actorFilter(camera,{shadows:false})(0,1.6,30,3.5),false);
  assert.equal(r.actorFilter(camera)(NaN,1,2,3),true,'uncertain bounds must be retained');
  r.resize('low');assert.equal(r.actorFilter(camera)(0,1.6,30,3.5),false);
});
