// Why is the goal unreachable? At each failed A* (first occurrence of each
// (enemy,start,end)), rerun an uncapped BFS from start under relaxed predicates:
//   base   exact segmentFree(.4) fresh (no cache)
//   r30    body radius .30 for cells and edges (player .28)
//   nodoor closed door boxes ignored
//   step1  step limit 1.0 m instead of .42 m
//   notrap trap boxes and floor-trap displacement ignored
//   links  base + jump-pad (pad cells -> target cell) and lift (lower <-> upper call) links
//   all    r30+nodoor+step1+notrap+links
// usage: node comps.mjs <repo> <circle|tour> <steps> <scenarios>
import {loadSet,rep,pickScen,makeDriver} from './lib.mjs';
const [root,driver='circle',stepsArg='1800',filter='legacy-s0']=process.argv.slice(2);const STEPS=+stepsArg;
const V=globalThis.__V={out:[],seen:new Set()};
function patch(src){
  src=rep(src,'    function route(e,x,z){',`    const __vis=new Uint32Array(nav.length),__q=new Int32Array(nav.length);let __stamp=0;
    function __segV(ax,az,bx,bz,r,o){
      const traps=o.notrap?[]:trapBoxes,act=o.notrap?[]:trapStates,doors=o.nodoor?[]:doorBoxes,g=(x,z)=>ground(x,z,act);
      const ya=g(ax,az),yb=g(bx,bz);
      if(blocked(ax,az,r,ya,doors,solids,traps)||blocked(bx,bz,r,yb,doors,solids,traps))return false;
      const dx=bx-ax,dz=bz-az,ay=Number.isFinite(ya)?ya:0,by=Number.isFinite(yb)?yb:0,minX=Math.min(ax,bx)-r-1e-7,maxX=Math.max(ax,bx)+r+1e-7,minZ=Math.min(az,bz)-r-1e-7,maxZ=Math.max(az,bz)+r+1e-7;
      for(const list of [solids,doors])for(const q of list){
        if(q.maxY<=Math.min(ay,by)+.06||q.minY>=Math.max(ay,by)+1.8)continue;
        if(q.maxX<minX||q.minX>maxX||q.maxZ<minZ||q.minZ>maxZ)continue;
        let lo=0,hi=1;
        for(const [origin,delta,min,max] of [[ax,dx,q.minX-r,q.maxX+r],[az,dz,q.minZ-r,q.maxZ+r]]){
          if(Math.abs(delta)<1e-8){if(origin<min||origin>max){hi=-1;break;}}
          else {let a=(min-origin)/delta,c=(max-origin)/delta;if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)break;}
        }
        if(hi>=lo&&hi>=0&&lo<=1)return false;
      }
      const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));let previous=ay;
      for(let j=1;j<=count;j++){const x=ax+dx*j/count,z=az+dz*j/count,y=g(x,z);if(!Number.isFinite(y)||Math.abs(y-previous)>o.step||blocked(x,z,r,y,doors,solids,traps))return false;previous=y;}
      return true;
    }
    function __cellV(i,o){const [x,z]=coord(i);return !blocked(x,z,o.r,ground(x,z,o.notrap?[]:trapStates),o.nodoor?[]:doorBoxes,solids,[]);}
    function __links(o){const L=new Map();if(!o.links)return L;const add=(a,b)=>{if(a<0||b<0)return;(L.get(a)||L.set(a,[]).get(a)).push(b);};
      for(const pad of s.jumpPads){const t=idx(pad.target.x,pad.target.z);const cx=idx(pad.x,pad.z),c0=cx%nx,r0=Math.floor(cx/nx);for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const j=(r0+dz)*nx+c0+dx;const [x,z]=coord(j);if(Math.hypot(x-pad.x,z-pad.z)<=pad.r+.4)add(j,t);}}
      for(const l of s.lifts){if(!l.lowerCall||!l.upperCall)continue;const a=idx(l.lowerCall.x,l.lowerCall.z),b=idx(l.upperCall.x,l.upperCall.z);add(a,b);add(b,a);}
      return L;}
    function __bfsV(start,end,o){
      const st=++__stamp,L=__links(o);let h=0,t=0;__q[t++]=start;__vis[start]=st;
      while(h<t){const i=__q[h++];if(i===end)return {ok:true,n:t};const ix=i%nx;
        const nb=[ix?i-1:-1,ix<nx-1?i+1:-1,i-nx,i+nx];
        for(const j of nb){if(j<0||j>=nav.length||__vis[j]===st||!__cellV(j,o))continue;if(!__segV(...coord(i),...coord(j),o.r,o))continue;__vis[j]=st;__q[t++]=j;}
        for(const j of L.get(i)||[]){if(__vis[j]===st)continue;__vis[j]=st;__q[t++]=j;}
      }
      return {ok:false,n:t};
    }
    function __why(e,start,end,x,z){
      const key=e.id+':'+start+':'+end;if(__V.seen.has(key))return;__V.seen.add(key);
      const B={r:.4,step:.42},res={};
      for(const [name,o] of [['base',B],['r30',{...B,r:.3}],['nodoor',{...B,nodoor:true}],['step1',{...B,step:1}],['notrap',{...B,notrap:true}],['links',{...B,links:true}],['all',{r:.3,step:1,nodoor:true,notrap:true,links:true}]])res[name]=__bfsV(start,end,o);
      const [sx,sz]=coord(start),[gx,gz]=coord(end);
      __V.out.push({t:+s.time.toFixed(2),id:e.id,type:e.type,at:[+e.x.toFixed(1),+e.z.toFixed(1)],goal:[+x.toFixed(1),+z.toFixed(1)],player:[+p.x.toFixed(1),+p.y.toFixed(2),+p.z.toFixed(1)],
        sy:+ground(sx,sz).toFixed(2),gy:+ground(gx,gz).toFixed(2),doorsClosed:s.doors.filter(d=>!d.open&&!d.destroyed).length,res:Object.fromEntries(Object.entries(res).map(([k,v])=>[k,(v.ok?'Y':'n')+v.n]))});
    }
    function route(e,x,z){`);
  src=rep(src,'if(!found)return null;','if(!found){__why(e,start,end,x,z);return null;}');
  return src;
};
const W=loadSet(root,{patch});const {FWorld,FSimulation,FBrain}=W;
for(const [label,idx,opts] of pickScen(filter)){
  V.out.length=0;V.seen.clear();
  const w=FWorld.create(96,idx,opts);const sim=FSimulation.create(w,{brain:FBrain.create({mode:'cpu'})});const s=sim.state;
  const drive=makeDriver(driver,sim,w),input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};
  for(let i=0;i<STEPS;i++){drive(i,input);sim.step(1/60,input);s.events.length=0;if(s.dead)break;}
  const agg={};for(const r of V.out)for(const [k,v] of Object.entries(r.res))agg[k]=(agg[k]||0)+(v[0]==='Y'?1:0);
  console.log(`=== ${label} ${driver} uniqueFailures=${V.out.length} connectedUnder=${JSON.stringify(agg)} pads=${s.jumpPads.length} lifts=${s.lifts.length} doors=${s.doors.length}`);
  for(const r of V.out.slice(0,10))console.log('  '+JSON.stringify(r));
}
