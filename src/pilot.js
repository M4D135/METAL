/* METAL — deterministic input pilot; bounded searches, no state writes. */
(function(G){'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=a=>{a%=Math.PI*2;return a>Math.PI?a-Math.PI*2:a<-Math.PI?a+Math.PI*2:a;};
const HEIGHT=[1.35,1.05,1.6,1.8];

function createPilot(sim,world,opt={}){
  const s=sim.state,p=s.player,nav=sim.nav,nx=nav.nx,nz=nav.nz,N=nx*nz,CELL=nav.cell||.8,b=world.bounds;
  const breachMesh=world.meshes.find(m=>m.category==='profile-breach');
  const cells=new Uint8Array(N),cellKnown=new Uint8Array(N),traverse=nav.playerTraverse||nav.canTraverse;
  function walkable(i){if(!cellKnown[i]){cellKnown[i]=1;cells[i]=nav.playerCell?Number(nav.playerCell(i)):nav.cells[i];}return cells[i];}
  const cx=i=>b.minX+(i%nx)*CELL,cz=i=>b.minZ+((i/nx)|0)*CELL;
  const cellOf=(x,z)=>clamp(Math.round((z-b.minZ)/CELL),0,nz-1)*nx+clamp(Math.round((x-b.minX)/CELL),0,nx-1);
  // --- cache d'arêtes paresseux (4 bits par cellule : -x,+x,-z,+z), vidé quand la topologie change
  const edgeKnown=new Uint8Array(N),edgeOpen=new Uint8Array(N);
  const gCost=new Float32Array(N),prev=new Int32Array(N),stamp=new Uint32Array(N),closed=new Uint32Array(N);
  let search=null,searchBudget=96,lastProfile=s.activeProfile,targetReady=0,jetRecover=false;
  let heapI=new Int32Array(4096),heapK=new Float32Array(4096),heapN=0,serial=0;
  const stats={astar:0,astarFail:0,astarNoEnd:0,astarCap:0,astarNodes:0,edgeTests:0,replans:0,unstick:0,interacts:0,think:0,topology:0,nearestLoose:0,padRoutes:0};
  const OFF=[-1,1,-nx,nx],REV=[1,0,3,2];
  const padMask=new Uint8Array(N);for(const pad of world.jumpPads||[]){const R=(pad.r||1.15)+.75,c=cellOf(pad.x,pad.z),ix=c%nx,iz=(c/nx)|0,n=Math.ceil(R/CELL)+1;for(let dz=-n;dz<=n;dz++)for(let dx=-n;dx<=n;dx++){const jx=ix+dx,jz=iz+dz;if(jx<0||jx>=nx||jz<0||jz>=nz)continue;const j=jz*nx+jx;if(Math.hypot(cx(j)-pad.x,cz(j)-pad.z)<R)padMask[j]=1;}}
  function edge(i,k){
    const m=1<<k;if(edgeKnown[i]&m)return (edgeOpen[i]&m)!==0;
    const j=i+OFF[k];let ok=false;
    if(j>=0&&j<N&&walkable(j)&&!(k===0&&i%nx===0)&&!(k===1&&i%nx===nx-1)){stats.edgeTests++;ok=traverse(cx(i),cz(i),cx(j),cz(j),.28);}
    edgeKnown[i]|=m;if(ok)edgeOpen[i]|=m;
    if(j>=0&&j<N){const r=1<<REV[k];edgeKnown[j]|=r;if(ok)edgeOpen[j]|=r;}
    return ok;
  }
  function push(i,k){if(heapN===heapI.length){const a=new Int32Array(heapN*2),c=new Float32Array(heapN*2);a.set(heapI);c.set(heapK);heapI=a;heapK=c;}let at=heapN++;while(at){const par=(at-1)>>1;if(heapK[par]<=k)break;heapI[at]=heapI[par];heapK[at]=heapK[par];at=par;}heapI[at]=i;heapK[at]=k;}
  function pop(){const top=heapI[0],li=heapI[--heapN],lk=heapK[heapN];if(heapN){let at=0;for(;;){let c=at*2+1;if(c>=heapN)break;if(c+1<heapN&&heapK[c+1]<heapK[c])c++;if(heapK[c]>=lk)break;heapI[at]=heapI[c];heapK[at]=heapK[c];at=c;}heapI[at]=li;heapK[at]=lk;}return top;}
  function nearestR(x,z,r){
    const c=cellOf(x,z),ix=c%nx,iz=(c/nx)|0;let best=-1,bd=Infinity;
    for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){const jx=ix+dx,jz=iz+dz;if(jx<0||jx>=nx||jz<0||jz>=nz)continue;const j=jz*nx+jx;if(!walkable(j))continue;const d=(cx(j)-x)**2+(cz(j)-z)**2;if(d<bd&&(r<=0||d<.02||traverse(x,z,cx(j),cz(j),r))){bd=d;best=j;}}
    return best;
  }
  // Le joueur (rayon .28) peut être collé à un socle : on relâche le rayon de la sonde plutôt que d'échouer.
  function nearest(x,z){let j=nearestR(x,z,.28);if(j<0)j=nearestR(x,z,.2);if(j<0)j=nearestR(x,z,.1);if(j<0){stats.nearestLoose++;j=nearestR(x,z,0);}return j;}
  function padFree(ax,az,bx,bz){for(const pad of world.jumpPads||[]){const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1,t=clamp(((pad.x-ax)*dx+(pad.z-az)*dz)/l2,0,1);if(Math.hypot(ax+dx*t-pad.x,az+dz*t-pad.z)<(pad.r||1.15)+.45)return false;}return true;}
  function* astar(sx,sz,gx,gz,allowPads=false,maxNodes=60000){
    stats.astar++;const start=nearest(sx,sz),end=nearest(gx,gz);if(start<0||end<0){stats.astarFail++;stats.astarNoEnd++;return null;}
    const st=++serial,ex=end%nx,ez=(end/nx)|0,h=i=>Math.abs(i%nx-ex)+Math.abs(((i/nx)|0)-ez);
    heapN=0;stamp[start]=st;gCost[start]=0;prev[start]=-1;push(start,h(start));let explored=0,found=false;
    while(heapN&&explored++<maxNodes){
      if(--searchBudget<=0){yield;searchBudget=96;}const i=pop();if(closed[i]===st)continue;closed[i]=st;if(i===end){found=true;break;}
      for(let k=0;k<4;k++){const j=i+OFF[k];if(j<0||j>=N||closed[j]===st||(!allowPads&&padMask[j]&&j!==end)||!edge(i,k))continue;const c=gCost[i]+1;if(stamp[j]===st&&gCost[j]<=c)continue;stamp[j]=st;gCost[j]=c;prev[j]=i;push(j,c+h(j));}
    }
    stats.astarNodes+=explored;if(!found){stats.astarFail++;if(explored>=maxNodes)stats.astarCap++;return null;}
    const raw=[];for(let i=end;i>=0;i=prev[i]){raw.push(i);if(raw.length%96===0)yield;}raw.reverse();
    const out=[];let ax=sx,az=sz,at=0;
    while(at<raw.length){if(out.length&&out.length%8===0)yield;let far=at;for(let k=Math.min(raw.length-1,at+12);k>at;k--)if(traverse(ax,az,cx(raw[k]),cz(raw[k]),.28)&&(allowPads||padFree(ax,az,cx(raw[k]),cz(raw[k])))){far=k;break;}out.push([cx(raw[far]),cz(raw[far])]);ax=cx(raw[far]);az=cz(raw[far]);at=far+1;}
    out.cells=raw.length;return out;
  }
  // --- état propre du pilote (mémoire courte ; tout est fonction de l'état de la simulation passé)
  let path=null,wi=0,goal=null,goalKey='',replanAt=0,topoKey='',blocked=new Map(),lastProgressT=0,lastProgressX=p.x,lastProgressZ=p.z,stuckLevel=0,unstickUntil=0,unstickDir=1;
  let target=null,targetUntil=0,strafe=1,strafeFlipAt=0,interactLatch=false,holdUntil=0,lastGoalProgressT=0,bestGoalDist=Infinity,weaponHold=0,lastWeapon=-1;
  const boss=()=>s.enemies.find(e=>e.type===3&&e.bossScale>1);
  function topology(){let k=String(s.destructionRevision??sim.destruction?.revision??0);for(const d of s.doors||[])k+=d.open?'1':'0';for(const m of s.mechanisms||[])k+=m.active?'1':'0';for(const l of s.lifts||[])k+=Math.round(l.y*2)+',';return k;}
  function objectives(){
    const list=[];const B=boss(),pg=world.profileGoals;
    if(pg){
      const wall=breachMesh,relay=s.mechanisms.find(m=>m.id===pg.mechanism),clear=wall&&(!sim.destruction?.isAlive(pg.breach)||traverse(pg.entry.x,pg.entry.z,wall.p[0]+1.2,pg.entry.z,.3));
      if(!clear){
        if(!s.inventory.weapons[3]||s.inventory.ammo[3]===0){for(const q of s.pickups)if(!q.taken&&q.weapon===3&&(s.inventory.weapons[3]||q.kind==='weapon'))list.push({key:'supply:'+q.id,x:q.x,y:q.y,z:q.z,pri:1.5,reach:.6,profile:'heavy'});}
        else list.push({key:'breach',x:wall.p[0]-6,y:pg.entry.y,z:pg.entry.z,pri:2,reach:.6,profile:'heavy',shoot:[wall.p[0],pg.entry.y+1.3,pg.entry.z]});
      }else if(relay&&!relay.active)list.push({key:'aerial-relay',x:relay.x,y:pg.entry.y,z:relay.z+1.4,pri:2,reach:.5,mech:relay.id,fly:relay.y,profile:'light'});
    }
    for(const q of s.loot||[])if(q.kind==='resupply'&&!q.taken&&Math.hypot(q.x-p.x,q.z-p.z)<16&&q.ammo.some((n,i)=>n&&s.inventory.weapons[i]&&(!s.activeProfile||G.MetalProfiles.allowed(s.activeProfile,i))&&s.inventory.ammo[i]<sim.ammoCaps[i]*.15))list.push({key:q.id,x:q.x,y:q.y,z:q.z,pri:1,reach:.6});
    for(const q of s.loot||[])if(q.kind==='boss'&&q.rewardTaken===false&&!q.taken)list.push({key:'bossloot',x:q.x,z:q.z,y:q.y,pri:0,reach:.7});
    if(p.hp<s.maxHp*.65)for(const q of s.pickups||[])if(!q.taken&&(q.kind==='health'||q.type==='health')&&Math.hypot(q.x-p.x,q.z-p.z)<45)list.push({key:'hp:'+q.id,x:q.x,z:q.z,y:q.y||0,pri:1,reach:.6});
    for(const m of s.mechanisms||[])if(m.required&&!m.active&&m.id!=='profile-power')for(const [ox,oz] of [[0,.95],[0,-.95],[.95,0],[-.95,0]])list.push({key:'mech:'+m.id+':'+ox+','+oz,x:m.x+ox,z:m.z+oz,y:m.y||0,pri:2,reach:.5,mech:m.id});
    for(const c of s.cores||[])if(!c.taken)list.push({key:'core:'+c.id,x:c.x,z:c.z,y:c.y||0,pri:2,reach:.7});
    for(const q of s.pickups||[])if(!q.taken&&q.trophyId)list.push({key:'trophy:'+q.id,x:q.x,z:q.z,y:q.y||0,pri:2,reach:.6});
    if(B&&B.hp>0){const A=world.bossArena||B.arena;if(A){const dx=p.x-B.x,dz=p.z-B.z,d=Math.hypot(dx,dz)||1,r=15;list.push({key:'boss',x:B.x+dx/d*r,z:B.z+dz/d*r,y:A.y||0,pri:3,reach:3,boss:true});list.push({key:'arena',x:A.x-(A.r-4),z:A.z,y:A.y||0,pri:3,reach:2.5,boss:true});list.push({key:'arena2',x:A.x,z:A.z+12,y:A.y||0,pri:3,reach:2.5,boss:true});}}
    list.push({key:'exit',x:world.exit.x,z:world.exit.z,y:world.exit.y||0,pri:4,reach:.9});
    return B?.bossAwake&&B.hp>0?list.filter(o=>o.boss||o.pri<2):list;
  }
  function* choose(){
    const list=objectives().filter(o=>!(blocked.get(o.key)>s.time));
    list.sort((a,c)=>a.pri-c.pri||Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z));
    for(const o of list){
      if(o.boss&&boss()?.bossAwake&&Math.hypot(p.x-boss().x,p.z-boss().z)<30){goal=o;goalKey=o.key;path=[];wi=0;return true;}
      if(Math.hypot(o.x-p.x,o.z-p.z)<o.reach&&Math.abs((o.y||0)-p.y)<.8){goal=o;goalKey=o.key;path=[];wi=0;return true;}
      let r=yield* astar(p.x,p.z,o.x,o.z);if(!r){r=yield* astar(p.x,p.z,o.x,o.z,true);if(r)stats.padRoutes++;}
      if(r){goal=o;if(goalKey!==o.key){goalKey=o.key;bestGoalDist=Infinity;lastGoalProgressT=s.time;}path=r;wi=0;return true;}
      blocked.set(o.key,s.time+(o.boss?2:6));yield;
    }
    goal=null;goalKey='';path=null;return false;
  }
  function visible(e){const h=e.type===3&&e.bossScale>1?2*e.bossScale:HEIGHT[e.type]*.7;return sim.sight(p.x,p.z,e.x,e.z,p.y+1.55,(e.baseY??e.y??0)+h);}
  function pickTarget(){
    if(target&&target.hp>0&&target.deployed!==false&&s.time<targetUntil&&visible(target))return target;
    let best=null,bs=Infinity;const B=boss();
    for(const e of s.enemies){if(e.hp<=0||e.deployed===false||e===B)continue;const d=Math.hypot(e.x-p.x,e.z-p.z);if(d>42||Math.abs((e.baseY??0)-p.y)>9)continue;const score=d-(e.windup>0?6:0)-(e.attackState==='burst'?4:0);if(score<bs&&visible(e)){bs=score;best=e;}}
    if(!best&&B&&B.hp>0&&B.bossAwake&&Math.hypot(B.x-p.x,B.z-p.z)<60&&visible(B))best=B;
    if(best!==target)targetReady=s.time+.25;target=best;targetUntil=s.time+.6;return best;
  }
  function weaponFor(d,giant,count){
    const w=s.inventory?.weapons.map((v,i)=>v&&(!s.activeProfile||G.MetalProfiles.allowed(s.activeProfile,i))),a=s.inventory?.ammo;if(!w)return s.weapon;
    if(giant&&!boss()?.weakPointOpen&&w[4])return 4;
    if(w[2]&&a[2]>0&&d>10&&(giant||count>=3))return 2;
    if(w[3]&&a[3]>0&&d>8&&d<24&&(count>=2||giant))return 3;
    if(w[1]&&a[1]>0&&d<11)return 1;
    if(w[0]&&a[0]>0)return 0;
    if(w[4])return 4;
    for(let i=0;i<w.length;i++)if(w[i])return i;return s.weapon;
  }
  function danger(){
    let best=null;
    for(const a of s.bossAttacks||[]){
      if(a.kind==='slam'||a.kind==='rocketZone'){const d=Math.hypot(p.x-a.x,p.z-a.z);if(d<a.radius+1.6){const n=Math.max(.01,d);best={x:(p.x-a.x)/n,z:(p.z-a.z)/n};}}
      else if(a.kind==='sweep'){const dx=p.x-a.x,dz=p.z-a.z,along=Math.max(0,Math.min(a.length,dx*a.dx+dz*a.dz)),ox=dx-a.dx*along,oz=dz-a.dz*along;if(Math.hypot(ox,oz)<a.width+1.6){const side=Math.sign(dx*a.dz-dz*a.dx)||1;best={x:a.dz*side,z:-a.dx*side};}}
    }
    for(const t of s.traps||[])if(s.activeProfile!=='light'&&(t.warning||t.hot)){const d=Math.hypot(p.x-t.x,p.z-t.z);if(d<2.2&&d>.01)best=best||{x:(p.x-t.x)/d,z:(p.z-t.z)/d};}
    return best;
  }
  function think(input,dt){
    stats.think++;
    input.moveX=0;input.moveY=0;input.lookX=0;input.lookY=0;input.fire=false;input.fireLeft=false;input.leftWeapon=undefined;input.dash=false;input.pulse=false;input.melee=false;input.interact=false;input.sprint=true;input.assist=false;input.jump=false;input.jumpHeld=false;input.switchProfile=false;searchBudget=96;
    if(s.dead||s.won)return;
    const t=s.time;if(lastProfile!==s.activeProfile){lastProfile=s.activeProfile;path=null;goal=null;search=null;replanAt=0;blocked.clear();}
    // 1) topologie : une porte, un mécanisme, une révision de destruction => les arêtes et les objectifs bloqués sont réévalués
    if(stats.think%30===1){const k=topology();if(k!==topoKey){topoKey=k;edgeKnown.fill(0);cellKnown.fill(0);edgeOpen.fill(0);blocked.clear();replanAt=0;search=null;stats.topology++;}}
    // Keep the ground route while a jump or jetpack crosses a moving obstacle.
    // 2) objectif et chemin
    if(!path||t>=replanAt||(goal&&goal.boss)){
      if(!search&&t>=replanAt){stats.replans++;search=choose();replanAt=t+(goal&&goal.boss?1.2:4);}
    }
    if(search&&search.next().done)search=null;
    if(goal?.profile&&s.activeProfile!==goal.profile&&Math.hypot(goal.x-p.x,goal.z-p.z)<12){input.switchProfile=true;return;}
    // 3) cible et visée
    const tg=pickTarget(),B=boss();let wantYaw=p.yaw,wantPitch=0,aiming=false,dT=Infinity,nearCount=0;
    for(const e of s.enemies)if(e.hp>0&&e.deployed!==false&&Math.hypot(e.x-p.x,e.z-p.z)<14)nearCount++;
    if(tg){
      const giant=tg===B;let ax=tg.x,az=tg.z,ay;
      // Exposed: the nearest weak point the simulation offers (joint or heart).
      if(giant){const q=tg.weakPointOpen&&sim.weakPoints?sim.weakPoints(tg).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]:null;if(q){ax=q.x;az=q.z;ay=q.y;}else if(tg.weakPointOpen){ax=tg.x+Math.sin(tg.yaw)*.9*tg.bossScale;az=tg.z-Math.cos(tg.yaw)*.9*tg.bossScale;ay=tg.baseY+1.93*tg.bossScale;}else ay=tg.baseY+2*tg.bossScale;}
      else ay=(tg.baseY??0)+HEIGHT[tg.type]*.62;
      const dx=ax-p.x,dz=az-p.z;dT=Math.hypot(dx,dz);
      // tremblement déterministe de la main, borné, pour une visée crédible
      const sway=.006*Math.sin(t*2.3+tg.id)+.004*Math.sin(t*5.1);
      wantYaw=Math.atan2(dx,-dz)+sway;wantPitch=Math.atan2(ay-(p.y+1.62),dT)+sway*.5;aiming=true;
    }
    // 4) déplacement
    let mx=0,mz=0,moving=false;
    const dng=danger();
    if(path&&goal){
      while(wi<path.length&&Math.hypot(path[wi][0]-p.x,path[wi][1]-p.z)<.5)wi++;
      if(wi<path.length){mx=path[wi][0]-p.x;mz=path[wi][1]-p.z;const n=Math.hypot(mx,mz)||1;mx/=n;mz/=n;moving=true;}
      else{const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz);if(d>goal.reach*.5){mx=dx/d;mz=dz/d;moving=true;}else if(!goal.boss&&!goal.mech)replanAt=Math.min(replanAt,t+.4);}
      const gd=Math.hypot(goal.x-p.x,goal.z-p.z);if(gd<bestGoalDist-.5){bestGoalDist=gd;lastGoalProgressT=t;}
    }
    // combat : s'arrêter et mitrailler quand une cible visible est proche ; reculer si elle colle ; tourner autour du colosse
    const fightBoss=B&&B.hp>0&&B.bossAwake&&tg===B&&dT<30;
    if(tg&&!fightBoss&&dT<20&&t<holdUntil+0){/* maintien en cours */}
    if(tg&&!fightBoss){
      if(t>strafeFlipAt){strafe=-strafe;strafeFlipAt=t+1.1+((tg.id*7)%5)*.17;}
      const dx=(tg.x-p.x)/(dT||1),dz=(tg.z-p.z)/(dT||1);
      if(dT<22){const keep=dT<6?-1:dT>13?.35:0;mx=mx*.25+(-dz*strafe)*.9+dx*keep;mz=mz*.25+(dx*strafe)*.9+dz*keep;moving=true;}
    }else if(fightBoss&&!(goal&&goal.pri<2)){
      const rx=p.x-B.x,rz=p.z-B.z,rn=Math.max(.01,Math.hypot(rx,rz)),radial=(20-rn)/4;
      if(t>strafeFlipAt){strafe=-strafe;strafeFlipAt=t+5;}
      mx=-rz/rn*strafe+rx/rn*radial;mz=rx/rn*strafe+rz/rn*radial;moving=true;
      const A=world.bossArena;if(A){const fc=Math.hypot(p.x-A.x,p.z-A.z);if(fc>A.r-5){mx+=(A.x-p.x)/fc*1.5;mz+=(A.z-p.z)/fc*1.5;}}
    }
    if(dng&&!p.airborne){mx=dng.x*2+mx*.3;mz=dng.z*2+mz*.3;moving=true;}
    // 5) sortie de blocage : aucun progrès de position alors qu'on veut bouger
    if(t-lastProgressT>.9){
      const d=Math.hypot(p.x-lastProgressX,p.z-lastProgressZ);
      if(moving&&(d<.35||goal?.boss&&!fightBoss&&t-lastGoalProgressT>8)&&(!tg||tg===B)){stuckLevel++;replanAt=0;if(stuckLevel>=2){unstickUntil=t+.7;unstickDir=-unstickDir;stats.unstick++;edgeKnown.fill(0);cellKnown.fill(0);edgeOpen.fill(0);}if(stuckLevel>=5&&goal){blocked.set(goal.key,t+10);stuckLevel=0;}}
      else if(d>=.35)stuckLevel=0;
      lastProgressT=t;lastProgressX=p.x;lastProgressZ=p.z;
    }
    if(t<unstickUntil){const ox=mx,oz=mz;mx=-oz*unstickDir*.9-ox*.4;mz=ox*unstickDir*.9-oz*.4;input.melee=true;input.dash=true;}
    const n=Math.hypot(mx,mz);if(n>1){mx/=n;mz/=n;}
    // 6) regard : lissé, vitesse angulaire bornée ; hors combat, on regarde où l'on va
    if(!aiming&&moving&&n>.05){wantYaw=Math.atan2(mx,-mz);wantPitch=goal?clamp(Math.atan2((goal.y||0)-p.y,Math.max(6,Math.hypot(goal.x-p.x,goal.z-p.z)))*.6,-.35,.35):0;}
    const ey=wrap(wantYaw-p.yaw),ep=wantPitch-p.pitch,rate=aiming?7.5:3.4,gain=aiming?14:6;
    input.lookX=clamp(ey*gain,-rate,rate)*dt;input.lookY=clamp(ep*gain,-rate,rate)*dt;
    const cy=Math.cos(p.yaw),sy=Math.sin(p.yaw);input.moveX=mx*cy+mz*sy;input.moveY=mx*sy-mz*cy;
    input.sprint=!tg||dT>16;
    // 7) arme, tir, garde, corps à corps
    if(tg){
      const giant=tg===B,w=weaponFor(dT,giant,nearCount);
      if(w!==s.weapon&&t>=weaponHold){input.weapon=w;weaponHold=t+1.2;}else input.weapon=s.weapon;
      const tol=Math.max(.018,Math.atan2(giant?(tg.weakPointOpen?.5:1.6)*1:.34,Math.max(1,dT)));
      const ord=s.weapon===2||s.weapon===3;
      if(Math.abs(ey)<tol&&Math.abs(ep)<tol*1.3&&!(ord&&dT<7)&&!(giant&&!tg.weakPointOpen&&s.weapon!==4))input.fire=t>=targetReady;
      if(giant&&!tg.weakPointOpen&&Math.abs(ey)<tol&&s.weapon===4)input.fire=t>=targetReady;
      if(dT<1.9&&!giant)input.melee=true;
      if(dng&&p.dash<=0)input.dash=true;
      if(nearCount>=4&&p.pulseCooldown<=0)input.pulse=true;
    }else input.weapon=s.weapon;
    if(tg&&s.equipment){const main=input.weapon??s.weapon,w=s.inventory.weapons,allowed=i=>w[i]&&i!==main&&(!s.activeProfile||G.MetalProfiles.allowed(s.activeProfile,i)),left=(main===0&&allowed(1)?1:main===1&&allowed(0)?0:allowed(4)?4:-1);input.leftWeapon=left;input.fireLeft=input.fire&&left>=0;}
    // Ground fronts cross in simulation time: jump at the approaching edge,
    // use dash if the jump is unavailable; do not spend it early in the tell.
    for(const a of s.bossAttacks||[])if(a.kind==='ring'&&a.active){const d=Math.hypot(p.x-a.x,p.z-a.z),eta=(d-a.currentRadius)/(a.radius/a.activeDuration);if(eta>=0&&eta<.24){if(!p.airborne)input.jump=true;else if(p.dash<=0)input.dash=true;}}
    if(B?.bossAwake&&B.hp>0&&B.profileRequired&&s.activeProfile!==B.profileRequired&&Math.hypot(p.x-B.x,p.z-B.z)<32){input.switchProfile=true;input.fire=false;return;}
    if(goal?.shoot&&Math.hypot(goal.x-p.x,goal.z-p.z)<1.5){const [x,y,z]=goal.shoot,dx=x-p.x,dz=z-p.z,ey=wrap(Math.atan2(dx,-dz)-p.yaw),ep=Math.atan2(y-p.y-1.62,Math.hypot(dx,dz))-p.pitch;input.moveX=input.moveY=0;input.lookX=clamp(ey*12,-6,6)*dt;input.lookY=clamp(ep*12,-6,6)*dt;input.weapon=3;input.fire=Math.abs(ey)<.035&&Math.abs(ep)<.035;if(!sim.destruction?.isAlive(world.profileGoals.breach)){path=null;goal=null;search=null;replanAt=0;}}
    if(goal?.fly&&Math.hypot(goal.x-p.x,goal.z-p.z)<12){const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),fly=p.y<goal.fly+.65;input.moveX=d>.55?(dx*cy+dz*sy)/d:0;input.moveY=d>.55?(dx*sy-dz*cy)/d:0;input.jump=!p.airborne;input.jumpHeld=fly;input.sprint=false;input.dash=false;input.fire=input.fireLeft=false;unstickUntil=0;lastProgressT=t;}
    // Local steering uses the current collision boxes (the A* projection
    // deliberately ignores the whole swept footprint of a moving blade).
    if(moving&&!goal?.fly&&!p.airborne){
      const len=Math.hypot(mx,mz)||1,dx=mx/len,dz=mz/len;
      const rigid=sim.rigid,surface=(x,z,ceiling)=>Math.max(sim.ground(x,z),rigid?.support(x,z,.3,ceiling)??-Infinity);
      const clear=(x,z)=>{for(const d of [.45,.85]){const px=p.x+x*d,pz=p.z+z*d,gy=surface(px,pz,p.y+.42);if(gy-p.y>.43||p.y-gy>1.4||sim.blocked(px,pz,.3,gy)||rigid?.obstacle(px,pz,.3,gy,1.8))return false;}return true;};
      if(rigid&&!clear(dx,dz)){const px=p.x+dx*.65,pz=p.z+dz*.65,top=rigid.support(px,pz,.3,p.y+(s.activeProfile==='heavy'?.9:1.1));if(top>p.y+.42&&top-p.y<=(s.activeProfile==='heavy'?.9:1.1)&&!sim.blocked(px,pz,.3,top)&&!rigid.obstacle(px,pz,.3,top,1.8)){input.jump=true;input.moveX=dx*cy+dz*sy;input.moveY=dx*sy-dz*cy;return;}}

      if(!clear(dx,dz)){
        let best=null,score=-Infinity;for(const a of [.4,-.4,.8,-.8,1.2,-1.2,1.55,-1.55,2,-2,Math.PI]){const c=Math.cos(a),v=Math.sin(a),x=dx*c-dz*v,z=dx*v+dz*c;if(!clear(x,z))continue;const value=x*dx+z*dz+(a>0?.03:0);if(value>score){score=value;best=[x,z];}}
        if(best){input.moveX=best[0]*cy+best[1]*sy;input.moveY=best[0]*sy-best[1]*cy;}else input.moveX=input.moveY=0;
      }
    }
    // The light operator crosses swept trap footprints in flight; a body or
    // a blade must never pin the demonstration pilot on the damaging floor.
    if(s.activeProfile==='light'&&!goal?.fly)for(const q of s.traps||[]){
      if(q.destroyed)continue;const tx=q.kind==='blade'&&q.axis!=='z'?(q.travel||1.65):0,tz=q.kind==='blade'&&q.axis==='z'?(q.travel||1.65):0;
      if(Math.abs(p.x-q.x)<q.w/2+tx+1.8&&Math.abs(p.z-q.z)<q.d/2+tz+1.8&&p.y<q.y+(q.kind==='press'?(q.travel||2.6)+(q.h||.65):q.h||.3)+.8){input.jump=!p.airborne;input.jumpHeld=true;}
    }
    if(s.activeProfile==='light'){if(s.jetpack.fuel<.12)jetRecover=true;else if(s.jetpack.fuel>=Math.min(2.5,s.jetpack.capacity))jetRecover=false;if(jetRecover){input.jump=input.jumpHeld=false;if(goal?.fly&&Math.hypot(goal.x-p.x,goal.z-p.z)<3)input.moveX=input.moveY=0;}}
    // Release the triggers before overheating, retaining ordinary cooling rules.
    if(s.weaponHeat?.[input.weapon??s.weapon]>.8)input.fire=false;
    // 8) interaction : seulement un mécanisme (jamais un atelier : la démo n'ouvre pas de menu)
    if(goal&&goal.mech&&Math.hypot(goal.x-p.x,goal.z-p.z)<2.4){
      const q=sim.nearestInteraction();
      if(q&&q.kind==='mechanism'&&!q.disabled&&!interactLatch){input.interact=true;stats.interacts++;}
      interactLatch=input.interact;
    }else interactLatch=false;
  }
  return {think,stats,get goal(){return goal;},get goalKey(){return goalKey;},get lastGoalProgressT(){return lastGoalProgressT;},get distanceProgress(){return Number.isFinite(bestGoalDist)?Math.floor(bestGoalDist/5):0;},get stuckLevel(){return stuckLevel;},
    blockedKeys:()=>[...blocked.keys()],reset(){target=null;targetReady=0;interactLatch=false;lastProgressT=s.time;lastProgressX=p.x;lastProgressZ=p.z;stuckLevel=0;unstickUntil=0;search=null;path=null;goal=null;goalKey='';replanAt=0;blocked.clear();edgeKnown.fill(0);cellKnown.fill(0);edgeOpen.fill(0);}};
}

G.FPilot={create:createPilot};
})(typeof window!=='undefined'?window:globalThis);
