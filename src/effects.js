/* FERRO — procedural destruction FX. Simulation owns every hazardous pose/time. */
(function(G){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),num=(v,f=0)=>Number.isFinite(v)?v:f;
  const hash=(seed,k=0)=>{let n=Math.imul((seed|0)^Math.imul(k+17,374761393),668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
  const unit=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);},add=(p,d,k)=>p.map((x,i)=>x+d[i]*k);
  const orient=d=>[Math.acos(clamp(d[1],-1,1)),Math.atan2(d[0],d[2]),0];
  function rotate(p,r){let [x,y,z]=p;const c=r.map(Math.cos),s=r.map(Math.sin);[y,z]=[c[0]*y-s[0]*z,s[0]*y+c[0]*z];[x,z]=[c[1]*x+s[1]*z,-s[1]*x+c[1]*z];return [c[2]*x-s[2]*y,s[2]*x+c[2]*y,z];}
  const mesh=(shape,p,s,mat=7,color,r=[0,0,0],part='')=>({shape,p,s,r,mat,...(color?{color}:{}),surface:'object',effectPart:part});
  function build(state,world,camera,options={}){
    if(!state)return [];
    if(typeof options==='string')options={quality:options};
    const software=options.backend==='canvas2d',tier=options.quality==='low'?0:options.quality==='high'?2:1;
    const eye=camera?.pos||[state.player?.x||0,(state.player?.y||0)+1.62,state.player?.z||0],time=num(state.time),out=[];
    const budget=(software?[24,44,64]:[48,96,144])[tier],debrisBudget=(software?[8,18,28]:[18,38,60])[tier];let particles=0;
    const point=e=>[num(e.x),num(e.y),num(e.z)],distance=p=>Math.hypot(p[0]-eye[0],p[1]-eye[1],p[2]-eye[2]);
    const fade=(p,r=0)=>clamp(((software?42:105)-Math.max(0,distance(p)-r))/(software?18:40),0,1);
    const close=(list,limit=Infinity)=>Array.from(list||[]).filter(e=>[e.x,e.y,e.z].every(Number.isFinite)).sort((a,b)=>distance(point(a))-distance(point(b))).slice(0,limit);
    function puff(p,s,color,alpha,emissive=0,part='dust',shape='sphere',r=[0,0,0],mandatory=false){
      alpha*=fade(p,Math.hypot(...s)*.5);if(!mandatory&&particles>=budget||alpha<.008||s.some(v=>!(v>.002)))return;
      const m=mesh(shape,p,s,7,color,r,part);m.fx=true;m.alpha=clamp(alpha,0,.94);m.emissive=emissive;if(mandatory)m.fxPriority='hazard';out.push(m);particles++;return m;
    }
    function solid(shape,p,s,mat,color,r,part){const m=mesh(shape,p,s,mat,color,r,part);out.push(m);return m;}

    // Telegraphs use the actual collision disc, annulus or swept capsule.
    // Large markers are kept while any part of their extent is in range.
    for(const a of state.bossAttacks||[]){
      if((!a.warning&&!a.active)||![a.x,a.y,a.z].every(Number.isFinite))continue;
      const p=[a.x,a.y+.026,a.z],warning=!!a.warning,color=warning?[1,.58,.08]:[1,.17,.035];
      const band=(radius,inner,part)=>{if(!(radius>.005)||radius<=inner)return;const m=puff(p,[radius*2,.022,radius*2],color,warning?.76:.68,warning?1.3:1.8,part,'ring',[0,0,0],true);if(m)m.innerRatio=clamp(inner/radius,0,.998);};
      if(a.kind==='ring'){
        const r=warning?num(a.radius):num(a.currentRadius),inner=warning?Math.max(0,r-.2):Math.max(0,num(a.innerRadius));band(r,inner,'boss-ring');
      }else if(a.kind==='sweep'){
        const d=unit([num(a.dx),0,num(a.dz,1)]),length=Math.max(0,num(a.length)),width=Math.max(.01,num(a.width)),yaw=Math.atan2(d[0],d[2]),center=add(p,d,length*.5);
        puff(center,[width*2,.022,Math.max(.01,length)],color,warning?.16:.28,1.0,'boss-sweep','box',[0,yaw,0],true);
        for(const k of [0,length])puff(add(p,d,k),[width*2,.022,width*2],color,warning?.16:.28,1.0,'boss-sweep-cap','cylinder',[0,0,0],true);
        for(const sign of [-1,1]){const side=[center[0]+d[2]*width*sign,center[1]+.002,center[2]-d[0]*width*sign];puff(side,[.045,.025,Math.max(.01,length)],color,.74,1.5,'boss-sweep-edge','box',[0,yaw,0],true);}
      }else if(a.kind==='slam'||a.kind==='rocketZone'){
        const radius=Math.max(0,num(a.radius));if(radius<=0)continue;
        puff(p,[radius*2,.018,radius*2],color,warning?.09:.22,1.1,'boss-zone','cylinder',[0,0,0],true);band(radius,Math.max(0,radius-.14),'boss-zone-edge');
      }
    }

    // Moving hazards are never paid for from the cosmetic particle allowance.
    // Their dimensions/centres come directly from the collision box, including
    // a press or blade halted by contact with a player/enemy.
    for(const trap of state.traps||[]){
      if(trap.destroyed)continue;
      if(!trap.box){
        if(trap.kind==='spikes'&&trap.warning&&[trap.x,trap.y,trap.z].every(Number.isFinite)){
          const p=point(trap),w=Math.max(.2,num(trap.w,2)),d=Math.max(.2,num(trap.d,2));
          if(distance(p)<90)for(const sign of [-1,1]){
            const a=solid('box',[p[0]+sign*w*.46,p[1]+.018,p[2]],[.045,.025,d*.94],5,[1,.48,.08],[0,0,0],'spike-warning');
            const b=solid('box',[p[0],p[1]+.018,p[2]+sign*d*.46],[w*.94,.025,.045],5,[1,.48,.08],[0,0,0],'spike-warning');a.emissive=b.emissive=.55;
          }
        }
        continue;
      }
      const q=trap.box,lo=[q.minX,q.minY,q.minZ],hi=[q.maxX,q.maxY,q.maxZ];if(!lo.concat(hi).every(Number.isFinite))continue;
      const s=hi.map((v,k)=>v-lo[k]),p=lo.map((v,k)=>(v+hi[k])/2);if(s.some(v=>v<=0)||distance(p)>180+Math.hypot(...s))continue;
      const alert=trap.hot?[.76,.19,.045]:trap.warning?[.95,.55,.08]:[.25,.39,.37],near=distance(p)<(software?18:32),detail=near&&tier>0;
      if(trap.kind==='press'){
        solid(detail?'bevel':'box',p,s,0,[.24,.27,.27],[0,0,0],'press-body');
        const strips=detail?4:2;for(let i=0;i<strips;i++){
          const x=p[0]+s[0]*((i+.5)/strips-.5),z=p[2]+s[2]*.493;
          solid('box',[x,p[1]-s[1]*.22,z],[s[0]/strips*.42,s[1]*.24,Math.min(.015,s[2]*.01)],1,alert,[0,0,0],'press-stripe');
        }
      }else if(trap.kind==='spikes'){
        const nx=detail?3:2,nz=detail?3:2;
        for(let x=0;x<nx;x++)for(let z=0;z<nz;z++){
          const pos=[lo[0]+s[0]*(x+.5)/nx,p[1],lo[2]+s[2]*(z+.5)/nz];
          solid('octa',pos,[Math.min(.22,s[0]/nx*.72),s[1],Math.min(.22,s[2]/nz*.72)],3,[.55,.58,.56],[0,0,0],'spike');
        }
      }else if(trap.kind==='blade'){
        const axis=s.indexOf(Math.min(...s)),plane=[0,1,2].filter(k=>k!==axis),diameter=Math.min(s[plane[0]],s[plane[1]]),thickness=s[axis],normal=[0,0,0];normal[axis]=1;
        const r=orient(normal),angle=num(trap.angle);
        solid('cylinder',p,[diameter*.82,thickness*.92,diameter*.82],3,[.52,.56,.56],r,'blade-disc');
        solid('cylinder',p,[diameter*.22,thickness,diameter*.22],0,[.19,.24,.25],r,'blade-hub');
        const teeth=detail?12:8;
        for(let i=0;i<teeth;i++){
          const a=angle+i*Math.PI*2/teeth,pos=p.slice(),size=[diameter*.13,diameter*.13,diameter*.13];
          pos[plane[0]]+=Math.cos(a)*diameter*.43;pos[plane[1]]+=Math.sin(a)*diameter*.43;size[axis]=thickness*.88;
          solid('octa',pos,size,3,i%3? [.57,.59,.57]:alert,[0,0,0],'blade-tooth');
        }
      }
    }

    // A hot pipe's cloud stays inside its directed hazard volume. Warnings
    // show a nozzle glow; they never draw a damaging-looking full jet early.
    for(const pipe of close(state.pipes,software?4:8)){
      if(!pipe.active||(!pipe.hot&&!pipe.warning))continue;
      const p=Array.isArray(pipe.nozzle)&&pipe.nozzle.length===3&&pipe.nozzle.every(Number.isFinite)?pipe.nozzle.slice():point(pipe),d=unit([num(pipe.dx,1),num(pipe.dy),num(pipe.dz)]),length=Math.max(.05,num(pipe.length,3)),radius=Math.max(.04,num(pipe.radius,.45)),r=orient(d),seed=num(pipe.id,1);
      if(fade(p)<=0)continue;
      const collar=solid('ring',p,[radius*.64,.035,radius*.64],pipe.hot?5:1,pipe.hot?[.85,.31,.08]:[.88,.55,.12],r,'pipe-warning');collar.emissive=pipe.hot?.25:.12;
      if(!pipe.hot)continue;
      const count=software?(tier?5:3):(tier===2?9:tier?7:4);
      for(let i=0;i<count;i++){
        const f=(time*1.8+i/count+hash(seed,i)*.13)%1,width=Math.min(radius*(.65+.9*f),length*.38),travel=width*.5+Math.max(0,length-width)*f;
        puff(add(p,d,travel),[width,width,width],[.68,.74,.74],(.32-.17*f)*(1-Math.abs(f-.5)*.3),.06,'steam');
      }
    }

    // Ages and centres are authoritative simulation values. The additional
    // lobes/sparks are deterministic visual detail; they cannot deal damage.
    for(const e of close((state.explosions||[]).filter(e=>num(e.age)>=0),software?6:12)){
      const age=Math.max(0,num(e.age)),life=Math.max(.01,num(e.life,.8)),t=age/life;if(t>=1)continue;
      const p=point(e),radius=Math.max(.1,num(e.radius,3)),seed=num(e.seed,num(e.id,1)),near=distance(p)<(software?18:42),density=near?(software?tier+2:tier*2+3):1;
      const expansion=radius*(.17+.57*(1-Math.exp(-t*7))),heat=clamp(1-t*1.8,0,1);
      if(age<.16)puff(p,[expansion*1.15,expansion*1.15,expansion*1.15],[1,.83,.38],.9*(1-age/.16),3.5,'blast-core');
      if(t<.6){const wave=radius*(.35+1.55*Math.sqrt(t));puff(p,[wave*2,Math.max(.025,radius*.025),wave*2],[1,.48,.12],.52*(1-t/.6),1.1,'shock-ring','ring');}
      for(let i=0;i<density;i++){
        const a=hash(seed,i)*Math.PI*2,h=hash(seed,i+19),reach=expansion*(.15+hash(seed,i+31)*.28),center=[p[0]+Math.cos(a)*reach,p[1]+(.15+h*.4)*radius*t,p[2]+Math.sin(a)*reach];
        const size=expansion*(.72+hash(seed,i+61)*.58),color=heat?[.36+.64*heat,.19+.38*heat,.08+.1*heat]:[.26,.245,.21];
        puff(center,[size,size*(.9+h*.3),size],color,(.68-t*.51)/Math.sqrt(density),heat*2.2,'fire-cloud');
      }
      if(t>.12)for(let i=0;i<Math.max(1,density-1);i++){
        const a=hash(seed,i+91)*Math.PI*2,spread=radius*(.12+t*.46),center=[p[0]+Math.cos(a)*spread,p[1]+radius*(t*.5+hash(seed,i+111)*.2),p[2]+Math.sin(a)*spread],size=radius*(.2+t*.55)*(1+hash(seed,i+131)*.3);
        puff(center,[size,size*.8,size],[.25,.24,.22],Math.sin(Math.PI*t)*.26/Math.sqrt(density),0,'blast-dust');
      }
    }

    // Rocket and grenade solids stay within the actual projectile collision
    // sphere, including their tip/fins. Trails alone extend behind that body.
    const trails=[];
    for(const q of close(state.projectiles)){
      if(q.kind!=='rocket'&&q.kind!=='grenade')continue;
      const p=point(q),radius=Math.max(.02,num(q.radius,q.kind==='rocket'?.24:.17));if(distance(p)>180+radius)continue;
      const velocity=[num(q.vx),num(q.vy),num(q.vz)],speed=Math.hypot(...velocity),d=speed>.001?unit(velocity):[0,0,-1],r=orient(d),near=distance(p)<(software?22:48),tint=q.owner==='player'?[.12,.56,.54]:[.62,.24,.08];
      if(q.kind==='rocket'){
        solid('cylinder',p,[radius*.48,radius*1.3,radius*.48],0,[.23,.27,.25],r,'rocket-body');
        solid('octa',add(p,d,radius*.65),[radius*.5,radius*.5,radius*.5],3,[.57,.56,.44],r,'rocket-nose');
        if(near){const tail=add(p,d,-radius*.55);solid('box',tail,[radius*1.1,radius*.35,radius*.14],0,tint,r,'rocket-fin');solid('box',tail,[radius*.14,radius*.35,radius*1.1],0,tint,r,'rocket-fin');}
        trails.push({q,p,d,speed,radius});
      }else{
        const rotation=[num(q.age)*4.3,num(q.age)*2.2,num(q.age)*3.1];
        solid('sphere',p,[radius*1.7,radius*1.7,radius*1.7],7,[.24,.28,.17],rotation,'grenade-body');
        if(near){const cap=rotate([0,radius*.72,0],rotation).map((v,k)=>v+p[k]);const m=solid('box',cap,[radius*.55,radius*.24,radius*.55],5,tint,rotation,'grenade-fuse');m.emissive=.25+.35*(1-clamp(num(q.fuse,2)/2,0,1));}
        trails.push({q,p,d,speed,radius});
      }
    }
    for(const {q,p,d,speed,radius} of trails){
      if(q.kind==='rocket'){
        const tail=add(p,d,-radius*.9),length=Math.min(3.2,Math.max(0,num(q.age))*speed);
        puff(tail,[radius*.6,radius*.6,radius*.6],[1,.63,.12],.8,3,'rocket-jet');
        const count=software?(tier?3:1):(tier===2?6:4);
        for(let i=0;i<count;i++){const f=(i+1)/(count+1),size=radius*(.7+f*1.7);puff(add(tail,d,-length*f),[size,size,size],[.45,.43,.38],.28*(1-f),0,'rocket-smoke');}
      }else if(num(q.fuse,2)<.7)puff(p,[radius*2.1,radius*2.1,radius*2.1],[1,.38,.08],.12+.1*Math.sin(time*35),.7,'grenade-warning');
    }
    for(const q of close(state.debris,debrisBudget)){
      const age=Math.max(0,num(q.age)),life=Math.max(.01,num(q.life,1.5));if(age>=life)continue;
      const p=point(q);if(fade(p)<=0)continue;
      const raw=Array.isArray(q.size)?q.size:[num(q.size,.12),num(q.size,.12),num(q.size,.12)],shrink=clamp((life-age)/(life*.24),0,1),s=raw.map(v=>clamp(num(v,.1),.015,3)*shrink);if(s.some(v=>v<.005))continue;
      const seed=num(q.seed,1),r=q.resting?[0,hash(seed,2)*Math.PI*2,0]:[age*(hash(seed,1)*5-2.5),age*(hash(seed,2)*5-2.5),age*(hash(seed,3)*5-2.5)];
      if(q.resting)p[1]-=(clamp(num(raw[1],.1),.015,3)-s[1])*.5;
      solid('box',p,s,clamp(num(q.mat,3),0,12),q.color,r,'debris');
    }
    return out;
  }
  function flash(state,camera){
    const eye=camera?.pos||[0,0,0];let value=0;
    for(const e of state?.explosions||[]){const age=num(e.age);if(age<0||age>.18)continue;const distance=Math.hypot(num(e.x)-eye[0],num(e.y)-eye[1],num(e.z)-eye[2]);value=Math.max(value,Math.exp(-age*22)/(1+distance*distance*.045));}
    return Math.min(.85,value);
  }
  G.FEffects={build,flash};
})(typeof window!=='undefined'?window:globalThis);
