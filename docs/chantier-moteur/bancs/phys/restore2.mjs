import {SCENES} from './scenes.mjs';
for(const [name,K,END] of [['rubble300',300,1100],['blast200',300,900]]){
  const run=(upto,w)=>{for(let i=w.__i||0;i<upto;i++){if(name==='blast200'&&i===240)w.explode(0,.5,0,14,900);w.step(1/120,1);}w.__i=upto;};
  const a=SCENES[name]({}).w;run(K,a);const snap=a.snapshot(true),text=JSON.stringify(snap);
  let negZero=0;for(const k of ['P','Q','V'])for(const v of snap[k])if(Object.is(v,-0))negZero++;
  const b=SCENES[name]({}).w;b.restore(JSON.parse(text));b.__i=K;
  const c=SCENES[name]({}).w;c.restore(snap);c.__i=K; // same data without the JSON text round trip
  let first=-1,firstC=-1;
  for(let i=K;i<END;i++){run(i+1,a);run(i+1,b);run(i+1,c);
    if(first<0){let d=0;for(let k=3;k<a.count*3;k++)d=Math.max(d,Math.abs(a.P[k]-b.P[k]));for(let k=6;k<a.count*6;k++)d=Math.max(d,Math.abs(a.V[k]-b.V[k]));if(d>0)first=i;}
    if(firstC<0&&a.hash()!==c.hash())firstC=i;}
  let d=0;for(let k=3;k<a.count*3;k++)d=Math.max(d,Math.abs(a.P[k]-b.P[k]));
  console.log(name,'negative zeros in snapshot',negZero,'| JSON restore: first numeric difference at step',first,'final max gap',d,'| in-memory restore into a fresh world: first hash difference at step',firstC);
}
