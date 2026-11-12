// Stack stability with sleeping DISABLED (true 10 s of simulation): pose error against the ideal stack at 1, 5 and 10 s.
import {SCENES} from './scenes.mjs';
const CFG=[['120 Hz x1 (2+1 it.)',120,1,{}],['60 Hz x2 substeps',60,2,{}],['120 Hz x1, slop 2 mm',120,1,{slop:.002}],['60 Hz x1 (2+1 it.)',60,1,{}],['120 Hz x1, 4+2 it.',120,1,{iterations:4,relaxIterations:2}],['120 Hz x1, sleeping ON',120,1,{sleep:true}]];
for(const name of ['stack10','pyramid55'])for(const [label,hz,sub,o] of CFG){
  const sc=SCENES[name](o.sleep?{}:{sleepTime:1e9,...o}),w=sc.w,out=[];let maxSpeed=0;
  for(let i=1;i<=10*hz;i++){w.step(1/hz,sub);
    if(i===hz||i===5*hz||i===10*hz){let h=0,v=0,t=0,sp=0;for(let k=0;k<sc.ids.length;k++){const b=sc.ids[k],id=sc.ideal(k);h=Math.max(h,Math.hypot(w.P[b*3]-id[0],w.P[b*3+2]-id[2]));v=Math.max(v,Math.abs(w.P[b*3+1]-id[1]));t=Math.max(t,1-Math.abs(w.R[b*9+4]));sp=Math.max(sp,Math.hypot(w.V[b*6],w.V[b*6+1],w.V[b*6+2]));}
      out.push(`t=${i/hz}s horiz ${(h*1000).toFixed(2)} mm vert ${(v*1000).toFixed(2)} mm tilt ${(Math.acos(Math.min(1,1-t))*180/Math.PI).toFixed(3)} deg speed ${(sp*1000).toFixed(3)} mm/s`);}}
  console.log(`${name.padEnd(10)} ${label.padEnd(24)} | ${out.join(' | ')} | awake at end ${w.stats.awake}`);
}
