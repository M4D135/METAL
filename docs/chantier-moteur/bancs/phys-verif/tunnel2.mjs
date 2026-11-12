import {create} from '../phys/fphys.mjs';
for(const [hz,sub] of [[120,1],[60,2]])for(const thick of [0.12])for(const speed of [14,24,30,40]){
  let through=0,total=0;
  for(let k=0;k<200;k++){
    const w=create({capacity:8,maxLinear:60});w.addStatic(5,0,-6,5+thick,6,6);w.buildStatics();
    const h=0.05+0.01*(k%9),y=0.5+0.1*(k%7),z=-4+0.04*k,i=w.addBox(5-1.5-0.0137*k,y+1,z,h,h*(1+k%3),h,2,0.5,0.2,0.1*(k%4),0.2,0.05*(k%3),0.97);
    const l=Math.hypot(w.Q[i*4],w.Q[i*4+1],w.Q[i*4+2],w.Q[i*4+3]);for(let c=0;c<4;c++)w.Q[i*4+c]/=l;
    w.V[i*6]=speed;w.V[i*6+1]=1;w.V[i*6+3]=3*(k%5);w.V[i*6+4]=7;w.V[i*6+2]=(k%11-5)*0.6;
    for(let s=0;s<hz;s++)w.step(1/hz,sub);
    total++;if(w.P[i*3]>5+thick/2)through++;
  }
  console.log(`${hz} Hz x${sub}, mur de ${thick*100} cm (epaisseur minimale des murs de METAL), ${speed} m/s: ${through}/${total} traversees`);
}
