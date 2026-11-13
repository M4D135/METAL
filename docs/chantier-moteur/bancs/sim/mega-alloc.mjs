// Root cause check: bytes allocated per call by a ground()-like loop, monomorphic vs 5 hidden classes,
// for-of vs indexed loop. Run through gc-harness.mjs (V8 "allocated=" counters). Also ns/call.
const N=2e6;
const shapes=[
  (x,z)=>({x,z,w:4.5,d:3.25,y:0.5,slopeX:0,slopeZ:0}),
  (x,z)=>({kind:'ramp',x,z,w:4.5,d:3.25,y:0.5,slopeX:0.1,slopeZ:0}),
  (x,z)=>({x,z,w:4.5,d:3.25,y:0.5,substrate:true}),
  (x,z)=>({id:3,x,z,w:4.5,d:3.25,y:0.5,slopeZ:0.2}),
  (x,z)=>({x,z,y:0.5,w:4.5,d:3.25,fallback:true,slopeX:0,slopeZ:0}),
];
function mk(poly){const out=[];for(let i=0;i<64;i++)out.push(shapes[poly?i%5:0](i*1.37%40,i*2.11%40));return out;}
function gOf(list,x,z){let best=-Infinity;for(const f of list){const hw=f.w/2+1e-7,hd=f.d/2+1e-7;if(Math.abs(x-f.x)<=hw&&Math.abs(z-f.z)<=hd){const y=(f.y||0)+(x-f.x)*(f.slopeX||0)+(z-f.z)*(f.slopeZ||0);best=Math.max(best,y);}}return best;}
function gIdx(list,x,z){let best=-Infinity;for(let i=0;i<list.length;i++){const f=list[i];const hw=f.w/2+1e-7,hd=f.d/2+1e-7;if(Math.abs(x-f.x)<=hw&&Math.abs(z-f.z)<=hd){const y=(f.y||0)+(x-f.x)*(f.slopeX||0)+(z-f.z)*(f.slopeZ||0);best=Math.max(best,y);}}return best;}
// separate copies so each variant has its own feedback
const variants={'mono_forof':[gOf.toString(),false],'mono_index':[gIdx.toString(),false],'poly5_forof':[gOf.toString(),true],'poly5_index':[gIdx.toString(),true]};
for(const [name,[src,poly]] of Object.entries(variants)){
  const f=new Function('return '+src)();const buckets=[];for(let b=0;b<16;b++){const l=mk(poly);buckets.push(l.slice(b*4,b*4+2));}
  let acc=0;for(let i=0;i<2e5;i++)acc+=f(buckets[i&15],(i*0.37)%40,(i*0.53)%40)|0; // warm
  globalThis.gc();console.log('##BEGIN '+name+' '+N);const t=performance.now();
  for(let i=0;i<N;i++){const v=f(buckets[i&15],(i*0.37)%40,(i*0.53)%40);if(v>acc)acc=v;}
  const dt=performance.now()-t;console.log('##TAIL');globalThis.gc();console.log('##END');
  console.log('##'+name.padEnd(12)+(dt*1e6/N).toFixed(1)+' ns/call (2 floors per bucket) acc='+acc.toFixed(3));
}
