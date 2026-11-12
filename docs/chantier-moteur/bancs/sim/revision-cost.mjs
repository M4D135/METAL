// Cost of per-destruction-revision work: original refreshNav enqueue-all vs value diff + dirty rects + mirror build.
import {loadFast} from './fast.mjs';import {build,SCENARIOS} from './lib.mjs';
const ctx=loadFast();const {world,sim}=build(ctx,2,undefined);const solids=world.colliders.map(c=>({...c})),solids2=solids.map(c=>({...c}));solids2[17]={...solids2[17],maxY:solids2[17].maxY-1};
const f64=new Float64Array(6),u32=new Uint32Array(f64.buffer);
const hash=q=>{f64[0]=q.minX;f64[1]=q.maxX;f64[2]=q.minY;f64[3]=q.maxY;f64[4]=q.minZ;f64[5]=q.maxZ;let h=2166136261;for(let k=0;k<12;k++)h=Math.imul(h^u32[k],16777619);return h|0;};
function diffNum(a,c,out){const pool=new Map();for(const q of a){const h=hash(q);let l=pool.get(h);if(!l)pool.set(h,l=[]);l.push(q);}for(const q of c){const l=pool.get(hash(q));let k=-1;if(l)for(let j=0;j<l.length;j++){const o=l[j];if(o.minX===q.minX&&o.maxX===q.maxX&&o.minY===q.minY&&o.maxY===q.maxY&&o.minZ===q.minZ&&o.maxZ===q.maxZ){k=j;break;}}if(k>=0){l[k]=l[l.length-1];l.pop();}else out.push(q);}for(const l of pool.values())for(const q of l)out.push(q);return out;}
function diffStr(a,c,out){const key=q=>q.minX+','+q.maxX+','+q.minY+','+q.maxY+','+q.minZ+','+q.maxZ,count=new Map();for(const q of a){const k=key(q);count.set(k,(count.get(k)||0)+1);}for(const q of c){const k=key(q),n=count.get(k);if(n)count.set(k,n-1);else out.push(q);}for(const q of a){const k=key(q),n=count.get(k);if(n>0){count.set(k,n-1);out.push(q);}}return out;}
const N=37114,navQueued=new Uint8Array(N),navQueue=new Int32Array(N);
function enqueueAll(){let tail=0,pending=0;navQueued.fill(0);for(let i=0;i<N;i++)if(!navQueued[i]){navQueued[i]=1;navQueue[tail]=i;tail=(tail+1)%N;pending++;}return pending;}
const t=(f,n=200)=>{for(let i=0;i<20;i++)f();const s=performance.now();for(let i=0;i<n;i++)f();return (performance.now()-s)/n*1000;};
console.log('colliders',solids.length,'| diff by string keys',t(()=>diffStr(solids,solids2,[])).toFixed(0),'us | diff by numeric hash',t(()=>diffNum(solids,solids2,[])).toFixed(0),'us | enqueue all 37k nav cells',t(enqueueAll).toFixed(0),'us | changed found',diffNum(solids,solids2,[]).length);
