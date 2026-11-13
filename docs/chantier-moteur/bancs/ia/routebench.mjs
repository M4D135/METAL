// Cost of one route() call by case, cold vs warm edge cache, base vs prototype.
// usage: node routebench.mjs <repo> <flags|base> [pairs=1500]
import {loadMain} from './loadmain.mjs'; import {rep} from './load.mjs'; import {protoPatch} from './proto.mjs';
const [root,flags='base',pairsArg='1500']=process.argv.slice(2);const PAIRS=+pairsArg;
const expose=src=>rep(src,'nav:{cells:nav,','__route:route,__nearest:nearestNode,__seg:segmentFree,__setBudget(n){routeBudget=n;},nav:{cells:nav,');
const G=loadMain(root,{patch:src=>expose(flags==='base'?src:protoPatch(src,flags))});const {FWorld,FSimulation}=G.window;
const w=FWorld.create(96,9,{campaign:true,campaignVersion:2});const sim=FSimulation.create(w);const N=sim.nav;
let seed=7;const R=()=>(seed=(seed*1103515245+12345)>>>0)/4294967296;
// exact connectivity (radius .4) to sort pairs into reachable / unreachable, computed once with the public predicate
const comp=new Int32Array(N.cells.length).fill(-1);{let id=0;const q=new Int32Array(N.cells.length);for(let c=0;c<N.cells.length;c++){if(!N.cells[c]||comp[c]>=0)continue;let h=0,t=0;q[t++]=c;comp[c]=id;while(h<t){const i=q[h++],ix=i%N.nx;for(const j of [ix?i-1:-1,ix<N.nx-1?i+1:-1,i-N.nx,i+N.nx]){if(j<0||j>=N.cells.length||!N.cells[j]||comp[j]>=0)continue;if(sim.__seg(...N.coord(i),...N.coord(j),.4)){comp[j]=id;q[t++]=j;}}}id++;}}
const walk=[];for(let i=0;i<N.cells.length;i++)if(N.cells[i])walk.push(i);
function pairs(kind){const out=[];let guard=0;while(out.length<PAIRS&&guard++<PAIRS*400){const a=walk[Math.floor(R()*walk.length)],[ax,az]=N.coord(a);const ang=R()*Math.PI*2,d=6+R()*24,bx=ax+Math.cos(ang)*d,bz=az+Math.sin(ang)*d;const bIdx=N.idx(bx,bz);if(!N.cells[bIdx])continue;const same=comp[a]===comp[bIdx];if((kind==='same')!==same)continue;if(sim.__seg(ax,az,bx,bz,.38))continue;out.push([ax+.1,az+.1,bx,bz]);}return out;}
const actor={x:0,z:0,type:0,bossScale:1};
function run(list){const times=[];let nul=0,path=0;for(const [ax,az,bx,bz] of list){actor.x=ax;actor.z=az;sim.__setBudget(1e9);const t=performance.now();const r=sim.__route(actor,bx,bz);times.push(performance.now()-t);if(!r)nul++;else path++;}times.sort((a,b)=>a-b);const q=p=>times[Math.min(times.length-1,Math.floor(times.length*p))];return {n:times.length,mean:+(times.reduce((a,b)=>a+b,0)/times.length*1000).toFixed(0),p50:+(q(.5)*1000).toFixed(0),p95:+(q(.95)*1000).toFixed(0),max:+(times.at(-1)*1000).toFixed(0),nul,path};}
// let the time-sliced bake (if any) complete before the warm runs
const same=pairs('same'),diff=pairs('diff');
const cold=run(same.slice(0,300));
for(let i=0;i<120;i++)sim.step(1/60,{});
const warmSame=run(same),warmDiff=run(diff);
console.log(JSON.stringify({flags,unit:'us per route()',coldSame:cold,warmSame,warmDiff,labelsReady:globalThis.__navProbe?.labelsReady??null}));
