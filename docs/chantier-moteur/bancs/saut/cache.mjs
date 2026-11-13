// (g) RCPU-01 margin cache (bench/rcpu/proto.mjs) under fast movement: rebuild rate of the main static list, upload bytes and
// list inflation, on the real FRender.create/setWorld/draw chain (fake WebGL2) with the "tour" pilot of bench/rcpu/harness.mjs.
// Deterministic counts (no timing): comparable across configurations despite machine load.
import {scene} from '../rcpu/harness.mjs';
const root=(process.env.METAL_ROOT||process.cwd());
const FR=+process.argv[2]||1500,worldIdx=+process.argv[3]||6;
const configs=[];for(const [D,TH] of [[1,8],[1.5,12],[2,16],[1,24]])for(const [speed,sweep,name] of [[7,45,'7 m/s · 69°/s crête (réf. RCPU-01)'],[7.6,45,'7,6 m/s · 69°/s'],[10.5,45,'10,5 m/s · 69°/s'],[10.5,10.3,'10,5 m/s · 300°/s crête'],[10.5,6.57,'10,5 m/s · 300°/s moyen']])configs.push({D,TH,speed,sweep,name});
const rows=[];
for(const c of configs){
  const S=scene(root,{world:['camp',worldIdx],quality:'auto',wrap:false,proto:{grid:true,sun:true,cache:true,pool:true,D:c.D,THETA:c.TH,expose:true}});
  let prev=null,rebuild=0,n=0,upload=0,vis=0,drawMs=0,prevSun=null,sunRebuild=0;
  for(let i=0;i<FR+60;i++){const r=S.frame(1/60,{tour:true,speed:c.speed,sweep:c.sweep});if(i<60){prev=S.renderer.stats.__slot0;continue;}
    const cur=S.renderer.stats.__slot0;if(cur!==prev)rebuild++;prev=cur;n++;upload+=S.renderer.stats.uploadBytes;vis+=S.renderer.stats.staticVisible;drawMs+=r.drawMs;}
  rows.push({D:c.D,theta:c.TH,pilote:c.name,'reconstructions %':+(100*rebuild/n).toFixed(1),'par seconde':+(60*rebuild/n).toFixed(1),'upload Ko/image':+(upload/n/1024).toFixed(1),'statiques visibles':Math.round(vis/n),'draw ms (indicatif)':+(drawMs/n).toFixed(3)});
}
console.table(rows);
