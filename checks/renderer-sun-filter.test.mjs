import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/renderer.js',import.meta.url),'utf8');

// Le filtre des casters du soleil écrit dans un tableau réutilisé (RCPU-03).
// Ce test verrouille le comportement nouveau : la liste du soleil doit quand même
// être recalculée et retéléversée quand la caméra change de quartier de la carte.
function gpu(){
  const calls=[],draws=[],buffers=new Map();
  let serial=0,bound=null,currentProgram=null,framebuffer=null,instanceOffset=0,viewport=[0,0,0,0];
  const gl=new Proxy({FRAMEBUFFER_COMPLETE:36053,COLOR_BUFFER_BIT:16384,DEPTH_BUFFER_BIT:256},{get(target,name){
    if(name in target)return target[name];
    if(/^[A-Z_0-9]+$/.test(name))return name;
    return (...args)=>{calls.push({name,args,viewport:viewport.slice()});
      if(name.startsWith('create'))return {kind:name,id:++serial};
      if(name==='getUniformLocation')return {program:args[0],name:args[1]};
      if(name==='getShaderParameter'||name==='getProgramParameter')return true;
      if(name==='checkFramebufferStatus')return 36053;
      if(name==='bindBuffer'&&args[0]==='ARRAY_BUFFER')bound=args[1];
      if(name==='bufferData'&&args[0]==='ARRAY_BUFFER')buffers.set(bound,Array.from(args[1]));
      if(name==='useProgram')currentProgram=args[0];
      if(name==='bindFramebuffer')framebuffer=args[1];
      if(name==='viewport')viewport=args.slice(0,4);
      if(name==='vertexAttribPointer'&&args[0]===2)instanceOffset=args[5]/4;
      if(name==='drawElementsInstanced')draws.push({program:currentProgram,framebuffer,viewport:viewport.slice(),values:(buffers.get(bound)||[]).slice(instanceOffset,instanceOffset+args[4]*16),count:args[4]});
    };
  }});
  const canvas={width:960,height:600,clientWidth:960,clientHeight:600,getContext:()=>gl,addEventListener(){},removeEventListener(){}};
  const scope={window:{innerWidth:960,innerHeight:600,devicePixelRatio:1}};
  vm.runInNewContext(source,scope);
  return {renderer:scope.window.FRender.create(canvas),calls,draws,canvas};
}

const environment={biome:'woodland',outdoorZones:[{x:0,z:0,w:1000,d:1000}],sunDirection:[-.4,.8,.3]};
const meshes=[{shape:'box',p:[0,-.1,0],s:[1000,.2,1000],mat:2,ground:true}];
for(let i=-10;i<=10;i++)meshes.push({shape:'box',p:[i*30,1.5,0],s:[6,3,6],mat:3});
const cameraAt=x=>({pos:[x,1.6,18],yaw:0,pitch:-.05,fov:74});
const sunRows=draws=>{
  const rows=[];
  for(const d of draws)if(d.viewport[1]===0&&d.viewport[0]>0)for(let i=0;i+16<=d.values.length;i+=16)rows.push(d.values.slice(i,i+16).map(v=>Math.round(v*1e4)/1e4).join(','));
  return rows;
};
const startsWith=(rows,prefix)=>rows.some(row=>row.startsWith(prefix));

test('les casters du soleil suivent la caméra malgré le tableau de filtre réutilisé',()=>{
  const g=gpu(),r=g.renderer;
  r.setWorld(meshes,[],environment);r.resize('auto');
  r.draw(cameraAt(-300),[],{time:1,shadows:true,bloom:false});
  const ouest=sunRows(g.draws);
  g.draws.length=0;
  r.draw(cameraAt(300),[],{time:1,shadows:true,bloom:false});
  const est=sunRows(g.draws);
  assert(ouest.length>0,'la passe du soleil doit dessiner des instances');
  assert(est.length>0,'la passe du soleil doit se recalculer après un grand déplacement');
  const setEst=new Set(est),setOuest=new Set(ouest);
  assert(![...setEst].every(row=>setOuest.has(row)),'la liste du soleil ne peut pas rester figée sur la caméra précédente');
  assert(startsWith(ouest,'-300,1.5,0'),'la boîte voisine de la caméra doit être caster du soleil');
  assert(startsWith(est,'300,1.5,0'),'la boîte voisine de la nouvelle caméra doit être caster du soleil');
  r.dispose();
});
