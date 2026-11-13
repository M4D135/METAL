// Contre-vérification LOOP-02 : recherches A* de route() — échec par épuisement du tas ou par
// plafond de 2 400, cache d'arêtes froid ou chaud, coût, et part des pas longs qu'elles expliquent.
// node routecheck.mjs <ferro> <monde> [secondes] [motif d'entrée a|b]
import {load} from './load.mjs';
import {performance} from 'node:perf_hooks';
const [root,label='campaign-9',secs='30',pattern='b']=process.argv.slice(2);
const W=load(root,{patch:src=>{
  const rep=(a,b)=>{if(!src.includes(a))throw new Error('motif '+a);src=src.replace(a,b);};
  rep('function segmentFree(ax,az,bx,bz,r=.4){','function segmentFree(ax,az,bx,bz,r=.4){G.__sf++;');
  rep('if(!found)return null;\n','G.__heapEmpty=heap.length===0;G.__explored=explored;if(!found)return null;\n');
  rep('const stamp=++routeSerial,heap=[];','let __unk=0;for(let __i=0;__i<nav.length;__i++)if(nav[__i]&&edgeKnown[__i]!==15)__unk++;G.__unknown=__unk;G.__astar=true;const stamp=++routeSerial,heap=[];');
  rep('const start=nearestNode(e.x,e.z,r),end=nearestNode(x,z,r);','const start=nearestNode(e.x,e.z,r),end=nearestNode(x,z,r);G.__se=[start,end];');
  rep('function route(e,x,z){','function __navComp(a,b){const seen=new Uint8Array(nav.length),q=[a];seen[a]=1;let n=0,hit=false;while(q.length){const i=q.pop();n++;if(i===b)hit=true;const ix=i%nx;for(const j of [ix?i-1:-1,ix<nx-1?i+1:-1,i-nx,i+nx])if(j>=0&&j<nav.length&&nav[j]&&!seen[j]){seen[j]=1;q.push(j);}}return {hit,n};}function route(e,x,z){G.__se=null;G.__astar=false;G.__explored=-1;G.__heapEmpty=null;const t0=performance.now(),sf0=G.__sf;const out=route__o(e,x,z);const __ms=performance.now()-t0,__b0=performance.now();const __c=(G.__astar&&out===null&&G.__se)?__navComp(G.__se[0],G.__se[1]):null;G.__bfs+=performance.now()-__b0;G.__routes.push({navSame:__c?__c.hit:null,navSize:__c?__c.n:null,ms:__ms,r:radius(e),astar:G.__astar,ok:out!==null,explored:G.__explored,heapEmpty:G.__heapEmpty,sf:G.__sf-sf0,unknown:G.__unknown,pending:navPending,t:s.time});return out;}function route__o(e,x,z){');
  return src;}});
W.__sf=0;W.__routes=[];W.__bfs=0;
const {FWorld,FSimulation,FBrain}=W;
const mk=()=>{const [k,i]=label.split('-');return k==='classic'?FWorld.create(96,+i):FWorld.create(96,+i,{campaign:true,campaignVersion:2});};
const world=mk(),opts={armorSystem:true};
const inputs={a:t=>({moveX:Math.sin(t*.667),moveY:1,sprint:true,fire:(t%.333)<.1,dash:false,lookX:.01,lookY:0}),
  b:t=>({moveX:Math.sign(Math.sin(t*.9)),moveY:1,lookX:.012,lookY:0,fire:true,fireLeft:false,dash:(t%2.5)<1/60,sprint:(t%4)<2,weapon:Math.floor(t/5)%5})};
const input=inputs[pattern];
// Chauffe du JIT sur un autre exemplaire.
{const w=FSimulation.create(world,{...opts,brain:FBrain.create({mode:'cpu'})});let t=0;for(let i=0;i<600;i++){w.step(1/60,input(t));w.state.player.hp=Math.max(w.state.player.hp,60);t+=1/60;}}
W.__routes.length=0;
const sim=FSimulation.create(mk(),{...opts,brain:FBrain.create({mode:'cpu'})}),s=sim.state;let t=0;const steps=[];
while(t<+secs&&!s.dead&&!s.won){const n0=W.__routes.length,rev=s.destructionRevision,b0=W.__bfs,t0=performance.now();sim.step(1/60,input(t));const ms=performance.now()-t0-(W.__bfs-b0);
  const rs=W.__routes.slice(n0);steps.push({ms,routeMs:rs.reduce((v,x)=>v+x.ms,0),failMs:rs.filter(x=>x.astar&&!x.ok).reduce((v,x)=>v+x.ms,0),rev:s.destructionRevision!==rev});
  s.player.hp=Math.max(s.player.hp,60);t+=1/60;}
const R=W.__routes.filter(x=>x.astar),sum=a=>+a.reduce((v,x)=>v+x.ms,0).toFixed(1);
const fail=R.filter(x=>!x.ok),exh=fail.filter(x=>x.heapEmpty),cap=fail.filter(x=>!x.heapEmpty);
const cold=fail.filter(x=>x.sf>1500),warm=fail.filter(x=>x.sf<=1500),navDiff=fail.filter(x=>x.navSame===false);
const long=steps.filter(x=>x.ms>16),longRoute=long.filter(x=>x.failMs>x.ms*.5);
console.log(JSON.stringify({monde:label,motif:pattern,pas:steps.length,'appels route':W.__routes.length,'A*':R.length,'A* ms':sum(R),
 'échecs n/ms':[fail.length,sum(fail)],'échecs par tas vide n/ms':[exh.length,sum(exh)],'échecs au plafond n/ms':[cap.length,sum(cap)],
 'échecs froids (>1500 segmentFree) n/ms':[cold.length,sum(cold)],'échecs où départ et arrivée sont dans deux composantes de nav[] n/ms':[navDiff.length,sum(navDiff)],'échecs cache chaud n/ms':[warm.length,sum(warm)],
 'succès n/ms':[R.length-fail.length,sum(R.filter(x=>x.ok))],
 'pas >16 ms':long.length,'dont >50 % en A* échouée':longRoute.length,'pas >16 ms avec révision':long.filter(x=>x.rev).length,
 'pas max ms':+Math.max(...steps.map(x=>x.ms)).toFixed(1),'p99':+[...steps.map(x=>x.ms)].sort((a,b)=>a-b)[Math.floor(steps.length*.99)].toFixed(2)}));
for(const x of [...fail].sort((a,b)=>b.ms-a.ms).slice(0,10))console.log(x.t.toFixed(2)+'s',x.ms.toFixed(1)+'ms r='+x.r.toFixed(2),'explorés',x.explored,'tasVide',x.heapEmpty,'segmentFree',x.sf,'navMêmeComposante',x.navSame,'tailleComposanteNav',x.navSize,'navPending',x.pending);
