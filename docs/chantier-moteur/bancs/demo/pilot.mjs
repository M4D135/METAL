// Banc DEMO — pilote automatique minimal de METAL (prototype d'audit, hors dépôt).
// Règle : le pilote ne lit que l'état de la simulation et son API publique (sim.state, sim.nav, sim.sight,
// sim.nearestInteraction, sim.ground) et n'écrit que dans `input`. Aucun Math.random, aucune horloge murale :
// même état => mêmes entrées, donc rejouable.
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrap=a=>{a%=Math.PI*2;return a>Math.PI?a-Math.PI*2:a<-Math.PI?a+Math.PI*2:a;};
const HEIGHT=[1.35,1.05,1.6,1.8];

export function createPilot(sim,world,opt={}){
  const s=sim.state,p=s.player,nav=sim.nav,nx=nav.nx,nz=nav.nz,N=nx*nz,CELL=.8,b=world.bounds;
  const cells=nav.cells,traverse=nav.canTraverse;
  const cx=i=>b.minX+(i%nx)*CELL,cz=i=>b.minZ+((i/nx)|0)*CELL;
  const cellOf=(x,z)=>clamp(Math.round((z-b.minZ)/CELL),0,nz-1)*nx+clamp(Math.round((x-b.minX)/CELL),0,nx-1);
  // --- cache d'arêtes paresseux (4 bits par cellule : -x,+x,-z,+z), vidé quand la topologie change
  const edgeKnown=new Uint8Array(N),edgeOpen=new Uint8Array(N);
  const gCost=new Float32Array(N),prev=new Int32Array(N),stamp=new Uint32Array(N),closed=new Uint32Array(N);
  let heapI=new Int32Array(4096),heapK=new Float32Array(4096),heapN=0,serial=0;
  const stats={astar:0,astarFail:0,astarNoEnd:0,astarCap:0,astarNodes:0,edgeTests:0,replans:0,unstick:0,interacts:0,think:0,topology:0,nearestLoose:0,padRoutes:0};
  const OFF=[-1,1,-nx,nx],REV=[1,0,3,2];
  const padMask=new Uint8Array(N);for(const pad of world.jumpPads||[]){const R=(pad.r||1.15)+.75,c=cellOf(pad.x,pad.z),ix=c%nx,iz=(c/nx)|0,n=Math.ceil(R/CELL)+1;for(let dz=-n;dz<=n;dz++)for(let dx=-n;dx<=n;dx++){const jx=ix+dx,jz=iz+dz;if(jx<0||jx>=nx||jz<0||jz>=nz)continue;const j=jz*nx+jx;if(Math.hypot(cx(j)-pad.x,cz(j)-pad.z)<R)padMask[j]=1;}}
  function edge(i,k){
    const m=1<<k;if(edgeKnown[i]&m)return (edgeOpen[i]&m)!==0;
    const j=i+OFF[k];let ok=false;
    if(j>=0&&j<N&&cells[j]&&!(k===0&&i%nx===0)&&!(k===1&&i%nx===nx-1)){stats.edgeTests++;ok=traverse(cx(i),cz(i),cx(j),cz(j),.4);}
    edgeKnown[i]|=m;if(ok)edgeOpen[i]|=m;
    if(j>=0&&j<N){const r=1<<REV[k];edgeKnown[j]|=r;if(ok)edgeOpen[j]|=r;}
    return ok;
  }
  function push(i,k){if(heapN===heapI.length){const a=new Int32Array(heapN*2),c=new Float32Array(heapN*2);a.set(heapI);c.set(heapK);heapI=a;heapK=c;}let at=heapN++;while(at){const par=(at-1)>>1;if(heapK[par]<=k)break;heapI[at]=heapI[par];heapK[at]=heapK[par];at=par;}heapI[at]=i;heapK[at]=k;}
  function pop(){const top=heapI[0],li=heapI[--heapN],lk=heapK[heapN];if(heapN){let at=0;for(;;){let c=at*2+1;if(c>=heapN)break;if(c+1<heapN&&heapK[c+1]<heapK[c])c++;if(heapK[c]>=lk)break;heapI[at]=heapI[c];heapK[at]=heapK[c];at=c;}heapI[at]=li;heapK[at]=lk;}return top;}
  function nearestR(x,z,r){
    const c=cellOf(x,z),ix=c%nx,iz=(c/nx)|0;let best=-1,bd=Infinity;
    for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){const jx=ix+dx,jz=iz+dz;if(jx<0||jx>=nx||jz<0||jz>=nz)continue;const j=jz*nx+jx;if(!cells[j])continue;const d=(cx(j)-x)**2+(cz(j)-z)**2;if(d<bd&&(r<=0||d<.02||traverse(x,z,cx(j),cz(j),r))){bd=d;best=j;}}
    return best;
  }
  // Le joueur (rayon .28) peut être collé à un socle : on relâche le rayon de la sonde plutôt que d'échouer.
  function nearest(x,z){let j=nearestR(x,z,.3);if(j<0)j=nearestR(x,z,.2);if(j<0)j=nearestR(x,z,.1);if(j<0){stats.nearestLoose++;j=nearestR(x,z,0);}return j;}
  function padFree(ax,az,bx,bz){for(const pad of world.jumpPads||[]){const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1,t=clamp(((pad.x-ax)*dx+(pad.z-az)*dz)/l2,0,1);if(Math.hypot(ax+dx*t-pad.x,az+dz*t-pad.z)<(pad.r||1.15)+.45)return false;}return true;}
  function astar(sx,sz,gx,gz,allowPads=false,maxNodes=60000){
    stats.astar++;const start=nearest(sx,sz),end=nearest(gx,gz);if(start<0||end<0){stats.astarFail++;stats.astarNoEnd++;return null;}
    const st=++serial,ex=end%nx,ez=(end/nx)|0,h=i=>Math.abs(i%nx-ex)+Math.abs(((i/nx)|0)-ez);
    heapN=0;stamp[start]=st;gCost[start]=0;prev[start]=-1;push(start,h(start));let explored=0,found=false;
    while(heapN&&explored++<maxNodes){
      const i=pop();if(closed[i]===st)continue;closed[i]=st;if(i===end){found=true;break;}
      for(let k=0;k<4;k++){const j=i+OFF[k];if(j<0||j>=N||closed[j]===st||(!allowPads&&padMask[j]&&j!==end)||!edge(i,k))continue;const c=gCost[i]+1;if(stamp[j]===st&&gCost[j]<=c)continue;stamp[j]=st;gCost[j]=c;prev[j]=i;push(j,c+h(j));}
    }
    stats.astarNodes+=explored;if(!found){stats.astarFail++;if(explored>=maxNodes)stats.astarCap++;return null;}
    const raw=[];for(let i=end;i>=0;i=prev[i])raw.push(i);raw.reverse();
    const out=[];let ax=sx,az=sz,at=0;
    while(at<raw.length){let far=at;for(let k=Math.min(raw.length-1,at+12);k>at;k--)if(traverse(ax,az,cx(raw[k]),cz(raw[k]),.4)&&(allowPads||padFree(ax,az,cx(raw[k]),cz(raw[k])))){far=k;break;}out.push([cx(raw[far]),cz(raw[far])]);ax=cx(raw[far]);az=cz(raw[far]);at=far+1;}
    out.cells=raw.length;return out;
  }
  // --- état propre du pilote (mémoire courte ; tout est fonction de l'état de la simulation passé)
  let path=null,wi=0,goal=null,goalKey='',replanAt=0,topoKey='',blocked=new Map(),lastProgressT=0,lastProgressX=p.x,lastProgressZ=p.z,stuckLevel=0,unstickUntil=0,unstickDir=1;
  let target=null,targetUntil=0,strafe=1,strafeFlipAt=0,interactLatch=false,holdUntil=0,lastGoalProgressT=0,bestGoalDist=Infinity,weaponHold=0,lastWeapon=-1;
  const boss=()=>s.enemies.find(e=>e.type===3&&e.bossScale>1);
  function topology(){let k=String(s.destructionRevision??sim.destruction?.revision??0);for(const d of s.doors||[])k+=d.open?'1':'0';for(const m of s.mechanisms||[])k+=m.active?'1':'0';for(const l of s.lifts||[])k+=Math.round(l.y*2)+',';return k;}
  function objectives(){
    const list=[];const B=boss();
    for(const q of s.loot||[])if(q.kind==='boss'&&q.rewardTaken===false&&!q.taken)list.push({key:'bossloot',x:q.x,z:q.z,y:q.y,pri:0,reach:.7});
    if(p.hp<45)for(const q of s.pickups||[])if(!q.taken&&(q.kind==='health'||q.type==='health')&&Math.hypot(q.x-p.x,q.z-p.z)<45)list.push({key:'hp:'+q.id,x:q.x,z:q.z,y:q.y||0,pri:1,reach:.6});
    for(const m of s.mechanisms||[])if(m.required&&!m.active)for(const [ox,oz] of [[0,.95],[0,-.95],[.95,0],[-.95,0]])list.push({key:'mech:'+m.id+':'+ox+','+oz,x:m.x+ox,z:m.z+oz,y:m.y||0,pri:2,reach:.5,mech:m.id});
    for(const c of s.cores||[])if(!c.taken)list.push({key:'core:'+c.id,x:c.x,z:c.z,y:c.y||0,pri:2,reach:.7});
    for(const q of s.pickups||[])if(!q.taken&&q.trophyId)list.push({key:'trophy:'+q.id,x:q.x,z:q.z,y:q.y||0,pri:2,reach:.6});
    if(B&&B.hp>0){const A=world.bossArena||B.arena;if(A){const dx=p.x-B.x,dz=p.z-B.z,d=Math.hypot(dx,dz)||1,r=15;list.push({key:'boss',x:B.x+dx/d*r,z:B.z+dz/d*r,y:A.y||0,pri:3,reach:3,boss:true});list.push({key:'arena',x:A.x-(A.r-4),z:A.z,y:A.y||0,pri:3,reach:2.5,boss:true});list.push({key:'arena2',x:A.x,z:A.z+12,y:A.y||0,pri:3,reach:2.5,boss:true});}}
    list.push({key:'exit',x:world.exit.x,z:world.exit.z,y:world.exit.y||0,pri:4,reach:.9});
    return list;
  }
  function choose(){
    const list=objectives().filter(o=>!(blocked.get(o.key)>s.time));
    list.sort((a,c)=>a.pri-c.pri||Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z));
    for(const o of list){
      if(Math.hypot(o.x-p.x,o.z-p.z)<o.reach&&Math.abs((o.y||0)-p.y)<.8){goal=o;goalKey=o.key;path=[];wi=0;return true;}
      let r=astar(p.x,p.z,o.x,o.z);if(!r){r=astar(p.x,p.z,o.x,o.z,true);if(r)stats.padRoutes++;}
      if(r){goal=o;if(goalKey!==o.key){goalKey=o.key;bestGoalDist=Infinity;lastGoalProgressT=s.time;}path=r;wi=0;return true;}
      blocked.set(o.key,s.time+(o.boss?2:6));
    }
    goal=null;goalKey='';path=null;return false;
  }
  function visible(e){const h=e.type===3&&e.bossScale>1?2*e.bossScale:HEIGHT[e.type]*.7;return sim.sight(p.x,p.z,e.x,e.z,p.y+1.55,(e.baseY??e.y??0)+h);}
  function pickTarget(){
    if(target&&target.hp>0&&target.deployed!==false&&s.time<targetUntil&&visible(target))return target;
    let best=null,bs=Infinity;const B=boss();
    for(const e of s.enemies){if(e.hp<=0||e.deployed===false||e===B)continue;const d=Math.hypot(e.x-p.x,e.z-p.z);if(d>42||Math.abs((e.baseY??0)-p.y)>9)continue;const score=d-(e.windup>0?6:0)-(e.attackState==='burst'?4:0);if(score<bs&&visible(e)){bs=score;best=e;}}
    if(!best&&B&&B.hp>0&&B.bossAwake&&Math.hypot(B.x-p.x,B.z-p.z)<60&&visible(B))best=B;
    target=best;targetUntil=s.time+.6;return best;
  }
  function weaponFor(d,giant,count){
    const w=s.inventory?.weapons,a=s.inventory?.ammo;if(!w)return s.weapon;
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
    for(const t of s.traps||[])if(t.warning||t.hot){const d=Math.hypot(p.x-t.x,p.z-t.z);if(d<2.2&&d>.01)best=best||{x:(p.x-t.x)/d,z:(p.z-t.z)/d};}
    return best;
  }
  function think(input,dt){
    stats.think++;
    input.moveX=0;input.moveY=0;input.lookX=0;input.lookY=0;input.fire=false;input.fireLeft=false;input.dash=false;input.pulse=false;input.melee=false;input.interact=false;input.sprint=true;input.assist=false;
    if(s.dead||s.won)return;
    const t=s.time;
    // 1) topologie : une porte, un mécanisme, une révision de destruction => les arêtes et les objectifs bloqués sont réévalués
    if(stats.think%30===1){const k=topology();if(k!==topoKey){topoKey=k;edgeKnown.fill(0);edgeOpen.fill(0);blocked.clear();replanAt=0;stats.topology++;}}
    if(p.airborne){path=null;replanAt=0;return;}
    // 2) objectif et chemin
    if(!path||t>=replanAt||(goal&&goal.boss)){
      if(!goal||!path||t>=replanAt){stats.replans++;choose();replanAt=t+(goal&&goal.boss?1.2:4);}
    }
    // 3) cible et visée
    const tg=pickTarget(),B=boss();let wantYaw=p.yaw,wantPitch=0,aiming=false,dT=Infinity,nearCount=0;
    for(const e of s.enemies)if(e.hp>0&&e.deployed!==false&&Math.hypot(e.x-p.x,e.z-p.z)<14)nearCount++;
    if(tg){
      const giant=tg===B;let ax=tg.x,az=tg.z,ay;
      if(giant){if(tg.weakPointOpen){ax=tg.x+Math.sin(tg.yaw)*.9*tg.bossScale;az=tg.z-Math.cos(tg.yaw)*.9*tg.bossScale;ay=tg.baseY+1.93*tg.bossScale;}else ay=tg.baseY+2*tg.bossScale;}
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
    const fightBoss=B&&B.hp>0&&B.bossAwake&&tg===B;
    if(tg&&!fightBoss&&dT<20&&t<holdUntil+0){/* maintien en cours */}
    if(tg&&!fightBoss){
      if(t>strafeFlipAt){strafe=-strafe;strafeFlipAt=t+1.1+((tg.id*7)%5)*.17;}
      const dx=(tg.x-p.x)/(dT||1),dz=(tg.z-p.z)/(dT||1);
      if(dT<22){const keep=dT<6?-1:dT>13?.35:0;mx=mx*.25+(-dz*strafe)*.9+dx*keep;mz=mz*.25+(dx*strafe)*.9+dz*keep;moving=true;}
    }else if(fightBoss){
      const rx=p.x-B.x,rz=p.z-B.z,rn=Math.max(.01,Math.hypot(rx,rz)),radial=(15-rn)/4;
      if(t>strafeFlipAt){strafe=-strafe;strafeFlipAt=t+5;}
      mx=-rz/rn*strafe+rx/rn*radial;mz=rx/rn*strafe+rz/rn*radial;moving=true;
      const A=world.bossArena;if(A){const fc=Math.hypot(p.x-A.x,p.z-A.z);if(fc>A.r-5){mx+=(A.x-p.x)/fc*1.5;mz+=(A.z-p.z)/fc*1.5;}}
    }
    if(dng){mx=dng.x*2+mx*.3;mz=dng.z*2+mz*.3;moving=true;}
    // 5) sortie de blocage : aucun progrès de position alors qu'on veut bouger
    if(t-lastProgressT>.9){
      const d=Math.hypot(p.x-lastProgressX,p.z-lastProgressZ);
      if(moving&&d<.35&&!tg){stuckLevel++;replanAt=0;if(stuckLevel>=2){unstickUntil=t+.7;unstickDir=-unstickDir;stats.unstick++;edgeKnown.fill(0);edgeOpen.fill(0);}if(stuckLevel>=5&&goal){blocked.set(goal.key,t+10);stuckLevel=0;}}
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
      if(Math.abs(ey)<tol&&Math.abs(ep)<tol*1.3&&!(ord&&dT<7)&&!(giant&&!tg.weakPointOpen&&s.weapon!==4&&s.weapon!==0))input.fire=true;
      if(giant&&!tg.weakPointOpen&&Math.abs(ey)<tol&&(s.weapon===4||s.weapon===0))input.fire=true;
      if(dT<1.9&&!giant)input.melee=true;
      if(s.equipment?.left==='shield'&&s.shield&&s.shield.energy>25){
        const threat=s.enemies.some(e=>e.hp>0&&e.deployed!==false&&(e.attackState==='aim'||e.attackState==='burst'||e.windup>0)&&Math.hypot(e.x-p.x,e.z-p.z)<30)||(s.projectiles||[]).some(q=>q.owner!=='player'&&Math.hypot(q.x-p.x,q.z-p.z)<9);
        if(threat)input.fireLeft=true;
      }else if(s.equipment&&s.equipment.left!=='shield'&&dng&&p.dash<=0)input.dash=true;
      if(nearCount>=4&&p.pulseCooldown<=0)input.pulse=true;
    }else input.weapon=s.weapon;
    // 8) interaction : seulement un mécanisme (jamais un atelier : la démo n'ouvre pas de menu)
    if(goal&&goal.mech&&Math.hypot(goal.x-p.x,goal.z-p.z)<2.4){
      const q=sim.nearestInteraction();
      if(q&&q.kind==='mechanism'&&!q.disabled&&!interactLatch){input.interact=true;stats.interacts++;}
      interactLatch=input.interact;
    }else interactLatch=false;
  }
  return {think,stats,get goal(){return goal;},get goalKey(){return goalKey;},get lastGoalProgressT(){return lastGoalProgressT;},get stuckLevel(){return stuckLevel;},
    blockedKeys:()=>[...blocked.keys()],reset(){path=null;goal=null;goalKey='';replanAt=0;blocked.clear();edgeKnown.fill(0);edgeOpen.fill(0);}};
}
