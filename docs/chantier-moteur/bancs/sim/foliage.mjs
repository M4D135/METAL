// Size of the point set scanned by debrisHalf() for foliage debris, unique points and convex-hull candidates.
import {loadFast} from './fast.mjs';
const ctx=loadFast();const tri=ctx.window.FRender.foliageTriangles();const pts=tri.flat();
const uniq=new Map();for(const p of pts)uniq.set(p.join(','),p);
// Support-direction test: points that are never the max of |p.v| over 20000 random directions.
let seed=7;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296*2-1;};
const U=[...uniq.values()],hit=new Set();for(let k=0;k<20000;k++){const v=[rnd(),rnd(),rnd()];let best=-1,arg=-1;U.forEach((p,i)=>{const d=Math.abs(p.reduce((n,x,j)=>n+x*v[j],0));if(d>best){best=d;arg=i;}});hit.add(arg);}
console.log('triangles',tri.length,'flat points',pts.length,'unique points',uniq.size,'points ever extreme over 20000 dirs',hit.size);
const v=[.3,.5,.8];let t=performance.now(),acc=0;for(let r=0;r<20000;r++)acc+=Math.max(...pts.map(p=>Math.abs(p.reduce((n,x,k)=>n+x*v[k],0))));const a=(performance.now()-t)/20000*1000;
t=performance.now();for(let r=0;r<20000;r++){let m=0;for(const p of U){const d=Math.abs(((0+p[0]*v[0])+p[1]*v[1])+p[2]*v[2]);if(d>m)m=d;}acc+=m;}const b=(performance.now()-t)/20000*1000;
console.log('one axis extent: current '+a.toFixed(2)+' us, loop over unique points '+b.toFixed(2)+' us (x'+(a/b).toFixed(0)+')',acc>0);
