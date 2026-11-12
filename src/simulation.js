/* FERRO — deterministic combat and checkpoints. No DOM, storage or rendering. */
(function (G) {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const HP=[3,5,4,30], HEIGHT=[1.35,1.05,1.6,1.8], ATTACKS=['idle','aim','burst','rush','recover','stunned'];
  const AIR=['airborne','airVX','airVY','airVZ','airTime','padCooldown','padId'];
  const pipeNozzle=q=>{const v=[q.dx??0,q.dy??1,q.dz??0],n=Math.hypot(...v)||1;return [q.x+v[0]/n*.46,q.y+v[1]/n*.46,q.z+v[2]/n*.46];};
  const freshAir=()=>({airborne:false,airVX:0,airVY:0,airVZ:0,airTime:0,padCooldown:0,padId:null}),GRAVITY=12;
  const PLAYER=['x','y','z','yaw','pitch','hp','heat','overheated','dash','dashing','pulseCooldown',...AIR];
  const ENEMY=['x','z','baseY','id','type','hp','maxHp','y','active','cooldown','hurt','windup','windupMax','attackState','yaw','stun','phase','aimX','aimY','aimZ','burstLeft','burstWait','rushTime','rushX','rushZ','rushHit',...AIR];
  // Awareness describes evidence (none / noise or ally / sight / lost sight).
  // Tactic describes the physical goal, independently of the existing attack telegraph.
  const AWARENESS=['patrol','investigate','engage','search'],TACTICS=['hold','advance','flank','cover'];
  const AI=['awareness','tactic','hasMemory','lastSeenX','lastSeenZ','memory','alert','seen','senseWait','thinkWait','shareWait','alertWait','coverWait','holdTime','planWait','patrolIndex','searchIndex','goalX','goalZ','pathAt','stuck','moveSpeed'];
  const AI3=['observedVY','dodgeWait','dodgeDelay','dodgeTime','dodgeX','dodgeZ'];
  const AI2=['lastSeenY','observedVX','observedVZ','observedAt','sleeping'];
  const giant=e=>e.type===3&&Number(e.bossScale)>1,scale=e=>giant(e)?e.bossScale:1,bodyHeight=e=>giant(e)?3.18*scale(e):1.8,health=e=>giant(e)?Math.max(30,Math.min(1000,Number(e.maxHp)||130)):HP[e.type];
  const BOSS=['bossAwake','bossClock','bossStep','attackLabel','weakPointOpen','weakTimer','bossReleased'];
  const DIRECTOR=['pressure','tension','eventType','eventAge','nextEvent','events','progress','tier','grace','eventX','eventY','eventZ','eventIntensity'];
  const HORROR=['','metallicSlam','blackout','alarm','ambush'];
  const BOSS_LABELS=['','Veille','Onde de choc','Écrasement','Barrage de roquettes','Balayage','Cœur exposé','Surcharge — renforts'];
  const PIPE=['broken','active','age','remaining','hot','warning','damageWait','cycle'];
  const TRAP=['progress','angle','box','hot','warning','damageWait','triggered','triggerAge','cycle','hp','destroyed'];
  const NUMBERS=['time','elapsed','kills','shots','hits','relays','weapon','score','combo','comboTime'];
  const pick=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value[key]]));
  function create(world) {
    const floors=world.walkable||[],advanced=!!world.combat||world.generation>=5,horror=!!world.horrorSites?.length||world.director?.enabled===true;
    let destruction=G.FDestruction?.create(world)||null,trapStates=[];
    // Static height rectangles share a small spatial index. Breach updates never
    // invalidate terrain, so path probes no longer rescan the entire landscape.
    const floorGX=Math.floor(world.bounds.minX/8),floorGZ=Math.floor(world.bounds.minZ/8),floorGW=Math.floor(world.bounds.maxX/8)-floorGX+1,floorGD=Math.floor(world.bounds.maxZ/8)-floorGZ+1;
    const floorBuckets=Array.from({length:floorGW*floorGD},()=>[]);
    for(const f of floors){const x0=Math.max(0,Math.floor((f.x-f.w/2-1e-7)/8)-floorGX),x1=Math.min(floorGW-1,Math.floor((f.x+f.w/2+1e-7)/8)-floorGX),z0=Math.max(0,Math.floor((f.z-f.d/2-1e-7)/8)-floorGZ),z1=Math.min(floorGD-1,Math.floor((f.z+f.d/2+1e-7)/8)-floorGZ);for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)floorBuckets[z*floorGW+x].push(f);}
    function ground(x,z){
      if(!floors.length)return 0;
      let y=-Infinity,flat=-Infinity,fallback=-Infinity;
      const gx=Math.floor(x/8)-floorGX,gz=Math.floor(z/8)-floorGZ,local=gx>=0&&gx<floorGW&&gz>=0&&gz<floorGD?floorBuckets[gz*floorGW+gx]:floors;
      for(const f of local)if(Math.abs(x-f.x)<=f.w/2+1e-7&&Math.abs(z-f.z)<=f.d/2+1e-7){
        const h=(f.y||0)+(x-f.x)*(f.slopeX||0)+(z-f.z)*(f.slopeZ||0);
        if(f.substrate||f.fallback)fallback=Math.max(fallback,h);else if(!f.slopeX&&!f.slopeZ)flat=Math.max(flat,h);else y=Math.max(y,h);
      }
      let result=Number.isFinite(flat)?flat:Number.isFinite(y)?y:fallback;
      for(const t of trapStates)if(t.kind==='floor'&&Math.abs(x-t.x)<t.w/2&&Math.abs(z-t.z)<t.d/2&&Math.abs(result-t.y)<.1)result=t.y-(t.travel||.85)*t.progress;
      return result;
    }
    const groundAt=(x,z)=>{const y=ground(x,z);return Number.isFinite(y)?y:0;};
    const elevated=floors.some(f=>f.y||f.slopeX||f.slopeZ)||(world.lifts||[]).length>0;
    const p={x:world.spawn.x,y:world.spawn.y??groundAt(world.spawn.x,world.spawn.z),z:world.spawn.z,yaw:world.spawn.yaw,pitch:0,hp:100,heat:0,overheated:false,dash:0,dashing:0,pulseCooldown:0,...freshAir()};
    const s={world,player:p,time:0,elapsed:0,won:false,dead:false,kills:0,shots:0,hits:0,relays:0,weapon:0,score:0,combo:0,comboTime:0,pulseVisual:0,
      difficulty:0,director:{pressure:0,tension:0,eventType:'',eventAge:0,nextEvent:horror?(world.stage?6:11):1e7,events:0,progress:0,tier:world.stage||0,grace:horror&&!world.stage?10:0,eventX:p.x,eventY:p.y,eventZ:p.z,eventIntensity:0},
      flash:0,damage:0,hitMarker:0,events:[],bullets:[],particles:[],threat:0,moving:0,
      enemies:world.enemies.map((e,i)=>({...e,id:i,hp:health(e),maxHp:health(e),baseY:e.y??groundAt(e.x,e.z),y:(e.y??groundAt(e.x,e.z))+HEIGHT[e.type]*scale(e),active:false,cooldown:advanced?.6+(i%7)*.11:1.2+i*.15,hurt:0,
        windup:0,windupMax:0,attackState:'idle',yaw:Number.isFinite(e.yaw)?e.yaw:Math.atan2(world.spawn.x-e.x,e.z-world.spawn.z),stun:0,phase:0,aimX:p.x,aimY:p.y+1.45,aimZ:p.z,burstLeft:0,burstWait:0,rushTime:0,rushX:0,rushZ:0,rushHit:false,
        awareness:'patrol',tactic:'hold',hasMemory:false,lastSeenX:e.x,lastSeenZ:e.z,memory:0,alert:0,seen:false,
        senseWait:0,thinkWait:i%4*.09,shareWait:0,alertWait:0,coverWait:0,holdTime:0,planWait:0,patrolIndex:0,searchIndex:0,
        goalX:e.x,goalZ:e.z,path:[],pathAt:0,stuck:0,moveSpeed:0,
        lastSeenY:(e.y??groundAt(e.x,e.z))+1.45,observedVX:0,observedVZ:0,observedAt:-1,sleeping:false,observedVY:0,dodgeWait:0,dodgeDelay:0,dodgeTime:0,dodgeX:0,dodgeZ:0,
        ...freshAir(),bossAwake:false,bossClock:0,bossStep:0,attackLabel:giant(e)?'Veille':'',weakPointOpen:false,weakTimer:0,bossReleased:!e.bossWave,squad:e.squadId??Math.floor(i/4),role:e.role||(e.type===1?'assault':e.type===2?'suppressor':i%3===0?'flanker':i%3===1?'assault':'suppressor')})),
      cores:world.cores.map(c=>({...c,taken:false})),pickups:world.pickups.map(c=>({...c,taken:false})),
      hazards:(world.hazards||[]).map(h=>({...h,hot:false,warning:false})),
      jumpPads:(world.jumpPads||[]).map(j=>({...j,flash:0})),
      projectiles:[],explosions:[],debris:[],bossAttacks:[],destructionRevision:destruction?.revision||0,
      pipes:(world.pipes||[]).map(q=>({...q,nozzle:pipeNozzle(q),dx:q.dx??0,dy:q.dy??1,dz:q.dz??0,length:q.length||3,radius:q.radius||.45,broken:false,active:false,age:0,remaining:0,hot:false,warning:false,damageWait:0,cycle:-1})),
      traps:(world.traps||[]).map(t=>({...t,hp:18,destroyed:false,warningTime:Math.max(.65,Number(t.warning)||1.2),progress:0,angle:0,box:null,hot:false,warning:false,damageWait:0,triggered:false,triggerAge:0,cycle:-1})),
      mechanisms:(world.mechanisms||[]).map(m=>({...m,active:false,shellHp:12,destroyed:false})),
      doors:(world.doors||[]).map(d=>({...d,progress:d.requires===undefined?1:0,open:d.requires===undefined,hp:18,destroyed:false})),
      lifts:(world.lifts||[]).map(l=>({...l,y:l.minY,target:l.minY,powered:l.requires===undefined,moving:false,carrying:false})),
      aiStats:{awake:0,dormant:0,alive:world.enemies.length,pathSearches:0,pathDeferred:0}};
    s.bossAlive=s.enemies.some(e=>e.type===3&&e.hp>0);trapStates=s.traps;let giants=s.enemies.filter(giant);
    // Public locomotion values describe displacement after collision, never held keys.
    const locomotion=s.locomotion={vx:0,vz:0,speed:0,forward:0,strafe:0,stridePhase:0,distance:0,
      moveBlend:0,sprintBlend:0,dashBlend:0,accelForward:0,accelStrafe:0,blocked:false};
    let velocityX=0,velocityZ=0,dashAge=.2,dashX=0,dashZ=0;
    let fireWait=0,navWait=0,hazardWait=0,recovery=0,interactHeld=false;
    let solids=destruction?.colliders||world.colliders;
    const b=world.bounds,trapBoxes=[];let bossAttackSerial=0,explosionSerial=0,projectileSerial=0,terrainDirty=false,seenDestructionRevision=destruction?.revision||0;
    const doorBoxes=s.doors.map(d=>({minX:d.x-d.w/2,maxX:d.x+d.w/2,minZ:d.z-d.d/2,maxZ:d.z+d.d/2,minY:0,maxY:0}));
    let navDirty=false,routeBudget=Infinity,routeSearches=0,routeDeferred=0;
    function updateDoorBoxes(doors=s.doors){
      for(let i=0;i<doors.length;i++){const d=doors[i],q=doorBoxes[i];q.minY=(d.y||0)+(d.destroyed?1000:d.progress*(d.h+.25));q.maxY=q.minY+d.h;}
    }
    updateDoorBoxes();
    const powered=id=>id===undefined||s.mechanisms.some(m=>m.id===id&&m.active);
    const feet=e=>e===p?e.y:Number.isFinite(e.baseY)?e.baseY:groundAt(e.x,e.z);
    function putHeight(e,y){if(e===p||e.type===undefined)e.y=y;else{e.baseY=y;e.y=y+HEIGHT[e.type]*scale(e);}}
    function onLift(l,x,z,margin=0){return Math.abs(x-l.x)<=l.w/2-margin&&Math.abs(z-l.z)<=l.d/2-margin;}
    function support(x,z,previous,r=.28){
      let y=ground(x,z);
      for(const l of s.lifts)if(onLift(l,x,z)&&Math.abs(l.y-previous)<=.43)y=Math.max(y,l.y);
      if(Math.abs(y-previous)>.43)for(const list of [localSolids(x,z),doorBoxes,trapBoxes])for(const q of list)if(Math.abs(q.maxY-previous)<=.43&&discBox(x,z,r,q))y=Math.max(y,q.maxY);
      return y;
    }
    // Static broad phase: all gameplay bodies fit within this expansion, including
    // the Custodian. A single bucket lookup replaces a full level scan per footstep.
    const bucketSize=8,bucketRadius=1.05,bucketX=Math.floor(b.minX/bucketSize),bucketZ=Math.floor(b.minZ/bucketSize);
    const bucketWidth=Math.floor(b.maxX/bucketSize)-bucketX+1,bucketDepth=Math.floor(b.maxZ/bucketSize)-bucketZ+1;
    const collisionBuckets=Array.from({length:bucketWidth*bucketDepth},()=>[]);
    function rebuildCollision(){
      for(const list of collisionBuckets)list.length=0;
    for(const q of solids){
      const x0=Math.max(0,Math.floor((q.minX-bucketRadius-1e-7)/bucketSize)-bucketX),x1=Math.min(bucketWidth-1,Math.floor((q.maxX+bucketRadius+1e-7)/bucketSize)-bucketX);
      const z0=Math.max(0,Math.floor((q.minZ-bucketRadius-1e-7)/bucketSize)-bucketZ),z1=Math.min(bucketDepth-1,Math.floor((q.maxZ+bucketRadius+1e-7)/bucketSize)-bucketZ);
      for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)collisionBuckets[z*bucketWidth+x].push(q);
    }
    }
    rebuildCollision();
    function syncDestruction(){
      if(!destruction||seenDestructionRevision===destruction.revision)return;
      solids=destruction.colliders;seenDestructionRevision=destruction.revision;s.destructionRevision++;rebuildCollision();navDirty=terrainDirty=true;unsupportedBodies();
      for(const m of s.mechanisms)if(!destruction.isAlive(m.destructibleId)){m.shellHp=0;activateMechanism(m,true);}
      for(const t of s.traps)if(!destruction.isAlive(t.destructibleId)){t.hp=0;t.destroyed=true;t.box=null;t.hot=t.warning=false;}
      for(const q of s.pipes)if(!destruction.isAlive(q.destructibleId)){q.broken=true;if(!q.active&&q.age===0)leakPipe(q);}
    }
    let fingerprint=2166136261;
    for(const c of JSON.stringify([world.seed,world.stage,world.spawn,b,world.colliders,world.enemies,world.cores,world.pickups,world.exit,world.hazards||[],world.walkable||[],world.mechanisms||[],world.doors||[],world.lifts||[],world.jumpPads||[],world.destructibles||[],world.pipes||[],world.traps||[],world.horrorSites||[],world.director||null]))fingerprint=Math.imul(fingerprint^c.charCodeAt(0),16777619);
    fingerprint=(fingerprint>>>0).toString(36);
    function blocked(x,z,r=.28,y=ground(x,z),doors=doorBoxes,staticBoxes=solids,traps=trapBoxes,height=1.8){
      if(x-r<b.minX||x+r>b.maxX||z-r<b.minZ||z+r>b.maxZ||!Number.isFinite(y))return true;
      const boxes=staticBoxes===solids&&r>=0&&r<=bucketRadius?collisionBuckets[(Math.floor(z/bucketSize)-bucketZ)*bucketWidth+Math.floor(x/bucketSize)-bucketX]||staticBoxes:staticBoxes;
      for(const list of [boxes,doors,traps])for(const q of list){
        if(q.minY>=y+height-1e-7||q.maxY<=y+.06)continue;
        const dx=x<q.minX?x-q.minX:x>q.maxX?x-q.maxX:0,dz=z<q.minZ?z-q.minZ:z>q.maxZ?z-q.maxZ:0;
        if(dx*dx+dz*dz<r*r)return true;
      }
      return false;
    }
    function localSolids(x,z){return collisionBuckets[(Math.floor(z/bucketSize)-bucketZ)*bucketWidth+Math.floor(x/bucketSize)-bucketX]||solids;}
    function discBox(x,z,r,q){const dx=x<q.minX?q.minX-x:x>q.maxX?x-q.maxX:0,dz=z<q.minZ?q.minZ-z:z>q.maxZ?z-q.maxZ:0;return dx*dx+dz*dz<r*r;}
    function actorBlocked(e,x,z,r,y){
      if(giant(e)&&e.arena&&Math.hypot(x-e.arena.x,z-e.arena.z)>Math.max(1,e.arena.r-2.1*scale(e)-5))return true;
      for(const g of giants)if(g!==e&&g.hp>0&&y<g.baseY+bodyHeight(g)&&y+bodyHeight(e)>g.baseY&&Math.hypot(x-g.x,z-g.z)<radius(g)+r)return true;
      if(giant(e)){if(p.hp>0&&Math.abs(p.y-y)<bodyHeight(e)&&Math.hypot(x-p.x,z-p.z)<r+.28)return true;for(const other of nearby(x,z,r+2))if(other!==e&&other.hp>0&&Math.abs(other.baseY-y)<bodyHeight(e)&&Math.hypot(x-other.x,z-other.z)<r+radius(other))return true;}
      return false;
    }
    function move(e,dx,dz,r=.28){
      if(e.airborne)return;if(giant(e))r=radius(e);const height=bodyHeight(e),free=(x,z,y)=>!blocked(x,z,r,y,doorBoxes,solids,trapBoxes,height)&&!actorBlocked(e,x,z,r,y);
      const count=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.12));
      dx/=count;dz/=count;
      for(let j=0;j<count;j++){
        let y=feet(e),next=support(e.x+dx,e.z,y,r);
        if(advanced&&e===p&&next<y-.42&&free(e.x+dx,e.z,y)){Object.assign(e,{airborne:true,airVX:velocityX,airVY:0,airVZ:velocityZ,airTime:0});e.x+=dx;p.dashing=0;stopMotion();break;}
        if(Math.abs(next-y)<=.42&&free(e.x+dx,e.z,next)){e.x+=dx;putHeight(e,next);}
        y=feet(e);next=support(e.x,e.z+dz,y,r);
        if(advanced&&e===p&&next<y-.42&&free(e.x,e.z+dz,y)){Object.assign(e,{airborne:true,airVX:velocityX,airVY:0,airVZ:velocityZ,airTime:0});e.z+=dz;p.dashing=0;stopMotion();break;}
        if(Math.abs(next-y)<=.42&&free(e.x,e.z+dz,next)){e.z+=dz;putHeight(e,next);}
      }
    }
    function nearestInteraction(){
      if(p.airborne)return null;
      const choices=[],add=(entry,x,y,z)=>{const d=Math.hypot(x-p.x,z-p.z);if(d<=2.6&&Math.abs(y-p.y)<1.05&&ray([p.x,p.y+1.4,p.z],[ (x-p.x)/(d||1),0,(z-p.z)/(d||1)],Math.max(0,d-.55))>=d-.6)choices.push({...entry,x,y,z,d});};
      for(const m of s.mechanisms)if(!m.active)add({kind:'mechanism',id:m.id,label:m.name||'Activer le mécanisme'},m.x,m.y||0,m.z);
      for(const l of s.lifts){
        const disabled=!l.powered,reason=disabled?'Rétablir l’alimentation':l.moving?'Ascenseur en mouvement':undefined;
        if(onLift(l,p.x,p.z,.08)&&Math.abs(p.y-l.y)<.25){
          const up=l.y<(l.minY+l.maxY)/2;
          choices.push({kind:'lift',id:l.id,label:up?'Monter avec l’ascenseur':'Descendre avec l’ascenseur',disabled:disabled||l.moving,reason,x:l.x,y:l.y,z:l.z,d:-1,target:up?l.maxY:l.minY});
        }else for(const call of [l.lowerCall,l.upperCall])if(call)add({kind:'lift',id:l.id,label:Math.abs(l.y-call.y)<.1?'Ascenseur au palier — embarquer':'Appeler l’ascenseur',disabled:disabled||l.moving||Math.abs(l.y-call.y)<.1,reason:disabled?reason:Math.abs(l.y-call.y)<.1?'Monter sur la plateforme':reason,target:call.y},call.x,call.y,call.z);
      }
      choices.sort((a,c)=>a.d-c.d);return choices[0]||null;
    }
    function interact(){
      if(s.dead||s.won)return false;
      const q=nearestInteraction();if(!q||q.disabled)return false;
      if(q.kind==='mechanism'){
        const m=s.mechanisms.find(m=>m.id===q.id);activateMechanism(m);return true;
      }
      const l=s.lifts.find(l=>l.id===q.id);l.target=q.target;l.moving=Math.abs(l.target-l.y)>.01;l.carrying=onLift(l,p.x,p.z)&&Math.abs(p.y-l.y)<.25;
      if(l.moving)emit('liftStart',{id:l.id,x:l.x,y:l.y,z:l.z,carrying:l.carrying});return l.moving;
    }
    function updateSystems(dt){
      for(const d of s.doors){
        const was=d.open;if(powered(d.requires))d.progress=Math.min(1,d.progress+dt/1.1);
        d.open=d.progress>=1;if(d.open&&!was){navDirty=true;emit('doorOpen',{id:d.id,x:d.x,y:d.y||0,z:d.z});}
      }
      updateDoorBoxes();
      for(const l of s.lifts){
        l.powered=powered(l.requires);if(!l.powered||!l.moving)continue;
        const old=l.y,actors=[p,...s.enemies.filter(e=>e.hp>0)],passengers=actors.filter(e=>!e.airborne&&onLift(l,e.x,e.z)&&Math.abs(feet(e)-old)<.18);
        let delta=clamp(l.target-old,-(l.speed||1.6)*dt,(l.speed||1.6)*dt);
        // A descending deck stops above a body underneath it. A carried body also
        // stops the deck at a low ceiling, rather than clipping through architecture.
        if(delta<0)for(const e of actors)if(!passengers.includes(e)&&onLift(l,e.x,e.z,-.35)&&feet(e)<old-.3)
          delta=Math.max(delta,Math.min(0,feet(e)+2.05-old));
        if(delta>0&&passengers.some(e=>blocked(e.x,e.z,e===p?.28:radius(e),feet(e)+delta)))delta=0;
        l.y+=delta;
        for(const e of passengers){putHeight(e,feet(e)+delta);if(e===p)l.carrying=true;}
        if(Math.abs(l.y-l.target)<1e-7){l.y=l.target;l.moving=false;emit('liftStop',{id:l.id,x:l.x,y:l.y,z:l.z,carrying:l.carrying&&onLift(l,p.x,p.z)&&Math.abs(p.y-l.y)<.25});l.carrying=false;}
      }
      if(navDirty){refreshNav();navDirty=terrainDirty=false;}
    }
    function landingAt(x,z,ceiling,r){
      let y=ground(x,z);if(y>ceiling+.08)y=-Infinity;
      for(const l of s.lifts)if(onLift(l,x,z)&&l.y<=ceiling+.08)y=Math.max(y,l.y);
      for(const list of [localSolids(x,z),doorBoxes,trapBoxes])for(const q of list)if(q.maxY<=ceiling+.08&&discBox(x,z,r,q))y=Math.max(y,q.maxY);
      return y;
    }
    function land(e,y,impact){
      putHeight(e,y);e.airborne=false;e.airVX=e.airVY=e.airVZ=e.airTime=0;e.padCooldown=Math.max(.5,e.padCooldown);
      if(e===p){stopMotion();p.dashing=0;}
      else{e.goalX=e.x;e.goalZ=e.z;e.path=[];e.pathAt=0;e.thinkWait=e.planWait=0;e.tactic='hold';}
      emit('land',{actor:e===p?'player':'enemy',enemyId:e===p?undefined:e.id,hard:impact>9,impact,x:e.x,y,z:e.z});
    }
    function airMove(e,dt,input){
      if(!e.airborne||!(dt>0))return;
      const r=e===p?.28:radius(e),count=Math.max(1,Math.ceil(dt*120),Math.ceil(Math.hypot(e.airVX,e.airVY,e.airVZ)*dt/.09)),h=dt/count;
      for(let i=0;i<count&&e.airborne;i++){
        if(e===p&&input){
          let mx=Number(input.moveX)||0,my=Number(input.moveY)||0,n=Math.max(1,Math.hypot(mx,my));mx/=n;my/=n;
          e.airVX=clamp(e.airVX+(Math.cos(p.yaw)*mx+Math.sin(p.yaw)*my)*h,-32,32);
          e.airVZ=clamp(e.airVZ+(Math.sin(p.yaw)*mx-Math.cos(p.yaw)*my)*h,-32,32);
        }
        const old=feet(e);let y=old+e.airVY*h-GRAVITY*h*h/2;e.airVY-=GRAVITY*h;e.airTime+=h;
        if(y>old){
          for(const list of [localSolids(e.x,e.z),doorBoxes,trapBoxes])for(const q of list)if(q.minY>=old+1.8-1e-7&&q.minY<y+1.8&&discBox(e.x,e.z,r,q)){y=Math.min(y,q.minY-1.8);e.airVY=0;}
          for(const l of s.lifts)if(onLift(l,e.x,e.z,-r)&&l.y-.22>=old+1.8-1e-7&&l.y-.22<y+1.8){y=Math.min(y,l.y-.22-1.8);e.airVY=0;}
        }else{
          const floor=landingAt(e.x,e.z,old,r);
          if(y<=floor&&old>=floor-.08){land(e,floor,-e.airVY);break;}
        }
        putHeight(e,y);
        const nx=e.x+e.airVX*h,nz=e.z+e.airVZ*h;
        if(ground(nx,e.z)<=y+.02&&!blocked(nx,e.z,r,y)&&!actorBlocked(e,nx,e.z,r,y))e.x=nx;else e.airVX=0;
        if(ground(e.x,nz)<=y+.02&&!blocked(e.x,nz,r,y)&&!actorBlocked(e,e.x,nz,r,y))e.z=nz;else e.airVZ=0;
        if(y<-14||e.airTime>8){
          if(e===p){p.hp=0;s.dead=true;stopMotion();emit('dead');}else damageEnemy(e,e.hp);
          e.airborne=false;e.airVX=e.airVY=e.airVZ=e.airTime=0;break;
        }
      }
    }
    function launch(e,pad){
      const duration=clamp(Number(pad.flightTime)||1.5,.7,2.5),y=feet(e);
      Object.assign(e,{airborne:true,airVX:(pad.target.x-e.x)/duration,airVZ:(pad.target.z-e.z)/duration,airVY:(pad.target.y-y)/duration+GRAVITY*duration/2,airTime:0,padCooldown:Math.max(2,duration+.5),padId:pad.id});
      if(e===p){stopMotion();p.dashing=0;hear(e.x,e.z,20,y);}else{e.rushTime=0;e.windup=0;e.burstLeft=0;e.dodgeTime=e.dodgeDelay=0;e.attackState='idle';}
      pad.flash=.55;emit('jumpPad',{id:pad.id,actor:e===p?'player':'enemy',enemyId:e===p?undefined:e.id,x:e.x,y,z:e.z});
    }
    function checkPad(e){
      if(e.airborne||e.padCooldown>0||e.type===3)return;
      for(const pad of s.jumpPads){
        if(e.padId===pad.id||Math.abs(feet(e)-pad.y)>.12||Math.hypot(e.x-pad.x,e.z-pad.z)>pad.r)continue;
        if(e!==p&&(!advanced||!e.hasMemory||Math.hypot(pad.target.x-e.lastSeenX,pad.target.z-e.lastSeenZ)>Math.hypot(e.x-e.lastSeenX,e.z-e.lastSeenZ)-2))continue;
        launch(e,pad);return;
      }
    }
    function airTimers(e,dt){
      e.padCooldown=Math.max(0,e.padCooldown-dt);
      if(!e.airborne&&e.padId!==null){const pad=s.jumpPads.find(j=>j.id===e.padId);if(!pad||Math.hypot(e.x-pad.x,e.z-pad.z)>pad.r+.4)e.padId=null;}
    }
    function stopMotion(reset=false){
      velocityX=velocityZ=0;dashAge=.2;dashX=dashZ=0;s.moving=0;
      for(const key of ['vx','vz','speed','forward','strafe','moveBlend','sprintBlend','dashBlend','accelForward','accelStrafe'])locomotion[key]=0;
      locomotion.blocked=false;
      if(reset)locomotion.stridePhase=locomotion.distance=0;
    }
    // Exact integral of a short smoothstep ramp, plateau, and smoothstep release.
    // The boost ends at 0.2s and never enters normal movement's velocity accumulator.
    function dashIntegral(time){
      const t=clamp(time,0,.2);
      if(t<.025){const u=t/.025;return .025*(u*u*u-.5*u*u*u*u);}
      if(t<=.15)return .0125+t-.025;
      const u=(t-.15)/.05;return .1375+.05*(u-u*u*u+.5*u*u*u*u);
    }
    function locomote(dt,input){
      if(p.airborne){
        const x=p.x,z=p.z;airMove(p,dt,input);
        const vx=dt>0?(p.x-x)/dt:0,vz=dt>0?(p.z-z)/dt:0;
        Object.assign(locomotion,{vx,vz,speed:0,forward:0,strafe:0,moveBlend:0,sprintBlend:0,dashBlend:0,accelForward:0,accelStrafe:0,blocked:false});s.moving=0;return;
      }
      let mx=Number.isFinite(input.moveX)?input.moveX:0,my=Number.isFinite(input.moveY)?input.moveY:0;
      let magnitude=Math.hypot(mx,my);
      if(magnitude>1){mx/=magnitude;my/=magnitude;magnitude=Math.hypot(mx,my);}
      if(magnitude<.002){mx=my=magnitude=0;}
      const cy=Math.cos(p.yaw),sy=Math.sin(p.yaw),speed=input.sprint?5.8:4.2;
      const targetX=(cy*mx+sy*my)*speed,targetZ=(sy*mx-cy*my)*speed;
      if(input.dash&&p.dash<=0){
        p.dash=1.7;p.dashing=.2;dashAge=0;
        if(magnitude>.1){dashX=(cy*mx+sy*my)/magnitude;dashZ=(sy*mx-cy*my)/magnitude;}
        else {dashX=sy;dashZ=-cy;}
        emit('dash');
      }
      if(!(dt>0))return;
      let dx=0,dz=0;
      function integrate(duration,rate){
        if(duration<=0)return;
        const decay=Math.exp(-rate*duration),area=(1-decay)/rate;
        dx+=targetX*duration+(velocityX-targetX)*area;
        dz+=targetZ*duration+(velocityZ-targetZ)*area;
        velocityX=targetX+(velocityX-targetX)*decay;
        velocityZ=targetZ+(velocityZ-targetZ)*decay;
      }
      const startX=p.x,startZ=p.z,previousX=locomotion.vx,previousZ=locomotion.vz;
      let travel=0,dashContribution=0,collided=false;
      // Resolve short physical segments as well as the exact velocity integral. This
      // preserves reversal/turning arc length and wall contact at lower frame rates.
      const count=Math.max(1,Math.ceil(dt*120)),part=dt/count;
      for(let sample=0;sample<count;sample++){
        dx=dz=0;
        if(!magnitude&&Math.hypot(velocityX,velocityZ)<.008)velocityX=velocityZ=0;
        const dot=velocityX*targetX+velocityZ*targetZ,targetSquared=targetX*targetX+targetZ*targetZ;
        if(magnitude&&dot<0){
          const crossing=Math.log((targetSquared-dot)/targetSquared)/38,first=Math.min(part,crossing);
          integrate(first,38);integrate(part-first,20);
        }else integrate(part,magnitude?20:32);
        let weight=0;
        if(dashAge<.2){
          const end=Math.min(.2,dashAge+part),area=dashIntegral(end)-dashIntegral(dashAge);
          weight=area/part;
          dx=dx*(1-weight)+dashX*13.2*area;
          dz=dz*(1-weight)+dashZ*13.2*area;
          dashAge=end;p.dashing=Math.max(0,.2-dashAge);
        }else p.dashing=Math.max(0,p.dashing-part);
        const x=p.x,z=p.z;move(p,dx,dz);
        const ax=p.x-x,az=p.z-z,distance=Math.hypot(ax,az),wanted=Math.hypot(dx,dz);
        const blockedX=Math.abs(ax-dx)>1e-8,blockedZ=Math.abs(az-dz)>1e-8;
        if(blockedX)velocityX=0;if(blockedZ)velocityZ=0;collided ||= blockedX||blockedZ;
        travel+=distance;
        if(distance>1e-8)dashContribution+=weight*clamp(distance/Math.max(wanted,1e-8),0,1)*part;
      }
      const actualX=p.x-startX,actualZ=p.z-startZ;
      locomotion.vx=actualX/dt;locomotion.vz=actualZ/dt;locomotion.speed=travel/dt;s.moving=locomotion.speed;
      locomotion.forward=sy*locomotion.vx-cy*locomotion.vz;
      locomotion.strafe=cy*locomotion.vx+sy*locomotion.vz;
      locomotion.blocked=collided;
      locomotion.moveBlend=clamp(locomotion.speed/4.2,0,1);
      locomotion.dashBlend=clamp(dashContribution/dt,0,1);
      locomotion.sprintBlend=clamp((locomotion.speed-4.2)/1.6,0,1)*(1-locomotion.dashBlend);
      const ax=(locomotion.vx-previousX)/dt,az=(locomotion.vz-previousZ)/dt;
      locomotion.accelForward=clamp(sy*ax-cy*az,-80,80);
      locomotion.accelStrafe=clamp(cy*ax+sy*az,-80,80);
      locomotion.distance+=travel;
      locomotion.stridePhase=(locomotion.stridePhase+travel/(2.4+.5*locomotion.sprintBlend)*Math.PI*2)%(Math.PI*2);
      if(!travel){locomotion.vx=locomotion.vz=locomotion.speed=locomotion.forward=locomotion.strafe=0;}
    }
    function ray(o,d,far=80){
      let best=far;
      for(const list of [solids,doorBoxes,trapBoxes])for(const q of list){
        let lo=0,hi=best;
        for(let k=0;k<3;k++){
          const min=k===0?q.minX:k===1?q.minY:q.minZ,max=k===0?q.maxX:k===1?q.maxY:q.maxZ;
          if(Math.abs(d[k])<1e-7){if(o[k]<min||o[k]>max){hi=-1;break;}}
          else {let a=(min-o[k])/d[k],c=(max-o[k])/d[k];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)break;}
        }
        if(hi>=lo&&lo>=0&&lo<best)best=lo;
      }
      // Lift decks have thickness and stop both upward and downward fire.
      for(const l of s.lifts){
        let lo=0,hi=best;
        for(let k=0;k<3;k++){
          const min=k===0?l.x-l.w/2:k===1?l.y-.2:l.z-l.d/2,max=k===0?l.x+l.w/2:k===1?l.y:l.z+l.d/2;
          if(Math.abs(d[k])<1e-9){if(o[k]<min||o[k]>max){hi=-1;break;}}
          else{let a=(min-o[k])/d[k],c=(max-o[k])/d[k];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)break;}
        }
        if(hi>=lo&&lo>=0&&lo<best)best=lo;
      }
      if(!floors.length){if(d[1]<-.0001){const t=-o[1]/d[1];if(t>=0)best=Math.min(best,t);}}
      else for(const f of floors){
        let enter=0,leave=best;
        for(const k of [0,2]){
          const center=k===0?f.x:f.z,extent=(k===0?f.w:f.d)/2;
          if(Math.abs(d[k])<1e-9){if(Math.abs(o[k]-center)>extent){leave=-1;break;}}
          else{let a=(center-extent-o[k])/d[k],c=(center+extent-o[k])/d[k];if(a>c)[a,c]=[c,a];enter=Math.max(enter,a);leave=Math.min(leave,c);}
        }
        if(leave<enter)continue;
        const sx=f.slopeX||0,sz=f.slopeZ||0,atOrigin=(f.y||0)+(o[0]-f.x)*sx+(o[2]-f.z)*sz;
        const relative=o[1]-atOrigin,rate=d[1]-d[0]*sx-d[2]*sz;
        if(relative+rate*enter<-.001){best=Math.min(best,enter);continue;}
        if(rate<-.000001){const t=-relative/rate;if(t>=enter&&t<=leave)best=Math.min(best,t);}
      }
      return best;
    }
    function sight(ax,az,bx,bz,ay=groundAt(ax,az)+1.2,by=groundAt(bx,bz)+1.2){const dx=bx-ax,dz=bz-az,dy=by-ay,l=Math.hypot(dx,dy,dz);return l<.01||ray([ax,ay,az],[dx/l,dy/l,dz/l],l)>=l-.02;}
    const cell=.8,nx=Math.ceil((b.maxX-b.minX)/cell)+1,nz=Math.ceil((b.maxZ-b.minZ)/cell)+1;
    const nav=new Uint8Array(nx*nz),dist=new Int16Array(nx*nz),queue=new Int32Array(nx*nz);
    const coord=i=>[b.minX+(i%nx)*cell,b.minZ+Math.floor(i/nx)*cell];
    const idx=(x,z)=>clamp(Math.round((z-b.minZ)/cell),0,nz-1)*nx+clamp(Math.round((x-b.minX)/cell),0,nx-1);
    for(let i=0;i<nav.length;i++){const [x,z]=coord(i);nav[i]=blocked(x,z,.4,ground(x,z),doorBoxes,solids,[])?0:1;}
    function rebuildNav(){
      dist.fill(-1);let start=idx(p.x,p.z);
      if(!nav[start]){let best=Infinity;for(let i=0;i<nav.length;i++)if(nav[i]){const [x,z]=coord(i),d=(x-p.x)**2+(z-p.z)**2;if(d<best){best=d;start=i;}}}
      let head=0,tail=0;queue[tail++]=start;dist[start]=0;
      while(head<tail){const i=queue[head++],x=i%nx;for(const j of [x?i-1:-1,x<nx-1?i+1:-1,i-nx,i+nx])if(j>=0&&j<nav.length&&nav[j]&&dist[j]<0&&(!elevated||segmentFree(...coord(i),...coord(j),.4))){dist[j]=dist[i]+1;queue[tail++]=j;}}
    }
    function emit(name,data){s.events.push({name,...data});}
    function particles(x,y,z,kind,n=9){
      for(let i=0;i<n;i++){const angle=i*2.399963+s.time*9,v=.7+(i%5)*.43;s.particles.push({x,y,z,vx:Math.cos(angle)*v,vy:.4+(i%4)*.5,vz:Math.sin(angle)*v,life:.4+(i%4)*.09,kind});}
      if(s.particles.length>180)s.particles.splice(0,s.particles.length-180);
    }

    function setDifficulty(level){if(!Number.isInteger(level)||level<0||level>2)return false;s.difficulty=level;return true;}
    const introSafe=()=>horror&&s.director.grace>0&&Math.hypot(p.x-world.spawn.x,p.z-world.spawn.z)<14;
    const enemySpeed=()=>1+s.difficulty*.09+(horror?(world.stage||0)*.025:0);
    const enemyCadence=()=>1/(1+s.difficulty*.13+(horror?(world.stage||0)*.045+s.director.progress*.05:0));
    function updateDirector(dt){
      const d=s.director;d.grace=Math.max(0,d.grace-dt);d.eventAge=Math.min(1e7,d.eventAge+dt);if(!horror)return;
      d.progress=clamp((s.relays+s.mechanisms.filter(m=>m.active).length*.5+Math.min(1,s.kills/Math.max(1,s.enemies.length))+.5*Math.min(1,s.elapsed/240))/6,0,1);
      d.tier=Math.min(6,(world.stage||0)+s.difficulty+Math.floor(d.progress*2));
      const danger=Math.min(1,s.enemies.filter(e=>e.hp>0&&!e.sleeping&&e.seen&&Math.hypot(e.x-p.x,e.z-p.z)<25).length/5),target=introSafe()?.16:clamp(.21+(world.stage||0)*.13+s.difficulty*.09+d.progress*.16+danger*.27+(1-p.hp/100)*.14,0,1);
      d.pressure+=(target-d.pressure)*(1-Math.exp(-dt*.7));d.tension=clamp(d.pressure+(d.eventType&&d.eventAge<2.2?(1-d.eventAge/2.2)*d.eventIntensity*.3:0),0,1);
      d.nextEvent=Math.max(0,d.nextEvent-dt);if(d.nextEvent>0)return;
      const sites=(world.horrorSites||[]).filter(q=>Math.hypot(q.x-p.x,q.z-p.z)>4&&Math.hypot(q.x-p.x,q.z-p.z)<24&&Math.abs((q.y||0)-p.y)<5&&(!q.destructibleId||!destruction||destruction.isAlive(q.destructibleId)));
      if(!sites.length){d.nextEvent=2.5;return;}
      const seed=((parseInt(fingerprint,36)||96)^Math.imul(d.events+1,1103515245))>>>0,site=sites[seed%sites.length],kinds=site.kind==='alarm'?['alarm','blackout','ambush']:site.kind==='steam'?['metallicSlam','ambush','blackout']:['metallicSlam','blackout','ambush'];
      const kind=kinds[Math.floor(seed/17)%kinds.length];d.events++;d.eventType=kind;d.eventAge=0;d.eventX=site.x;d.eventY=(site.y||0)+.8;d.eventZ=site.z;d.eventIntensity=clamp(.45+d.tier*.07,0,1);
      d.nextEvent=Math.max(9,21-(world.stage||0)*2-s.difficulty*1.5-d.progress*3)+(seed%5)*.55;
      emit('horror',{kind,x:d.eventX,y:d.eventY,z:d.eventZ,intensity:d.eventIntensity,tier:d.tier,id:site.id});
      if(kind==='ambush'){
        const choices=nearby(site.x,site.z,30).filter(e=>e.hp>0&&!giant(e)&&(!e.bossWave||e.bossReleased)&&!e.seen&&Math.hypot(e.x-site.x,e.z-site.z)<30).sort((a,b)=>Math.hypot(a.x-site.x,a.z-site.z)-Math.hypot(b.x-site.x,b.z-site.z));
        const squad=choices[0]?.squad;
        if(squad!==undefined)for(const e of choices)if(e.squad===squad){remember(e,site.x,site.z,'investigate',7,(site.y||0)+1.45);e.cooldown=Math.max(e.cooldown,1.2);}
      }else if(kind==='alarm')hear(site.x,site.z,22,(site.y||0));
      else if(kind==='metallicSlam')particles(site.x,d.eventY,site.z,5,6);
    }
    function hurt(amount,difficulty=true){
      if(introSafe())return;if(difficulty)amount*=1+s.difficulty*.15+(horror?(world.stage||0)*.035:0);
      if(!(amount>0)||p.dashing>0||recovery>0||s.dead||s.won)return;
      p.hp=Math.max(0,p.hp-amount);s.damage=1;s.combo=0;s.comboTime=0;emit('hurt');
      if(!p.hp){s.dead=true;stopMotion();emit('dead');}
    }
    function bossPhase(e){
      if(giant(e)){if(e.hp>0&&e.bossAwake)bossPhaseChange(e);return;}
      if(e.type===3&&e.hp>0&&e.hp<=e.maxHp/2&&e.phase===0){
        e.phase=1;e.cooldown=Math.min(e.cooldown,.65);emit('bossPhase',{id:e.id,phase:1});particles(e.x,e.y,e.z,6,24);
      }
    }
    function damageEnemy(e,amount,source,weak=false){
      if(e.hp<=0)return;if(giant(e))amount*=e.weakPointOpen&&weak?3.2:.30;if(e.bossWave)e.bossReleased=true;
      e.hp=Math.max(0,e.hp-amount);e.hurt=.2;const origin=source||{x:p.x,y:p.y+1.45,z:p.z,credit:true};remember(e,origin.x,origin.z,'investigate',7,origin.y);e.thinkWait=0;
      if(e.hp<=0){
        if(giant(e)){s.bossAttacks=s.bossAttacks.filter(a=>a.bossId!==e.id);e.weakPointOpen=false;e.weakTimer=0;emit('bossDeath',{id:e.id,x:e.x,y:e.y,z:e.z,scale:scale(e)});for(let i=0;i<12;i++){const angle=i*2.399963,size=scale(e),id=++explosionSerial;s.explosions.push({id,kind:'boss',x:e.x+Math.cos(angle)*size*.5,y:e.baseY+size*(.35+i*.23),z:e.z+Math.sin(angle)*size*.5,age:-i*.09,life:1.2,radius:size*.56,power:55,seed:id*911});}if(s.explosions.length>24)s.explosions.splice(0,s.explosions.length-24);}
        s.kills++;if(origin.credit){s.combo++;s.comboTime=4;}
        const multiplier=1+Math.min(4,s.combo-1)*.25,points=Math.round([100,150,125,2000][e.type]*multiplier);
        if(origin.credit)s.score+=points;emit('kill',{kind:e.type,boss:e.type===3,points:origin.credit?points:0,credited:!!origin.credit});particles(e.x,e.y,e.z,6,e.type===3?32:18);
        if(origin.credit&&s.combo>1)emit('combo',{count:s.combo,multiplier});
        if(e.type===3)s.bossAlive=s.enemies.some(q=>q.type===3&&q.hp>0);
      }else bossPhase(e);
    }

    function giantHit(e,o,d,far,padding=0){
      const size=scale(e),cs=Math.cos(e.yaw),sn=Math.sin(e.yaw),ox=o[0]-e.x,oz=o[2]-e.z;
      const origin=[(cs*ox+sn*oz)/size,(o[1]-e.baseY)/size,(-sn*ox+cs*oz)/size],dir=[(cs*d[0]+sn*d[2])/size,d[1]/size,(-sn*d[0]+cs*d[2])/size];
      let distance=far,weak=false;
      const boxes=[[-.825,.825,1.2,2.6,-.575,.625],[-.5,.5,2.64,3.14,-.455,.295],[-.605,.605,1.495,2.365,-.70,-.54]];
      for(const side of [-1,1])for(const end of [-1,1])boxes.push([side*.86-.28,side*.86+.28,.03,1.45,end*.68-.34,end*.68+.34]);
      for(const box of boxes){const q=box.map((v,i)=>v+(i%2?padding:-padding)/size);let lo=0,hi=distance;for(let k=0;k<3;k++){if(Math.abs(dir[k])<1e-9){if(origin[k]<q[k*2]||origin[k]>q[k*2+1]){hi=-1;break;}}else{let a=(q[k*2]-origin[k])/dir[k],b=(q[k*2+1]-origin[k])/dir[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(hi<lo)break;}}if(hi>=lo&&lo>=0&&lo<distance)distance=lo;}
      const center=[e.x+sn*.9*size,e.baseY+1.93*size,e.z-cs*.9*size],delta=center.map((v,k)=>v-o[k]),along=delta.reduce((n,v,k)=>n+v*d[k],0),off=delta.reduce((n,v)=>n+v*v,0)-along*along,r=.36*size+padding;
      if(along>=0&&off<=r*r){const hit=Math.max(0,along-Math.sqrt(Math.max(0,r*r-off)));if(hit<distance){distance=hit;weak=true;}}
      return {distance,weak};
    }
    function hitRay(origin,dir,far,assist){
      let distance=ray(origin,dir,far),victim=null,weak=false;
      for(const e of s.enemies)if(e.hp>0){
        if(giant(e)){const h=giantHit(e,origin,dir,distance);if(h.distance<distance){distance=h.distance;victim=e;weak=h.weak;}continue;}
        // The original torso stays unchanged. Ascension helmets match FActors'
        // heavy (1.88 m) and Custodian (2.89 m) head centres, with no damage bonus.
        const volumes=advanced&&(e.type===1||e.type===3)?2:1;
        for(let volume=0;volume<volumes;volume++){
          const y=volume?e.baseY+(e.type===1?1.88:2.89):e.y;
          const d=[e.x-origin[0],y-origin[1],e.z-origin[2]],along=d[0]*dir[0]+d[1]*dir[1]+d[2]*dir[2];
          const radius=(volume?(e.type===1?.30:.36):e.type===3?1.15:.67)+(assist?Math.min(s.weapon?.16:.38,along*(s.weapon?.012:.025)):0);
          if(along<0||along>distance+radius)continue;
          const perp=d[0]*d[0]+d[1]*d[1]+d[2]*d[2]-along*along;
          if(perp>radius*radius)continue;
          const hit=Math.max(0,along-Math.sqrt(Math.max(0,radius*radius-perp)));
          if(hit<distance){distance=hit;victim=e;weak=false;}
        }
      }
      return {distance,victim,weak};
    }

    function activateMechanism(m,destroyed=false){
      if(destroyed)m.destroyed=true;if(m.active)return;
      m.active=true;for(const l of s.lifts)l.powered=powered(l.requires);
      emit('mechanism',{id:m.id,kind:m.kind,label:m.name,destroyed:!!m.destroyed,x:m.x,y:m.y||0,z:m.z});
      hear(m.x,m.z,advanced?25:15,m.y||0);
    }
    function leakPipe(q){
      if(q.active)return;
      q.active=true;q.age=0;q.remaining=(q.delay||1)+(q.duration||7);q.warning=true;q.hot=false;
      emit('pipeLeak',{id:q.id,x:q.x,y:q.y,z:q.z});
    }
    function sceneryResult(result,point,power){
      if(!result)return;
      for(const id of result.pipeLeaks||[]){const q=s.pipes.find(q=>q.id===id);if(q)leakPipe(q);}
      for(const q of (result.debris||[]).slice(0,28)){
        const pos=q.p||[q.x,q.y,q.z],index=s.debris.length,angle=index*2.399963;
        if(!pos.every(Number.isFinite))continue;
        const size=Array.isArray(q.size)?q.size.slice():Number(q.size)||.16,velocity=q.velocity||[q.vx,q.vy,q.vz],fallback=[Math.cos(angle)*(1.5+index%3),2+(index%4)*.5,Math.sin(angle)*(1.5+index%3)];
        s.debris.push({x:pos[0],y:pos[1],z:pos[2],vx:Number.isFinite(velocity[0])?velocity[0]:fallback[0],vy:Number.isFinite(velocity[1])?velocity[1]:fallback[1],vz:Number.isFinite(velocity[2])?velocity[2]:fallback[2],size,age:0,life:q.life||2+(index%3)*.3,mat:q.mat??1,color:q.color,seed:q.seed??index});
      }
      if(s.debris.length>96)s.debris.splice(0,s.debris.length-96);
      if(result.changed)emit('creak',{x:point[0],y:point[1],z:point[2],power});
    }
    function distanceBox(point,q){return Math.hypot(Math.max(q.minX-point[0],0,point[0]-q.maxX),Math.max(q.minY-point[1],0,point[1]-q.maxY),Math.max(q.minZ-point[2],0,point[2]-q.maxZ));}
    function damageScenery(point,power,r=0,direction,ignoreId){
      if(!(power>0))return;
      const result=destruction&&(r>0?destruction.blast(point,r,power,ignoreId):destruction.hit(point,power,direction));sceneryResult(result,point,power);
      for(let i=0;i<s.doors.length;i++){
        const d=s.doors[i];if(d.destroyed)continue;const distance=distanceBox(point,doorBoxes[i]);if(distance>(r||.18))continue;
        d.hp=Math.max(0,d.hp-power*(r?Math.max(.2,1-distance/r):1));
        if(!d.hp){d.destroyed=true;d.progress=1;d.open=true;navDirty=true;emit('doorOpen',{id:d.id,destroyed:true,x:d.x,y:d.y||0,z:d.z});}
      }
      updateDoorBoxes();
      for(const m of s.mechanisms){
        if(m.destroyed)continue;const d=Math.hypot(m.x-point[0],(m.y||0)+.95-point[1],m.z-point[2]);if(d>(r||.8))continue;
        m.shellHp=Math.max(0,(m.shellHp??12)-power*(r?Math.max(.2,1-d/r):1));if(!m.shellHp)activateMechanism(m,true);
      }
      for(const q of s.pipes)if(Math.hypot(q.x-point[0],q.y-point[1],q.z-point[2])<(r||.9))leakPipe(q);
      for(const t of s.traps){
        if(t.destroyed)continue;const q=t.box||{minX:t.x-t.w/2,maxX:t.x+t.w/2,minY:t.y,maxY:t.y+.3,minZ:t.z-t.d/2,maxZ:t.z+t.d/2};
        const d=distanceBox(point,q);if(d>(r||.18))continue;t.hp=Math.max(0,(t.hp??18)-power*(r?Math.max(.2,1-d/r):1));
        if(!t.hp){t.destroyed=true;t.hot=t.warning=false;t.box=null;emit('trap',{id:t.id,kind:t.kind,destroyed:true,x:t.x,y:t.y,z:t.z});}
      }
    }
    function blastExposure(point,x,y,z){
      let clear=0;
      for(const offset of [-.35,.35]){const target=[x,y+offset,z],v=target.map((n,k)=>n-point[k]),d=Math.hypot(...v);if(d<.08||ray(point,v.map(n=>n/d),d)>=d-.04)clear++;}
      return clear/2;
    }
    function explode(point,r,damage,terrainPower,owner,shot=false,weakId=-1,ignoreId){
      const id=++explosionSerial,seed=(id*1103515245+(world.stage||0)*12345)>>>0;
      s.explosions.push({id,x:point[0],y:point[1],z:point[2],age:0,life:.8,radius:r,power:terrainPower,seed});if(s.explosions.length>24)s.explosions.shift();
      emit('explosion',{id,x:point[0],y:point[1],z:point[2],radius:r,power:terrainPower,seed,owner});
      // Resolve cover before the blast removes it: this explosion cannot retroactively
      // hurt a body through the wall that it has just opened.
      const pd=Math.hypot(p.x-point[0],p.y+1-point[1],p.z-point[2]);
      if(pd<r){const exposure=blastExposure(point,p.x,p.y+1,p.z);if(exposure){hurt(Math.min(owner==='player'?32:40,damage*(1-pd/r)*exposure),owner!=='player');const n=Math.max(.01,Math.hypot(p.x-point[0],p.z-point[2]));if(!s.dead){if(p.airborne){p.airVX=clamp(p.airVX+(p.x-point[0])/n*2,-32,32);p.airVZ=clamp(p.airVZ+(p.z-point[2])/n*2,-32,32);}else move(p,(p.x-point[0])/n*.42*exposure,(p.z-point[2])/n*.42*exposure);}}}
      let connected=false;
      for(const e of new Set([...nearby(point[0],point[2],r+2),...giants]))if(e.hp>0&&owner!==e.id){
        const d=Math.max(0,Math.hypot(e.x-point[0],e.y-point[1],e.z-point[2])-(giant(e)?1.15*scale(e):0));if(d>=r)continue;
        const exposure=blastExposure(point,e.x,e.y,e.z);if(!exposure)continue;
        const amount=(owner==='player'?8.5:damage*.23)*Math.max(0,1-d/r)*exposure;
        if(amount>0){connected=true;damageEnemy(e,amount,{x:point[0],y:point[1],z:point[2],credit:owner==='player'},e.id===weakId);if(e.hp>0){e.stun=Math.max(e.stun,.25);e.windup=0;e.burstLeft=0;}}
      }
      if(shot&&connected){s.hits++;s.hitMarker=.22;emit('hit');}
      damageScenery(point,terrainPower,r,undefined,ignoreId);syncDestruction();hear(point[0],point[2],34,point[1]);
      particles(...point,5,22);
    }
    function castProjectile(o,d,far,r=.12){
      let distance=far,normal=[0,1,0];
      const lifts=s.lifts.map(l=>({minX:l.x-l.w/2,maxX:l.x+l.w/2,minY:l.y-.2,maxY:l.y,minZ:l.z-l.d/2,maxZ:l.z+l.d/2}));
      for(const list of [solids,doorBoxes,trapBoxes,lifts])for(const q of list){
        let lo=0,hi=distance,n=[0,1,0];
        for(let k=0;k<3;k++){
          const min=(k===0?q.minX:k===1?q.minY:q.minZ)-r,max=(k===0?q.maxX:k===1?q.maxY:q.maxZ)+r;
          if(Math.abs(d[k])<1e-9){if(o[k]<min||o[k]>max){hi=-1;break;}}
          else{let a=(min-o[k])/d[k],c=(max-o[k])/d[k],sign=-1;if(a>c){[a,c]=[c,a];sign=1;}if(a>lo){lo=a;n=[0,0,0];n[k]=sign;}hi=Math.min(hi,c);if(hi<lo)break;}
        }
        if(hi>=lo&&lo>=0&&lo<distance){distance=lo;normal=n;}
      }
      if(!floors.length){if(d[1]<-1e-8){const hit=(r-o[1])/d[1];if(hit>=0&&hit<distance){distance=hit;normal=[0,1,0];}}}
      else for(const f of floors){
        let enter=0,leave=distance;
        for(const k of [0,2]){const c=k===0?f.x:f.z,span=(k===0?f.w:f.d)/2;if(Math.abs(d[k])<1e-9){if(Math.abs(o[k]-c)>span){leave=-1;break;}}else{let a=(c-span-o[k])/d[k],b=(c+span-o[k])/d[k];if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);leave=Math.min(leave,b);}}
        if(leave<enter)continue;
        const sx=f.slopeX||0,sz=f.slopeZ||0,height=(f.y||0)+(o[0]-f.x)*sx+(o[2]-f.z)*sz,relative=o[1]-height-r,rate=d[1]-d[0]*sx-d[2]*sz;
        let hit=relative+rate*enter<-.001?enter:rate<-1e-9?-relative/rate:Infinity;
        if(hit>=enter&&hit<=leave&&hit<distance){distance=hit;const n=Math.hypot(sx,1,sz);normal=[-sx/n,1/n,-sz/n];}
      }
      const decorative=destruction?.raycast?.(o,d,distance);if(decorative&&decorative.distance<distance){distance=decorative.distance;normal=decorative.normal||normal;}
      return {distance,normal};
    }
    function projectileVictim(q,o,d,far){
      let result=null,best=far,weak=false;
      const test=(actor,x,y,z,r)=>{const v=[x-o[0],y-o[1],z-o[2]],along=v.reduce((n,c,k)=>n+c*d[k],0),off=v.reduce((n,c)=>n+c*c,0)-along*along;if(along<0||off>r*r)return;const hit=Math.max(0,along-Math.sqrt(Math.max(0,r*r-off)));if(hit<best){best=hit;result=actor;weak=false;}};
      if(q.owner!=='player')test(p,p.x,p.y+1,p.z,.48+q.radius);
      for(const e of new Set([...nearby(o[0],o[2],far+3),...giants]))if(e.hp>0&&q.owner!==e.id){if(giant(e)){const hit=giantHit(e,o,d,best,q.radius);if(hit.distance<best){best=hit.distance;result=e;weak=hit.weak;}continue;}test(e,e.x,e.y,e.z,(e.type===3?1.15:.67)+q.radius);if(advanced&&(e.type===1||e.type===3))test(e,e.x,e.baseY+(e.type===1?1.88:2.89),e.z,(e.type===1?.30:.36)+q.radius);}
      return {actor:result,distance:best,weak};
    }
    function spawnProjectile(kind,source,velocity,owner,settings={}){
      if(s.projectiles.length>=48)return false;
      const q={id:++projectileSerial,kind,owner,x:source[0],y:source[1],z:source[2],vx:velocity[0],vy:velocity[1],vz:velocity[2],age:0,life:kind==='rocket'?5:4,fuse:kind==='grenade'?1.8:0,radius:kind==='rocket'?.24:.17,blastRadius:kind==='rocket'?3.4:3.2,damage:kind==='rocket'?28:24,terrainPower:kind==='rocket'?38:28,travel:0,bounces:0,resting:false,...settings};
      s.projectiles.push(q);emit(kind,{x:q.x,y:q.y,z:q.z,owner,id:q.id});return q;
    }
    function updateProjectiles(dt){
      for(const q of s.projectiles){
        const count=Math.max(1,Math.ceil(dt*120)),h=dt/count;
        for(let i=0;i<count&&q.life>0;i++){
          q.age+=h;q.life-=h;if(q.kind==='grenade')q.fuse-=h;
          if(q.kind==='grenade'&&q.fuse<=0){explode([q.x,q.y,q.z],q.blastRadius,q.damage,q.terrainPower,q.owner,q.owner==='player');q.life=0;break;}
          if(q.resting)continue;
          const origin=[q.x,q.y,q.z],delta=[q.vx*h,q.vy*h-(q.kind==='grenade'?GRAVITY*h*h/2:0),q.vz*h],travel=Math.hypot(...delta);
          if(q.kind==='grenade')q.vy-=GRAVITY*h;
          if(travel<1e-9)continue;const dir=delta.map(v=>v/travel),wall=castProjectile(origin,dir,travel+.001,q.radius),victim=projectileVictim(q,origin,dir,Math.min(travel,wall.distance));
          const hit=victim.actor?victim.distance:wall.distance,amount=Math.min(travel,Math.max(0,hit-.002));q.x+=dir[0]*amount;q.y+=dir[1]*amount;q.z+=dir[2]*amount;q.travel+=amount;
          if(hit<=travel){
            if(q.kind==='rocket'){
              if(q.age>=.07&&q.travel>=.7)explode([q.x,q.y,q.z],q.blastRadius,q.damage,q.terrainPower,q.owner,q.owner==='player',victim.weak?victim.actor.id:-1);
              else{damageScenery([q.x,q.y,q.z],8,0,dir);syncDestruction();emit('rocketDud',{x:q.x,y:q.y,z:q.z,owner:q.owner});particles(q.x,q.y,q.z,5,6);}
              q.life=0;
            }else{
              const n=victim.actor?dir.map(v=>-v):wall.normal,dot=q.vx*n[0]+q.vy*n[1]+q.vz*n[2];
              q.vx=(q.vx-2*dot*n[0])*.42;q.vy=(q.vy-2*dot*n[1])*.42;q.vz=(q.vz-2*dot*n[2])*.42;q.x+=n[0]*.012;q.y+=n[1]*.012;q.z+=n[2]*.012;q.bounces++;
              if(q.bounces>=3||Math.hypot(q.vx,q.vy,q.vz)<1.4){q.resting=true;q.vx=q.vy=q.vz=0;}
            }
          }
          if(q.y<-20||q.x<b.minX-10||q.x>b.maxX+10||q.z<b.minZ-10||q.z>b.maxZ+10)q.life=0;
        }
      }
      s.projectiles=s.projectiles.filter(q=>q.life>0);
      for(const q of s.explosions)q.age+=dt;s.explosions=s.explosions.filter(q=>q.age<q.life);
      for(const q of s.debris){
        q.age+=dt;if(q.resting)continue;
        const size=Array.isArray(q.size)?q.size:[q.size,q.size,q.size],r=Math.hypot(...size)/2,old=[q.x,q.y,q.z],delta=[q.vx*dt,q.vy*dt-GRAVITY*dt*dt/2,q.vz*dt],travel=Math.hypot(...delta);q.vy-=GRAVITY*dt;
        let hit=false;const boxes=r+travel/2<=bucketRadius?localSolids(q.x+delta[0]/2,q.z+delta[2]/2):solids;
        // A conservative sphere contains the spinning fragment. Contact stops it;
        // cosmetic fragments never become invisible blockers for living bodies.
        if(travel>0)for(const box of boxes){let lo=0,hi=1;for(let k=0;k<3;k++){const min=(k===0?box.minX:k===1?box.minY:box.minZ)-r,max=(k===0?box.maxX:k===1?box.maxY:box.maxZ)+r;if(Math.abs(delta[k])<1e-9){if(old[k]<min||old[k]>max){hi=-1;break;}}else{let a=(min-old[k])/delta[k],b=(max-old[k])/delta[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(hi<lo)break;}}if(hi>=lo&&lo<=1&&hi>=0){hit=true;break;}}
        if(hit){q.age=q.life;continue;}q.x+=delta[0];q.y+=delta[1];q.z+=delta[2];
        const floor=Math.max(ground(q.x,q.z),ground(q.x-size[0]/2,q.z-size[2]/2),ground(q.x+size[0]/2,q.z+size[2]/2));
        if(q.y-r<=floor){q.y=floor+size[1]/2;q.vx=q.vy=q.vz=0;q.resting=true;}
      }
      s.debris=s.debris.filter(q=>q.age<q.life);
    }
    function launchRocket(forward,right,up,origin,assist){
      const target=hitRay(origin,forward,80,assist),aim=origin.map((v,k)=>v+forward[k]*target.distance);
      const offset=forward.map((v,k)=>v*1.228+right[k]*.255-up[k]*.23),distance=Math.hypot(...offset),direction=offset.map(v=>v/distance),reach=Math.max(0,ray(origin,direction,distance+.02)-.025);
      const source=origin.map((v,k)=>v+direction[k]*Math.min(distance,reach)),toward=aim.map((v,k)=>v-source[k]),length=Math.hypot(...toward)||1;
      return spawnProjectile('rocket',source,toward.map(v=>v/length*24),'player',{blastRadius:4.2,terrainPower:55,damage:32});
    }
    function fire(assist=false){
      if(s.dead||s.won||fireWait>0||p.overheated)return false;
      const shotgun=s.weapon===1,rocket=s.weapon===2;
      fireWait=rocket?1.25:shotgun?.78:.165;p.heat=Math.min(1,p.heat+(rocket?.65:shotgun?.37:.12));
      if(p.heat>=.99){p.overheated=true;emit('overheat');}
      const cy=Math.cos(p.yaw),sy=Math.sin(p.yaw),cp=Math.cos(p.pitch),sp=Math.sin(p.pitch);
      const forward=[sy*cp,sp,-cy*cp],right=[cy,0,sy],up=[-sy*sp,cp,cy*sp],origin=[p.x,p.y+1.62,p.z];
      if(rocket){launchRocket(forward,right,up,origin,assist);s.flash=1;s.shots++;hear(p.x,p.z,30,p.y);reactToShot();return true;}
      let connected=false;
      for(let i=0;i<(shotgun?7:1);i++){
        const angle=(i-1)*Math.PI/3+s.shots*.71,spread=i?.088:0;
        const a=Math.cos(angle)*spread,c=Math.sin(angle)*spread;
        const dir=forward.map((v,k)=>v+right[k]*a+up[k]*c),length=Math.hypot(...dir);for(let k=0;k<3;k++)dir[k]/=length;
        const hit=hitRay(origin,dir,shotgun?24:75,assist);
        const prop=destruction?.raycast?.(origin,dir,hit.distance);if(prop&&prop.distance<hit.distance){hit.distance=prop.distance;hit.victim=null;}
        if(hit.victim){
          connected=true;damageEnemy(hit.victim,shotgun?.82*clamp(1-(hit.distance-5)*.035,.45,1):1,undefined,hit.weak);
          particles(origin[0]+dir[0]*hit.distance,origin[1]+dir[1]*hit.distance,origin[2]+dir[2]*hit.distance,5,shotgun?3:7);
        }else{const point=origin.map((v,k)=>v+dir[k]*hit.distance);particles(...point,5,shotgun?2:4);if(hit.distance<(shotgun?24:75)-.001)damageScenery(point,shotgun?5:2,0,dir);}
      }
      syncDestruction();s.flash=1;s.shots++;emit(shotgun?'fracture':'shot',{weapon:s.weapon});
      hear(p.x,p.z,shotgun?24:18,p.y);reactToShot();
      if(connected){s.hits++;s.hitMarker=.18;emit('hit');}
      return true;
    }
    function pulse(){
      if(s.dead||s.won||p.pulseCooldown>0)return false;
      p.pulseCooldown=7;s.pulseVisual=.65;p.heat=Math.max(0,p.heat-.28);
      let hits=0;
      for(const e of s.enemies)if(e.hp>0){
        const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);
        if(Math.hypot(d,e.baseY-p.y)>6.5||!sight(p.x,p.z,e.x,e.z,p.y+1.2,e.y))continue;
        hits++;damageEnemy(e,e.type===3?3:d<3?3:2);
        if(e.hp>0){
          e.stun=e.type===3?.38:.85;e.windup=0;e.burstLeft=0;e.rushTime=0;e.attackState='stunned';e.cooldown=Math.max(e.cooldown,.7);
          const push=e.type===3?.6:2.3*(1-d/9),n=Math.max(.01,d);
          if(e.airborne){e.airVX=clamp(e.airVX+dx/n*3,-32,32);e.airVZ=clamp(e.airVZ+dz/n*3,-32,32);}else move(e,dx/n*push,dz/n*push,e.type===3?1.05:.38);
        }
      }
      s.bullets=s.bullets.filter(q=>{if(Math.hypot(q.x-p.x,q.y-(p.y+1),q.z-p.z)>7.5)return true;particles(q.x,q.y,q.z,4,3);return false;});
      hear(p.x,p.z,15,p.y);emit('pulse',{radius:6.5,hits});return true;
    }
    function eyeHeight(e){return advanced&&(e.type===1||e.type===3)?e.baseY+(e.type===1?1.88:2.89)*scale(e):e.y;}
    function articulatedGun(e){return advanced&&(e.type===1||e.type===3);}
    function barrel(e,x=e.aimX,y=e.aimY,z=e.aimZ,side=1){
      if(!articulatedGun(e))return {point:[e.x,e.y,e.z],blocked:false};
      // Same nominal joint frames as FActors, without cosmetic gait/bob. The
      // heavy rifle has one offset barrel; each half of the boss fan uses an arm.
      const heavy=e.type===1,size=scale(e),pivot=(heavy?1.33:2.28)*size,pitch=clamp(Math.atan2(y-e.baseY-pivot,Math.hypot(x-e.x,z-e.z)), -.9,.9);
      const lateral=heavy?.23:side*1.04*size,forward=heavy?.29+1.005*Math.cos(pitch)-.045*Math.sin(pitch):1.486*Math.cos(pitch)*size;
      const rise=heavy?.045*Math.cos(pitch)+1.005*Math.sin(pitch):1.486*Math.sin(pitch)*size,sin=Math.sin(e.yaw),cos=Math.cos(e.yaw);
      const delta=[cos*lateral+sin*forward,rise,sin*lateral-cos*forward],distance=Math.hypot(...delta),direction=delta.map(v=>v/distance);
      const source=[e.x,e.baseY+pivot,e.z],travel=Math.min(distance,Math.max(0,ray(source,direction,distance+.025)-.025));
      return {point:source.map((v,k)=>v+direction[k]*travel),blocked:travel<distance-1e-6,obstruction:direction};
    }

    const hasOrdnance=e=>advanced&&(e.weapon==='rocket'||e.weapon==='grenade');
    function ordnanceSolution(e,x,y,z){
      const kind=e.weapon,muzzle=barrel(e,x,y,z);if(muzzle.blocked)return null;
      const origin=muzzle.point,d=Math.hypot(x-origin[0],z-origin[2]),r=kind==='rocket'?3.4:3.2;
      if(d<(kind==='rocket'?7:6)||d>(kind==='rocket'?29:24))return null;
      const target=[x,kind==='grenade'?y-1.25:y,z];
      // An ally near the intended blast is a reason to move or hold fire, not an
      // expendable blocker. Only the committed observation is used as the target.
      for(const ally of nearby(x,z,r+2))if(ally!==e&&ally.hp>0&&Math.hypot(ally.x-x,ally.y-target[1],ally.z-z)<r+1.1)return null;
      if(!clearLane(e,x,y,z,origin))return null;
      if(kind==='rocket'){
        if(!sight(origin[0],origin[2],x,z,origin[1],y))return null;
        const delta=target.map((v,k)=>v-origin[k]),length=Math.hypot(...delta)||1;
        return {origin,velocity:delta.map(v=>v/length*11),fuse:0};
      }
      const duration=clamp(d/13,.65,1.35),velocity=[(x-origin[0])/duration,(target[1]-origin[1])/duration+GRAVITY*duration/2,(z-origin[2])/duration];
      let previous=origin;
      for(let i=1;i<=12;i++){
        const t=duration*i/12,next=origin.map((v,k)=>v+velocity[k]*t-(k===1?GRAVITY*t*t/2:0)),delta=next.map((v,k)=>v-previous[k]),length=Math.hypot(...delta);
        if(length>0&&castProjectile(previous,delta.map(v=>v/length),length,.17).distance<length-.015)return null;
        previous=next;
      }
      return {origin,velocity,fuse:duration+.55};
    }
    function enemyOrdnance(e){
      const solution=ordnanceSolution(e,e.aimX,e.aimY,e.aimZ);
      if(!solution){e.cooldown=.8;return;}
      spawnProjectile(e.weapon,solution.origin,solution.velocity.map(v=>e.weapon==='rocket'?v*enemySpeed():v),e.id,{fuse:solution.fuse});
      e.cooldown=(e.weapon==='grenade'?4.8:4.1)*enemyCadence();
      emit('enemyShot',{x:e.x,y:e.y,z:e.z,kind:e.type,weapon:e.weapon});
    }
    function canShoot(e,x,y,z){
      if(hasOrdnance(e))return !!ordnanceSolution(e,x,y,z);
      for(const side of articulatedGun(e)&&e.type===3?[-1,1]:[1]){
        const muzzle=barrel(e,x,y,z,side);if(muzzle.blocked)continue;const source=muzzle.point;
        if(sight(source[0],source[2],x,z,source[1],y)&&clearLane(e,x,y,z,source))return true;
      }
      return false;
    }
    function projectile(e,angle=0,speed=7,damage=8){
      const muzzle=barrel(e,e.aimX,e.aimY,e.aimZ,angle<0?-1:1);let source=muzzle.point;
      if(!muzzle.blocked&&!clearLane(e,e.aimX,e.aimY,e.aimZ,source))return;
      const horizontal=Math.hypot(e.aimX-source[0],e.aimZ-source[2]),pitch=Math.atan2(e.aimY-source[1],horizontal||.01),yaw=Math.atan2(e.aimX-source[0],source[2]-e.aimZ)+angle;
      const direction=muzzle.blocked?muzzle.obstruction:[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
      if(!articulatedGun(e)){
        // Legacy and compact guns keep their old reach, shortened against walls.
        const muzzle=Math.min(e.type===3?1.2:.52,Math.max(0,ray(source,direction,1.2)-.025));
        source=source.map((v,k)=>v+direction[k]*muzzle);
      }
      speed*=enemySpeed();s.bullets.push({x:source[0],y:source[1],z:source[2],dx:direction[0]*speed,dy:direction[1]*speed,dz:direction[2]*speed,life:5,damage,kind:e.type,owner:e.id});
      if(s.bullets.length>160)s.bullets.shift();
      emit('enemyShot',{x:e.x,z:e.z,kind:e.type});
    }
    function burst(e){
      projectile(e,(e.burstLeft-2)*.055,7.7,6);e.burstLeft--;e.burstWait=.18;
      if(!e.burstLeft)e.attackState='recover';
    }
    function attack(e){
      e.attackState='recover';e.cooldown=([2.05,2.9,2.65,e.phase?2.15:2.85][e.type]-.08*(world.stage||0))*enemyCadence();
      if(hasOrdnance(e)){enemyOrdnance(e);return;}
      if(e.type===0)projectile(e,0,7.2,8);
      else if(e.type===1){
        const dx=e.aimX-e.x,dz=e.aimZ-e.z,d=Math.hypot(dx,dz);
        if(!e.airborne&&d<11.5&&d>1&&Math.abs(e.aimY-1.45-e.baseY)<.65&&segmentFree(e.x,e.z,e.aimX,e.aimZ,.38)){e.attackState='rush';e.rushTime=.68;e.rushX=dx/d;e.rushZ=dz/d;e.rushHit=false;}
        else projectile(e,0,5.5,14);
      }else if(e.type===2){e.attackState='burst';e.burstLeft=3;burst(e);}
      else {
        const half=e.phase?3:2;
        for(let i=-half;i<=half;i++)projectile(e,i*.16,e.phase?6.3:5.5,e.phase?11:12);
      }
    }
    // Perception records observations, never an omniscient navigation target. A sound
    // or a nearby observer can supply a position; neither grants vision through walls.
    // A fixed spatial index serves local sound, squad alerts and body separation.
    // Membership contains every living actor; sleeping actors are never despawned.
    const neighbors=new Map();
    function rebuildNeighbors(){
      neighbors.clear();
      for(const e of s.enemies)if(e.hp>0){const key=Math.floor(e.x/8)+','+Math.floor(e.z/8);let list=neighbors.get(key);if(!list)neighbors.set(key,list=[]);list.push(e);}
    }
    function nearby(x,z,r){
      if(!advanced)return s.enemies;
      const result=[];
      for(let iz=Math.floor((z-r)/8);iz<=Math.floor((z+r)/8);iz++)for(let ix=Math.floor((x-r)/8);ix<=Math.floor((x+r)/8);ix++){
        const list=neighbors.get(ix+','+iz);if(list)for(const e of list)result.push(e);
      }
      return result;
    }
    function remember(e,x,z,awareness,life=8,y=groundAt(x,z)+1.45){
      if(e.hp<=0||e.seen&&awareness!=='engage')return;
      const fresh=!e.hasMemory;
      e.hasMemory=true;e.active=true;e.sleeping=false;e.lastSeenX=x;e.lastSeenY=y;e.lastSeenZ=z;e.memory=life;
      e.awareness=awareness;e.alert=awareness==='engage'?1:.7;
      if(awareness!=='engage'){e.observedVX=e.observedVY=e.observedVZ=0;e.observedAt=-1;}
      if(fresh){e.thinkWait=0;e.planWait=0;e.path=[];e.pathAt=0;e.searchIndex=0;
        if(e.alertWait<=0){emit('alerted',{id:e.id,kind:e.type,x:e.x,z:e.z});e.alertWait=7;}}
    }
    function hear(x,z,radius,y=groundAt(x,z)){
      for(const e of nearby(x,z,radius))if(e.hp>0&&!e.seen){
        const distance=Math.hypot(e.x-x,e.baseY-y,e.z-z);
        if(distance<radius&&(distance<radius*.58||sight(x,z,e.x,e.z,y+1.2,e.y)))remember(e,x,z,'investigate',7,y+1.45);
      }
    }
    function reactToShot(){
      if(!advanced)return;
      for(const e of nearby(p.x,p.z,28)){
        if(e.hp<=0||e.type===3||e.airborne||!e.seen||e.dodgeWait>0||e.stun>0||!sight(e.x,e.z,p.x,p.z,eyeHeight(e),p.y+1.45))continue;
        const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);if(d<2||d>28||(Math.sin(p.yaw)*dx-Math.cos(p.yaw)*dz)/d<.7)continue;
        // A dodge follows a visible shot; it cannot retroactively evade that hit.
        const side=(e.id+e.squad)%2?-1:1;
        e.dodgeX=-dz/d*side;e.dodgeZ=dx/d*side;e.dodgeDelay=.08+(e.id%4)*.035;e.dodgeTime=.32;e.dodgeWait=1.6+(e.id%3)*.3;
      }
    }
    function perceive(e){
      const dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz),facing=(Math.sin(e.yaw)*dx-Math.cos(e.yaw)*dz)/Math.max(d,.01);
      const visible=d<(giant(e)?(e.arena?.r||28)+10:advanced?(e.hasMemory?31:25):(e.hasMemory?24:e.type===3?23:18))&&(giant(e)||e.hasMemory||d<3||facing>-.15)&&sight(e.x,e.z,p.x,p.z,eyeHeight(e),p.y+1.45);
      if(visible){
        const interval=s.time-e.observedAt;
        if(e.seen&&e.observedAt>=0&&interval>.01&&interval<.4){e.observedVX=clamp((p.x-e.lastSeenX)/interval,-6,6);e.observedVZ=clamp((p.z-e.lastSeenZ)/interval,-6,6);e.observedVY=clamp((p.y+1.45-e.lastSeenY)/interval,-18,18);}
        else e.observedVX=e.observedVY=e.observedVZ=0;
        e.observedAt=s.time;
      }
      e.seen=visible;
      if(visible){
        remember(e,p.x,p.z,'engage',8,p.y+1.45);
        if(e.shareWait<=0){
          e.shareWait=1.1;
          for(const ally of nearby(e.x,e.z,advanced?16:12))if(ally!==e&&ally.hp>0&&!ally.seen&&Math.hypot(ally.x-e.x,ally.baseY-e.baseY,ally.z-e.z)<(advanced&&ally.squad===e.squad?16:12))
            remember(ally,e.lastSeenX,e.lastSeenZ,'investigate',7,e.lastSeenY);
        }
      }else if(e.awareness==='engage')e.awareness='search';
    }
    function clearLane(e,x,y,z,source=barrel(e,x,y,z).point){
      if(!advanced)return true;
      const dx=x-source[0],dz=z-source[2],len2=dx*dx+dz*dz;
      if(len2<.01)return true;
      for(const ally of nearby((source[0]+x)/2,(source[2]+z)/2,Math.sqrt(len2)/2+1.5))if(ally!==e&&ally.hp>0){
        const t=((ally.x-source[0])*dx+(ally.z-source[2])*dz)/len2;
        if(t<=0||t>=1)continue;
        const lineY=source[1]+(y-source[1])*t,top=advanced&&(ally.type===1||ally.type===3)?ally.baseY+(ally.type===1?2.18:3.25)*scale(ally):ally.baseY+HEIGHT[ally.type]+.65;
        if(lineY>ally.baseY+.12&&lineY<top&&Math.hypot(source[0]+dx*t-ally.x,source[2]+dz*t-ally.z)<radius(ally)+.19)return false;
      }
      return true;
    }
    function radius(e){return giant(e)?1.5*scale(e):e.type===3?1.05:.38;}
    function segmentFree(ax,az,bx,bz,r=.4){
      if(blocked(ax,az,r)||blocked(bx,bz,r))return false;
      const dx=bx-ax,dz=bz-az,ay=groundAt(ax,az),by=groundAt(bx,bz),minX=Math.min(ax,bx)-r-1e-7,maxX=Math.max(ax,bx)+r+1e-7,minZ=Math.min(az,bz)-r-1e-7,maxZ=Math.max(az,bz)+r+1e-7;
      // Sweep the body, not an eye ray: low crates and narrow wall ends still block feet.
      const short=Math.max(Math.abs(dx),Math.abs(dz))/2+r<=bucketRadius;
      const local=short?collisionBuckets[(Math.floor((az+bz)/2/bucketSize)-bucketZ)*bucketWidth+Math.floor((ax+bx)/2/bucketSize)-bucketX]||solids:solids;
      for(const list of [local,doorBoxes])for(const q of list){
        if(q.maxY<=Math.min(ay,by)+.06||q.minY>=Math.max(ay,by)+1.8)continue;
        // Most A* edge checks are shorter than a metre: discard remote boxes
        // before building intervals, without approximating the remaining sweep.
        if(q.maxX<minX||q.minX>maxX||q.maxZ<minZ||q.minZ>maxZ)continue;
        let lo=0,hi=1;
        for(const [origin,delta,min,max] of [[ax,dx,q.minX-r,q.maxX+r],[az,dz,q.minZ-r,q.maxZ+r]]){
          if(Math.abs(delta)<1e-8){if(origin<min||origin>max){hi=-1;break;}}
          else {let a=(min-origin)/delta,c=(max-origin)/delta;if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)break;}
        }
        if(hi>=lo&&hi>=0&&lo<=1)return false;
      }
      if(floors.length){
        const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));let previous=ay;
        for(let j=1;j<=count;j++){
          const x=ax+dx*j/count,z=az+dz*j/count,y=ground(x,z);
          if(!Number.isFinite(y)||Math.abs(y-previous)>.42||blocked(x,z,r,y))return false;
          previous=y;
        }
      }
      return true;
    }
    const routeCost=new Float64Array(nav.length),routePrev=new Int32Array(nav.length),routeStamp=new Uint32Array(nav.length),routeClosed=new Uint32Array(nav.length);
    const edgeKnown=new Uint8Array(nav.length),edgeOpen=new Uint8Array(nav.length),navQueued=new Uint8Array(nav.length),navQueue=new Int32Array(nav.length);let routeSerial=0,navHead=0,navTail=0,navPending=0;
    function pumpNav(limit=768){
      let work=0;while(navPending&&work<limit){const i=navQueue[navHead];navHead=(navHead+1)%nav.length;navPending--;navQueued[i]=0;const [x,z]=coord(i);nav[i]=blocked(x,z,.4,ground(x,z),doorBoxes,solids,[])?0:1;work++;}
      s.aiStats.navUpdates=work;s.aiStats.navPending=navPending;
    }
    function refreshNav(reset=true){
      if(advanced&&reset){
        // Colliders/rays change immediately. Updating the advisory walking grid is
        // amortised; another blast appends dirty cells instead of restarting work.
        for(let i=0;i<nav.length;i++)if(!navQueued[i]){navQueued[i]=1;navQueue[navTail]=i;navTail=(navTail+1)%nav.length;navPending++;}
      }else{navHead=navTail=navPending=0;navQueued.fill(0);for(let i=0;i<nav.length;i++){const [x,z]=coord(i);nav[i]=blocked(x,z,.4,ground(x,z),doorBoxes,solids,[])?0:1;}}
      edgeKnown.fill(0);edgeOpen.fill(0);if(reset)for(const e of s.enemies){e.path=[];e.pathAt=0;e.planWait=0;e.thinkWait=advanced?(e.id%8)*.06:0;}
      if(!advanced)rebuildNav();
    }
    function nearestNode(x,z,r){
      const center=idx(x,z),cx=center%nx,cz=Math.floor(center/nx);let best=-1,distance=Infinity;
      for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){
        const ix=cx+dx,iz=cz+dz;if(ix<0||ix>=nx||iz<0||iz>=nz)continue;
        const j=iz*nx+ix;if(!nav[j])continue;
        const [px,pz]=coord(j),d=(px-x)**2+(pz-z)**2;
        if(d<distance&&segmentFree(x,z,px,pz,r)){best=j;distance=d;}
      }
      return best;
    }
    function route(e,x,z){
      const r=radius(e);
      if(blocked(x,z,r))return null;
      if(segmentFree(e.x,e.z,x,z,r))return [];
      if(routeBudget<=0){routeDeferred++;return null;}routeBudget--;routeSearches++;
      const start=nearestNode(e.x,e.z,r),end=nearestNode(x,z,r);if(start<0||end<0)return null;
      const stamp=++routeSerial,heap=[];
      const heuristic=i=>Math.abs(i%nx-end%nx)+Math.abs(Math.floor(i/nx)-Math.floor(end/nx));
      function push(i,cost){let at=heap.length;heap.push([i,cost]);while(at){const parent=(at-1)>>1;if(heap[parent][1]<=cost)break;heap[at]=heap[parent];at=parent;}heap[at]=[i,cost];}
      function pop(){const value=heap[0],last=heap.pop();if(heap.length){let at=0;while(at*2+1<heap.length){let child=at*2+1;if(child+1<heap.length&&heap[child+1][1]<heap[child][1])child++;if(heap[child][1]>=last[1])break;heap[at]=heap[child];at=child;}heap[at]=last;}return value[0];}
      routeStamp[start]=stamp;routeCost[start]=0;routePrev[start]=-1;push(start,heuristic(start));
      let explored=0,found=false;
      while(heap.length&&explored++<2400){
        const i=pop();if(routeClosed[i]===stamp)continue;routeClosed[i]=stamp;if(i===end){found=true;break;}
        const ix=i%nx,neighbors=[ix?i-1:-1,ix<nx-1?i+1:-1,i-nx,i+nx];
        for(let k=0;k<4;k++){
          const j=neighbors[k];if(j<0||j>=nav.length||!nav[j]||routeClosed[j]===stamp)continue;
          const mask=1<<k;
          if(!(edgeKnown[i]&mask)){edgeKnown[i]|=mask;if(segmentFree(...coord(i),...coord(j),.4))edgeOpen[i]|=mask;}
          if(!(edgeOpen[i]&mask)||r>.4&&!segmentFree(...coord(i),...coord(j),r))continue;
          const cost=routeCost[i]+1;if(routeStamp[j]===stamp&&routeCost[j]<=cost)continue;
          routeStamp[j]=stamp;routeCost[j]=cost;routePrev[j]=i;push(j,cost+heuristic(j));
        }
      }
      if(!found)return null;
      const raw=[];for(let i=end;i>=0;i=routePrev[i])raw.push(i);raw.reverse();
      // String-pull this bounded local route once, rather than trace many rays every frame.
      const result=[];let ax=e.x,az=e.z,at=0;
      while(at<raw.length){let far=at;for(let k=Math.min(raw.length-1,at+14);k>at;k--)if(segmentFree(ax,az,...coord(raw[k]),r)){far=k;break;}
        result.push(raw[far]);[ax,az]=coord(raw[far]);at=far+1;}
      return result.length<=512?result:null;
    }
    function setGoal(e,x,z,tactic,commit=0){
      const path=route(e,x,z);if(!path)return false;
      e.goalX=x;e.goalZ=z;e.path=path;e.pathAt=0;e.tactic=tactic;e.planWait=commit;e.stuck=0;return true;
    }
    function reached(e){return Math.hypot(e.goalX-e.x,e.goalZ-e.z)<.16;}
    function protects(e,x,z){
      const dx=x-e.lastSeenX,dz=z-e.lastSeenZ,dy=groundAt(x,z)+HEIGHT[e.type]+.3-e.lastSeenY,d=Math.hypot(dx,dy,dz);
      return d>.01&&ray([e.lastSeenX,e.lastSeenY,e.lastSeenZ],[dx/d,dy/d,dz/d],d)<d-.02;
    }
    function cover(e){
      const choices=[],r=radius(e)+.18;
      for(const q of solids){
        if(q.maxY<e.baseY+1.35||q.minY>e.baseY+1.4||q.maxX-q.minX>12||q.maxZ-q.minZ>12)continue;
        const x=(q.minX+q.maxX)/2,z=(q.minZ+q.maxZ)/2;
        if(Math.hypot(x-e.x,z-e.z)>10)continue;
        for(const [cx,cz] of [[q.minX-r,z],[q.maxX+r,z],[x,q.minZ-r],[x,q.maxZ+r]]){
          const d=Math.hypot(cx-e.x,cz-e.z);
          if(d<.35||d>10||blocked(cx,cz,.4)||Math.hypot(cx-e.lastSeenX,cz-e.lastSeenZ)<3||sight(e.lastSeenX,e.lastSeenZ,cx,cz,e.lastSeenY,groundAt(cx,cz)+HEIGHT[e.type])||!protects(e,cx,cz))continue;
          const occupied=nearby(cx,cz,12).some(q=>q!==e&&q.hp>0&&q.tactic==='cover'&&Math.hypot(cx-q.goalX,cz-q.goalZ)<1.3);
          choices.push({x:cx,z:cz,score:d+(occupied?8:0)});
        }
      }
      choices.sort((a,b)=>a.score-b.score);
      for(const q of choices.slice(0,7))if(setGoal(e,q.x,q.z,'cover')){e.holdTime=[1.1,1.25,1.4][e.id%3];return true;}
      return false;
    }
    function peek(e){
      const choices=[];
      for(const d of [1.2,2.4,3.6])for(let j=0;j<12;j++){
        const angle=j*Math.PI/6,x=e.x+Math.cos(angle)*d,z=e.z+Math.sin(angle)*d;
        if(blocked(x,z,.4)||Math.hypot(x-e.lastSeenX,z-e.lastSeenZ)<3||!sight(x,z,e.lastSeenX,e.lastSeenZ,groundAt(x,z)+HEIGHT[e.type],e.lastSeenY))continue;
        choices.push({x,z,d});
      }
      for(const q of choices)if(setGoal(e,q.x,q.z,'flank',2.3)){e.coverWait=4.5;return true;}
      e.coverWait=2;e.holdTime=0;return false;
    }
    function plan(e){
      if(e.airborne)return;
      const home=world.enemies[e.id];
      if(e.type===2&&!advanced){e.tactic='hold';e.path=[];e.pathAt=0;e.goalX=e.x;e.goalZ=e.z;return;}
      if(advanced&&e.type!==3&&e.hasMemory&&e.padCooldown<=0){
        const direct=Math.hypot(e.x-e.lastSeenX,e.z-e.lastSeenZ);
        for(const pad of s.jumpPads)if(pad.id!==e.padId&&Math.hypot(e.x-pad.x,e.z-pad.z)<12&&Math.abs(e.baseY-pad.y)<.6&&Math.hypot(pad.target.x-e.lastSeenX,pad.target.z-e.lastSeenZ)+5<direct){
          if(setGoal(e,pad.x,pad.z,'advance',2.4))return;
        }
      }
      if(e.stuck>1.1){
        const path=route(e,e.goalX,e.goalZ);e.planWait=0;e.path=path||[];e.pathAt=0;e.stuck=0;
        if(!path&&e.tactic==='cover'){e.tactic='hold';e.coverWait=1.5;e.holdTime=0;}
      }
      if(e.hasMemory&&e.tactic==='cover'){
        if(!reached(e)||e.holdTime>0)return;
        if(peek(e))return;
        e.tactic='advance';
      }
      if(e.planWait>0&&!reached(e))return;
      if(!e.hasMemory){
        if(!reached(e)&&e.tactic==='advance')return;
        const span=e.type===3?1.6:2.5;
        for(let j=0;j<4;j++){
          const angle=(++e.patrolIndex+e.id)*Math.PI/2,x=home.x+Math.cos(angle)*span,z=home.z+Math.sin(angle)*span;
          if(setGoal(e,x,z,'advance'))return;
        }
        e.tactic='hold';return;
      }
      if(e.type===0&&e.hp<=e.maxHp*.55&&e.coverWait<=0&&cover(e))return;
      if(!e.seen){
        if(e.type===3){
          const x=clamp(e.lastSeenX,home.x-4,home.x+4),z=clamp(e.lastSeenZ,home.z-4,home.z+4);
          if(setGoal(e,x,z,'advance'))return;
          e.tactic='hold';return;
        }
        const d=Math.hypot(e.lastSeenX-e.x,e.lastSeenZ-e.z);
        if(d>1.2){
          if(setGoal(e,e.lastSeenX,e.lastSeenZ,'advance'))return;
          const near=nearestNode(e.lastSeenX,e.lastSeenZ,.28);
          if(near>=0&&setGoal(e,...coord(near),'advance'))return;
        }else{
          e.awareness='search';
          for(let j=0;j<4;j++){
            const angle=(++e.searchIndex+e.id)*2.399963,distance=1.8+(e.searchIndex%2)*.9;
            if(setGoal(e,e.lastSeenX+Math.cos(angle)*distance,e.lastSeenZ+Math.sin(angle)*distance,'advance',1.2))return;
          }
        }
        e.tactic='hold';return;
      }
      const dx=e.lastSeenX-e.x,dz=e.lastSeenZ-e.z,d=Math.hypot(dx,dz)||.01;
      if(advanced&&e.type===0){
        const side=e.squad%2?-1:1,base=Math.atan2(-dz,-dx);
        // Complementary squad roles choose real positions around the last observation.
        // A suppressor holds range, an assault closes, a flanker takes a side lane.
        const range=e.role==='assault'?4.5+(e.id%3)*.7:e.role==='suppressor'?10+(e.id%3):7.5+(e.id%2);
        if(e.role==='suppressor'&&d>8&&d<15&&clearLane(e,e.lastSeenX,e.lastSeenY,e.lastSeenZ)){e.tactic='hold';e.goalX=e.x;e.goalZ=e.z;e.path=[];e.pathAt=0;return;}
        const spread=e.role==='flanker'?.95:e.role==='assault'?.25:.5;
        for(const offset of [side*spread,side*(spread+.4),-side*spread]){
          const angle=base+offset,x=e.lastSeenX+Math.cos(angle)*range,z=e.lastSeenZ+Math.sin(angle)*range;
          if(setGoal(e,x,z,e.role==='flanker'?'flank':'advance',e.role==='flanker'?2.2:1.1))return;
        }
      }else if(e.type===0){
        const base=Math.atan2(-dz,-dx),side=e.id%2?-1:1,range=clamp(d,5.7,8);
        for(const offset of [side*.9,side*1.35,-side*.9]){
          const angle=base+offset;
          if(setGoal(e,e.lastSeenX+Math.cos(angle)*range,e.lastSeenZ+Math.sin(angle)*range,'flank',2.6))return;
        }
      }else if(hasOrdnance(e)){
        const desired=e.weapon==='grenade'?12:16,base=Math.atan2(-dz,-dx),side=e.squad%2?-1:1;
        if(d>=9&&d<=20&&canShoot(e,e.lastSeenX,e.lastSeenY,e.lastSeenZ)){e.goalX=e.x;e.goalZ=e.z;e.path=[];e.pathAt=0;e.tactic='hold';return;}
        for(const offset of [side*.35,-side*.35,side*.8]){const angle=base+offset;if(setGoal(e,e.lastSeenX+Math.cos(angle)*desired,e.lastSeenZ+Math.sin(angle)*desired,'flank',1.8))return;}
      }else if(e.type===1){
        if(d<4.1){e.goalX=e.x;e.goalZ=e.z;e.path=[];e.pathAt=0;e.tactic='hold';return;}
        if(setGoal(e,e.x+dx/d*(d-3.8),e.z+dz/d*(d-3.8),'advance'))return;
      }else if(e.type===2&&advanced){
        // Mobile sentinels redeploy their tripod to keep a useful ranged lane.
        if(d>=10&&d<=16&&canShoot(e,e.lastSeenX,e.lastSeenY,e.lastSeenZ)){e.goalX=e.x;e.goalZ=e.z;e.path=[];e.pathAt=0;e.tactic='hold';return;}
        const base=Math.atan2(-dz,-dx),side=e.squad%2?-1:1;
        for(const offset of [side*.40,-side*.40,side*.85]){
          const angle=base+offset;
          if(setGoal(e,e.lastSeenX+Math.cos(angle)*13,e.lastSeenZ+Math.sin(angle)*13,'flank',1.7))return;
        }
      }else {
        // The Custodian guards the arena; it never wanders into a narrow service doorway.
        const side=e.id%2?-1:1,radial=d>14?1.6:d<5?-1:0;
        const x=clamp(e.x+dx/d*radial-dz/d*side*1.5,home.x-4,home.x+4),z=clamp(e.z+dz/d*radial+dx/d*side*1.5,home.z-4,home.z+4);
        if(setGoal(e,x,z,'advance',1.8))return;
      }
      e.tactic='hold';
    }
    function navigate(e,dt){
      if(e.airborne)return;
      if(e.type===2&&!advanced||e.tactic==='hold')return;
      const speed=!e.hasMemory?(e.type===0?.72:.55):advanced?[e.role==='assault'?2.4:e.role==='flanker'?2.25:1.8,1.7,1.8,e.phase?1.05:.8][e.type]:[1.65,1.05,0,e.phase?.85:.65][e.type];
      let budget=speed*dt,segments=0;
      const ox=e.x,oz=e.z;
      while(budget>1e-8&&segments++<8){
        const target=e.pathAt<e.path.length?coord(e.path[e.pathAt]):[e.goalX,e.goalZ],dx=target[0]-e.x,dz=target[1]-e.z,d=Math.hypot(dx,dz);
        if(d<.035){if(e.pathAt<e.path.length){e.pathAt++;continue;}break;}
        const travel=Math.min(d,budget);move(e,dx/d*travel,dz/d*travel,radius(e));budget-=travel;
        if(travel<d)break;
        if(e.pathAt<e.path.length)e.pathAt++;else break;
      }
      const actual=Math.hypot(e.x-ox,e.z-oz);
      if(actual<speed*dt*.15&&!reached(e))e.stuck+=dt;else e.stuck=Math.max(0,e.stuck-dt*2);
      if(!e.hasMemory&&actual>.0001)e.yaw=Math.atan2(e.x-ox,oz-e.z);
      if(e.tactic==='cover'&&reached(e))e.holdTime=Math.max(0,e.holdTime-dt);
    }
    function separate(dt){
      for(const a of s.enemies){
        if(a.hp<=0||a.sleeping||a.airborne)continue;
        for(const c of nearby(a.x,a.z,3)){
          if(c.id<=a.id||c.hp<=0||c.sleeping||c.airborne||Math.abs(c.baseY-a.baseY)>1.1)continue;
          const dx=c.x-a.x,dz=c.z-a.z,d=Math.hypot(dx,dz),gap=radius(a)+radius(c)+(advanced?.42:.18);
          if(d>=gap)continue;
          const angle=(a.id+c.id+1)*2.399963,ux=d>.001?dx/d:Math.cos(angle),uz=d>.001?dz/d:Math.sin(angle);
          const mobile=e=>(e.type!==2||advanced)&&e.rushTime<=0&&e.windup<=0&&e.stun<=0;
          const ma=mobile(a),mc=mobile(c),count=Number(ma)+Number(mc);if(!count)continue;
          const push=Math.min(gap-d,dt*2)/count;
          if(ma)move(a,-ux*push,-uz*push,radius(a));if(mc)move(c,ux*push,uz*push,radius(c));
        }
      }
    }

    function bossPhaseChange(e){
      const phase=e.hp<=e.maxHp*.34?2:e.hp<=e.maxHp*.67?1:0;if(phase<=e.phase)return;
      e.phase=phase;e.bossClock=1.8;e.weakTimer=1.2;e.weakPointOpen=true;e.attackLabel='Surcharge — renforts';
      s.bossAttacks=s.bossAttacks.filter(a=>a.bossId!==e.id);
      for(const ally of s.enemies)if(ally.bossId===e.id&&ally.bossWave<=phase&&!ally.bossReleased&&ally.hp>0){ally.bossReleased=true;ally.sleeping=false;ally.cooldown=Math.max(ally.cooldown,1.6);if(e.hasMemory)remember(ally,e.lastSeenX,e.lastSeenZ,'investigate',7,e.lastSeenY);}
      emit('bossPhase',{id:e.id,phase});emit('bossRoar',{id:e.id,x:e.x,y:e.y,z:e.z,phase});
    }
    function bossPoint(e,x,z){const a=e.arena,dx=x-a.x,dz=z-a.z,d=Math.hypot(dx,dz),r=a.r-1;if(d>r){x=a.x+dx/d*r;z=a.z+dz/d*r;}return {x,y:groundAt(x,z),z};}
    function bossAttack(e,kind,point,options={}){
      const tell=options.tell??(kind==='rocketZone'?1.75:kind==='ring'?1.55:1.45)-e.phase*.1,activeDuration=kind==='rocketZone'?2.8:kind==='ring'?2.3:kind==='sweep'?.55:.22;
      const angle=options.angle??Math.atan2(e.lastSeenX-e.x,e.z-e.lastSeenZ),a={id:++bossAttackSerial,bossId:e.id,kind,x:point.x,y:point.y,z:point.z,radius:kind==='ring'?e.arena.r-1:kind==='rocketZone'?3.2:kind==='slam'?4.3:0,warning:true,active:false,age:0,tell,activeDuration,duration:tell+activeDuration,currentRadius:0,innerRadius:0,angle,dx:Math.sin(angle),dz:-Math.cos(angle),length:kind==='sweep'?e.arena.r+2:0,width:kind==='sweep'?1.45:0,phase:e.phase,damage:kind==='slam'?30:kind==='ring'?22:kind==='sweep'?26:28,hitPlayer:false,hitEnemies:[],fired:false};
      s.bossAttacks.push(a);return a;
    }
    function beginBossAttack(e){
      const pattern=e.bossKind==='colossus'?['slam','ring','slam','ring']:e.bossKind==='siegebreaker'?['rocketZone','sweep','rocketZone','sweep']:['ring','rocketZone','sweep','rocketZone'];
      const kind=pattern[e.bossStep++%pattern.length],point=bossPoint(e,e.lastSeenX,e.lastSeenZ),angle=Math.atan2(e.lastSeenX-e.x,e.z-e.lastSeenZ);
      e.aimX=point.x;e.aimY=e.lastSeenY;e.aimZ=point.z;e.yaw=angle;e.weakPointOpen=false;e.weakTimer=0;
      e.attackLabel=kind==='slam'?'Écrasement':kind==='ring'?'Onde de choc':kind==='rocketZone'?'Barrage de roquettes':'Balayage';
      if(kind==='rocketZone'){
        const count=2+e.phase,side=[Math.cos(angle),Math.sin(angle)];
        for(let i=0;i<count;i++){const offset=(i-(count-1)/2)*4.2,q=bossPoint(e,point.x+side[0]*offset,point.z+side[1]*offset);bossAttack(e,kind,q,{tell:1.7+i*.28});}
      }else if(kind==='sweep'){
        const count=e.phase===2?3:2;
        for(let i=0;i<count;i++)bossAttack(e,kind,{x:e.x,y:e.baseY,z:e.z},{tell:1.6+i*.42,angle:angle+(i-(count-1)/2)*.38});
      }else{
        bossAttack(e,kind,kind==='ring'?{x:e.x,y:e.baseY,z:e.z}:point);
        if(e.phase===2&&kind==='ring')bossAttack(e,kind,{x:e.x,y:e.baseY,z:e.z},{tell:2.55});
        if(e.phase===2&&kind==='slam'){const side=[Math.cos(angle),Math.sin(angle)],q=bossPoint(e,point.x+side[0]*5.2,point.z+side[1]*5.2);bossAttack(e,kind,q,{tell:1.85});}
      }
      const duration=Math.max(...s.bossAttacks.filter(a=>a.bossId===e.id).map(a=>a.duration));e.bossClock=duration+2.6;e.attackState='aim';e.windup=e.windupMax=Math.min(3.5,Math.max(...s.bossAttacks.filter(a=>a.bossId===e.id).map(a=>a.tell)));
      emit('bossTell',{id:e.id,kind,label:e.attackLabel,x:e.x,y:e.y,z:e.z,phase:e.phase});
    }
    function tickBoss(e,dt){
      const arena=e.arena,inArena=arena&&Math.hypot(p.x-arena.x,p.z-arena.z)<arena.r&&Math.abs(p.y-e.baseY)<5;
      e.hurt=Math.max(0,e.hurt-dt);e.stun=0;e.cooldown=Math.max(0,e.cooldown-dt);e.senseWait=Math.max(-.05,e.senseWait-dt);
      if(!e.bossAwake){e.sleeping=true;e.seen=false;e.active=false;if(!inArena)return false;e.bossAwake=true;e.sleeping=false;e.bossClock=1.8;emit('bossRoar',{id:e.id,x:e.x,y:e.y,z:e.z,phase:e.phase});}
      e.sleeping=false;e.bossClock=Math.max(0,e.bossClock-dt);e.weakTimer=Math.max(0,e.weakTimer-dt);e.weakPointOpen=e.weakTimer>0;
      if(e.hasMemory)e.memory=Math.max(0,e.memory-dt);
      if(e.senseWait<=0){e.senseWait=.15;perceive(e);if(!inArena)e.seen=false;}
      if(!e.seen&&e.hasMemory&&e.memory<=0){e.hasMemory=false;e.active=false;e.awareness='patrol';}
      bossPhaseChange(e);
      const attacks=s.bossAttacks.filter(a=>a.bossId===e.id);
      if(attacks.length){const warning=attacks.filter(a=>a.warning);e.windup=warning.length?Math.max(...warning.map(a=>Math.max(0,a.tell-a.age))):0;e.windupMax=Math.max(e.windup,e.windupMax);e.attackState=warning.length?'aim':'burst';return true;}
      e.windup=0;e.attackState='recover';if(e.weakPointOpen)e.attackLabel='Cœur exposé';
      if(e.hasMemory){e.yaw=Math.atan2(e.lastSeenX-e.x,e.z-e.lastSeenZ);e.aimX=e.lastSeenX;e.aimY=e.lastSeenY;e.aimZ=e.lastSeenZ;}
      // The entire articulated silhouette remains inside the cleared arena. A
      // giant never uses infantry nav or squeezes down the entrance bridge.
      if(e.seen&&e.bossClock>0&&!e.weakPointOpen){const dx=e.lastSeenX-e.x,dz=e.lastSeenZ-e.z,d=Math.hypot(dx,dz);if(d>radius(e)+8)move(e,dx/d*dt*.8,dz/d*dt*.8,radius(e));}
      e.goalX=e.x;e.goalZ=e.z;e.path=[];e.pathAt=0;
      if(e.bossClock<=0&&e.hasMemory&&inArena)beginBossAttack(e);
      return true;
    }
    function bossZoneContains(a,e,padding=0){
      const y=feet(e);if(Math.abs(y-a.y)>1.05)return false;
      const dx=e.x-a.x,dz=e.z-a.z,d=Math.hypot(dx,dz);
      if(a.kind==='ring')return d>=Math.max(0,a.innerRadius-padding)&&d<=a.currentRadius+padding;
      if(a.kind==='sweep'){const along=clamp(dx*a.dx+dz*a.dz,0,a.length);return Math.hypot(dx-a.dx*along,dz-a.dz*along)<=a.width+padding;}
      return d<=a.radius+padding;
    }
    function updateBossAttacks(dt){
      const finished=new Set();
      for(const a of s.bossAttacks){
        const e=s.enemies[a.bossId];if(!e||e.hp<=0){a.age=a.duration;finished.add(a.bossId);continue;}
        a.age+=dt;a.warning=a.age<a.tell;a.active=!a.warning&&a.age<a.duration;
        if(a.kind==='ring'){a.currentRadius=a.warning?0:clamp((a.age-a.tell)/a.activeDuration,0,1)*a.radius;a.innerRadius=Math.max(0,a.currentRadius-1.6);}
        if(a.active&&!a.fired){
          a.fired=true;emit('bossImpact',{id:e.id,kind:a.kind,x:a.x,y:a.y,z:a.z,phase:e.phase});
          if(a.kind==='rocketZone'){
            const target=[a.x,a.y+.14,a.z];e.aimX=target[0];e.aimY=target[1];e.aimZ=target[2];e.yaw=Math.atan2(target[0]-e.x,e.z-target[2]);const mouth=barrel(e,...target,a.id%2?-1:1);if(!mouth.blocked){const delta=target.map((v,k)=>v-mouth.point[k]),length=Math.hypot(...delta)||1;spawnProjectile('rocket',mouth.point,delta.map(v=>v/length*18),e.id,{blastRadius:a.radius,terrainPower:34,damage:a.damage});}
          }else if(a.kind==='slam')explode([a.x,a.y+.18,a.z],a.radius,a.damage,24,e.id);
        }
        if(a.active&&(a.kind==='ring'||a.kind==='sweep')){
          const origin=[a.x,a.y+1,a.z];
          if(!a.hitPlayer&&bossZoneContains(a,p,.28)&&sight(a.x,a.z,p.x,p.z,origin[1],p.y+1)){a.hitPlayer=true;hurt(a.damage);}
          for(const enemy of nearby(a.x,a.z,a.kind==='ring'?a.currentRadius+2:a.length+2))if(enemy.hp>0&&enemy.id!==a.bossId&&!a.hitEnemies.includes(enemy.id)&&bossZoneContains(a,enemy,.38)&&sight(a.x,a.z,enemy.x,enemy.z,origin[1],enemy.y)){a.hitEnemies.push(enemy.id);damageEnvironment(enemy,a.damage,a.x,a.y+1,a.z);}
        }
        if(a.age>=a.duration)finished.add(a.bossId);
      }
      s.bossAttacks=s.bossAttacks.filter(a=>a.age<a.duration);
      for(const id of finished)if(!s.bossAttacks.some(a=>a.bossId===id)){const e=s.enemies[id];if(e?.hp>0){e.weakTimer=e.bossKind==='colossus'?3:e.bossKind==='siegebreaker'?2.7:2.4;e.weakPointOpen=true;e.attackLabel='Cœur exposé';e.attackState='recover';e.windup=0;e.bossClock=Math.max(e.bossClock,e.weakTimer+.1);}}
    }
    function avoidBossZone(e,dt){
      for(const a of s.bossAttacks){
        if(a.bossId===e.id||Math.abs(e.baseY-a.y)>1||Math.hypot(e.x-a.x,e.z-a.z)>Math.max(a.radius,a.length)+4)continue;
        let danger=a.kind==='ring'?(a.warning?Math.hypot(e.x-a.x,e.z-a.z)<a.radius+1:Math.hypot(e.x-a.x,e.z-a.z)>a.innerRadius-1&&Math.hypot(e.x-a.x,e.z-a.z)<a.currentRadius+4):bossZoneContains(a,e,1.2);
        if(!danger)continue;
        let dx=e.x-a.x,dz=e.z-a.z;if(a.kind==='sweep'){const side=Math.sign(dx*a.dz-dz*a.dx)||1;dx=a.dz*side;dz=-a.dx*side;}const d=Math.hypot(dx,dz)||1;
        e.windup=0;e.burstLeft=0;e.attackState='recover';move(e,dx/d*3.6*dt,dz/d*3.6*dt,radius(e));e.thinkWait=0;e.planWait=0;return true;
      }
      return false;
    }
    function updateEnemies(dt){
      let threat=0,awake=0,dormant=0;const starts=s.enemies.map(e=>[e.x,e.z]);
      routeBudget=advanced?2:Infinity;routeSearches=routeDeferred=0;rebuildNeighbors();
      for(const e of s.enemies){
        e.moveSpeed=0;let sensed=false;if(e.hp<=0)continue;airTimers(e,dt);if(e.airborne)airMove(e,dt);if(e.hp<=0)continue;
        if(e.bossWave&&!e.bossReleased){e.sleeping=true;e.seen=false;dormant++;continue;}
        if(giant(e)){if(tickBoss(e,dt)){awake++;if(e.bossAwake)threat++;}else dormant++;continue;}
        const d=Math.hypot(p.x-e.x,p.z-e.z);
        // Far squads retain their exact positions and state. They awaken well before
        // firing range; nearby actors have no arbitrary simultaneous-attack cap.
        e.sleeping=advanced&&!e.airborne&&d>68&&(!e.hasMemory||d>88)&&e.windup<=0&&e.rushTime<=0&&e.burstLeft<=0;
        if(e.sleeping)dormant++;else awake++;
        e.hurt=Math.max(0,e.hurt-dt);e.cooldown=Math.max(0,e.cooldown-dt);e.burstWait=Math.max(0,e.burstWait-dt);e.dodgeWait=Math.max(0,e.dodgeWait-dt);e.dodgeDelay=Math.max(0,e.dodgeDelay-dt);bossPhase(e);
        for(const key of ['senseWait','thinkWait','shareWait','alertWait','coverWait','planWait'])e[key]=Math.max(-.05,e[key]-dt);
        if(e.hasMemory){e.memory=Math.max(0,e.memory-dt);e.alert=e.seen?1:clamp(e.memory/8,.1,.85);}
        if(!e.sleeping&&e.senseWait<=0){e.senseWait+=.15;perceive(e);sensed=true;}
        if(e.hasMemory&&e.memory<=0){e.hasMemory=false;e.active=false;e.awareness='patrol';e.alert=0;e.seen=false;e.planWait=0;e.tactic='hold';e.path=[];e.pathAt=0;e.goalX=e.x;e.goalZ=e.z;e.thinkWait=0;}
        if(e.sleeping){e.seen=false;e.dodgeTime=e.dodgeDelay=0;e.stun=Math.max(0,e.stun-dt);continue;}
        if(e.hasMemory&&d<26)threat++;
        if(e.stun>0){e.stun=Math.max(0,e.stun-dt);e.attackState=e.stun>0?'stunned':'recover';continue;}
        if(avoidBossZone(e,dt))continue;
        if(e.rushTime>0){
          e.attackState='rush';e.rushTime=Math.max(0,e.rushTime-dt);move(e,e.rushX*7.3*dt,e.rushZ*7.3*dt,.38);
          if(!e.rushHit&&Math.abs(e.baseY-p.y)<.9&&Math.hypot(e.x-p.x,e.z-p.z)<.9&&sight(e.x,e.z,p.x,p.z,e.y,p.y+1.2)){e.rushHit=true;hurt(16);}
          if(e.rushTime<=0)e.attackState='recover';continue;
        }
        if(e.dodgeTime>0&&!e.airborne&&e.dodgeDelay<=0){
          const duration=Math.min(dt,e.dodgeTime);e.dodgeTime=Math.max(0,e.dodgeTime-dt);move(e,e.dodgeX*3.6*duration,e.dodgeZ*3.6*duration,radius(e));
          if(!e.dodgeTime){e.thinkWait=0;e.planWait=0;}
        }
        if(e.burstLeft>0){if(e.burstWait<=0)burst(e);continue;}
        if(e.windup>0){e.windup=Math.max(0,e.windup-dt);if(!e.windup)attack(e);continue;}
        if(e.thinkWait<=0){e.thinkWait+=.65+(e.id%3)*.05;plan(e);}
        if(e.hasMemory)e.yaw=Math.atan2(e.lastSeenX-e.x,e.z-e.lastSeenZ);
        else if(e.type===2){const home=world.enemies[e.id],yaw=Number.isFinite(home.yaw)?home.yaw:Math.atan2(world.spawn.x-home.x,home.z-world.spawn.z);e.yaw=yaw+Math.sin(s.time*.45+e.id)*.85;}
        if(!introSafe()&&e.seen&&e.tactic!=='cover'&&d<(advanced?29:22)&&e.cooldown<=0&&(!hasOrdnance(e)||sensed)&&canShoot(e,e.lastSeenX,e.lastSeenY,e.lastSeenZ)){
          const lead=advanced?Math.min(.65,d/14):0;
          e.aimX=clamp(e.lastSeenX+e.observedVX*lead,b.minX+.1,b.maxX-.1);e.aimY=e.lastSeenY+(advanced?e.observedVY*lead*.45:0);e.aimZ=clamp(e.lastSeenZ+e.observedVZ*lead,b.minZ+.1,b.maxZ-.1);
          e.yaw=Math.atan2(e.aimX-e.x,e.z-e.aimZ);e.windupMax=hasOrdnance(e)?e.weapon==='grenade'?1.15:1.05:[advanced?.52:.65,advanced?.8:.9,advanced?.65:.75,e.phase?.9:1.15][e.type];
          e.windup=e.windupMax;e.attackState='aim';continue;
        }
        e.attackState=e.cooldown>0?'recover':'idle';navigate(e,dt);
      }
      for(const e of s.enemies)if(e.hp>0)checkPad(e);
      rebuildNeighbors();separate(dt);
      if(dt>0)for(let i=0;i<s.enemies.length;i++)s.enemies[i].moveSpeed=Math.hypot(s.enemies[i].x-starts[i][0],s.enemies[i].z-starts[i][1])/dt;
      Object.assign(s.aiStats,{awake,dormant,alive:awake+dormant,pathSearches:routeSearches,pathDeferred:routeDeferred});
      s.threat=Math.min(1,threat/4);
    }

    function trapShape(t,progress){
      if(t.destroyed)return null;
      let x=t.x,y=t.y,z=t.z,h=t.h||.3;
      if(t.kind==='blade'){const offset=-(t.travel||1.65)*Math.cos(progress*Math.PI*2);if(t.axis==='z')z+=offset;else x+=offset;}
      else if(t.kind==='press')y+=(t.travel||2.6)*(1-progress);
      else if(t.kind==='spikes'){h*=progress;if(h<.02)return null;}
      else return null;
      return {minX:x-t.w/2,maxX:x+t.w/2,minY:y,maxY:y+h,minZ:z-t.d/2,maxZ:z+t.d/2};
    }
    function bodyTouches(e,q,margin=0){const y=feet(e),r=(e===p?.28:radius(e))+margin;return q&&q.maxY>y+.06&&q.minY<y+1.8&&discBox(e.x,e.z,r,q);}
    function damageEnvironment(e,amount,x,y,z){if(e===p)hurt(amount);else damageEnemy(e,amount*.18,{x,y,z,credit:false});}
    function trapPose(t,desired,actors){
      const target=trapShape(t,desired),previous=t.box||trapShape(t,t.progress),contacts=[];
      if(!target)return {progress:desired,box:null,contacts};
      if(t.kind==='press'&&previous&&target.minY<previous.minY){
        for(const e of actors)if(e.hp>0&&discBox(e.x,e.z,e===p?.28:radius(e),target)&&feet(e)<previous.minY-.01&&feet(e)+1.8>target.minY){target.minY=Math.max(target.minY,feet(e)+1.8);contacts.push(e);}
        target.maxY=target.minY+(t.h||.65);desired=clamp(1-(target.minY-t.y)/(t.travel||2.6),0,1);
      }else if(t.kind==='blade'&&previous){
        const axis=t.axis==='z'?'z':'x',a=axis==='x'?'X':'Z',other=axis==='x'?'z':'x',o=axis==='x'?'Z':'X',half=(axis==='x'?t.w:t.d)/2;
        const old=(previous['min'+a]+previous['max'+a])/2;let next=(target['min'+a]+target['max'+a])/2,sign=Math.sign(next-old);
        for(const e of actors)if(e.hp>0&&feet(e)+1.8>target.minY&&feet(e)<target.maxY){
          const r=e===p?.28:radius(e);if(e[other]+r<target['min'+o]||e[other]-r>target['max'+o])continue;
          if(sign>0&&e[axis]-r>=old+half-1e-6&&e[axis]-r<next+half){next=Math.min(next,e[axis]-r-half);contacts.push(e);}
          if(sign<0&&e[axis]+r<=old-half+1e-6&&e[axis]+r>next-half){next=Math.max(next,e[axis]+r+half);contacts.push(e);}
        }
        target['min'+a]=next-half;target['max'+a]=next+half;
      }
      return {progress:desired,box:target,contacts};
    }
    function updateEnvironment(dt,damage=true){
      trapBoxes.length=0;
      for(const t of s.traps){
        t.damageWait=Math.max(0,(t.damageWait||0)-dt);
        if(t.destroyed){t.box=null;t.warning=t.hot=false;continue;}
        const actors=[p,...nearby(t.x,t.z,Math.max(t.w,t.d)+(t.travel||2)+3).filter(e=>e.hp>0)];
        let progress=0,warning=false,hot=false;
        if(t.kind==='spikes'||t.kind==='floor'){
          if(!t.triggered&&actors.some(e=>Math.abs(e.x-t.x)<t.w/2+.2&&Math.abs(e.z-t.z)<t.d/2+.2&&Math.abs(feet(e)-t.y)<.35)){t.triggered=true;t.triggerAge=0;if(damage)emit('trap',{id:t.id,kind:t.kind,warning:true,x:t.x,y:t.y,z:t.z});}
          if(t.triggered){
            t.triggerAge+=dt;const delay=Math.max(.65,t.warningTime||t.warningDuration||t.warningTime||1.2),active=t.active||2;
            warning=t.triggerAge<delay;hot=t.triggerAge>=delay&&t.triggerAge<delay+active;
            progress=hot?Math.sin(Math.PI*(t.triggerAge-delay)/active):0;
            if(t.triggerAge>=delay+active+1.2){t.triggered=false;t.triggerAge=0;}
          }
        }else{
          const period=Math.max(3,t.period||7),phase=((s.time+(t.phase||0))%period+period)%period,active=Math.min(period-1,t.active||2),warningTime=Math.max(.65,t.warningTime||1.2);
          warning=phase>period-warningTime;hot=phase<active;
          progress=hot?(t.kind==='blade'?phase/active:Math.sin(Math.PI*phase/active)):0;
          const cycle=Math.floor((s.time+(t.phase||0))/period);
          if(warning&&t.cycle!==cycle){t.cycle=cycle;if(damage)emit('trap',{id:t.id,kind:t.kind,warning:true,x:t.x,y:t.y,z:t.z});}
        }
        const pose=trapPose(t,progress,actors);t.progress=pose.progress;t.box=pose.box;t.angle=progress*Math.PI*2;t.warning=warning;t.hot=hot;
        if(t.box&&(t.kind==='blade'||t.kind==='press'))trapBoxes.push(t.box);
        if(damage&&hot&&t.damageWait<=0){
          const contact=new Set(pose.contacts);if(t.kind==='spikes')for(const e of actors)if(bodyTouches(e,t.box,.02))contact.add(e);
          if(contact.size){t.damageWait=.55;for(const e of contact)damageEnvironment(e,t.damage||20,t.x,t.y+.5,t.z);}
        }
      }
      for(const q of s.pipes){
        q.damageWait=Math.max(0,q.damageWait-dt);
        const period=q.broken?0:Number(q.period)||0,delay=Math.max(.65,Number(q.delay)||1),duration=Math.max(.5,Number(q.duration)||7);
        if(period>delay+duration&&!q.active){const phase=((s.time+(q.phase||0))%period+period)%period,cycle=Math.floor((s.time+(q.phase||0))/period);if(phase>=period-delay&&q.cycle!==cycle){q.cycle=cycle;if(damage)leakPipe(q);}}
        if(!q.active){q.warning=q.hot=false;continue;}
        const age=q.age;q.age=Math.min(delay+duration+1,q.age+dt);q.remaining=Math.max(0,delay+duration-q.age);q.warning=q.age<delay;q.hot=q.age>=delay&&q.age<delay+duration;
        if(damage&&age<delay&&q.age>=delay){
          const length=Math.hypot(q.dx,q.dy,q.dz)||1,point=q.nozzle.map((v,k)=>v+[q.dx,q.dy,q.dz][k]/length*.08);explode(point,2.25,12,10,'environment',false,-1,q.destructibleId);
        }
        if(damage&&q.hot&&q.damageWait<=0){
          const n=Math.hypot(q.dx,q.dy,q.dz)||1,dir=[q.dx/n,q.dy/n,q.dz/n],origin=q.nozzle;let connected=false;
          for(const e of [p,...nearby(q.x,q.z,q.length+2).filter(e=>e.hp>0)]){
            const center=[e.x,feet(e)+1,e.z],v=center.map((c,k)=>c-origin[k]),along=clamp(v.reduce((sum,c,k)=>sum+c*dir[k],0),0,q.length),near=origin.map((c,k)=>c+dir[k]*along);
            if(Math.hypot(...center.map((c,k)=>c-near[k]))>q.radius+.4)continue;
            const distance=Math.hypot(...v);if(distance>.01&&ray(origin,v.map(c=>c/distance),distance)<distance-.1)continue;
            damageEnvironment(e,q.damage||8,q.x,q.y,q.z);connected=true;
          }
          if(connected)q.damageWait=.55;
        }
        if(period>0&&q.remaining<=0)q.active=false;
      }
    }
    function unsupportedBodies(){
      for(const e of [p,...s.enemies])if(e.hp>0&&!e.airborne){const y=feet(e),floor=support(e.x,e.z,y,e===p?.28:radius(e));if(floor<y-.15){Object.assign(e,{airborne:true,airVX:e===p?velocityX:0,airVY:0,airVZ:e===p?velocityZ:0,airTime:0,padId:null});if(e===p){stopMotion();p.dashing=0;}}}
    }
    function updateHazards(damage=true){
      for(const h of s.hazards){
        const period=Math.max(1.2,Number(h.period)||6),time=((s.time+(Number(h.phase)||0))%period+period)%period;
        h.hot=time<clamp(Number(h.active)||0,0,period);h.warning=!h.hot&&time>period-.85;
        if(damage&&h.hot&&hazardWait<=0&&Math.abs(p.y-(h.y||0))<1&&Math.hypot(p.x-h.x,p.z-h.z)<(Number(h.r)||1)+.12){hazardWait=.65;hurt(8);}
      }
    }
    function step(dt,input={}){
      dt=Number.isFinite(dt)?clamp(dt,0,.05):0;if(s.won||s.dead)return;
      s.time+=dt;s.elapsed+=dt;fireWait=Math.max(0,fireWait-dt);navWait-=dt;hazardWait=Math.max(0,hazardWait-dt);recovery=Math.max(0,recovery-dt);
      s.flash=Math.max(0,s.flash-dt*9);s.damage=Math.max(0,s.damage-dt*1.9);s.hitMarker=Math.max(0,s.hitMarker-dt);s.pulseVisual=Math.max(0,s.pulseVisual-dt);
      s.comboTime=Math.max(0,s.comboTime-dt);if(!s.comboTime)s.combo=0;
      if(input.weapon===0||input.weapon===1||input.weapon===2)s.weapon=input.weapon;
      p.yaw+=Number.isFinite(input.lookX)?input.lookX:0;p.pitch=clamp(p.pitch+(Number.isFinite(input.lookY)?input.lookY:0),-1.2,1.2);
      p.heat=Math.max(0,p.heat-dt*(fireWait>0?.1:.35));if(p.overheated&&p.heat<.3){p.overheated=false;emit('cooled');}
      p.dash=Math.max(0,p.dash-dt);p.pulseCooldown=Math.max(0,p.pulseCooldown-dt);
      airTimers(p,dt);for(const j of s.jumpPads)j.flash=Math.max(0,j.flash-dt);
      syncDestruction();updateSystems(dt);pumpNav();updateDirector(dt);updateEnvironment(dt);if(s.dead)return;if(input.interact&&!interactHeld)interact();interactHeld=!!input.interact;
      if(input.pulse)pulse();
      locomote(dt,input);if(s.dead)return;checkPad(p);
      if(input.fire)fire(input.assist);
      if(navWait<=0){if(!advanced)rebuildNav();navWait=.6;}
      updateEnemies(dt);updateBossAttacks(dt);updateProjectiles(dt);
      for(const bullet of s.bullets){
        const speed=Math.hypot(bullet.dx,bullet.dy,bullet.dz),travel=speed*dt;
        if(!(speed>0)){bullet.life=0;continue;}
        const hit=ray([bullet.x,bullet.y,bullet.z],[bullet.dx/speed,bullet.dy/speed,bullet.dz/speed],travel+.02);
        const dx=bullet.dx*dt,dz=bullet.dz*dt,flat=dx*dx+dz*dz;
        const t=flat>1e-10?clamp(((p.x-bullet.x)*dx+(p.z-bullet.z)*dz)/flat,0,1):0;
        const y=bullet.y+bullet.dy*dt*t;
        if(Math.hypot(bullet.x+dx*t-p.x,bullet.z+dz*t-p.z)<.42&&y>p.y+.1&&y<p.y+1.95&&hit>=travel*t){hurt(bullet.damage);bullet.life=0;continue;}
        if(hit<travel){bullet.life=0;continue;}
        bullet.x+=dx;bullet.y+=bullet.dy*dt;bullet.z+=dz;bullet.life-=dt;
      }
      s.bullets=s.bullets.filter(q=>q.life>0);
      updateHazards();if(s.dead)return;
      for(const c of s.cores)if(!c.taken&&Math.abs(p.y-(c.y||0))<.8&&Math.hypot(p.x-c.x,p.z-c.z)<1.35){c.taken=true;s.relays++;p.hp=Math.min(100,p.hp+18);s.score+=250;emit('core',{count:s.relays});particles(c.x,(c.y||0)+1.2,c.z,4,18);}
      for(const c of s.pickups)if(!c.taken&&p.hp<99&&Math.abs(p.y-(c.y||0))<.8&&Math.hypot(p.x-c.x,p.z-c.z)<1){c.taken=true;p.hp=Math.min(100,p.hp+35);s.score+=25;emit('pickup');}
      for(const q of s.particles){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.vy-=dt*3;}
      s.particles=s.particles.filter(q=>q.life>0);
      s.bossAlive=s.enemies.some(e=>e.type===3&&e.hp>0);
      if(s.relays===3&&!s.bossAlive&&s.mechanisms.every(m=>!m.required||m.active)&&Math.abs(p.y-(world.exit.y||0))<.8&&Math.hypot(p.x-world.exit.x,p.z-world.exit.z)<1.5&&!s.dead){s.won=true;s.score+=500;stopMotion();emit('win');}
    }
    function snapshot(){
      // A checkpoint materialises the advisory map once, so continuation has the
      // same routes as a freshly restored world. No actor or gameplay timer moves.
      if(navPending)pumpNav(nav.length);
      return {version:1,aiVersion:3,systemsVersion:1,physicsVersion:1,directorVersion:1,bossVersion:1,destructionVersion:1,destruction:destruction?.snapshot()||null,format:'FERRO',seed:world.seed,stage:world.stage||0,fingerprint,
        state:{...pick(s,NUMBERS),difficulty:s.difficulty,director:pick(s.director,DIRECTOR),won:s.won,dead:s.dead,bossAlive:s.bossAlive,player:pick(p,PLAYER),
          enemies:s.enemies.map(e=>({...pick(e,ENEMY),...pick(e,AI),...pick(e,AI2),...pick(e,AI3),...pick(e,BOSS),path:e.path.slice()})),cores:s.cores.map(c=>c.taken),pickups:s.pickups.map(c=>c.taken),bullets:s.bullets.map(q=>({...q})),
          mechanisms:s.mechanisms.map(m=>m.active),doors:s.doors.map(d=>d.progress),lifts:s.lifts.map(l=>pick(l,['y','target','powered','moving','carrying'])),
          bossAttacks:s.bossAttacks.map(q=>({...q,hitEnemies:q.hitEnemies.slice()})),projectiles:s.projectiles.map(q=>({...q})),pipes:s.pipes.map(q=>pick(q,PIPE)),traps:s.traps.map(q=>pick(q,TRAP)),
          doorDamage:s.doors.map(d=>({hp:d.hp,destroyed:d.destroyed})),mechanismDamage:s.mechanisms.map(m=>({hp:m.shellHp,destroyed:m.destroyed}))},
        timers:{fireWait,navWait:Math.max(0,navWait),hazardWait,explosionSerial,projectileSerial,bossAttackSerial}};
    }
    function restore(data,options={}){
      try{
        const json=JSON.stringify(data);if(!json||json.length>2000000)return false;data=JSON.parse(json);
        const a=data.state,t=data.timers;
        const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
        const integer=(v,min,max)=>number(v,min,max)&&Number.isInteger(v);
        const bool=v=>typeof v==='boolean',require=condition=>{if(!condition)throw new Error('Invalid checkpoint');};
        require(data.version===1&&data.format==='FERRO'&&data.seed===world.seed&&data.stage===(world.stage||0)&&data.fingerprint===fingerprint&&a&&t);
        require(data.aiVersion===undefined||data.aiVersion===1||data.aiVersion===2||data.aiVersion===3);
        require(data.systemsVersion===undefined||data.systemsVersion===1);
        require(data.physicsVersion===undefined||data.physicsVersion===1);
        require(data.destructionVersion===undefined||data.destructionVersion===1);
        require(data.bossVersion===undefined||data.bossVersion===1);
        require(data.directorVersion===undefined||data.directorVersion===1);
        let difficulty=0,director={...s.director};
        if(data.directorVersion===1){const d=a.director;require(integer(a.difficulty,0,2)&&d&&number(d.pressure,0,1)&&number(d.tension,0,1)&&HORROR.includes(d.eventType)&&number(d.eventAge,0,1e7)&&number(d.nextEvent,0,1e7)&&integer(d.events,0,1e9)&&number(d.progress,0,1)&&integer(d.tier,0,6)&&number(d.grace,0,10)&&number(d.eventX,b.minX,b.maxX)&&number(d.eventZ,b.minZ,b.maxZ)&&number(d.eventY,-1000,1000)&&number(d.eventIntensity,0,1));difficulty=a.difficulty;director=pick(d,DIRECTOR);}else require(a.difficulty===undefined&&a.director===undefined&&!horror);
        let candidate=G.FDestruction?.create(world)||null;
        if(data.destructionVersion===1){require(candidate?candidate.restore(data.destruction,{exactRevision:true}):data.destruction===null);}else require(data.destruction===undefined);
        const savedSolids=candidate?.colliders||world.colliders;
        require(number(a.time,0,1e7)&&number(a.elapsed,0,1e7));
        for(const key of ['kills','shots','hits','score'])require(integer(a[key],0,1e9));
        require(a.hits<=a.shots&&integer(a.relays,0,3)&&integer(a.weapon,0,2)&&integer(a.combo,0,1000)&&number(a.comboTime,0,4));
        require(bool(a.won)&&bool(a.dead)&&bool(a.bossAlive)&&!(a.won&&a.dead));
        let mechanisms,doors,lifts;
        if(data.systemsVersion===1){
          require(Array.isArray(a.mechanisms)&&a.mechanisms.length===s.mechanisms.length&&a.mechanisms.every(bool));
          mechanisms=(world.mechanisms||[]).map((m,i)=>({...m,active:a.mechanisms[i]}));
          const hasPower=id=>id===undefined||mechanisms.some(m=>m.id===id&&m.active);
          require(Array.isArray(a.doors)&&a.doors.length===s.doors.length);
          doors=(world.doors||[]).map((d,i)=>{const progress=a.doors[i];require(number(progress,0,1)&&(progress===0||hasPower(d.requires)||data.destructionVersion===1&&a.doorDamage?.[i]?.destroyed===true));return {...d,progress,open:progress===1};});
          require(Array.isArray(a.lifts)&&a.lifts.length===s.lifts.length);
          lifts=(world.lifts||[]).map((l,i)=>{
            const q=a.lifts[i];require(q&&number(q.y,l.minY,l.maxY)&&(q.target===l.minY||q.target===l.maxY));
            require(bool(q.powered)&&q.powered===hasPower(l.requires)&&bool(q.moving)&&bool(q.carrying));
            require(q.moving===(Math.abs(q.target-q.y)>1e-7)&&(!q.moving||q.powered));
            require(q.powered||(q.y===l.minY&&q.target===l.minY));
            return {...l,...pick(q,['y','target','powered','moving','carrying'])};
          });
        }else{
          require(!elevated&&!s.mechanisms.length&&!s.doors.length&&!s.lifts.length&&a.mechanisms===undefined&&a.doors===undefined&&a.lifts===undefined);
          mechanisms=[];doors=[];lifts=[];
        }
        let pipes=(world.pipes||[]).map(q=>({...q,nozzle:pipeNozzle(q),dx:q.dx??0,dy:q.dy??1,dz:q.dz??0,length:q.length||3,radius:q.radius||.45,broken:false,active:false,age:0,remaining:0,hot:false,warning:false,damageWait:0,cycle:-1})),traps=(world.traps||[]).map(q=>({...q,warningTime:Math.max(.65,Number(q.warning)||1.2),progress:0,angle:0,box:null,hot:false,warning:false,damageWait:0,triggered:false,triggerAge:0,cycle:-1,hp:18,destroyed:false})),projectiles=[],savedTrapBoxes=[];
        if(data.destructionVersion===1){
          require(Array.isArray(a.doorDamage)&&a.doorDamage.length===doors.length&&Array.isArray(a.mechanismDamage)&&a.mechanismDamage.length===mechanisms.length);
          doors.forEach((d,i)=>{const q=a.doorDamage[i];require(q&&number(q.hp,0,18)&&bool(q.destroyed)&&q.destroyed===(q.hp===0)&&(!q.destroyed||d.progress===1));Object.assign(d,q);});
          mechanisms.forEach((m,i)=>{const q=a.mechanismDamage[i];require(q&&number(q.hp,0,12)&&bool(q.destroyed)&&q.destroyed===(q.hp===0)&&(!q.destroyed||m.active));if(candidate&&m.destructibleId&&!candidate.isAlive(m.destructibleId))require(q.destroyed&&m.active);m.shellHp=q.hp;m.destroyed=q.destroyed;});
          require(Array.isArray(a.pipes)&&a.pipes.length===pipes.length&&Array.isArray(a.traps)&&a.traps.length===traps.length);
          pipes=pipes.map((q,i)=>{const v=a.pipes[i],delay=Math.max(.65,Number(q.delay)||1),duration=Math.max(.5,Number(q.duration)||7);require(v&&bool(v.broken)&&bool(v.active)&&bool(v.warning)&&bool(v.hot)&&number(v.age,0,delay+duration+1)&&number(v.remaining,0,delay+duration)&&number(v.damageWait,0,.55)&&integer(v.cycle,-1,1e7));if(candidate&&q.destructibleId)require(v.broken===!candidate.isAlive(q.destructibleId));require(!v.hot||v.active&&v.age>=delay&&v.age<delay+duration);require(!v.warning||v.active&&v.age<delay);return {...q,...pick(v,PIPE)};});
          traps=traps.map((q,i)=>{const v=a.traps[i];require(v&&number(v.progress,0,1)&&number(v.angle,0,Math.PI*2+1e-6)&&number(v.damageWait,0,.55)&&bool(v.hot)&&bool(v.warning)&&bool(v.triggered)&&number(v.triggerAge,0,20)&&integer(v.cycle,-1,1e7)&&number(v.hp,0,18)&&bool(v.destroyed)&&v.destroyed===(v.hp===0));const result={...q,...pick(v,TRAP)};if(candidate&&q.destructibleId&&!candidate.isAlive(q.destructibleId))require(v.destroyed);
            if(v.box!==null){require(v.box&&['minX','maxX','minY','maxY','minZ','maxZ'].every(k=>number(v.box[k],-1000,1000)));const expected=trapShape(result,v.progress);require(expected&&!v.destroyed);for(const axis of ['X','Y','Z'])require(Math.abs(v.box['max'+axis]-v.box['min'+axis]-(expected['max'+axis]-expected['min'+axis]))<1e-6);if(q.kind==='blade'){const axis=q.axis==='z'?'Z':'X',other=axis==='X'?'Z':'X',center=(v.box['min'+axis]+v.box['max'+axis])/2;require(Math.abs(center-(axis==='X'?q.x:q.z))<=(q.travel||1.65)+1e-6&&Math.abs(v.box.minY-expected.minY)<1e-6&&Math.abs(v.box['min'+other]-expected['min'+other])<1e-6);}else for(const k of ['minX','minY','minZ'])require(Math.abs(v.box[k]-expected[k])<1e-6);if(q.kind==='blade'||q.kind==='press')savedTrapBoxes.push(v.box);}
            else require(v.destroyed||q.kind==='spikes'&&v.progress<.02/(q.h||.3)||q.kind==='floor');return result;});
          require(Array.isArray(a.projectiles)&&a.projectiles.length<=48&&integer(t.explosionSerial,0,1e9)&&integer(t.projectileSerial,0,1e9));const ids=new Set();
          projectiles=a.projectiles.map(q=>{require(q&&integer(q.id,1,t.projectileSerial)&&!ids.has(q.id));ids.add(q.id);require(q.kind==='rocket'||q.kind==='grenade');require(q.owner==='player'||integer(q.owner,0,s.enemies.length-1));require(number(q.x,b.minX-150,b.maxX+150)&&number(q.z,b.minZ-150,b.maxZ+150)&&number(q.y,-150,150));for(const k of ['vx','vy','vz'])require(number(q[k],-40,40));require(number(q.age,0,5)&&number(q.life,0,5)&&number(q.fuse,-.05,3)&&q.radius===(q.kind==='rocket'?.24:.17)&&number(q.blastRadius,2,4.2)&&number(q.damage,0,40)&&number(q.terrainPower,0,80)&&number(q.travel,0,200)&&integer(q.bounces,0,3)&&bool(q.resting));return pick(q,['id','kind','owner','x','y','z','vx','vy','vz','age','life','fuse','radius','blastRadius','damage','terrainPower','travel','bounces','resting']);});
        }else{require(a.projectiles===undefined&&a.pipes===undefined&&a.traps===undefined&&a.doorDamage===undefined&&a.mechanismDamage===undefined&&t.explosionSerial===undefined&&t.projectileSerial===undefined&&!pipes.length&&!traps.length);for(const d of doors){d.hp=18;d.destroyed=false;}for(const m of mechanisms){m.shellHp=12;m.destroyed=false;}}
        const savedDoors=doors.map(d=>({minX:d.x-d.w/2,maxX:d.x+d.w/2,minZ:d.z-d.d/2,maxZ:d.z+d.d/2,minY:(d.y||0)+(d.destroyed?1000:d.progress*(d.h+.25)),maxY:(d.y||0)+(d.destroyed?1000:d.progress*(d.h+.25))+d.h}));
        const supported=(x,z,y,r=.28)=>number(y,-1000,1000)&&(Math.abs(y-ground(x,z))<.061||lifts.some(l=>onLift(l,x,z)&&Math.abs(y-l.y)<.061)||savedSolids.some(q=>Math.abs(q.maxY-y)<.061&&discBox(x,z,r,q))||savedDoors.some(q=>Math.abs(q.maxY-y)<.061&&discBox(x,z,r,q)));
        const top=Math.max(0,...floors.map(f=>(f.y||0)+Math.abs((f.slopeX||0)*f.w/2)+Math.abs((f.slopeZ||0)*f.d/2)))+24;
        function validAir(e,x,z,y){
          if(data.physicsVersion===undefined){require(AIR.every(key=>e[key]===undefined));Object.assign(e,freshAir());}
          require(bool(e.airborne)&&number(e.airVX,-32,32)&&number(e.airVY,-40,40)&&number(e.airVZ,-32,32)&&number(e.airTime,0,8)&&number(e.padCooldown,0,4));
          require(e.padId===null||s.jumpPads.some(j=>j.id===e.padId));
          if(e.airborne){require((e.type!==3||e.padId===null&&e.airVY<=.001)&&number(y,-14,top)&&ground(x,z)<=y+.08&&(e.padId!==null||e.airVY<=.001));if(e.airVY>0){const pad=s.jumpPads.find(j=>j.id===e.padId);require(pad&&y>=pad.y-.13);}}
          else require(e.airVX===0&&e.airVY===0&&e.airVZ===0&&e.airTime===0&&supported(x,z,y,e.type===3?1.05:e.type===undefined?.28:.38));
        }
        const v=a.player;if(v&&v.y===undefined&&data.systemsVersion===undefined)v.y=0;
        require(v&&number(v.x,b.minX,b.maxX)&&number(v.z,b.minZ,b.maxZ)&&!blocked(v.x,v.z,.28,v.y,savedDoors,savedSolids,savedTrapBoxes));validAir(v,v.x,v.z,v.y);
        require(number(v.yaw,-1e6,1e6)&&number(v.pitch,-1.2,1.2)&&number(v.hp,0,100)&&number(v.heat,0,1)&&bool(v.overheated));
        require(number(v.dash,0,1.7)&&number(v.dashing,0,.2)&&number(v.pulseCooldown,0,7)&&a.dead===(v.hp===0));
        require(number(t.fireWait,0,1.25)&&number(t.navWait,0,.6)&&number(t.hazardWait,0,.65));
        require(Array.isArray(a.cores)&&a.cores.length===s.cores.length&&a.cores.every(bool)&&a.cores.filter(Boolean).length===a.relays);
        require(Array.isArray(a.pickups)&&a.pickups.length===s.pickups.length&&a.pickups.every(bool));
        require(Array.isArray(a.enemies)&&a.enemies.length===s.enemies.length);
        const enemies=a.enemies.map((e,i)=>{
          const home=world.enemies[i],type=home.type,r=radius(home),height=bodyHeight(home);
          if(e&&e.baseY===undefined&&data.systemsVersion===undefined)e.baseY=0;
          require(e&&e.id===i&&e.type===type&&e.maxHp===health(home)&&number(e.hp,0,health(home))&&number(e.y,-1000,1000)&&Math.abs(e.y-e.baseY-HEIGHT[type]*scale(home))<1e-7);
          require(number(e.x,b.minX,b.maxX)&&number(e.z,b.minZ,b.maxZ)&&!blocked(e.x,e.z,r,e.baseY,savedDoors,savedSolids,savedTrapBoxes,height));validAir(e,e.x,e.z,e.baseY);
          require(bool(e.active)&&bool(e.rushHit)&&number(e.cooldown,0,30)&&number(e.hurt,0,.2));
          require(number(e.windup,0,giant(home)?3.5:1.15)&&number(e.windupMax,0,giant(home)?3.5:1.15)&&e.windup<=e.windupMax&&ATTACKS.includes(e.attackState));
          require(number(e.yaw,-1e6,1e6)&&number(e.stun,0,.85)&&integer(e.phase,0,giant(home)?2:type===3?1:0));
          require(number(e.aimX,b.minX,b.maxX)&&number(e.aimZ,b.minZ,b.maxZ)&&number(e.aimY,-1000,1000));
          require(integer(e.burstLeft,0,3)&&number(e.burstWait,0,.18)&&number(e.rushTime,0,.68)&&number(e.rushX,-1,1)&&number(e.rushZ,-1,1));
          let ai;
          if(data.aiVersion===1||data.aiVersion===2||data.aiVersion===3){
            require(AWARENESS.includes(e.awareness)&&TACTICS.includes(e.tactic)&&bool(e.hasMemory)&&bool(e.seen));
            require(number(e.lastSeenX,b.minX,b.maxX)&&number(e.lastSeenZ,b.minZ,b.maxZ)&&number(e.memory,0,8)&&number(e.alert,0,1));
            require(number(e.goalX,b.minX,b.maxX)&&number(e.goalZ,b.minZ,b.maxZ)&&!blocked(e.goalX,e.goalZ,r,ground(e.goalX,e.goalZ),savedDoors,savedSolids,[],height));
            require(number(e.senseWait,-.05,.15)&&number(e.thinkWait,-.05,.75)&&number(e.shareWait,-.05,1.1)&&number(e.alertWait,-.05,7));
            require(number(e.coverWait,-.05,4.5)&&number(e.planWait,-.05,2.6)&&number(e.holdTime,0,1.4)&&number(e.stuck,0,30)&&number(e.moveSpeed,0,40));
            require(integer(e.patrolIndex,0,1e9)&&integer(e.searchIndex,0,1e9));
            require(Array.isArray(e.path)&&e.path.length<=512&&e.path.every(j=>integer(j,0,nav.length-1)&&!blocked(...coord(j),.4,ground(...coord(j)),savedDoors,savedSolids,[]))&&integer(e.pathAt,0,e.path.length));
            require(!e.seen||e.hasMemory);require(e.hasMemory||e.awareness==='patrol');
            ai={...pick(e,AI),path:e.path.slice()};
          }else{
            // Legacy saves have no tactical memory. A stored aim is a legitimate old
            // observation; the current player position is deliberately not imported.
            require(AI.concat(AI2,AI3).every(key=>e[key]===undefined)&&e.path===undefined);
            ai={awareness:e.active?'search':'patrol',tactic:'hold',hasMemory:e.active,lastSeenX:e.active?e.aimX:e.x,lastSeenZ:e.active?e.aimZ:e.z,
              memory:e.active?2:0,alert:e.active?.25:0,seen:false,senseWait:0,thinkWait:0,shareWait:0,alertWait:0,coverWait:0,holdTime:0,
              planWait:0,patrolIndex:0,searchIndex:0,goalX:e.x,goalZ:e.z,path:[],pathAt:0,stuck:0,moveSpeed:0};
          }
          if(data.aiVersion===2||data.aiVersion===3){
            require(number(e.lastSeenY,-1000,1000)&&number(e.observedVX,-6,6)&&number(e.observedVZ,-6,6)&&number(e.observedAt,-1,a.time)&&bool(e.sleeping));
            Object.assign(ai,pick(e,AI2));
          }else{
            require(AI2.every(key=>e[key]===undefined));
            Object.assign(ai,{lastSeenY:e.active?e.aimY:e.baseY+1.45,observedVX:0,observedVZ:0,observedAt:-1,sleeping:false});
          }
          if(data.aiVersion===3){
            require(number(e.observedVY,-18,18)&&number(e.dodgeWait,0,2.3)&&number(e.dodgeDelay,0,.2)&&number(e.dodgeTime,0,.32)&&number(e.dodgeX,-1,1)&&number(e.dodgeZ,-1,1)&&Math.hypot(e.dodgeX,e.dodgeZ)<=1.00001);
            Object.assign(ai,pick(e,AI3));
          }else{
            require(AI3.every(key=>e[key]===undefined));Object.assign(ai,{observedVY:0,dodgeWait:0,dodgeDelay:0,dodgeTime:0,dodgeX:0,dodgeZ:0});
          }
          let boss;
          if(data.bossVersion===1){require(bool(e.bossAwake)&&number(e.bossClock,0,12)&&integer(e.bossStep,0,1e9)&&BOSS_LABELS.includes(e.attackLabel)&&bool(e.weakPointOpen)&&number(e.weakTimer,0,3)&&e.weakPointOpen===(e.weakTimer>0)&&bool(e.bossReleased));if(!giant(home))require(!e.bossAwake&&e.bossClock===0&&e.bossStep===0&&e.attackLabel===''&&!e.weakPointOpen&&e.weakTimer===0);if(!home.bossWave)require(e.bossReleased);if(giant(home))require(home.arena&&Math.hypot(e.x-home.arena.x,e.z-home.arena.z)<=Math.max(1,home.arena.r-2.1*scale(home)-5)+1e-6);boss=pick(e,BOSS);}
          else{require(BOSS.every(key=>e[key]===undefined)&&!giant(home)&&!home.bossWave);boss={bossAwake:false,bossClock:0,bossStep:0,attackLabel:'',weakPointOpen:false,weakTimer:0,bossReleased:true};}
          return {...home,...pick(e,ENEMY),...ai,...boss,role:s.enemies[i].role,squad:s.enemies[i].squad};
        });
        let bossAttacks=[];
        if(data.bossVersion===1){
          require(Array.isArray(a.bossAttacks)&&a.bossAttacks.length<=16&&integer(t.bossAttackSerial,0,1e9));const ids=new Set();
          bossAttacks=a.bossAttacks.map(q=>{
            require(q&&integer(q.id,1,t.bossAttackSerial)&&!ids.has(q.id)&&integer(q.bossId,0,enemies.length-1));ids.add(q.id);const owner=enemies[q.bossId];require(giant(owner)&&owner.hp>0&&owner.bossAwake&&['slam','ring','rocketZone','sweep'].includes(q.kind));
            require(number(q.x,b.minX,b.maxX)&&number(q.z,b.minZ,b.maxZ)&&number(q.y,-1000,1000)&&number(q.radius,0,40)&&bool(q.warning)&&bool(q.active)&&q.warning!==q.active&&number(q.age,0,12)&&number(q.tell,.5,4)&&number(q.activeDuration,.1,6)&&Math.abs(q.duration-q.tell-q.activeDuration)<1e-8&&q.age<q.duration&&q.warning===(q.age<q.tell));
            require(number(q.currentRadius,0,q.radius)&&number(q.innerRadius,0,q.currentRadius)&&number(q.angle,-1e6,1e6)&&number(q.dx,-1,1)&&number(q.dz,-1,1)&&Math.abs(q.dx-Math.sin(q.angle))<1e-7&&Math.abs(q.dz+Math.cos(q.angle))<1e-7&&number(q.length,0,60)&&number(q.width,0,10)&&integer(q.phase,0,2)&&number(q.damage,0,40)&&bool(q.hitPlayer)&&bool(q.fired));
            require(Array.isArray(q.hitEnemies)&&q.hitEnemies.length<=enemies.length&&new Set(q.hitEnemies).size===q.hitEnemies.length&&q.hitEnemies.every(id=>integer(id,0,enemies.length-1)));
            return {...q,hitEnemies:q.hitEnemies.slice()};
          });
          for(const e of enemies)if(giant(e)&&e.hp>0&&v.y<e.baseY+bodyHeight(e)&&v.y+1.8>e.baseY)require(Math.hypot(v.x-e.x,v.z-e.z)>=radius(e)+.28-1e-7);
        }else require(a.bossAttacks===undefined&&t.bossAttackSerial===undefined);
        require(enemies.filter(e=>e.hp===0).length===a.kills&&enemies.some(e=>e.type===3&&e.hp>0)===a.bossAlive);
        require(!a.won||(a.relays===3&&!a.bossAlive&&mechanisms.every(m=>!m.required||m.active)));
        require(Array.isArray(a.bullets)&&a.bullets.length<=160);
        const bullets=a.bullets.map(q=>{
          require(q&&number(q.x,b.minX-150,b.maxX+150)&&number(q.z,b.minZ-150,b.maxZ+150)&&number(q.y,-150,150));
          for(const key of ['dx','dy','dz'])require(number(q[key],-30,30));
          require(number(q.life,0,5)&&number(q.damage,0,1000));
          const bullet=pick(q,['x','y','z','dx','dy','dz','life','damage']);
          if(q.kind!==undefined){require(integer(q.kind,0,3));bullet.kind=q.kind;}
          if(q.owner!==undefined){require(integer(q.owner,0,Math.max(0,enemies.length-1)));bullet.owner=q.owner;}
          return bullet;
        });
        Object.assign(p,pick(v,PLAYER));Object.assign(s,pick(a,NUMBERS),{difficulty,director,won:a.won,dead:a.dead,bossAlive:a.bossAlive,enemies,bullets,mechanisms,doors,lifts,pipes,traps,projectiles,bossAttacks});
        s.cores=world.cores.map((c,i)=>({...c,taken:a.cores[i]}));s.pickups=world.pickups.map((c,i)=>({...c,taken:a.pickups[i]}));
        giants=s.enemies.filter(giant);destruction=candidate;solids=savedSolids;seenDestructionRevision=destruction?.revision||0;s.destructionRevision++;trapStates=s.traps;trapBoxes.length=0;trapBoxes.push(...savedTrapBoxes);rebuildCollision();
        bossAttackSerial=t.bossAttackSerial||0;explosionSerial=t.explosionSerial||0;projectileSerial=t.projectileSerial||0;s.explosions=[];s.debris=[];
        s.events=[];s.particles=[];for(const j of s.jumpPads)j.flash=0;s.pulseVisual=0;s.flash=0;s.damage=0;s.hitMarker=0;s.moving=0;s.threat=0;
        fireWait=t.fireWait;navWait=t.navWait;hazardWait=t.hazardWait;recovery=0;interactHeld=false;stopMotion(true);
        Object.assign(s.aiStats,{awake:enemies.filter(e=>e.hp>0&&!e.sleeping).length,dormant:enemies.filter(e=>e.hp>0&&e.sleeping).length,alive:enemies.filter(e=>e.hp>0).length,pathSearches:0,pathDeferred:0});
        if(options?.recover===true&&!s.dead&&!s.won){recovery=1.4;s.bullets=s.bullets.filter(q=>Math.hypot(q.x-p.x,q.z-p.z)>=2.4);}
        updateDoorBoxes();refreshNav(false);rebuildNeighbors();updateHazards(false);return true;
      }catch(_){return false;}
    }
    if(!advanced)rebuildNav();else dist.fill(-1);rebuildNeighbors();updateHazards(false);updateEnvironment(0,false);
    return {state:s,get destruction(){return destruction;},setDifficulty,step,fire,pulse,interact,nearestInteraction,ground,blocked,move,ray,sight,hurt,snapshot,restore,nav:{cells:nav,get dist(){if(advanced)rebuildNav();return dist;},nx,nz,cell,coord,idx,rebuild:rebuildNav,canTraverse:segmentFree}};
  }
  G.FSimulation={create,clamp};
})(typeof window!=='undefined'?window:globalThis);
