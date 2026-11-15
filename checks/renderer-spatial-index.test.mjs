import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Expose the production index only inside this test VM, without widening FRender.
const source=readFileSync(new URL('../src/renderer.js',import.meta.url),'utf8');
const scope={window:{}};vm.runInNewContext(source.replace('window.FRender={create,foliageTriangles};','window.FRender={create,foliageTriangles,spatialIndex};'),scope);
const build=scope.window.FRender.spatialIndex;
const box=(id,x,y,z,detail=0,size=1)=>({id,p:[x,y,z],s:[size,size,size],shape:'box',detail});
const ids=list=>Array.from(list,e=>e.mesh.id);

// Frozen pre-03r query contract: cell order is detail, x, z, insertion order.
// This deliberately uses the old Map/string implementation as an independent oracle.
function reference(meshes,eye,ranges,frustum){
  const levels=[new Map(),new Map(),new Map()],radii=[0,0,0],result=[];
  for(const mesh of meshes){const p=mesh.p||[0,0,0],radius=Math.hypot(...(mesh.s||[1,1,1]))*.5,detail=Math.max(0,Math.min(2,Math.floor(mesh.detail||0))),key=Math.floor(p[0]/8)+','+Math.floor(p[2]/8);let cell=levels[detail].get(key);
    if(!cell){cell={list:[],sumY:0,minY:Infinity,maxY:-Infinity};levels[detail].set(key,cell);}cell.list.push({mesh,p,radius});cell.sumY+=p[1];cell.minY=Math.min(cell.minY,p[1]);cell.maxY=Math.max(cell.maxY,p[1]);radii[detail]=Math.max(radii[detail],radius);
  }
  for(let level=0;level<3;level++){const range=ranges[level];if(!(range>0))continue;const r=range+radii[level];
    for(let x=Math.floor((eye[0]-r)/8);x<=Math.floor((eye[0]+r)/8);x++)for(let z=Math.floor((eye[2]-r)/8);z<=Math.floor((eye[2]+r)/8);z++){
      const cell=levels[level].get(x+','+z);if(!cell)continue;
      if(frustum){const cy=cell.sumY/cell.list.length,sr=5.656854249492381+Math.max(cy-cell.minY,cell.maxY-cy)+radii[level],v=[x*8+4-eye[0],cy-eye[1],z*8+4-eye[2]],dot=a=>v[0]*a[0]+v[1]*a[1]+v[2]*a[2],depth=dot(frustum.axes.forward),h=frustum.horizontal,t=frustum.vertical;
        if(!(depth+sr>.04&&depth-sr<frustum.far&&Math.abs(dot(frustum.axes.right))<=depth*h+sr*Math.sqrt(1+h*h)&&Math.abs(dot(frustum.axes.up))<=depth*t+sr*Math.sqrt(1+t*t)))continue;
      }
      for(const e of cell.list)if((e.p[0]-eye[0])**2+(e.p[1]-eye[1])**2+(e.p[2]-eye[2])**2<=(range+e.radius)**2)result.push(e.mesh.id);
    }
  }
  return result;
}

test('incremental queries preserve the old cell order and fresh rebuild results through destruction, moves and reorderings',()=>{
  let seed=7921,serial=0;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const make=()=>box(serial++,Math.floor(random()*80-40)*4,random()*18,Math.floor(random()*80-40)*4,Math.floor(random()*3),1+random()*15);
  let meshes=Array.from({length:500},make),index=build(meshes);const out=[];
  for(let revision=0;revision<50;revision++){
    if(revision){meshes=meshes.filter((_,i)=>i%41!==revision%41);meshes.push(make(),make(),make());const moving=meshes[revision];moving.p[0]+=revision%2?8:-8;moving.p[1]+=.5;if(revision%7===0)meshes.reverse();index=build(meshes,null,index);}
    const fresh=build(meshes);
    for(let k=0;k<12;k++){const eye=[random()*320-160,random()*30,random()*320-160],ranges=[55,24,k%2?0:14],a=random()*6.28,frustum=k%2?{axes:{forward:[Math.sin(a),0,-Math.cos(a)],right:[Math.cos(a),0,Math.sin(a)],up:[0,1,0]},horizontal:1.3,vertical:.8,far:60}:null;
      assert.equal(index.query(eye,ranges,out,frustum),out);const actual=ids(out);
      assert.deepEqual(actual,reference(meshes,eye,ranges,frustum),'old query/order at revision '+revision);
      assert.deepEqual(actual,ids(fresh.query(eye,ranges,null,frustum)),'fresh rebuild at revision '+revision);
    }
  }
});

