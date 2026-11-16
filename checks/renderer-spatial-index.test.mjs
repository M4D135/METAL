import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Expose the production index only inside this test VM, without widening FRender.
const source=readFileSync(new URL('../src/renderer.js',import.meta.url),'utf8');
const scope={window:{}};vm.runInNewContext(source.replace('window.FRender={create,foliageTriangles};','window.FRender={create,foliageTriangles,spatialIndex};'),scope);
const build=scope.window.FRender.shared.spatialIndex;
const box=(id,x,y,z,detail=0,size=1)=>({id,p:[x,y,z],s:[size,size,size],shape:'box',detail});
const ids=list=>Array.from(list,e=>e.mesh.id);

// FERRO wide-world contract: detail, oversized objects, then x/z cells and insertion order.
// The independent oracle also checks exact optional frustum rejection.
function reference(meshes,eye,ranges,frustum){
  const entries=meshes.map((mesh,ordinal)=>({mesh,ordinal,p:mesh.p||[0,0,0],radius:Math.hypot(...(mesh.s||[1,1,1]))*.5,detail:Math.max(0,Math.min(2,Math.floor(mesh.detail||0)))}));
  return entries.filter(e=>{const range=ranges[e.detail];if(!(range>0)||Math.hypot(...e.p.map((v,k)=>v-eye[k]))>range+e.radius)return false;
    if(frustum){const v=e.p.map((x,k)=>x-eye[k]),dot=a=>v.reduce((n,x,k)=>n+x*a[k],0),z=dot(frustum.axes.forward),r=e.radius,h=frustum.horizontal,t=frustum.vertical;if(!(z+r>.04&&z-r<frustum.far&&Math.abs(dot(frustum.axes.right))<=z*h+r*Math.sqrt(1+h*h)&&Math.abs(dot(frustum.axes.up))<=z*t+r*Math.sqrt(1+t*t)))return false;}return true;
  }).sort((a,b)=>a.detail-b.detail||Number(b.radius>32)-Number(a.radius>32)||(a.radius>32?a.ordinal-b.ordinal:Math.floor(a.p[0]/8)-Math.floor(b.p[0]/8)||Math.floor(a.p[2]/8)-Math.floor(b.p[2]/8)||a.ordinal-b.ordinal)).map(e=>e.mesh.id);
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
  index=build([a,c],null,index);assert.equal(index.delta.full,false);assert.equal(index.delta.removed.length,1);assert.equal(index.delta.added.length,0);assert.equal(index.byMesh.get(a),entry);assert.equal(entry.row,row);assert.equal(index.byMesh.get(b),undefined);
  index=build([a,c],null,index);assert.equal(index.delta.added.length+index.delta.removed.length+index.delta.changed.length,0);
});

test('negative boundaries, large radii, moved identities and the four-cell overflow fallback stay exact',()=>{
  const large=box('large',-8,2,-8,0,90),a=box('edge',-.00001,1,8),b=box('next',0,2,8);let meshes=[large,a,b],index=build(meshes);
  assert.deepEqual(ids(index.query([20,2,8],[1,0,0])),reference(meshes,[20,2,8],[1,0,0]));
  a.p=[16,9,-16];a.s=[6,6,6];a.detail=2;meshes=[b,a];index=build(meshes,null,index);
  assert.deepEqual(ids(index.query([0,3,0],[40,0,40])),reference(meshes,[0,3,0],[40,0,40]));assert.equal(index.byMesh.get(a).row[0],16);
  meshes.push(box('outside',400,2,-400));index=build(meshes,null,index);assert.equal(index.delta.full,false);assert.deepEqual(ids(index.query([400,2,-400],[2,0,0])),['outside']);
});

test('extreme extents use a bounded sparse fallback without losing query order',()=>{
  const meshes=[box('left',-1000000,0,-1000000),box('right',1000000,0,1000000)];const index=build(meshes);assert.equal(index.entries.length,2);assert.deepEqual(ids(index.query([1000000,0,1000000],[5,0,0])),['right']);
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
