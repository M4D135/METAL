// Decompose the proposed shield gain: (A) current, (B) energy/absorption only with the CURRENT cone,
// (C) arc only (horizontal +-70deg vs projectile direction) with CURRENT energy, (D) both.
// usage: node guard-split.mjs <root> [seconds=30] [variants=10]
import {vload,arena} from './vload.mjs';
const root=process.argv[2],T=+process.argv[3]||30,V=+process.argv[4]||10;
function mk({energy,arc}){
  return (n,src)=>{if(n!=='simulation')return src;const rep=(a,b)=>{if(!src.includes(a))throw new Error('anchor '+a.slice(0,50));src=src.replace(a,b);};
    if(arc){rep("const dx=source.x-p.x,dy=source.y-(p.y+1.25),dz=source.z-p.z,d=Math.hypot(dx,dy,dz),cp=Math.cos(p.pitch);\n      return d>.08&&(dx*Math.sin(p.yaw)*cp+dy*Math.sin(p.pitch)-dz*Math.cos(p.yaw)*cp)/d>.55;",
      "let hx,hz;if(Number.isFinite(source.vx)){hx=-source.vx;hz=-source.vz;}else{hx=source.x-p.x;hz=source.z-p.z;}const d=Math.hypot(hx,hz);if(source.blast&&d<1)return false;if(d<.05)return true;return (hx*Math.sin(p.yaw)-hz*Math.cos(p.yaw))/d>.34;");
      rep("hurt(bullet.damage,true,{x:bullet.x,y:bullet.y,z:bullet.z})","hurt(bullet.damage,true,{x:bullet.x,y:bullet.y,z:bullet.z,vx:bullet.dx,vz:bullet.dz})");}
    if(energy){rep("const absorbed=Math.min(amount*(source.blast?.55:.8),s.shield.energy/1.5);s.shield.energy=Math.max(0,s.shield.energy-absorbed*1.5);s.shield.rechargeDelay=2.2;amount-=absorbed;",
        "const absorbed=Math.min(amount*(source.blast?.75:1),s.shield.energy);s.shield.energy=Math.max(0,s.shield.energy-absorbed);s.shield.rechargeDelay=1.2;amount-=absorbed;");
      rep("if(s.shield.energy<=.01)s.shield.raised=false;","if(s.shield.energy<=.01){s.shield.raised=false;s.shield.rechargeDelay=1.6;}");
      rep("p.hp=Math.max(0,p.hp-amount);s.damage=1;s.combo=0;s.comboTime=0;emit('hurt');","if(amount<=.01)return;p.hp=Math.max(0,p.hp-amount);s.damage=1;s.combo=0;s.comboTime=0;emit('hurt');");
      rep("q.energy>(q.raised?.01:8);","q.energy>(q.raised?.01:25);");
      rep("if(q.raised){q.energy=Math.max(0,q.energy-dt*2.5);if(!q.energy){q.raised=false;q.rechargeDelay=2.2;}}\n      else if(q.rechargeDelay<=0)q.energy=Math.min(100,q.energy+dt*18);",
        "if(q.raised){q.energy=Math.min(100,Math.max(0,q.energy-dt*1.5+(q.rechargeDelay<=0?dt*6:0)));if(!q.energy){q.raised=false;q.rechargeDelay=1.6;}}\n      else if(q.rechargeDelay<=0)q.energy=Math.min(100,q.energy+dt*28);");}
    return src;};
}
const layouts={front:[[-3,-10,0],[0,-12,2],[3,-9,0]],heavy:[[-3,-10,0],[0,-12,2],[3,-9,0],[1,-8,1]],flank:[[-2,-10,0],[2,-10,2],[-9,-3,0],[9,-3,2]]};
const variants={'A actuel':{},'B energie seule':{energy:true},'C arc seul':{arc:true},'D les deux':{energy:true,arc:true}};
const Ws=Object.fromEntries(Object.entries(variants).map(([k,v])=>[k,vload(root,['destruction','economy','simulation'],mk(v))]));
for(const track of [0,1])for(const [name,layout] of Object.entries(layouts)){
  const row={};
  for(const [k,W] of Object.entries(Ws)){let dead=0,surv=0,hp=0;
    for(let i=0;i<V;i++){const sim=W.FSimulation.create(arena({enemies:layout.map(([x,z,type],j)=>({x:x+i*.6*Math.sin(j*7.1),z:z+i*.6*Math.cos(j*3.3),type}))}),{equipment:{right:0,left:'shield',shieldEnergy:100},armorSystem:true,armor:{version:1,points:0}});
      const s=sim.state,p=s.player;let t=0,lost=0;while(t<T&&!s.dead){if(track){let b=null,bd=1e9;for(const e of s.enemies)if(e.hp>0){const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<bd){bd=d;b=e;}}if(b)p.yaw=Math.atan2(b.x-p.x,-(b.z-p.z));}const h0=p.hp;sim.step(1/60,{fireLeft:true});lost+=Math.max(0,h0-p.hp);t+=1/60;s.events.length=0;}
      dead+=s.dead;surv+=t;hp+=lost;}
    row[k]=`${dead}/${V} morts, ${(surv/V).toFixed(1)} s, ${(hp/V).toFixed(0)} PV`;}
  console.log((track?'suivi ':'fixe  ')+name.padEnd(6),JSON.stringify(row));
}
