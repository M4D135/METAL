import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/renderer.js',import.meta.url),'utf8');

// RCPU-V1 : la portée de coupure est encodée dans le drapeau de surface des lignes
// statiques (bits 3 et suivants = niveau de détail + 1) et lue par le vertex shader.
// Les lignes dynamiques doivent rester à 0 pour ne jamais être coupées.
function gpu(){
  const buffers=new Map();let serial=0,bound=null,instanceOffset=0;
  const rows=[];
  const gl=new Proxy({FRAMEBUFFER_COMPLETE:36053,COLOR_BUFFER_BIT:16384,DEPTH_BUFFER_BIT:256},{get(target,name){
    if(name in target)return target[name];
    if(/^[A-Z_0-9]+$/.test(name))return name;
    return (...args)=>{
      if(name.startsWith('create'))return {kind:name,id:++serial};
      if(name==='getUniformLocation')return {program:args[0],name:args[1]};
      if(name==='getShaderParameter'||name==='getProgramParameter')return true;
      if(name==='checkFramebufferStatus')return 36053;
      if(name==='bindBuffer'&&args[0]==='ARRAY_BUFFER')bound=args[1];
      if(name==='bufferData'&&args[0]==='ARRAY_BUFFER'&&ArrayBuffer.isView(args[1]))buffers.set(bound,Array.from(args[1]));
      if(name==='bufferSubData'&&args[0]==='ARRAY_BUFFER'){const target=buffers.get(bound)||[],source=Array.from(args[2]),start=args[1]/4;for(let i=0;i<source.length;i++)target[start+i]=source[i];buffers.set(bound,target);}
      if(name==='vertexAttribPointer'&&args[0]===2)instanceOffset=args[5]/4;
      if(name==='drawElementsInstanced'){const v=(buffers.get(bound)||[]).slice(instanceOffset,instanceOffset+args[4]*16);for(let i=0;i+16<=v.length;i+=16)rows.push(v.slice(i,i+16));}
    };
  }});
  const canvas={width:960,height:600,clientWidth:960,clientHeight:600,getContext:()=>gl,addEventListener(){},removeEventListener(){}};
  const scope={window:{innerWidth:960,innerHeight:600,devicePixelRatio:1}};
  vm.runInNewContext(source,scope);
  return {renderer:scope.window.FRender.create(canvas),rows};
}

const environment={biome:'woodland',outdoorZones:[{x:0,z:0,w:1000,d:1000}],sunDirection:[-.4,.8,.3]};
const meshes=[{shape:'box',p:[0,-.1,0],s:[400,.2,400],mat:2,ground:true}];
for(let i=0;i<3;i++)for(let d=0;d<3;d++)meshes.push({shape:'box',p:[i*4,1.5,0],s:[2,3,2],mat:3,detail:d});
const camera={pos:[0,1.6,14],yaw:0,pitch:-.05,fov:74};

test('le CPU filtre les niveaux statiques et garde les instances dynamiques',()=>{
  const g=gpu(),r=g.renderer;
  r.setWorld(meshes,[],environment);r.resize('auto');
  r.draw(camera,[],{time:1,shadows:false,bloom:false});
  const statiques=g.rows.filter(row=>row[1]>=1&&row[1]<=3&&Math.abs(row[2])<1e-9);
  assert(statiques.length>0,'les boîtes statiques doivent être dessinées');
  assert.equal(statiques.length,8,'the farthest detail-2 box is culled before upload');
  assert(statiques.every(row=>row[11]<8),'surface bits are reserved for material/overlay flags in FERRO');
  g.rows.length=0;
  const dynamique=[{shape:'box',p:[0,1,0],s:[1,1,1],mat:3,detail:2},{shape:'sphere',p:[1,1,0],s:[1,1,1],mat:4,detail:1}];
  r.draw(camera,dynamique,{time:1,shadows:false,bloom:false});
  const dynamiques=g.rows.filter(row=>row[4]===1&&row[5]===1&&row[6]===1);
  assert(dynamiques.length>0,'les instances dynamiques doivent être dessinées');
  for(const row of dynamiques)assert(Math.floor(row[11]/8)===0,'une instance dynamique ne doit jamais être coupée par la portée');
  r.dispose();
});
