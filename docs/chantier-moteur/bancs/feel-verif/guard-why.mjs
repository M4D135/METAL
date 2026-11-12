// Why are hits not blocked in a frontal firefight? Classify each player hit (current rules).
// usage: node guard-why.mjs <root> [seconds=30] [variants=10] [track=0]
import {vload,arena} from './vload.mjs';
const root=process.argv[2],T=+process.argv[3]||30,V=+process.argv[4]||10,TRACK=process.argv[5]==='1';
const head='function hurt(amount,difficulty=true,source=null){';
const patch=(n,src)=>{if(n!=='simulation')return src;if(!src.includes(head))throw new Error('anchor');
  return src.replace(head,head+"const __e0=s.shield?s.shield.energy:0,__r0=!!(s.shield&&s.shield.raised),__hp0=p.hp,__fac=shieldFacing(source);try{return __h(amount,difficulty,source);}finally{(G.__LOG||(G.__LOG=[])).push({t:s.time,raised:__r0,energy:__e0,facing:__fac,blocked:s.shield?s.shield.energy<__e0-1e-9:false,src:source?{...source}:null,yaw:p.yaw,pitch:p.pitch,px:p.x,py:p.y,pz:p.z,dash:p.dashing>0,hp:__hp0-p.hp});}}function __h(amount,difficulty=true,source=null){");};
const W=vload(root,['destruction','economy','simulation'],patch);
const layouts={front:[[-3,-10,0],[0,-12,2],[3,-9,0]],flank:[[-2,-10,0],[2,-10,2],[-9,-3,0],[9,-3,2]]};
for(const [name,layout] of Object.entries(layouts)){
  const agg={hits:0,noSource:0,raised:0,lowered:0,front45:0,front45Raised:0,front45RaisedEnergy:0,front45Blocked:0,side:0,rear:0,blocked:0,deaths:0,surv:0,lowerHits:0};
  const vert=[];
  for(let k=0;k<V;k++){
    W.__LOG=[];const sim=W.FSimulation.create(arena({enemies:layout.map(([x,z,type],i)=>({x:x+k*.6*Math.sin(i*7.1),z:z+k*.6*Math.cos(i*3.3),type}))}),{equipment:{right:0,left:'shield',shieldEnergy:100},armorSystem:true,armor:{version:1,points:0}});
    const s=sim.state,p=s.player;let t=0;
    while(t<T&&!s.dead){if(TRACK){let b=null,bd=1e9;for(const e of s.enemies)if(e.hp>0){const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<bd){bd=d;b=e;}}if(b)p.yaw=Math.atan2(b.x-p.x,-(b.z-p.z));}sim.step(1/60,{fireLeft:true});t+=1/60;s.events.length=0;}
    agg.deaths+=s.dead;agg.surv+=t;
    for(const h of W.__LOG){agg.hits++;if(!h.src){agg.noSource++;continue;}
      const dx=h.src.x-h.px,dz=h.src.z-h.pz,az=Math.abs(Math.atan2(dx*Math.cos(h.yaw)+dz*Math.sin(h.yaw),dx*Math.sin(h.yaw)-dz*Math.cos(h.yaw))*180/Math.PI);
      if(h.raised)agg.raised++;else agg.lowered++;if(h.blocked)agg.blocked++;
      if(az<=45){agg.front45++;if(h.raised){agg.front45Raised++;if(h.energy>0){agg.front45RaisedEnergy++;if(h.blocked)agg.front45Blocked++;else vert.push(+(h.src.y-(h.py+1.25)).toFixed(2));}}}
      else if(az<=100)agg.side++;else agg.rear++;}
  }
  agg.surv=+(agg.surv/V).toFixed(1);
  console.log(name,JSON.stringify(agg));
  console.log('  frontal(<=45deg), garde levee, energie>0 mais non bloque: dy des sources =',JSON.stringify(vert.slice(0,30)));
}
