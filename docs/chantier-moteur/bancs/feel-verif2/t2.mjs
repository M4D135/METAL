// FEEL-02/03 independent: why are hits not blocked in real combat? Split by cause. Also dt dependence.
import {load,rep,flat} from './L.mjs';
const patch=(n,src)=>n!=='simulation'?src:rep(src,"if(shieldFacing(source)&&s.shield.energy>0){","if(source&&globalThis.__H)globalThis.__H.push({raised:s.shield.raised,energy:s.shield.energy,facing:shieldFacing(source),sx:source.x-p.x,sy:source.y-p.y,sz:source.z-p.z,vx:source.vx,vz:source.vz,yaw:p.yaw,pitch:p.pitch,blast:!!source.blast,amount,t:s.time});if(shieldFacing(source)&&s.shield.energy>0){");
const patch2=(n,src)=>{src=patch(n,src);return n!=='simulation'?src:rep(src,"hurt(bullet.damage,true,{x:bullet.x,y:bullet.y,z:bullet.z})","hurt(bullet.damage,true,{x:bullet.x,y:bullet.y,z:bullet.z,vx:bullet.dx,vz:bullet.dz})");};
const W=load(['destruction','economy','simulation'],patch2);
const layouts={front:[[-3,-10,0],[0,-12,2],[3,-9,0]],heavy:[[-3,-10,0],[0,-12,2],[3,-9,0],[1,-8,1]],flank:[[-2,-10,0],[2,-10,2],[-9,-3,0],[9,-3,2]]};
function run(layout,{track,dt=1/60,T=30,jitter=0,immortal=false}){
  globalThis.__H=[];
  const sim=W.FSimulation.create(flat({enemies:layout.map(([x,z,type],i)=>({x:x+jitter*Math.sin(i*7.1),z:z+jitter*Math.cos(i*3.3),type}))}),{equipment:{right:0,left:'shield',shieldEnergy:100},armorSystem:true,armor:{version:1,points:0}});
  const s=sim.state,p=s.player;let t=0,up=0,n=0;
  while(t<T&&!s.dead){
    if(track){let best=null,bd=1e9;for(const e of s.enemies)if(e.hp>0){const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<bd){bd=d;best=e;}}if(best)p.yaw=Math.atan2(best.x-p.x,-(best.z-p.z));}
    sim.step(dt,{fireLeft:true});t+=dt;s.events.length=0;if(immortal)p.hp=100;up+=s.shield.raised;n++;
  }
  return {H:globalThis.__H,t,dead:s.dead,up:up/n};
}
function classify(H){
  const c={hits:0,blocked:0,guardDown:0,coneMissAz:0,coneMissVert:0,blast:0};const dys=[],dhs=[];
  for(const h of H){c.hits++;if(h.blast)c.blast++;
    if(h.raised&&h.facing&&h.energy>0){c.blocked++;}
    else if(!h.raised){c.guardDown++;}
    else{ // raised but not facing: would a purely horizontal test on arrival direction (cos>.55) have blocked?
      let hx=-(h.vx??-h.sx),hz=-(h.vz??-h.sz);const d=Math.hypot(hx,hz)||1;const f=(hx*Math.sin(h.yaw)-hz*Math.cos(h.yaw))/d;
      if(f>.55)c.coneMissVert++;else c.coneMissAz++;
    }
    if(!h.blast){dys.push(h.sy);dhs.push(Math.hypot(h.sx,h.sz));}
  }
  dys.sort((a,b)=>a-b);dhs.sort((a,b)=>a-b);const q=(a,f)=>a.length?a[Math.floor((a.length-1)*f)].toFixed(2):'-';
  c.srcY=`p10 ${q(dys,.1)} med ${q(dys,.5)} p90 ${q(dys,.9)}`;c.srcH=`p10 ${q(dhs,.1)} med ${q(dhs,.5)} p90 ${q(dhs,.9)}`;return c;
}
for(const dt of [1/60,1/120,1/30])for(const [name,layout] of Object.entries(layouts))for(const track of [false,true]){
  const agg={hits:0,blocked:0,guardDown:0,coneMissAz:0,coneMissVert:0,blast:0};let dead=0,tt=0,up=0;let last;
  for(let k=0;k<10;k++){const r=run(layout,{track,dt,jitter:k*.6});const c=classify(r.H);for(const key in agg)agg[key]+=c[key];dead+=r.dead;tt+=r.t;up+=r.up;last=c;}
  console.log(`dt=1/${Math.round(1/dt)} ${name} ${track?'track':'fixe '} morts ${dead}/10 survie ${(tt/10).toFixed(1)}s garde levee ${(up*10).toFixed(0)}% |`,JSON.stringify(agg),'| srcY(rel pieds)',last.srcY,'| srcH',last.srcH);
}
