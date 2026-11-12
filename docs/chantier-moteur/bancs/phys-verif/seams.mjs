import { create } from '../phys/fphys.mjs';
const HZ=120;
// T5b : glissade sur dalles jointives selon la vitesse et la tolérance d'appui (slop)
for(const slop of [0.005,0.002,0]) for(const speed of [1.5,3,6,9]){
  const res=[];
  for(const tiles of [1,24]){
    const w=create({capacity:8,sleepTime:1e9,slop}); if(tiles===1)w.addStatic(-12,0,-2,12,1,2); else for(let k=0;k<tiles;k++)w.addStatic(-12+k,0,-2,-11+k,1,2);
    w.buildStatics(); const b=w.addBox(-11.3,1.4-slop,0.137,0.4,0.4,0.4,30,0.6,0.1); for(let i=0;i<60;i++)w.step(1/HZ,1); w.V[b*6]=speed;
    let hop=0,tilt=0,stops=0,pv=speed; for(let i=0;i<4*HZ;i++){w.step(1/HZ,1);hop=Math.max(hop,w.P[b*3+1]-1.4);tilt=Math.max(tilt,1-Math.abs(w.R[b*9+4]));const v=w.V[b*6];if(pv-v>0.25*speed&&pv>0.3)stops++;pv=v;}
    res.push(`${tiles===1?'1 dalle':'24 dalles'}: ${(w.P[b*3]+11.3).toFixed(2)} m, saut ${(hop*1000).toFixed(0)} mm, inclin. ${(Math.acos(1-tilt)*180/Math.PI).toFixed(1)} deg, coups d'arret ${stops}`);
  }
  console.log(`T5b slop ${slop*1000} mm, ${speed} m/s -> ${res.join(' | ')}`);
}
// T5c : caisse poussée le long d'un mur fait de 12 boîtes bout à bout (face verticale coplanaire), force constante vers le mur + le long
for(const parts of [1,12]){
  const w=create({capacity:8,sleepTime:1e9}); if(parts===1)w.addStatic(-6,0,0.4,6,3,0.8); else for(let k=0;k<parts;k++)w.addStatic(-6+k,0,0.4,-5+k,3,0.8); w.buildStatics();
  const b=w.addBox(-5.3,0.395,0,0.4,0.4,0.4,30,0.6,0.1); for(let i=0;i<60;i++)w.step(1/HZ,1);
  let stops=0,pv=0,yaw=0; for(let i=0;i<4*HZ;i++){w.impulseAt(b,w.P[b*3],w.P[b*3+1],w.P[b*3+2],30*14/HZ,0,30*6/HZ);w.step(1/HZ,1);const v=w.V[b*6];if(pv-v>0.4&&pv>0.5)stops++;pv=v;yaw=Math.max(yaw,1-Math.abs(w.R[b*9]));}
  console.log(`T5c caisse poussee le long d'un mur en ${parts} boite(s): distance ${(w.P[b*3]+5.3).toFixed(2)} m, coups d'arret ${stops}, rotation max ${(Math.acos(1-yaw)*180/Math.PI).toFixed(1)} deg`);
}
// T2b : masses réelles des gravats (destruction.js:223 : 0,035 à 160) — dalle lourde sur éclats légers
for(const [mc,ms] of [[0.035,160],[0.5,160],[2,160],[0.035,20]]){
  const w=create({capacity:32}); w.buildStatics(); const chips=[]; for(let k=0;k<6;k++)chips.push(w.addBox(-0.3+0.3*(k%3),0.05,-0.15+0.3*((k/3)|0),0.05,0.05,0.05,mc,0.7,0.16));
  const slab=w.addBox(0,0.5,0,0.5,0.1,0.5,ms,0.7,0.16); let minChip=1,vmax=0,sleepAt=-1; for(let i=0;i<10*HZ;i++){w.step(1/HZ,1);for(const c of chips){minChip=Math.min(minChip,w.P[c*3+1]-0.05);vmax=Math.max(vmax,Math.hypot(w.V[c*6],w.V[c*6+1],w.V[c*6+2]));}if(sleepAt<0&&w.stats.awake===0)sleepAt=i;}
  console.log(`T2b dalle ${ms} sur 6 eclats de ${mc}: dessous d'eclat min ${(minChip*1000).toFixed(1)} mm (0 = sol), dalle finale dessous a ${((w.P[slab*3+1]-0.1)*1000).toFixed(1)} mm (ideal 100), vitesse max d'un eclat ${vmax.toFixed(2)} m/s, endormi au pas ${sleepAt} (${(sleepAt/HZ).toFixed(2)} s)`);
}
// T8 : coût dans un monde à l'échelle de METAL (206 x 134 m, 448 statiques, 276 corps endormis, N éveillés)
{
  const mk=()=>{const w=create({capacity:384,minX:-103,maxX:103,minZ:-67,maxZ:67}); let n=1;const r=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
    for(let k=0;k<448;k++){const x=-100+r()*200,z=-64+r()*128,sx=0.5+r()*6,sz=0.3+r()*2;w.addStatic(x,0,z,x+sx,3,z+sz);} w.buildStatics();
    const ids=[];for(let k=0;k<288;k++){const x=-95+(k%24)*8+r(),z=-60+((k/24)|0)*10+r();ids.push(w.addBox(x,0.4,z,0.4,0.4,0.4,30,0.6,0.1));} return {w,ids};};
  const small=()=>{const w=create({capacity:384}); const ids=[];w.buildStatics();for(let k=0;k<288;k++)ids.push(w.addBox(-55+(k%24)*4.5,0.4,-50+((k/24)|0)*8,0.4,0.4,0.4,30,0.6,0.1));return {w,ids};};
  for(const [label,f] of [['monde METAL 206x134 (6901 cellules)',mk],['grille par defaut 128x128 (4096 cellules)',small]]) for(const nAwake of [0,1,12,48]){
    let best=1e9; for(let rep=0;rep<5;rep++){const {w,ids}=f(); for(let i=0;i<200;i++)w.step(1/HZ,1); // tout s'endort
      const asleep=w.stats.awake; let acc=0,cnt=0; for(let i=0;i<300;i++){ if(i%20===0)for(let k=0;k<nAwake;k++)w.impulseAt(ids[k*5],w.P[ids[k*5]*3],w.P[ids[k*5]*3+1],w.P[ids[k*5]*3+2],40,20,10); const t0=performance.now();w.step(1/HZ,1);acc+=performance.now()-t0;cnt++; }
      best=Math.min(best,acc/cnt*1000);}
    console.log(`T8 ${label}, ${nAwake} corps reveilles en continu: ${best.toFixed(1)} us par pas (meilleure moyenne de 5)`);
  }
}
