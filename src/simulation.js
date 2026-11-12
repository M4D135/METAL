/* FERRO — deterministic combat and checkpoints. No DOM, storage or rendering. */
(function (G) {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const HP=[3,5,4,30], HEIGHT=[1.35,1.05,1.6,1.8], ATTACKS=['idle','aim','burst','rush','recover','stunned'];
  const PLAYER=['x','z','yaw','pitch','hp','heat','overheated','dash','dashing','pulseCooldown'];
  const ENEMY=['x','z','id','type','hp','maxHp','y','active','cooldown','hurt','windup','windupMax','attackState','yaw','stun','phase','aimX','aimY','aimZ','burstLeft','burstWait','rushTime','rushX','rushZ','rushHit'];
  const NUMBERS=['time','elapsed','kills','shots','hits','relays','weapon','score','combo','comboTime'];
  const pick=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value[key]]));
  function create(world) {
    const p={x:world.spawn.x,z:world.spawn.z,yaw:world.spawn.yaw,pitch:0,hp:100,heat:0,overheated:false,dash:0,dashing:0,pulseCooldown:0};
    const s={world,player:p,time:0,elapsed:0,won:false,dead:false,kills:0,shots:0,hits:0,relays:0,weapon:0,score:0,combo:0,comboTime:0,pulseVisual:0,
      flash:0,damage:0,hitMarker:0,events:[],bullets:[],particles:[],threat:0,moving:0,
      enemies:world.enemies.map((e,i)=>({...e,id:i,hp:HP[e.type],maxHp:HP[e.type],y:HEIGHT[e.type],active:false,cooldown:1.2+i*.15,hurt:0,
        windup:0,windupMax:0,attackState:'idle',yaw:0,stun:0,phase:0,aimX:p.x,aimY:1.45,aimZ:p.z,burstLeft:0,burstWait:0,rushTime:0,rushX:0,rushZ:0,rushHit:false})),
      cores:world.cores.map(c=>({...c,taken:false})),pickups:world.pickups.map(c=>({...c,taken:false})),
      hazards:(world.hazards||[]).map(h=>({...h,hot:false,warning:false}))};
    s.bossAlive=s.enemies.some(e=>e.type===3&&e.hp>0);
    // Public locomotion values describe displacement after collision, never held keys.
    const locomotion=s.locomotion={vx:0,vz:0,speed:0,forward:0,strafe:0,stridePhase:0,distance:0,
      moveBlend:0,sprintBlend:0,dashBlend:0,accelForward:0,accelStrafe:0,blocked:false};
    let velocityX=0,velocityZ=0,dashAge=.2,dashX=0,dashZ=0;
    let fireWait=0,navWait=0,hazardWait=0,recovery=0;
    const solids=world.colliders.filter(b=>b.minY<1.8&&b.maxY>.06),b=world.bounds;
    let fingerprint=2166136261;
    for(const c of JSON.stringify([world.seed,world.stage,world.spawn,b,world.colliders,world.enemies,world.cores,world.pickups,world.exit,world.hazards||[]]))fingerprint=Math.imul(fingerprint^c.charCodeAt(0),16777619);
    fingerprint=(fingerprint>>>0).toString(36);
    function blocked(x,z,r=.28){
      if(x-r<b.minX||x+r>b.maxX||z-r<b.minZ||z+r>b.maxZ)return true;
      for(const q of solids){const dx=x-clamp(x,q.minX,q.maxX),dz=z-clamp(z,q.minZ,q.maxZ);if(dx*dx+dz*dz<r*r)return true;}
      return false;
    }
    function move(e,dx,dz,r=.28){
      const count=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.12));
      dx/=count;dz/=count;
      for(let j=0;j<count;j++){if(!blocked(e.x+dx,e.z,r))e.x+=dx;if(!blocked(e.x,e.z+dz,r))e.z+=dz;}
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
      for(const q of world.colliders){
        let lo=0,hi=best;
        const mins=[q.minX,q.minY,q.minZ],maxs=[q.maxX,q.maxY,q.maxZ];
        for(let k=0;k<3;k++){
          if(Math.abs(d[k])<1e-7){if(o[k]<mins[k]||o[k]>maxs[k]){hi=-1;break;}}
          else {let a=(mins[k]-o[k])/d[k],c=(maxs[k]-o[k])/d[k];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)break;}
        }
        if(hi>=lo&&lo>=0&&lo<best)best=lo;
      }
      if(d[1]<-.0001){const t=-o[1]/d[1];if(t>=0)best=Math.min(best,t);}
      return best;
    }
    function sight(ax,az,bx,bz){const dx=bx-ax,dz=bz-az,l=Math.hypot(dx,dz);return l<.01||ray([ax,1.2,az],[dx/l,0,dz/l],l)>=l-.02;}
    const cell=.8,nx=Math.ceil((b.maxX-b.minX)/cell)+1,nz=Math.ceil((b.maxZ-b.minZ)/cell)+1;
    const nav=new Uint8Array(nx*nz),dist=new Int16Array(nx*nz),queue=new Int32Array(nx*nz);
    const coord=i=>[b.minX+(i%nx)*cell,b.minZ+Math.floor(i/nx)*cell];
    const idx=(x,z)=>clamp(Math.round((z-b.minZ)/cell),0,nz-1)*nx+clamp(Math.round((x-b.minX)/cell),0,nx-1);
    for(let i=0;i<nav.length;i++){const [x,z]=coord(i);nav[i]=blocked(x,z,.4)?0:1;}
    function rebuildNav(){
      dist.fill(-1);let start=idx(p.x,p.z);
      if(!nav[start]){let best=Infinity;for(let i=0;i<nav.length;i++)if(nav[i]){const [x,z]=coord(i),d=(x-p.x)**2+(z-p.z)**2;if(d<best){best=d;start=i;}}}
      let head=0,tail=0;queue[tail++]=start;dist[start]=0;
      while(head<tail){const i=queue[head++],x=i%nx;for(const j of [x?i-1:-1,x<nx-1?i+1:-1,i-nx,i+nx])if(j>=0&&j<nav.length&&nav[j]&&dist[j]<0){dist[j]=dist[i]+1;queue[tail++]=j;}}
    }
    function emit(name,data){s.events.push({name,...data});}
    function particles(x,y,z,kind,n=9){
      for(let i=0;i<n;i++){const angle=i*2.399963+s.time*9,v=.7+(i%5)*.43;s.particles.push({x,y,z,vx:Math.cos(angle)*v,vy:.4+(i%4)*.5,vz:Math.sin(angle)*v,life:.4+(i%4)*.09,kind});}
      if(s.particles.length>180)s.particles.splice(0,s.particles.length-180);
    }
    function hurt(amount){
      if(!(amount>0)||p.dashing>0||recovery>0||s.dead||s.won)return;
      p.hp=Math.max(0,p.hp-amount);s.damage=1;s.combo=0;s.comboTime=0;emit('hurt');
      if(!p.hp){s.dead=true;stopMotion();emit('dead');}
    }
    function bossPhase(e){
      if(e.type===3&&e.hp>0&&e.hp<=e.maxHp/2&&e.phase===0){
        e.phase=1;e.cooldown=Math.min(e.cooldown,.65);emit('bossPhase',{id:e.id,phase:1});particles(e.x,e.y,e.z,6,24);
      }
    }
    function damageEnemy(e,amount){
      if(e.hp<=0)return;
      e.hp=Math.max(0,e.hp-amount);e.hurt=.2;e.active=true;
      if(e.hp<=0){
        s.kills++;s.combo++;s.comboTime=4;
        const multiplier=1+Math.min(4,s.combo-1)*.25,points=Math.round([100,150,125,2000][e.type]*multiplier);
        s.score+=points;emit('kill',{kind:e.type,boss:e.type===3,points});particles(e.x,e.y,e.z,6,e.type===3?32:18);
        if(s.combo>1)emit('combo',{count:s.combo,multiplier});
        if(e.type===3)s.bossAlive=s.enemies.some(q=>q.type===3&&q.hp>0);
      }else bossPhase(e);
    }
    function hitRay(origin,dir,far,assist){
      let distance=ray(origin,dir,far),victim=null;
      for(const e of s.enemies)if(e.hp>0){
        const d=[e.x-origin[0],e.y-origin[1],e.z-origin[2]],along=d[0]*dir[0]+d[1]*dir[1]+d[2]*dir[2];
        const radius=(e.type===3?1.15:.67)+(assist?Math.min(s.weapon?.16:.38,along*(s.weapon?.012:.025)):0);
        if(along<0||along>distance+radius)continue;
        const perp=d[0]*d[0]+d[1]*d[1]+d[2]*d[2]-along*along;
        if(perp>radius*radius)continue;
        const hit=Math.max(0,along-Math.sqrt(Math.max(0,radius*radius-perp)));
        if(hit<distance){distance=hit;victim=e;}
      }
      return {distance,victim};
    }
    function fire(assist=false){
      if(s.dead||s.won||fireWait>0||p.overheated)return false;
      const shotgun=s.weapon===1;
      fireWait=shotgun?.78:.165;p.heat=Math.min(1,p.heat+(shotgun?.37:.12));
      if(p.heat>=.99){p.overheated=true;emit('overheat');}
      const cy=Math.cos(p.yaw),sy=Math.sin(p.yaw),cp=Math.cos(p.pitch),sp=Math.sin(p.pitch);
      const forward=[sy*cp,sp,-cy*cp],right=[cy,0,sy],up=[-sy*sp,cp,cy*sp],origin=[p.x,1.62,p.z];
      let connected=false;
      for(let i=0;i<(shotgun?7:1);i++){
        const angle=(i-1)*Math.PI/3+s.shots*.71,spread=i?.088:0;
        const a=Math.cos(angle)*spread,c=Math.sin(angle)*spread;
        const dir=forward.map((v,k)=>v+right[k]*a+up[k]*c),length=Math.hypot(...dir);for(let k=0;k<3;k++)dir[k]/=length;
        const hit=hitRay(origin,dir,shotgun?24:75,assist);
        if(hit.victim){
          connected=true;damageEnemy(hit.victim,shotgun?.82*clamp(1-(hit.distance-5)*.035,.45,1):1);
          particles(hit.victim.x,hit.victim.y,hit.victim.z,5,shotgun?3:7);
        }else particles(origin[0]+dir[0]*hit.distance,origin[1]+dir[1]*hit.distance,origin[2]+dir[2]*hit.distance,5,shotgun?2:4);
      }
      s.flash=1;s.shots++;emit(shotgun?'fracture':'shot',{weapon:s.weapon});
      if(connected){s.hits++;s.hitMarker=.18;emit('hit');}
      return true;
    }
    function pulse(){
      if(s.dead||s.won||p.pulseCooldown>0)return false;
      p.pulseCooldown=7;s.pulseVisual=.65;p.heat=Math.max(0,p.heat-.28);
      let hits=0;
      for(const e of s.enemies)if(e.hp>0){
        const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);
        if(d>6.5||!sight(p.x,p.z,e.x,e.z))continue;
        hits++;damageEnemy(e,e.type===3?3:d<3?3:2);
        if(e.hp>0){
          e.stun=e.type===3?.38:.85;e.windup=0;e.burstLeft=0;e.rushTime=0;e.attackState='stunned';e.cooldown=Math.max(e.cooldown,.7);
          const push=e.type===3?.6:2.3*(1-d/9),n=Math.max(.01,d);
          move(e,dx/n*push,dz/n*push,e.type===3?1.05:.38);
        }
      }
      s.bullets=s.bullets.filter(q=>{if(Math.hypot(q.x-p.x,q.z-p.z)>7.5)return true;particles(q.x,q.y,q.z,4,3);return false;});
      emit('pulse',{radius:6.5,hits});return true;
    }
    function projectile(e,angle=0,speed=7,damage=8){
      const horizontal=Math.hypot(e.aimX-e.x,e.aimZ-e.z),pitch=Math.atan2(e.aimY-e.y,horizontal||.01),yaw=Math.atan2(e.aimX-e.x,e.z-e.aimZ)+angle;
      const direction=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)],muzzle=e.type===3?1.2:.52;
      s.bullets.push({x:e.x+direction[0]*muzzle,y:e.y+direction[1]*muzzle,z:e.z+direction[2]*muzzle,
        dx:direction[0]*speed,dy:direction[1]*speed,dz:direction[2]*speed,life:5,damage,kind:e.type,owner:e.id});
      if(s.bullets.length>160)s.bullets.shift();
      emit('enemyShot',{x:e.x,z:e.z,kind:e.type});
    }
    function burst(e){
      projectile(e,(e.burstLeft-2)*.055,7.7,6);e.burstLeft--;e.burstWait=.18;
      if(!e.burstLeft)e.attackState='recover';
    }
    function attack(e){
      e.attackState='recover';e.cooldown=[2.05,2.9,2.65,e.phase?2.15:2.85][e.type]-.08*(world.stage||0);
      if(e.type===0)projectile(e,0,7.2,8);
      else if(e.type===1){
        const dx=e.aimX-e.x,dz=e.aimZ-e.z,d=Math.hypot(dx,dz);
        if(d<11.5&&d>1){e.attackState='rush';e.rushTime=.68;e.rushX=dx/d;e.rushZ=dz/d;e.rushHit=false;}
        else projectile(e,0,5.5,14);
      }else if(e.type===2){e.attackState='burst';e.burstLeft=3;burst(e);}
      else {
        const half=e.phase?3:2;
        for(let i=-half;i<=half;i++)projectile(e,i*.16,e.phase?6.3:5.5,e.phase?11:12);
      }
    }
    function navigate(e,dx,dz,clear,d,dt){
      if(e.type===2)return;
      let vx=0,vz=0;
      if(!clear){
        const i=idx(e.x,e.z);let best=i;
        for(let iz=-1;iz<=1;iz++)for(let ix=-1;ix<=1;ix++){
          const j=i+iz*nx+ix;
          if(j>=0&&j<nav.length&&nav[j]&&dist[j]>=0&&(dist[best]<0||dist[j]<dist[best])&&sight(e.x,e.z,...coord(j)))best=j;
        }
        const target=coord(best),x=target[0]-e.x,z=target[1]-e.z,n=Math.hypot(x,z);
        if(n>.1){vx=x/n*(e.type===0?1.65:.85);vz=z/n*(e.type===0?1.65:.85);}
      }else if(d>.01){
        const nx=dx/d,nz=dz/d;
        if(e.type===0){
          const radial=d>8?1.65:d<4.2?-1.1:.12,strafe=d<13?Math.sin(s.time*.85+e.id*1.73)*1.35:0;
          vx=nx*radial-nz*strafe;vz=nz*radial+nx*strafe;
        }else if(e.type===1){if(d>4.1){vx=nx*.92;vz=nz*.92;}}
        else {
          const radial=d>14?.8:d<5?-.5:0,side=Math.sin(s.time*.6+e.id)*(e.phase?.75:.45);
          vx=nx*radial-nz*side;vz=nz*radial+nx*side;
        }
      }
      move(e,vx*dt,vz*dt,e.type===3?1.05:.38);
    }
    function updateEnemies(dt){
      let threat=0;
      for(const e of s.enemies){
        if(e.hp<=0)continue;
        e.hurt=Math.max(0,e.hurt-dt);e.cooldown=Math.max(0,e.cooldown-dt);e.burstWait=Math.max(0,e.burstWait-dt);bossPhase(e);
        const dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz),clear=d<25&&sight(e.x,e.z,p.x,p.z);
        if(clear&&d<(e.type===3?23:18))e.active=true;
        if(!e.active)continue;
        if(d<19)threat++;
        if(e.stun>0){e.stun=Math.max(0,e.stun-dt);e.attackState=e.stun>0?'stunned':'recover';continue;}
        if(e.rushTime>0){
          e.attackState='rush';e.rushTime=Math.max(0,e.rushTime-dt);move(e,e.rushX*7.3*dt,e.rushZ*7.3*dt,.38);
          if(!e.rushHit&&Math.hypot(e.x-p.x,e.z-p.z)<.9&&sight(e.x,e.z,p.x,p.z)){e.rushHit=true;hurt(16);}
          if(e.rushTime<=0)e.attackState='recover';continue;
        }
        if(e.burstLeft>0){if(e.burstWait<=0)burst(e);continue;}
        if(e.windup>0){e.windup=Math.max(0,e.windup-dt);if(!e.windup)attack(e);continue;}
        e.yaw=Math.atan2(dx,-dz);
        if(clear&&d<22&&e.cooldown<=0){
          e.aimX=p.x;e.aimY=1.45;e.aimZ=p.z;e.windupMax=[.65,.9,.75,e.phase?.9:1.15][e.type];
          e.windup=e.windupMax;e.attackState='aim';continue;
        }
        e.attackState=e.cooldown>0?'recover':'idle';navigate(e,dx,dz,clear,d,dt);
      }
      s.threat=Math.min(1,threat/4);
    }
    function updateHazards(damage=true){
      for(const h of s.hazards){
        const period=Math.max(1.2,Number(h.period)||6),time=((s.time+(Number(h.phase)||0))%period+period)%period;
        h.hot=time<clamp(Number(h.active)||0,0,period);h.warning=!h.hot&&time>period-.85;
        if(damage&&h.hot&&hazardWait<=0&&Math.hypot(p.x-h.x,p.z-h.z)<(Number(h.r)||1)+.12){hazardWait=.65;hurt(8);}
      }
    }
    function step(dt,input={}){
      dt=Number.isFinite(dt)?clamp(dt,0,.05):0;if(s.won||s.dead)return;
      s.time+=dt;s.elapsed+=dt;fireWait=Math.max(0,fireWait-dt);navWait-=dt;hazardWait=Math.max(0,hazardWait-dt);recovery=Math.max(0,recovery-dt);
      s.flash=Math.max(0,s.flash-dt*9);s.damage=Math.max(0,s.damage-dt*1.9);s.hitMarker=Math.max(0,s.hitMarker-dt);s.pulseVisual=Math.max(0,s.pulseVisual-dt);
      s.comboTime=Math.max(0,s.comboTime-dt);if(!s.comboTime)s.combo=0;
      if(input.weapon===0||input.weapon===1)s.weapon=input.weapon;
      p.yaw+=Number.isFinite(input.lookX)?input.lookX:0;p.pitch=clamp(p.pitch+(Number.isFinite(input.lookY)?input.lookY:0),-1.2,1.2);
      p.heat=Math.max(0,p.heat-dt*(fireWait>0?.1:.35));if(p.overheated&&p.heat<.3){p.overheated=false;emit('cooled');}
      p.dash=Math.max(0,p.dash-dt);p.pulseCooldown=Math.max(0,p.pulseCooldown-dt);
      if(input.pulse)pulse();
      locomote(dt,input);
      if(input.fire)fire(input.assist);
      if(navWait<=0){rebuildNav();navWait=.6;}
      updateEnemies(dt);
      for(const bullet of s.bullets){
        const speed=Math.hypot(bullet.dx,bullet.dy,bullet.dz),travel=speed*dt;
        if(!(speed>0)){bullet.life=0;continue;}
        const hit=ray([bullet.x,bullet.y,bullet.z],[bullet.dx/speed,bullet.dy/speed,bullet.dz/speed],travel+.02);
        const dx=bullet.dx*dt,dz=bullet.dz*dt,flat=dx*dx+dz*dz;
        const t=flat>1e-10?clamp(((p.x-bullet.x)*dx+(p.z-bullet.z)*dz)/flat,0,1):0;
        const y=bullet.y+bullet.dy*dt*t;
        if(Math.hypot(bullet.x+dx*t-p.x,bullet.z+dz*t-p.z)<.42&&y>.1&&y<1.95&&hit>=travel*t){hurt(bullet.damage);bullet.life=0;continue;}
        if(hit<travel){bullet.life=0;continue;}
        bullet.x+=dx;bullet.y+=bullet.dy*dt;bullet.z+=dz;bullet.life-=dt;
      }
      s.bullets=s.bullets.filter(q=>q.life>0);
      updateHazards();if(s.dead)return;
      for(const c of s.cores)if(!c.taken&&Math.hypot(p.x-c.x,p.z-c.z)<1.35){c.taken=true;s.relays++;p.hp=Math.min(100,p.hp+18);s.score+=250;emit('core',{count:s.relays});particles(c.x,1.2,c.z,4,18);}
      for(const c of s.pickups)if(!c.taken&&p.hp<99&&Math.hypot(p.x-c.x,p.z-c.z)<1){c.taken=true;p.hp=Math.min(100,p.hp+35);s.score+=25;emit('pickup');}
      for(const q of s.particles){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.vy-=dt*3;}
      s.particles=s.particles.filter(q=>q.life>0);
      s.bossAlive=s.enemies.some(e=>e.type===3&&e.hp>0);
      if(s.relays===3&&!s.bossAlive&&Math.hypot(p.x-world.exit.x,p.z-world.exit.z)<1.5&&!s.dead){s.won=true;s.score+=500;stopMotion();emit('win');}
    }
    function snapshot(){
      return {version:1,format:'FERRO',seed:world.seed,stage:world.stage||0,fingerprint,
        state:{...pick(s,NUMBERS),won:s.won,dead:s.dead,bossAlive:s.bossAlive,player:pick(p,PLAYER),
          enemies:s.enemies.map(e=>pick(e,ENEMY)),cores:s.cores.map(c=>c.taken),pickups:s.pickups.map(c=>c.taken),bullets:s.bullets.map(q=>({...q}))},
        timers:{fireWait,navWait:Math.max(0,navWait),hazardWait}};
    }
    function restore(data,options={}){
      try{
        const json=JSON.stringify(data);if(!json||json.length>160000)return false;data=JSON.parse(json);
        const a=data.state,t=data.timers;
        const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
        const integer=(v,min,max)=>number(v,min,max)&&Number.isInteger(v);
        const bool=v=>typeof v==='boolean',require=condition=>{if(!condition)throw new Error('Invalid checkpoint');};
        require(data.version===1&&data.format==='FERRO'&&data.seed===world.seed&&data.stage===(world.stage||0)&&data.fingerprint===fingerprint&&a&&t);
        require(number(a.time,0,1e7)&&number(a.elapsed,0,1e7));
        for(const key of ['kills','shots','hits','score'])require(integer(a[key],0,1e9));
        require(a.hits<=a.shots&&integer(a.relays,0,3)&&integer(a.weapon,0,1)&&integer(a.combo,0,1000)&&number(a.comboTime,0,4));
        require(bool(a.won)&&bool(a.dead)&&bool(a.bossAlive)&&!(a.won&&a.dead));
        const v=a.player;require(v&&number(v.x,b.minX,b.maxX)&&number(v.z,b.minZ,b.maxZ)&&!blocked(v.x,v.z));
        require(number(v.yaw,-1e6,1e6)&&number(v.pitch,-1.2,1.2)&&number(v.hp,0,100)&&number(v.heat,0,1)&&bool(v.overheated));
        require(number(v.dash,0,1.7)&&number(v.dashing,0,.2)&&number(v.pulseCooldown,0,7)&&a.dead===(v.hp===0));
        require(number(t.fireWait,0,.78)&&number(t.navWait,0,.6)&&number(t.hazardWait,0,.65));
        require(Array.isArray(a.cores)&&a.cores.length===s.cores.length&&a.cores.every(bool)&&a.cores.filter(Boolean).length===a.relays);
        require(Array.isArray(a.pickups)&&a.pickups.length===s.pickups.length&&a.pickups.every(bool));
        require(Array.isArray(a.enemies)&&a.enemies.length===s.enemies.length);
        const enemies=a.enemies.map((e,i)=>{
          const type=world.enemies[i].type;
          require(e&&e.id===i&&e.type===type&&e.maxHp===HP[type]&&e.y===HEIGHT[type]&&number(e.hp,0,HP[type]));
          require(number(e.x,b.minX,b.maxX)&&number(e.z,b.minZ,b.maxZ)&&!blocked(e.x,e.z,type===3?1.05:.38));
          require(bool(e.active)&&bool(e.rushHit)&&number(e.cooldown,0,30)&&number(e.hurt,0,.2));
          require(number(e.windup,0,1.15)&&number(e.windupMax,0,1.15)&&e.windup<=e.windupMax&&ATTACKS.includes(e.attackState));
          require(number(e.yaw,-1e6,1e6)&&number(e.stun,0,.85)&&integer(e.phase,0,type===3?1:0));
          require(number(e.aimX,b.minX,b.maxX)&&number(e.aimZ,b.minZ,b.maxZ)&&number(e.aimY,0,3));
          require(integer(e.burstLeft,0,3)&&number(e.burstWait,0,.18)&&number(e.rushTime,0,.68)&&number(e.rushX,-1,1)&&number(e.rushZ,-1,1));
          return {...world.enemies[i],...pick(e,ENEMY)};
        });
        require(enemies.filter(e=>e.hp===0).length===a.kills&&enemies.some(e=>e.type===3&&e.hp>0)===a.bossAlive);
        require(!a.won||(a.relays===3&&!a.bossAlive));
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
        Object.assign(p,pick(v,PLAYER));Object.assign(s,pick(a,NUMBERS),{won:a.won,dead:a.dead,bossAlive:a.bossAlive,enemies,bullets});
        s.cores=world.cores.map((c,i)=>({...c,taken:a.cores[i]}));s.pickups=world.pickups.map((c,i)=>({...c,taken:a.pickups[i]}));
        s.events=[];s.particles=[];s.pulseVisual=0;s.flash=0;s.damage=0;s.hitMarker=0;s.moving=0;s.threat=0;
        fireWait=t.fireWait;navWait=t.navWait;hazardWait=t.hazardWait;recovery=0;stopMotion(true);
        if(options?.recover===true&&!s.dead&&!s.won){recovery=1.4;s.bullets=s.bullets.filter(q=>Math.hypot(q.x-p.x,q.z-p.z)>=2.4);}
        rebuildNav();updateHazards(false);return true;
      }catch(_){return false;}
    }
    rebuildNav();updateHazards(false);
    return {state:s,step,fire,pulse,blocked,move,ray,sight,hurt,snapshot,restore,nav:{cells:nav,dist,nx,nz,cell,coord,idx,rebuild:rebuildNav}};
  }
  G.FSimulation={create,clamp};
})(typeof window!=='undefined'?window:globalThis);
