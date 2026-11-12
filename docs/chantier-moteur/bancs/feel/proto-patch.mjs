// Prototype guard rules, injected IN MEMORY into simulation.js (repo untouched).
import {hurtProbe} from './load.mjs';
export function protoPatch(P){
  return (name,src)=>{
    src=hurtProbe(name,src);if(name!=='simulation')return src;
    const rep=(a,b)=>{if(!src.includes(a))throw new Error('patch anchor missing: '+a.slice(0,60));src=src.replace(a,b);};
    // 1) horizontal arc, measured against the projectile's travel direction (or the attacker position)
    rep("const dx=source.x-p.x,dy=source.y-(p.y+1.25),dz=source.z-p.z,d=Math.hypot(dx,dy,dz),cp=Math.cos(p.pitch);\n      return d>.08&&(dx*Math.sin(p.yaw)*cp+dy*Math.sin(p.pitch)-dz*Math.cos(p.yaw)*cp)/d>.55;",
        `let hx,hz;if(Number.isFinite(source.vx)){hx=-source.vx;hz=-source.vz;}else{hx=source.x-p.x;hz=source.z-p.z;}const d=Math.hypot(hx,hz);if(source.blast&&d<${P.blastMin})return false;if(d<.05)return true;return (hx*Math.sin(p.yaw)-hz*Math.cos(p.yaw))/d>${P.arc};`);
    rep("hurt(bullet.damage,true,{x:bullet.x,y:bullet.y,z:bullet.z})","hurt(bullet.damage,true,{x:bullet.x,y:bullet.y,z:bullet.z,vx:bullet.dx,vz:bullet.dz})");
    // 2) absorption / cost / delay, and no damage feedback for a fully absorbed hit
    rep("const absorbed=Math.min(amount*(source.blast?.55:.8),s.shield.energy/1.5);s.shield.energy=Math.max(0,s.shield.energy-absorbed*1.5);s.shield.rechargeDelay=2.2;amount-=absorbed;",
        `const absorbed=Math.min(amount*(source.blast?${P.blast}:${P.direct}),s.shield.energy/${P.cost});s.shield.energy=Math.max(0,s.shield.energy-absorbed*${P.cost});s.shield.rechargeDelay=${P.delay};amount-=absorbed;`);
    rep("if(s.shield.energy<=.01)s.shield.raised=false;",`if(s.shield.energy<=.01){s.shield.raised=false;s.shield.rechargeDelay=${P.breakDelay};}`);
    rep("p.hp=Math.max(0,p.hp-amount);s.damage=1;s.combo=0;s.comboTime=0;emit('hurt');",`if(${P.quiet}&&amount<=.01)return;p.hp=Math.max(0,p.hp-amount);s.damage=1;s.combo=0;s.comboTime=0;emit('hurt');`);
    // 3) raise threshold, drain, recharge, regen while held
    rep("q.energy>(q.raised?.01:8);",`q.energy>(q.raised?.01:${P.raise});`);
    rep("if(q.raised){q.energy=Math.max(0,q.energy-dt*2.5);if(!q.energy){q.raised=false;q.rechargeDelay=2.2;}}\n      else if(q.rechargeDelay<=0)q.energy=Math.min(100,q.energy+dt*18);",
        `if(q.raised){q.energy=Math.max(0,q.energy-dt*${P.drain}+(q.rechargeDelay<=0?dt*${P.holdRegen}:0));q.energy=Math.min(100,q.energy);if(!q.energy){q.raised=false;q.rechargeDelay=${P.breakDelay};}}
      else if(q.rechargeDelay<=0)q.energy=Math.min(100,q.energy+dt*${P.recharge});`);
    return src;
  };
}
export const PROPOSED={arc:.34,direct:1,blast:.75,blastMin:1.0,cost:1,delay:1.2,breakDelay:1.6,raise:25,drain:1.5,recharge:28,holdRegen:6,quiet:true};
