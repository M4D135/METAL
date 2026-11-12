// LOOP-02 (contre-vérif, domaine principal) : coût réel des A* de route(), échecs, plafonds, pas longs.
// node routes.mjs <monde> [s] [motif] [dt]
import {loadFast,rep,mkWorld,INPUTS,stat} from './fast.mjs';
const [label='campaign-9',secs='30',pat='a',hz='60']=process.argv.slice(2);
const W=loadFast({patch:(n,src)=>{if(n!=='simulation')return src;
  src=rep(src,'function segmentFree(ax,az,bx,bz,r=.4){','function segmentFree(ax,az,bx,bz,r=.4){G.__sf++;');
  src=rep(src,'if(!found)return null;\n','G.__heapEmpty=heap.length===0;G.__explored=explored;if(!found)return null;\n');
  src=rep(src,'const stamp=++routeSerial,heap=[];','G.__astar=true;const stamp=++routeSerial,heap=[];');
  src=rep(src,'function route(e,x,z){','function route(e,x,z){G.__astar=false;G.__explored=-1;G.__heapEmpty=null;const t0=performance.now(),sf0=G.__sf;const out=route__o(e,x,z);G.__routes.push({ms:performance.now()-t0,r:radius(e),astar:G.__astar,ok:out!==null,explored:G.__explored,heapEmpty:G.__heapEmpty,sf:G.__sf-sf0,pending:navPending,t:s.time,stuck:e.stuck>1.1,id:e.id});return out;}function route__o(e,x,z){');
  return src;}});
W.__sf=0;W.__routes=[];
const {FSimulation,FBrain}=W,input=INPUTS[pat],dt=1/+hz;
const opts=label.startsWith('classic')?{armorSystem:true,inventory:{weapons:[true,true,true],ammo:[180,36,12]}}:{armorSystem:true};
const mk=w=>FSimulation.create(w,{...opts,brain:FBrain.create({mode:'cpu'})});
{const w=mk(mkWorld(W,label));let t=0;for(let i=0;i<900;i++){w.step(dt,input(t));w.state.player.hp=Math.max(w.state.player.hp,60);t+=dt;}}
W.__routes.length=0;
const sim=mk(mkWorld(W,label)),s=sim.state;let t=0;const steps=[];
while(t<+secs&&!s.dead&&!s.won){const n0=W.__routes.length,rev=s.destructionRevision,t0=performance.now();sim.step(dt,input(t));const ms=performance.now()-t0;
  const rs=W.__routes.slice(n0);steps.push({ms,routeMs:rs.reduce((v,x)=>v+x.ms,0),failMs:rs.filter(x=>x.astar&&!x.ok).reduce((v,x)=>v+x.ms,0),rev:s.destructionRevision!==rev,t});
  s.player.hp=Math.max(s.player.hp,60);t+=dt;}
const R=W.__routes.filter(x=>x.astar),sum=a=>+a.reduce((v,x)=>v+x.ms,0).toFixed(1);
const fail=R.filter(x=>!x.ok),exh=fail.filter(x=>x.heapEmpty),cap=fail.filter(x=>x.heapEmpty===false);
const long8=steps.filter(x=>x.ms>8),long16=steps.filter(x=>x.ms>16);
// échecs répétés par le même ennemi
const byId={};for(const x of fail)byId[x.id]=(byId[x.id]||0)+1;
console.log(JSON.stringify({monde:label,motif:pat,hz:+hz,pas:steps.length,'pas ms':stat(steps.map(x=>x.ms)),'A*':R.length,'A* ms':sum(R),'échecs n/ms':[fail.length,sum(fail)],'dont tas vide':[exh.length,sum(exh)],'dont plafond 2400':[cap.length,sum(cap)],
 'échecs r>0.4':fail.filter(x=>x.r>.4).length,'échecs par ennemi (max)':Math.max(0,...Object.values(byId)),'ennemis en échec':Object.keys(byId).length,'succès n/ms':[R.length-fail.length,sum(R.filter(x=>x.ok))],
 'pas>8ms':long8.length,'dont >50% A* échouée':long8.filter(x=>x.failMs>x.ms*.5).length,'dont révision':long8.filter(x=>x.rev).length,'pas>16ms':long16.length,'total sim ms':+steps.reduce((v,x)=>v+x.ms,0).toFixed(0),'part route %':+(100*steps.reduce((v,x)=>v+x.routeMs,0)/steps.reduce((v,x)=>v+x.ms,0)).toFixed(1)}));
for(const x of [...steps].sort((a,b)=>b.ms-a.ms).slice(0,6))console.log(' pas',x.t.toFixed(2)+'s',x.ms.toFixed(1)+'ms route',x.routeMs.toFixed(1),'échec',x.failMs.toFixed(1),'rev',x.rev);
for(const x of [...fail].sort((a,b)=>b.ms-a.ms).slice(0,6))console.log(' A*',x.t.toFixed(2)+'s',x.ms.toFixed(1)+'ms r='+x.r.toFixed(2),'explorés',x.explored,'tasVide',x.heapEmpty,'segmentFree',x.sf,'navPending',x.pending,'stuck',x.stuck,'id',x.id);
