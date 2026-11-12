import { create } from '../phys/fphys.mjs';
const HZ=120;
for(const [label,o,sub] of [['2+1 it. (defaut)',{},1],['4+2 it.',{iterations:4,relaxIterations:2},1],['8+2 it.',{iterations:8,relaxIterations:2},1],['2+1 it., 2 sous-pas',{},2],['2+1 it., 4 sous-pas',{},4]]){
  // pile 8,8,8,8,150
  let w=create({capacity:32,sleepTime:1e9,...o}); w.buildStatics(); const ids=[],m=[8,8,8,8,150]; for(let i=0;i<5;i++)ids.push(w.addBox(0,0.4+i*0.8,0,0.4,0.4,0.4,m[i],0.6,0.1));
  const t0=performance.now(); for(let i=0;i<10*HZ;i++)w.step(1/HZ,sub); const ms=(performance.now()-t0)/(10*HZ)*1000; let h=0;for(const b of ids)h=Math.max(h,Math.hypot(w.P[b*3],w.P[b*3+2]));
  // dalle 160 sur éclats 0,035 et 0,5
  const r=[];for(const mc of [0.035,0.5]){w=create({capacity:32,...o}); w.buildStatics(); const chips=[]; for(let k=0;k<6;k++)chips.push(w.addBox(-0.3+0.3*(k%3),0.05,-0.15+0.3*((k/3)|0),0.05,0.05,0.05,mc,0.7,0.16)); const slab=w.addBox(0,0.5,0,0.5,0.1,0.5,160,0.7,0.16); for(let i=0;i<10*HZ;i++)w.step(1/HZ,sub); r.push(((w.P[slab*3+1]-0.1)*1000).toFixed(0));}
  console.log(`${label.padEnd(22)}: pile 8,8,8,8,150 ecart horiz. a 10 s ${(h*1000).toFixed(0)} mm (${ms.toFixed(0)} us/pas) ; dalle 160 sur eclats 0,035 / 0,5 : dessous final a ${r[0]} / ${r[1]} mm (ideal 100)`);
}
// poussée lente d'une caisse sur des dalles jointives (joueur qui pousse : vitesse plafonnée à ~2,5 m/s)
for(const tiles of [1,24]) for(const vmax of [1.5,2.5,4]){
  const w=create({capacity:8,sleepTime:1e9}); if(tiles===1)w.addStatic(-12,0,-2,12,1,2); else for(let k=0;k<tiles;k++)w.addStatic(-12+k,0,-2,-11+k,1,2); w.buildStatics();
  const b=w.addBox(-11.3,1.395,0.137,0.4,0.4,0.4,30,0.6,0.1); for(let i=0;i<60;i++)w.step(1/HZ,1);
  let stops=0,pv=0,tilt=0,hop=0; for(let i=0;i<6*HZ;i++){ if(w.V[b*6]<vmax)w.impulseAt(b,w.P[b*3]-0.4,w.P[b*3+1]-0.1,w.P[b*3+2],30*20/HZ,0,0); w.step(1/HZ,1); const v=w.V[b*6]; if(pv-v>0.5*vmax&&pv>0.5*vmax)stops++; pv=v; tilt=Math.max(tilt,1-Math.abs(w.R[b*9+4])); hop=Math.max(hop,w.P[b*3+1]-1.4);}
  console.log(`poussee ${vmax} m/s sur ${tiles===1?'1 dalle':'24 dalles'}: distance ${(w.P[b*3]+11.3).toFixed(2)} m en 6 s, coups d'arret ${stops}, saut ${(hop*1000).toFixed(0)} mm, inclinaison max ${(Math.acos(1-tilt)*180/Math.PI).toFixed(1)} deg`);
}
