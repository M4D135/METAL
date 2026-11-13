// Reachability explorer driving the REAL player physics (move / locomote / airMove / land / checkPad / checkPlayerBounds
// of src/simulation.js, main realm, patched in memory). States are real standing positions, deduplicated per 0.5 m cell + height level.
// usage: node explore.mjs <world label> <mode W|J|JC> [key=value ...]
//   W  = baseline physics (unpatched), walking + ledge drops + pads + lifts        (what 0.8.0 allows without demolition)
//   J  = FEEL-08/09 prototype, walking + jumps (0 / 3.8 / 7.6 / 10.5 m/s take-off), no clip
//   JC = same with perfect containment: a flight that enters a boundary footprint or ends outside is recorded, not expanded
import {writeFileSync} from 'node:fs';
import {loadFast,WORLDS} from './lib.mjs';import {physPatches} from './phys.mjs';
const [label,mode='J',...rest]=process.argv.slice(2);const opt=Object.fromEntries(rest.map(a=>a.split('=')).map(([k,v])=>[k,isNaN(+v)?v:+v]));
const entry=WORLDS.find(w=>w[0]===label);if(!entry)throw new Error('unknown world '+label);
const JUMP=mode.startsWith('J'),CONTAIN=mode.endsWith('C');
const patches=physPatches({fatal:opt.fatal??7.75,airStep:opt.airStep??0,cap:opt.cap??10.5,jump:opt.jump??6.2});
if(!JUMP){ // baseline physics: keep only the hook lines (state + internals), drop behaviour patches
  patches.simulation=patches.simulation.filter(([from])=>from.startsWith('let velocityX=0')||from.startsWith('return {state:s')||from.startsWith('function actorBlocked'));
  patches.simulation[0][1]=patches.simulation[0][1].replace('const Q=motionProfile.q||null;','const Q=null;');
}
const W=loadFast({patches});
const T0=performance.now();
const world=W.FWorld.create(96,entry[1],entry[2]);const sim=W.FSimulation.create(world,{});const I=sim.__I,s=sim.state,p=s.player,HK=I.HK,b=world.bounds;
const CELL=opt.cell??0.6,YQ=0.25,NX=Math.ceil((b.maxX-b.minX)/CELL)+1,NZ=Math.ceil((b.maxZ-b.minZ)/CELL)+1,DT=1/60;
const keyOf=(x,z,y)=>(Math.round((y+16)/YQ)*NZ+Math.floor((z-b.minZ)/CELL))*NX+Math.floor((x-b.minX)/CELL);
// ---- geometry helpers -------------------------------------------------------------------------------------------
const floors=world.walkable,authored=floors.filter(f=>!f.substrate&&!f.fallback);
const inAuthored=(x,z,m=0)=>{for(const f of authored)if(Math.abs(x-f.x)<=f.w/2+m&&Math.abs(z-f.z)<=f.d/2+m)return true;return false;};
const bounds=(world.outdoorBoundaries||[]).map(bd=>{const c=world.colliders.find(c=>c.mesh===bd.mesh);return c?{...c,base:c.minY,region:bd.region}:null;}).filter(Boolean);
const BG=4,bgx=Math.floor(b.minX/BG),bgz=Math.floor(b.minZ/BG),bgw=Math.floor(b.maxX/BG)-bgx+1,bgd=Math.floor(b.maxZ/BG)-bgz+1,bgrid=Array.from({length:bgw*bgd},()=>[]);
for(const q of bounds)for(let z=Math.floor((q.minZ-.4)/BG)-bgz;z<=Math.floor((q.maxZ+.4)/BG)-bgz;z++)for(let x=Math.floor((q.minX-.4)/BG)-bgx;x<=Math.floor((q.maxX+.4)/BG)-bgx;x++)if(x>=0&&z>=0&&x<bgw&&z<bgd)bgrid[z*bgw+x].push(q);
function overBoundary(x,z){const l=bgrid[(Math.floor(z/BG)-bgz)*bgw+Math.floor(x/BG)-bgx];if(!l)return null;for(const q of l){const dx=x<q.minX?q.minX-x:x>q.maxX?x-q.maxX:0,dz=z<q.minZ?q.minZ-z:z>q.maxZ?z-q.maxZ:0;if(dx*dx+dz*dz<.28*.28)return q;}return null;}
// "inside" = over an authored floor and not standing on a boundary wall
// raster for jump pruning: ground height and lowest box top above ground per 0.25 m cell
const RS=.25,RX=Math.ceil((b.maxX-b.minX)/RS)+1,RZ=Math.ceil((b.maxZ-b.minZ)/RS)+1,rGround=new Float32Array(RX*RZ),rLow=new Float32Array(RX*RZ).fill(1e9);
for(let iz=0;iz<RZ;iz++)for(let ix=0;ix<RX;ix++){const g=I.ground(b.minX+(ix+.5)*RS,b.minZ+(iz+.5)*RS);rGround[iz*RX+ix]=Number.isFinite(g)?g:-99;}
function rasterBox(q,always=false){const x0=Math.max(0,Math.floor((q.minX-.45-b.minX)/RS)),x1=Math.min(RX-1,Math.floor((q.maxX+.45-b.minX)/RS)),z0=Math.max(0,Math.floor((q.minZ-.45-b.minZ)/RS)),z1=Math.min(RZ-1,Math.floor((q.maxZ+.45-b.minZ)/RS));
  for(let iz=z0;iz<=z1;iz++)for(let ix=x0;ix<=x1;ix++){const k=iz*RX+ix;if(always){rLow[k]=-99;continue;}if(q.maxY>rGround[k]+.06&&q.maxY<rLow[k])rLow[k]=q.maxY;}}
