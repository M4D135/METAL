// Exact restore: snapshot at step K -> JSON text -> fresh world -> continue; compare with the uninterrupted run.
import {SCENES} from './scenes.mjs';
for(const [name,K,END] of [['rubble300',300,1100],['blast200',300,900],['pyramid55',10,300]]){
  const run=(upto,w)=>{for(let i=w.__i||0;i<upto;i++){if(name==='blast200'&&i===240)w.explode(0,.5,0,14,900);w.step(1/120,1);}w.__i=upto;};
  const a=SCENES[name]({}).w;run(K,a);const text=JSON.stringify(a.snapshot(true)),textNo=JSON.stringify(a.snapshot(false));run(END,a);
  const b=SCENES[name]({}).w;b.restore(JSON.parse(text));b.__i=K;run(END,b);
  const c=SCENES[name]({}).w;c.restore(JSON.parse(textNo));c.__i=K;run(END,c);
  let d=0;for(let i=3;i<a.count*3;i++)d=Math.max(d,Math.abs(a.P[i]-c.P[i]));
  const cache=JSON.parse(text).cache;
  console.log(`${name}: snapshot at step ${K}: ${text.length} chars with impulse cache (${cache.K.length} contact points, ${JSON.stringify(cache).length} chars), ${textNo.length} without | continued to ${END}: with cache ${a.hash()===b.hash()?'IDENTICAL hash '+a.hash():'DIFFERENT'} | without cache ${a.hash()===c.hash()?'identical':'different, max position gap '+(d*1000).toFixed(2)+' mm'}`);
}
