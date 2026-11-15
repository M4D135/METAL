// Exercise the actual game.models() function and FMotion without a browser.
// World decoration is omitted; no first-person geometry is recreated here.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {FRenderMesh} from './mesh-fixture.mjs';

export function viewModels(root=new URL('../src/',import.meta.url)) {
  const source=readFileSync(new URL('game.js',root),'utf8');
  const model=source.slice(source.indexOf('  function models('),source.indexOf('  function renderHUD('));
  assert(model.startsWith('  function models('));
  const mesh=source.match(/  const m=\(shape,p,s,mat,r=\[0,0,0\],emissive=0\)=>[^\n]+/)[0];
  const noop=()=>{},context={window:{},quality:'auto',innerWidth:1280,innerHeight:800,FRender:{mesh:FRenderMesh},
    clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),machinery:noop,ambience:noop,systems:noop,
    exitReady:()=>false,actorMotion:new Map(),prefs:{shadows:true},
    renderer:{stats:{backend:'webgl2'}},
    world:{environment:{},trophies:[],exit:{x:1000,y:0,z:1000}},
  };
  const state={player:{x:0,y:0,z:0,yaw:0,pitch:0,heat:0},weapon:0,
    equipment:{left:null,right:0},flash:0,leftFlash:0,
    cores:[],enemies:[],pickups:[],loot:[],bullets:[],particles:[],pulseVisual:0};
  context.sim={state};vm.createContext(context);
  vm.runInContext(readFileSync(new URL('motion.js',root),'utf8'),context,{filename:'motion.js'});
  context.FMotion=context.window.FMotion;
  context.motion=context.FMotion.create();context.leftMotion=context.FMotion.create();
  vm.runInContext(mesh+'\n'+model+'\nthis.models=models;',context,{filename:'game.models.js'});
  return {context,state,motion:context.motion,leftMotion:context.leftMotion,
    build(camera={pos:[0,1.62,0],yaw:0,pitch:0,roll:0,fov:74}) {
      Object.assign(state.player,{x:camera.pos[0],y:camera.pos[1]-1.62,z:camera.pos[2],yaw:camera.yaw,pitch:camera.pitch});
      return context.models(3,true,camera).filter(m=>m.overlay);
    }};
}

export function primitivePoints(root=new URL('../src/',import.meta.url)) {
  const context={window:{}};vm.createContext(context);
  const source=readFileSync(new URL('renderer.js',root),'utf8').replace('window.FRender={create,foliageTriangles};','window.FRender={create,foliageTriangles,geometry};');
  vm.runInContext(source,context,{filename:'renderer.js'});
  const g=context.window.FRender.geometry(false),result={};
  for(const [name,range] of Object.entries(g.ranges)){
    const seen=new Map();
    for(let j=range.offset/2;j<range.offset/2+range.count;j++){
      const i=g.indices[j]*6,p=Array.from(g.vertices.slice(i,i+3));seen.set(p.join(','),p);
    }
    result[name]=Array.from(seen.values());
  }
  return result;
}

export function localCorners(mesh,camera={pos:[0,1.62,0],yaw:0,pitch:0,roll:0},vertices) {
  const [rx,ry,rz]=mesh.r||[0,0,0],cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
  const axes=[[cz*cy,sz*cy,-sy],[cz*sy*sx-sz*cx,sz*sy*sx+cz*cx,cy*sx],[cz*sy*cx+sz*sx,sz*sy*cx-cz*sx,cy*cx]];
  const yaw=camera.yaw||0,pitch=camera.pitch||0,roll=camera.roll||0,
    r=[Math.cos(yaw),0,Math.sin(yaw)],u=[-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),Math.cos(yaw)*Math.sin(pitch)],b=[-Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
  const cameraAxes=[r.map((v,k)=>v*Math.cos(roll)+u[k]*Math.sin(roll)),u.map((v,k)=>v*Math.cos(roll)-r[k]*Math.sin(roll)),b],corners=[];
  const cube=vertices||[-.5,.5].flatMap(x=>[-.5,.5].flatMap(y=>[-.5,.5].map(z=>[x,y,z])));
  for(const [x,y,z] of cube){
    const point=mesh.p.map((p,k)=>p+axes[0][k]*mesh.s[0]*x+axes[1][k]*mesh.s[1]*y+axes[2][k]*mesh.s[2]*z-camera.pos[k]);
    corners.push(cameraAxes.map(axis=>axis.reduce((sum,v,k)=>sum+v*point[k],0)));
  }
  return corners;
}

export function bounds(meshes,camera){
  const corners=meshes.flatMap(m=>localCorners(m,camera));
  return {min:[0,1,2].map(k=>Math.min(...corners.map(c=>c[k]))),max:[0,1,2].map(k=>Math.max(...corners.map(c=>c[k]))),
    projected:{minX:Math.min(...corners.map(c=>c[0]/-c[2])),maxX:Math.max(...corners.map(c=>c[0]/-c[2])),minY:Math.min(...corners.map(c=>c[1]/-c[2])),maxY:Math.max(...corners.map(c=>c[1]/-c[2]))}};
}

export function projectedHull(mesh,camera,vertices){
  const p=localCorners(mesh,camera,vertices).map(v=>[v[0]/-v[2],v[1]/-v[2]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),a=[],b=[];
  for(const q of p){while(a.length>1&&cross(a.at(-2),a.at(-1),q)<=0)a.pop();a.push(q);}
  for(const q of p.reverse()){while(b.length>1&&cross(b.at(-2),b.at(-1),q)<=0)b.pop();b.push(q);}
  return a.slice(0,-1).concat(b.slice(0,-1));
}

export function visibleOverlap(first,second,horizontal,vertical){
  function clip(points){
    for(const [axis,sign,limit] of [[0,1,horizontal],[0,-1,horizontal],[1,1,vertical],[1,-1,vertical]]){
      const result=[];
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],da=limit-a[axis]*sign,db=limit-b[axis]*sign;
        if(da>=0)result.push(a);
        if((da>=0)!==(db>=0)){const t=da/(da-db);result.push(a.map((n,k)=>n+(b[k]-n)*t));}
      }
      points=result;if(!points.length)return points;
    }
    return points;
  }
  const extents=p=>[Math.min(...p.map(v=>v[0])),Math.max(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[1]))];
  const aa=extents(first),bb=extents(second);
  if(Math.min(aa[1],bb[1],horizontal)<=Math.max(aa[0],bb[0],-horizontal)||Math.min(aa[3],bb[3],vertical)<=Math.max(aa[2],bb[2],-vertical))return false;
  const a=clip(first),b=clip(second);if(a.length<3||b.length<3)return false;
  for(const p of [a,b])for(let i=0;i<p.length;i++){
    const q=p[i],r=p[(i+1)%p.length],axis=[q[1]-r[1],r[0]-q[0]],d=a.map(v=>v[0]*axis[0]+v[1]*axis[1]),e=b.map(v=>v[0]*axis[0]+v[1]*axis[1]);
    if(Math.min(Math.max(...d),Math.max(...e))-Math.max(Math.min(...d),Math.min(...e))<=1e-7)return false;
  }
  return true;
}
