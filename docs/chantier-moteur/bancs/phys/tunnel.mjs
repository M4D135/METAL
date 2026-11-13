// Fast small bodies against thin static walls: does the speculative margin (fat AABB + margin = speed*dt) prevent tunnelling?
import {create} from './fphys.mjs';
for(const [hz,sub] of [[120,1],[60,2],[60,1]])for(const thick of [0.2,0.05])for(const speed of [20,40]){
  let through=0,total=0,maxPen=0;
  for(let k=0;k<40;k++){
    const w=create({capacity:8,maxLinear:60});w.addStatic(5,0,-3,5+thick,6,3);w.buildStatics();
    const h=0.05+0.01*(k%5),y=0.5+0.1*(k%7),z=-1+0.05*k,i=w.addBox(5-1.5-0.013*k,y+1,z,h,h*(1+k%3),h,2,0.5,0.2,0.1*(k%4),0.2,0.05*(k%3),0.97);
    const l=Math.hypot(w.Q[i*4],w.Q[i*4+1],w.Q[i*4+2],w.Q[i*4+3]);for(let c=0;c<4;c++)w.Q[i*4+c]/=l;
    w.V[i*6]=speed;w.V[i*6+1]=1;w.V[i*6+3]=3*(k%5);w.V[i*6+4]=7;
    for(let s=0;s<hz;s++){w.step(1/hz,sub);maxPen=Math.max(maxPen,w.P[i*3]-5);}
    total++;if(w.P[i*3]>5+thick/2)through++;
  }
  console.log(`${hz} Hz x${sub} wall ${thick*100} cm, speed ${speed} m/s (${(speed/hz*100).toFixed(0)} cm per step): passed through ${through}/${total}, deepest centre excursion past the wall face ${(maxPen*100).toFixed(1)} cm`);
}
