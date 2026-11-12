// FEEL-02 vs FEEL-03 attribution: geometry-only, economy-only, both. Own patches (main realm).
import {load,rep,flat} from './L.mjs';
const CUR={geo:null,direct:.8,blast:.55,cost:1.5,delay:2.2,breakDelay:2.2,raise:8,drain:2.5,recharge:18,holdRegen:0};
const ECO={direct:1,blast:.75,cost:1,delay:1.2,breakDelay:1.6,raise:25,drain:1.5,recharge:28,holdRegen:6};
function mk(P){return (n,src)=>{ if(n!=='simulation')return src;
  src=rep(src,"if(shieldFacing(source)&&s.shield.energy>0){","if(source&&globalThis.__H)globalThis.__H.push({raised:s.shield.raised,ok:shieldFacing(source)&&s.shield.energy>0,amount});if(shieldFacing(source)&&s.shield.energy>0){");
  src=rep(src,"hurt(bullet.damage,true,{x:bullet.x,y:bullet.y,z:bullet.z})","hurt(bullet.damage,true,{x:bullet.x,y:bullet.y,z:bullet.z,vx:bullet.dx,vz:bullet.dz})");
  if(P.geo!=null)src=rep(src,"const dx=source.x-p.x,dy=source.y-(p.y+1.25),dz=source.z-p.z,d=Math.hypot(dx,dy,dz),cp=Math.cos(p.pitch);\n      return d>.08&&(dx*Math.sin(p.yaw)*cp+dy*Math.sin(p.pitch)-dz*Math.cos(p.yaw)*cp)/d>.55;",
    `let hx,hz;if(Number.isFinite(source.vx)){hx=-source.vx;hz=-source.vz;}else{hx=source.x-p.x;hz=source.z-p.z;}const d=Math.hypot(hx,hz);if(source.blast&&d<1)return false;if(d<.05)return true;return (hx*Math.sin(p.yaw)-hz*Math.cos(p.yaw))/d>${P.geo};`);
  src=rep(src,"const absorbed=Math.min(amount*(source.blast?.55:.8),s.shield.energy/1.5);s.shield.energy=Math.max(0,s.shield.energy-absorbed*1.5);s.shield.rechargeDelay=2.2;amount-=absorbed;",
    `const absorbed=Math.min(amount*(source.blast?${P.blast}:${P.direct}),s.shield.energy/${P.cost});s.shield.energy=Math.max(0,s.shield.energy-absorbed*${P.cost});s.shield.rechargeDelay=${P.delay};amount-=absorbed;`);
  src=rep(src,"if(s.shield.energy<=.01)s.shield.raised=false;",`if(s.shield.energy<=.01){s.shield.raised=false;s.shield.rechargeDelay=${P.breakDelay};}`);
  src=rep(src,"q.energy>(q.raised?.01:8);",`q.energy>(q.raised?.01:${P.raise});`);
  src=rep(src,"if(q.raised){q.energy=Math.max(0,q.energy-dt*2.5);if(!q.energy){q.raised=false;q.rechargeDelay=2.2;}}\n      else if(q.rechargeDelay<=0)q.energy=Math.min(100,q.energy+dt*18);",
    `if(q.raised){q.energy=Math.min(100,Math.max(0,q.energy-dt*${P.drain}+(q.rechargeDelay<=0?dt*${P.holdRegen}:0)));if(!q.energy){q.raised=false;q.rechargeDelay=${P.breakDelay};}}\n      else if(q.rechargeDelay<=0)q.energy=Math.min(100,q.energy+dt*${P.recharge});`);
  return src;};}
const V={'A actuel':CUR,'B geo dir ±56.6 seule':{...CUR,geo:.55},'C geo ±70 seule':{...CUR,geo:.34},'D eco seule':{...CUR,...ECO},'E geo±70+eco':{...CUR,...ECO,geo:.34},
 'F eco sans regen tenue':{...CUR,...ECO,holdRegen:0},'G eco: seulement absorb100+cout1':{...CUR,direct:1,cost:1}};
const sims={};for(const k in V)sims[k]=load(['destruction','economy','simulation'],mk(V[k])).FSimulation;
const layouts={front:[[-3,-10,0],[0,-12,2],[3,-9,0]],heavy:[[-3,-10,0],[0,-12,2],[3,-9,0],[1,-8,1]],flank:[[-2,-10,0],[2,-10,2],[-9,-3,0],[9,-3,2]]};
const T=+process.argv[2]||30;
for(const [name,layout] of Object.entries(layouts))for(const track of [false,true]){
  const row=[];
  for(const k in V){let dead=0,tt=0,hits=0,blk=0,hp=0,up=0,n=0;
    for(let j=0;j<10;j++){globalThis.__H=[];const jitter=j*.6;
      const sim=sims[k].create(flat({enemies:layout.map(([x,z,type],i)=>({x:x+jitter*Math.sin(i*7.1),z:z+jitter*Math.cos(i*3.3),type}))}),{equipment:{right:0,left:'shield',shieldEnergy:100},armorSystem:true,armor:{version:1,points:0}});
      const s=sim.state,p=s.player;let t=0;
      while(t<T&&!s.dead){if(track){let best=null,bd=1e9;for(const e of s.enemies)if(e.hp>0){const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<bd){bd=d;best=e;}}if(best)p.yaw=Math.atan2(best.x-p.x,-(best.z-p.z));}
        sim.step(1/60,{fireLeft:true});t+=1/60;s.events.length=0;up+=s.shield.raised;n++;}
      dead+=s.dead;tt+=t;hits+=globalThis.__H.length;blk+=globalThis.__H.filter(h=>h.ok).length;hp+=100-p.hp;}
    row.push(`${k}: ${dead}/10 morts ${(tt/10).toFixed(1)}s bloq ${blk}/${hits}=${(blk/hits*100).toFixed(0)}% levee ${(up/n*100).toFixed(0)}%`);
  }
  console.log(`== ${name} ${track?'track':'fixe'}\n  `+row.join('\n  '));
}
