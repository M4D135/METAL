/* FERRO — deterministic world and real-time gameplay. No DOM or rendering dependencies. */
(function (G) {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function create(world) {
    const p={x:world.spawn.x,z:world.spawn.z,yaw:world.spawn.yaw,pitch:0,hp:100,heat:0,overheated:false,dash:0,dashing:0};
    const s={world,player:p,time:0,elapsed:0,won:false,dead:false,kills:0,shots:0,hits:0,relays:0,flash:0,damage:0,hitMarker:0,events:[],bullets:[],particles:[],
      enemies:world.enemies.map((e,i)=>({...e,id:i,hp:[3,5,4][e.type],maxHp:[3,5,4][e.type],y:[1.35,1.05,1.6][e.type],active:false,cooldown:1.2+i*.15,hurt:0})),
      cores:world.cores.map(c=>({...c,taken:false})),pickups:world.pickups.map(c=>({...c,taken:false}))};
    let fireWait=0,navWait=0;
    const solids=world.colliders.filter(b=>b.minY<1.8&&b.maxY>.06),b=world.bounds;
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
      if(s.particles.length>160)s.particles.splice(0,s.particles.length-160);
    }
    function hurt(amount){if(p.dashing>0||s.dead||s.won)return;p.hp=Math.max(0,p.hp-amount);s.damage=1;emit('hurt');if(!p.hp){s.dead=true;emit('dead');}}
    function fire(assist=false){
      if(s.dead||s.won||fireWait>0||p.overheated)return false;
      fireWait=.165;p.heat=Math.min(1,p.heat+.12);if(p.heat>=.99){p.overheated=true;emit('overheat');}
      const dir=[Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch)];
      const origin=[p.x,1.62,p.z];let distance=ray(origin,dir,75),victim=null;
      for(const e of s.enemies)if(e.hp>0){
        const d=[e.x-origin[0],e.y-origin[1],e.z-origin[2]],along=d[0]*dir[0]+d[1]*dir[1]+d[2]*dir[2];
        if(along<0||along>distance+.6)continue;
        const radius=.67+(assist?Math.min(.38,along*.025):0),perp=d[0]*d[0]+d[1]*d[1]+d[2]*d[2]-along*along;
        if(perp>radius*radius)continue;
        const hit=Math.max(0,along-Math.sqrt(radius*radius-perp));
        if(hit<distance){distance=hit;victim=e;}
      }
      s.flash=1;s.shots++;emit('shot');
      if(victim){victim.hp--;victim.hurt=.2;victim.active=true;s.hits++;s.hitMarker=.18;emit('hit');particles(victim.x,victim.y,victim.z,5);
        if(victim.hp<=0){s.kills++;emit('kill');particles(victim.x,victim.y,victim.z,6,18);}}
      else particles(origin[0]+dir[0]*distance,origin[1]+dir[1]*distance,origin[2]+dir[2]*distance,5,4);
      return true;
    }
    function step(dt,input={}){
      dt=clamp(dt,0,.05);if(s.won||s.dead)return;
      s.time+=dt;s.elapsed+=dt;fireWait-=dt;navWait-=dt;
      s.flash=Math.max(0,s.flash-dt*9);s.damage=Math.max(0,s.damage-dt*1.9);s.hitMarker=Math.max(0,s.hitMarker-dt);
      p.yaw+=(input.lookX||0);p.pitch=clamp(p.pitch+(input.lookY||0),-1.2,1.2);
      p.heat=Math.max(0,p.heat-dt*(fireWait>0?.1:.35));if(p.overheated&&p.heat<.3){p.overheated=false;emit('cooled');}
      p.dash=Math.max(0,p.dash-dt);p.dashing=Math.max(0,p.dashing-dt);
      if(input.dash&&p.dash<=0){p.dash=1.7;p.dashing=.2;emit('dash');}
      let mx=input.moveX||0,my=input.moveY||0,len=Math.hypot(mx,my);if(len>1){mx/=len;my/=len;}
      if(p.dashing>0&&len<.1)my=1;
      const speed=p.dashing>0?12:input.sprint?5.8:4.2,dx=(Math.cos(p.yaw)*mx+Math.sin(p.yaw)*my)*speed*dt,dz=(Math.sin(p.yaw)*mx-Math.cos(p.yaw)*my)*speed*dt;
      move(p,dx,dz);s.moving=Math.hypot(dx,dz)/Math.max(dt,.001);
      if(input.fire)fire(input.assist);
      if(navWait<=0){rebuildNav();navWait=.6;}
      let threat=0;
      for(const e of s.enemies){
        if(e.hp<=0)continue;e.hurt=Math.max(0,e.hurt-dt);e.cooldown-=dt;
        let dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz),clear=d<23&&sight(e.x,e.z,p.x,p.z);
        if(clear&&d<18)e.active=true;
        if(!e.active)continue;
        if(d<18)threat++;
        if(e.type!==2&&d>3.2){
          if(!clear){const i=idx(e.x,e.z);let best=i;for(let iz=-1;iz<=1;iz++)for(let ix=-1;ix<=1;ix++){
            const j=i+iz*nx+ix;if(j>=0&&j<nav.length&&nav[j]&&dist[j]>=0&&(dist[best]<0||dist[j]<dist[best])&&sight(e.x,e.z,...coord(j)))best=j;
          }const target=coord(best);dx=target[0]-e.x;dz=target[1]-e.z;}
          const n=Math.hypot(dx,dz);if(n>.1){const v=[1.45,.82,0][e.type];move(e,dx/n*v*dt,dz/n*v*dt,.38);}
        }
        if(clear&&d<19&&e.cooldown<=0){
          e.cooldown=[2.2,2.8,2.05][e.type]-.15*world.stage;
          const vx=p.x-e.x,vy=1.45-e.y,vz=p.z-e.z,n=Math.hypot(vx,vy,vz),v=[7.2,6,8][e.type];
          s.bullets.push({x:e.x,y:e.y,z:e.z,dx:vx/n*v,dy:vy/n*v,dz:vz/n*v,life:4,damage:[8,13,10][e.type]});
        }
      }
      s.threat=Math.min(1,threat/4);
      for(const bullet of s.bullets){
        const v=Math.hypot(bullet.dx,bullet.dy,bullet.dz),travel=v*dt,hit=ray([bullet.x,bullet.y,bullet.z],[bullet.dx/v,bullet.dy/v,bullet.dz/v],travel+.02);
        if(hit<travel){bullet.life=0;continue;}
        bullet.x+=bullet.dx*dt;bullet.y+=bullet.dy*dt;bullet.z+=bullet.dz*dt;bullet.life-=dt;
        if(Math.hypot(bullet.x-p.x,bullet.z-p.z)<.42&&bullet.y>.1&&bullet.y<1.95){hurt(bullet.damage);bullet.life=0;}
      }
      s.bullets=s.bullets.filter(v=>v.life>0);
      if(s.dead)return;
      for(const c of s.cores)if(!c.taken&&Math.hypot(p.x-c.x,p.z-c.z)<1.35){c.taken=true;s.relays++;p.hp=Math.min(100,p.hp+18);emit('core',{count:s.relays});particles(c.x,1.2,c.z,4,18);}
      for(const c of s.pickups)if(!c.taken&&p.hp<99&&Math.hypot(p.x-c.x,p.z-c.z)<1){c.taken=true;p.hp=Math.min(100,p.hp+35);emit('pickup');}
      for(const q of s.particles){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.vy-=dt*3;}
      s.particles=s.particles.filter(q=>q.life>0);
      if(s.relays===3&&Math.hypot(p.x-world.exit.x,p.z-world.exit.z)<1.5&&!s.dead){s.won=true;emit('win');}
    }
    rebuildNav();
    return {state:s,step,fire,blocked,move,ray,sight,hurt,nav:{cells:nav,dist,nx,nz,cell,coord,idx,rebuild:rebuildNav}};
  }
  G.FSimulation={create,clamp};
})(typeof window!=='undefined'?window:globalThis);