for(const q of I.solids)rasterBox(q);
for(const l of s.lifts)rasterBox({minX:l.x-l.w/2-1,maxX:l.x+l.w/2+1,minZ:l.z-l.d/2-1,maxZ:l.z+l.d/2+1},true);
function interesting(x,z,y,ux,uz,len){ // anything a jump could use along this corridor that walking cannot?
  for(let d=0;d<=len;d+=RS)for(let o=-1;o<=1;o++){const px=x+ux*d-uz*o*.3,pz=z+uz*d+ux*o*.3,ix=Math.floor((px-b.minX)/RS),iz=Math.floor((pz-b.minZ)/RS);if(ix<0||iz<0||ix>=RX||iz>=RZ)continue;const k=iz*RX+ix;if(Math.abs(rGround[k]-y)>.03||rLow[k]<=y+1.02)return true;}
  return false;
}
// ---- BFS storage ---------------------------------------------------------------------------------------------
const CAP=opt.cap2??400000;const X=new Float64Array(CAP),Z=new Float64Array(CAP),Y=new Float64Array(CAP),STG=new Uint8Array(CAP),FLG=new Uint8Array(CAP),PAR=new Int32Array(CAP),PRIM=new Uint8Array(CAP);
const seen=new Map();let N=0;const queue=[];let qh=0;const E1=[],E2=[];
const F_OUT=1,F_BOUND=2,F_BOX=4,F_VIAJUMP=8,F_VIAOUT=16;
let stage=0;
function classify(){let f=0;const g=I.ground(p.x,p.z);if(!inAuthored(p.x,p.z))f|=F_OUT;if(overBoundary(p.x,p.z)&&p.y>g+.3)f|=F_BOUND;if(p.y>g+.06)f|=F_BOX;return f;}
function add(parent,prim,extra=0){
  if(CONTAIN&&parent>=0&&!(FLG[parent]&(F_OUT|F_BOUND|F_VIAOUT))){const f=classify();if(f&(F_OUT|F_BOUND)){if(prim<10&&!leakSeen.has(parent)){leakSeen.add(parent);walkLeaks.push({from:[+X[parent].toFixed(2),+Y[parent].toFixed(2),+Z[parent].toFixed(2)],to:[+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)],flags:f,prim});}return -1;}}
  const k=keyOf(p.x,p.z,p.y);let n=seen.get(k);
  if(n===undefined){if(N>=CAP)throw new Error('node cap');n=N++;seen.set(k,n);X[n]=p.x;Z[n]=p.z;Y[n]=p.y;STG[n]=stage;FLG[n]=classify()|extra|(parent>=0&&(FLG[parent]&(F_OUT|F_VIAOUT))?F_VIAOUT:0);PAR[n]=parent;PRIM[n]=prim;queue.push(n);onNew(n);}
  if(parent>=0&&parent!==n){E1.push(parent);E2.push(n);if((FLG[parent]&F_OUT)&&!(FLG[n]&(F_OUT|F_BOUND))&&reentries.length<4000)reentries.push([+X[parent].toFixed(2),+Y[parent].toFixed(2),+Z[parent].toFixed(2),+X[n].toFixed(2),+Y[n].toFixed(2),+Z[n].toFixed(2),prim,stage]);}
  return n;
}
function place(n){p.x=X[n];p.z=Z[n];p.y=Y[n];p.airborne=false;p.airVX=p.airVY=p.airVZ=p.airTime=0;p.padCooldown=0;p.padId=null;p.dashing=0;p.hp=100;s.dead=false;s.won=false;I.stopMotion();I.setJump(0,0);}
// ---- objectives --------------------------------------------------------------------------------------------------
const objects=new Map();const hit=(id,n)=>{if(!objects.has(id))objects.set(id,{stage,node:n});};
const rooms=world.rooms||[];
function onNew(n){
  for(const c of world.cores)if(Math.abs(p.y-(c.y||0))<.8&&Math.hypot(p.x-c.x,p.z-c.z)<1.35)hit('core-'+c.id,n);
  if(Math.abs(p.y-(world.exit.y||0))<.8&&Math.hypot(p.x-world.exit.x,p.z-world.exit.z)<1.5)hit('exit',n);
  for(const m of s.mechanisms)if(!objects.has(m.id)&&I.reachMech(m))hit(m.id,n);
  for(const r of rooms)if(!objects.has('room-'+r.id)&&Math.abs(p.x-r.x)<r.w/2-1&&Math.abs(p.z-r.z)<r.d/2-1&&Math.abs(p.y-(r.y||0))<.6)hit('room-'+r.id,n);
  for(const l of s.lifts){const on=Math.abs(p.x-l.x)<=l.w/2-.08&&Math.abs(p.z-l.z)<=l.d/2-.08;if(on&&Math.abs(p.y-l.minY)<.25)hit(l.id+':bas',n);if(on&&Math.abs(p.y-l.maxY)<.25)hit(l.id+':haut',n);
    for(const [tag,call] of [['appel-bas',l.lowerCall],['appel-haut',l.upperCall]])if(call&&Math.hypot(call.x-p.x,call.z-p.z)<=2.6&&Math.abs(call.y-p.y)<1.05)hit(l.id+':'+tag,n);}
  for(const q of world.shops||[])if(Math.hypot(p.x-q.x,p.z-q.z)<=2.6&&Math.abs(p.y-(q.y||0))<1.05)hit(q.id,n);
}
// ---- flights ---------------------------------------------------------------------------------------------------
const stat={walkSims:0,jumpSims:0,jumpPruned:0,deaths:{fatalFall:0,beneath:0,void:0,timeout:0},deathsWalk:0,deathsJump:0,softFallback:0,softFallbackJump:0,fallbackLandings:0,frozen:0,frozenNear:0,head:0,crossings:0,stuck:0,maxFeet:-99,padFlights:0};
const crossings=[];const reentries=[];const deathSamples=[];const walkLeaks=[],leakSeen=new Set();const freezeHist=new Array(12).fill(0);
HK.onFreeze=(dh)=>{freezeHist[Math.min(11,Math.floor(dh/.1))]++;};
let flightMinRel=1e9,flightBound=null,flightMaxFeet=-99,flightCore=false;
function track(){const q=overBoundary(p.x,p.z);if(q){const rel=p.y-q.base;if(rel<flightMinRel){flightMinRel=rel;flightBound=q;}}if(p.y>flightMaxFeet)flightMaxFeet=p.y;
  for(const c of world.cores)if(Math.abs(p.y-(c.y||0))<.8&&Math.hypot(p.x-c.x,p.z-c.z)<1.35)flightCore=c.id;}