test('only affected cells rebuild and unchanged metadata survives with stable instance rows',()=>{
  const a=box('a',1,2,1),b=box('b',25,2,25),c=box('c',26,3,26),meshes=[a,b,c];let index=build(meshes);const entry=index.byMesh.get(a),row=entry.row;
  index=build([a,c],null,index);assert.equal(index.full,false);assert.equal(index.changedCells,1);assert.equal(index.byMesh.get(a),entry);assert.equal(entry.row,row);assert.equal(index.byMesh.get(b),undefined);
  index=build([a,c],null,index);assert.equal(index.changedCells,0);assert.equal(index.changes.length,0);
});

test('negative boundaries, large radii, moved identities and the four-cell overflow fallback stay exact',()=>{
  const large=box('large',-8,2,-8,0,90),a=box('edge',-.00001,1,8),b=box('next',0,2,8);let meshes=[large,a,b],index=build(meshes);
  assert.deepEqual(ids(index.query([20,2,8],[1,0,0])),reference(meshes,[20,2,8],[1,0,0]));
  a.p=[16,9,-16];a.s=[6,6,6];a.detail=2;meshes=[b,a];index=build(meshes,null,index);
  assert.deepEqual(ids(index.query([0,3,0],[40,0,40])),reference(meshes,[0,3,0],[40,0,40]));assert.equal(index.byMesh.get(a).row[0],16);
  meshes.push(box('outside',400,2,-400));index=build(meshes,null,index);assert.equal(index.full,true);assert.deepEqual(ids(index.query([400,2,-400],[2,0,0])),['outside']);
});

test('extreme extents use a bounded sparse fallback without losing query order',()=>{
  const meshes=[box('left',-1000000,0,-1000000),box('right',1000000,0,1000000)];const index=build(meshes);assert.equal(index.dense,false);assert.deepEqual(ids(index.query([1000000,0,1000000],[5,0,0])),['right']);
});


test('repeated mesh identities preserve every insertion across revisions',()=>{
  const a=box('same',0,1,0),b=box('other',1,1,0);let meshes=[a,a,b],index=build(meshes);
  assert.deepEqual(ids(index.query([0,1,0],[5,0,0])),['same','same','other']);
  for(const next of [[a,b,a],[a,a,a,b],[b,a]]){meshes=next;index=build(meshes,null,index);assert.deepEqual(ids(index.query([0,1,0],[5,0,0])),reference(meshes,[0,1,0],[5,0,0]));}
});


test('shared added/removed deltas match the generation diff and full reconstruction',()=>{
  let meshes=Array.from({length:180},(_,i)=>box(i,(i%18)*8,i%9,Math.floor(i/18)*8,i%3)),fast=build(meshes),generic=build(meshes);
  for(let revision=0;revision<40;revision++){
    const removed=meshes.filter((_,i)=>i%37===revision%37),added=[box('new'+revision,revision*2,4,16,revision%3)];meshes=meshes.filter(m=>!removed.includes(m)).concat(added);
    fast=build(meshes,null,fast,{added,removed,full:false});generic=build(meshes,null,generic);
    for(const eye of [[0,1,0],[40,4,20],[90,2,70]])assert.deepEqual(ids(fast.query(eye,[65,25,20])),ids(generic.query(eye,[65,25,20])));
  }
});
