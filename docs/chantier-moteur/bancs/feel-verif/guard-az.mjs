// Azimuth histogram of hits (current rules) + what a horizontal +-70deg arc would add, energy aside.
import {vload,arena} from './vload.mjs';
const root=process.argv[2],T=+process.argv[3]||30,V=+process.argv[4]||10;
const head='function hurt(amount,difficulty=true,source=null){';
const patch=(n,src)=>n!=='simulation'?src:src.replace(head,head+"const __e0=s.shield?s.shield.energy:0,__r0=!!(s.shield&&s.shield.raised);try{return __h(amount,difficulty,source);}finally{(G.__LOG||(G.__LOG=[])).push({raised:__r0,energy:__e0,blocked:s.shield?s.shield.energy<__e0-1e-9:false,src:source?{...source}:null,yaw:p.yaw,pitch:p.pitch,px:p.x,py:p.y,pz:p.z});}}function __h(amount,difficulty=true,source=null){");
const W=vload(root,['destruction','economy','simulation'],patch);
const layouts={front:[[-3,-10,0],[0,-12,2],[3,-9,0]],heavy:[[-3,-10,0],[0,-12,2],[3,-9,0],[1,-8,1]],flank:[[-2,-10,0],[2,-10,2],[-9,-3,0],[9,-3,2]]};
for(const track of [0,1])for(const [name,layout] of Object.entries(layouts)){
  const bins=[0,0,0,0,0,0,0];const edges=[30,45,55,70,90,135,181];let total=0,blk=0,raisedLow=0,add70=0,heights=[];
  for(let k=0;k<V;k++){W.__LOG=[];const sim=W.FSimulation.create(arena({enemies:layout.map(([x,z,type],i)=>({x:x+k*.6*Math.sin(i*7.1),z:z+k*.6*Math.cos(i*3.3),type}))}),{equipment:{right:0,left:'shield',shieldEnergy:100},armorSystem:true,armor:{version:1,points:0}});
    const s=sim.state,p=s.player;let t=0;while(t<T&&!s.dead){if(track){let b=null,bd=1e9;for(const e of s.enemies)if(e.hp>0){const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<bd){bd=d;b=e;}}if(b)p.yaw=Math.atan2(b.x-p.x,-(b.z-p.z));}sim.step(1/60,{fireLeft:true});t+=1/60;s.events.length=0;}
    for(const h of W.__LOG){if(!h.src)continue;total++;blk+=h.blocked;const dx=h.src.x-h.px,dz=h.src.z-h.pz;const az=Math.abs(Math.atan2(dx*Math.cos(h.yaw)+dz*Math.sin(h.yaw),dx*Math.sin(h.yaw)-dz*Math.cos(h.yaw))*180/Math.PI);
      bins[edges.findIndex(e=>az<e)]++;if(!h.blocked&&h.raised&&h.energy>0&&az<=70)add70++;heights.push(h.src.y-h.py);}}
  heights.sort((a,b)=>a-b);const q=f=>heights[Math.floor(f*(heights.length-1))].toFixed(2);
  console.log(`${name}${track?' suivi':' fixe'}: coups ${total}, bloques ${blk} (${(blk/total*100).toFixed(0)}%) | azimut <30:${bins[0]} 30-45:${bins[1]} 45-55:${bins[2]} 55-70:${bins[3]} 70-90:${bins[4]} 90-135:${bins[5]} >135:${bins[6]} | non bloques garde levee+energie dans 70deg: ${add70} | hauteur source/pieds p10 ${q(.1)} p50 ${q(.5)} p90 ${q(.9)}`);
}