const NOIN={moveX:0,moveY:0,sprint:true};
function fly(input){ // returns 'ok' (standing), or a death cause
  let t=0;flightMinRel=1e9;flightBound=null;flightMaxFeet=p.y;flightCore=false;let pads=0;
  while(t<7){
    I.locomote(DT,input);t+=DT;track();
    if(s.dead)return 'fatalFall';
    if(I.checkPlayerBounds())return p.y<-14?'void':'beneath';
    if(!p.airborne){I.checkPad(p);if(!p.airborne)return 'ok';if(++pads>3)return 'timeout';stat.padFlights++;input=NOIN;}
  }
  return 'timeout';
}
function finish(n,prim,res,isJump){
  s.events.length=0;
  if(res!=='ok'){stat.deaths[res]++;if(isJump)stat.deathsJump++;else stat.deathsWalk++;if(deathSamples.length<40)deathSamples.push({from:[+X[n].toFixed(2),+Y[n].toFixed(2),+Z[n].toFixed(2)],at:[+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)],cause:res,prim,impact:+(HK.lastImpact||0).toFixed(2),fromFlags:FLG[n]});return -1;}
  if(HK.lastLandSerial!==HK.lands){HK.lastLandSerial=HK.lands;if(HK.lastFallback){stat.fallbackLandings++;if(HK.lastImpact>6){stat.softFallback++;if(isJump)stat.softFallbackJump++;}}}
  if(flightCore!==false)hit('core-'+flightCore,n);
  const f=classify();
  if(isJump&&flightMaxFeet>stat.maxFeet)stat.maxFeet=flightMaxFeet;
  const fromIn=!(FLG[n]&(F_OUT|F_BOUND|F_VIAOUT));
  if(fromIn&&(f&(F_OUT|F_BOUND))){stat.crossings++;const rel=flightBound?flightMinRel:null;crossings.push({from:n,x:p.x,y:p.y,z:p.z,flags:f,rel,prim});if(CONTAIN)return -1;}
  return add(n,prim,isJump?F_VIAJUMP:0);
}
// ---- primitives ------------------------------------------------------------------------------------------------
const DIR16=Array.from({length:16},(_,i)=>[Math.sin(i*Math.PI/8),-Math.cos(i*Math.PI/8),i*Math.PI/8]);// forward for yaw a = (sin a, -cos a)
const FWD={moveX:0,moveY:1,sprint:true};
// jump variants: [take-off speed, input, reach used for pruning, 16 directions?]
const JV=[[7.6,FWD,5.4,true],[10.5,FWD,7.3,true],[0,FWD,2.3,false],[3.8,NOIN,3.0,false]];
function expand(n){
  const y0=Y[n],onBox=FLG[n]&(F_BOX|F_BOUND|F_OUT);
  // walking: 16 directions x 2 step lengths; ledge drops at sprint speed (forward held) and creeping (no input)
  const plain=(FLG[n]&F_OUT)&&!(FLG[n]&(F_BOX|F_BOUND));
  for(let d=0;d<16;d+=plain?2:1){const [ux,uz,yaw]=DIR16[d];
    for(const L of plain||opt.fast?[.6]:[.3,.6]){
      place(n);p.yaw=yaw;I.setVel(ux*7.6,uz*7.6);I.move(p,ux*L,uz*L);stat.walkSims++;
      if(p.airborne){const res=fly(FWD);finish(n,1,res,false);
        place(n);p.yaw=yaw;I.setVel(ux*1,uz*1);I.move(p,ux*L,uz*L);if(p.airborne){const r2=fly(NOIN);finish(n,2,r2,false);}
      }else{
        if(I.checkPlayerBounds()){finish(n,0,p.y<-14?'void':'beneath',false);continue;}
        I.checkPad(p);if(p.airborne){stat.padFlights++;const res=fly(NOIN);finish(n,3,res,false);}else{flightCore=false;add(n,0);}
      }
    }
  }
  if(!JUMP)return;
  for(let v=0;v<JV.length;v++){const [speed,input,reach,all]=JV[v];if(plain&&(v===1||v===3))continue;
    for(let d=0;d<16;d+=all&&!plain&&!(opt.fast&&v===1&&!onBox)?1:2){const [ux,uz,yaw]=DIR16[d];
      if(!onBox&&!interesting(X[n],Z[n],y0,ux,uz,reach)){stat.jumpPruned++;continue;}
      place(n);p.yaw=yaw;I.setVel(ux*speed,uz*speed);I.setJump(.12,0);const f0=HK.frozen,fn0=HK.frozenNear,h0=HK.head;
      const res=fly(input);stat.jumpSims++;stat.frozen+=HK.frozen-f0;stat.frozenNear+=HK.frozenNear-fn0;stat.head+=HK.head-h0;
      const m=finish(n,10+v,res,true);
      if(m>=0&&I.blocked(X[m],Z[m],.28,Y[m]))stat.stuck++;
    }
  }
}
// ---- progression stages -------------------------------------------------------------------------------------
const activeMech=new Set(),usedLifts=new Set();const stageLog=[];
function requeueNear(x,z,r){for(let n=0;n<N;n++)if(Math.abs(X[n]-x)<r&&Math.abs(Z[n]-z)<r)queue.push(n);}
function advance(){
  let changed=false;
  for(const m of s.mechanisms)if(objects.has(m.id)&&!activeMech.has(m.id)){activeMech.add(m.id);m.active=true;changed=true;
    for(const d of s.doors)if(d.requires===m.id){d.progress=1;d.open=true;requeueNear(d.x,d.z,9);}
    for(const l of s.lifts)if(l.requires===m.id)l.powered=true;}
  I.updateDoorBoxes();
  for(const l of s.lifts)if(l.powered&&!usedLifts.has(l.id)&&[':bas',':appel-bas',':appel-haut',':haut'].some(t=>objects.has(l.id+t))){usedLifts.add(l.id);l.y=l.maxY;changed=true;
    // riding up: seed a standing state on the raised platform, then re-expand the neighbourhood at both levels
    p.x=l.x;p.z=l.z;p.y=l.maxY;p.airborne=false;const before=N;add(-1,4);if(N>before)STG[N-1]=stage+1;requeueNear(l.x,l.z,9);}
  return changed;
}
// ---- run ---------------------------------------------------------------------------------------------------------
place(0);p.x=world.spawn.x;p.z=world.spawn.z;p.y=world.spawn.y??I.ground(p.x,p.z);add(-1,0);
const LIMIT=(opt.limit??240)*1000;let aborted=false;
for(;;){
  while(qh<queue.length){expand(queue[qh++]);if((qh&255)===0&&performance.now()-T0>LIMIT){aborted=true;break;}}
  if(aborted)break;
  stageLog.push({stage,nodes:N,objects:[...objects].filter(([,v])=>v.stage===stage).map(([k])=>k)});
  stage++;if(!advance())break;
}
// ---- dead ends: reverse reachability to the spawn / exit over the recorded edges ------------------------------
const rev=Array.from({length:N},()=>[]);for(let i=0;i<E1.length;i++)rev[E2[i]].push(E1[i]);
function back(seeds){const ok=new Uint8Array(N);const st=[...seeds];for(const n of st)ok[n]=1;while(st.length){const n=st.pop();for(const m of rev[n])if(!ok[m]){ok[m]=1;st.push(m);}}return ok;}
const exitNode=objects.get('exit')?.node,toSpawn=back([0]),toExit=exitNode!==undefined?back([exitNode]):new Uint8Array(N);
let dead=0,deadIn=0;const deadSamples=[];for(let n=0;n<N;n++)if(!toSpawn[n]&&!toExit[n]){dead++;if(!(FLG[n]&F_OUT))deadIn++;if(deadSamples.length<25)deadSamples.push([+X[n].toFixed(2),+Y[n].toFixed(2),+Z[n].toFixed(2),FLG[n]]);}
let noSpawn=0;for(let n=0;n<N;n++)if(!toSpawn[n])noSpawn++;
// ---- summary ------------------------------------------------------------------------------------------------------
let out=0,onBound=0,onBox=0,viaOut=0,maxPerch=-99;const perches=[];
for(let n=0;n<N;n++){const f=FLG[n];if(f&F_OUT)out++;if(f&F_BOUND)onBound++;if(f&F_VIAOUT)viaOut++;if(f&F_BOX){onBox++;const g=I.ground(X[n],Z[n]);const h=Y[n]-g;if(h>maxPerch)maxPerch=h;if(!(f&(F_OUT|F_BOUND))&&h>=.6)perches.push([+X[n].toFixed(3),+Y[n].toFixed(3),+Z[n].toFixed(3),+h.toFixed(2)]);}}
const rels=crossings.map(c=>c.rel).filter(v=>v!==null).sort((a,c)=>a-c);
const path=n=>{const r=[];for(let k=n,i=0;k>=0&&i<400;k=PAR[k],i++)r.push([+X[k].toFixed(1),+Y[k].toFixed(1),+Z[k].toFixed(1),PRIM[k]]);return r.reverse();};
const result={label,mode,opt,ms:Math.round(performance.now()-T0),aborted,nodes:N,edges:E1.length,stages:stageLog,objects:Object.fromEntries([...objects].map(([k,v])=>[k,v.stage])),stat,freezeHist,
  outside:out,onBoundary:onBound,onBox,viaOutside:viaOut,maxPerchHeight:+maxPerch.toFixed(2),crossingCount:crossings.length,crossingRel:rels.length?{min:+rels[0].toFixed(2),p50:+rels[rels.length>>1].toFixed(2),max:+rels[rels.length-1].toFixed(2),over234:rels.filter(v=>v>=2.34).length,over174:rels.filter(v=>v>=1.74).length,over114:rels.filter(v=>v>=1.14).length}:null,
  crossingNoWall:crossings.filter(c=>c.rel===null).length,walkLeakCount:walkLeaks.length,walkLeaks:walkLeaks.slice(0,30),jumpCrossings:crossings.filter(c=>c.prim>=10).length,walkCrossings:crossings.filter(c=>c.prim<10).length,deadEnds:dead,deadEndsInside:deadIn,noReturnToSpawn:noSpawn,deadSamples,deathSamples,
  crossSamples:crossings.slice(0,12).map(c=>({from:[+X[c.from].toFixed(1),+Y[c.from].toFixed(2),+Z[c.from].toFixed(1)],to:[+c.x.toFixed(1),+c.y.toFixed(2),+c.z.toFixed(1)],rel:c.rel===null?null:+c.rel.toFixed(2),prim:c.prim})),
  topCross:crossings.filter(c=>c.rel!==null).sort((a,c)=>c.rel-a.rel).slice(0,6).map(c=>({from:[+X[c.from].toFixed(1),+Y[c.from].toFixed(2),+Z[c.from].toFixed(1)],to:[+c.x.toFixed(1),+c.y.toFixed(2),+c.z.toFixed(1)],rel:+c.rel.toFixed(2),path:path(c.from).slice(-8)})),
  objectPaths:Object.fromEntries([...objects].filter(([k,v])=>FLG[v.node]&(F_VIAJUMP|F_VIAOUT)||opt.paths).map(([k,v])=>[k,path(v.node).filter((q,i,a)=>q[3]>=10||i===a.length-1).slice(-6)])),
  reentryCount:reentries.length,reentries:reentries.filter((r,i)=>i%Math.max(1,Math.floor(reentries.length/40))===0).slice(0,40),perchCount:perches.length,firstOutPath:(()=>{for(let n=0;n<N;n++)if((FLG[n]&F_OUT)&&Y[n]<I.ground(X[n],Z[n])+.05){const r=path(n);return {stage:STG[n],len:r.length,tail:r.slice(-16)};}return null;})(),
  outsideAliveOnSubstrate:(()=>{let c=0;for(let n=0;n<N;n++)if((FLG[n]&F_OUT)&&Y[n]<I.ground(X[n],Z[n])+.05)c++;return c;})(),
  earliestViaOut:Object.fromEntries([...objects].filter(([k,v])=>FLG[v.node]&F_VIAOUT).map(([k,v])=>[k,v.stage]))};
writeFileSync(new URL('./out/'+label+'-'+mode+(opt.tag?'-'+opt.tag:'')+'-x.json',import.meta.url),JSON.stringify({...result,perches:perches.length>4000?perches.filter((_,i)=>i%Math.ceil(perches.length/4000)===0):perches}));
const {deathSamples:_d,deadSamples:_e,crossSamples:_c,topCross:_t,objectPaths:_o,walkLeaks:_w,firstOutPath:_f,reentries:_r,...short}=result;console.log(JSON.stringify(short));
