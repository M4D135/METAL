// RCPU: per-frame JS cost of models() + FRender.draw() on a fake WebGL2 context, real worlds, real simulation.
// usage: node bench-draw.mjs <ferroRoot> [frames=1800] [world=camp:6] [quality=auto] [instrument=0]
import {scene,stats,GLC,resetGL,timers,PROF,resetProf} from './harness.mjs';
const root=process.argv[2],frames=+(process.argv[3]||1800),[kind,idx]=(process.argv[4]||'camp:6').split(':'),quality=process.argv[5]||'auto',instrument=process.argv[6]==='1',mode=process.argv[7]||'tour';
const S=scene(root,{world:[kind,+idx],quality,instrument});
const rows=[];resetGL();resetProf();
const warm=120;
for(let i=0;i<frames+warm;i++){
  if(i===warm){resetGL();resetProf();for(const k in timers){timers[k].ms=0;timers[k].calls=0;}}
  const g0={...GLC};const r=S.frame(1/60,{tour:mode==='tour'});const st=S.renderer.stats;
  if(i>=warm)rows.push({...r,drawCalls:st.drawCalls,instances:st.instances,triangles:st.triangles,uploadBytes:st.uploadBytes,staticVisible:st.staticVisible,fxInstances:st.fxInstances,shadowMaps:st.shadowMaps,glCalls:GLC.calls-g0.calls,bufferData:GLC.bufferData-g0.bufferData,dynLights:st.dynamicLights,actorsConsidered:st.actorsConsidered,actorsCulled:st.actorsCulled});
}
const col=k=>rows.map(r=>r[k]);
const n=rows.length;
const res={world:kind+':'+idx,quality,mode,frames:n,meshes:S.world.meshes.length,genMs:+S.genMs.toFixed(1),setWorldMs:+S.setWorldMs.toFixed(1),canvas:[S.canvas.width,S.canvas.height],
  simMs:stats(col('simMs')),modelsMs:stats(col('modelsMs')),drawMs:stats(col('drawMs')),lightsMs:stats(col('lightsMs')),updateWorldMs:stats(col('updateMs')),
  destructionUpdates:rows.filter(r=>r.changed).length,
  dynamicMeshes:stats(col('dynamic')),drawCalls:stats(col('drawCalls')),instances:stats(col('instances')),uploadKB:stats(col('uploadBytes').map(v=>v/1024)),staticVisible:stats(col('staticVisible')),fxInstances:stats(col('fxInstances')),glCalls:stats(col('glCalls')),bufferDataPerFrame:stats(col('bufferData')),
  actorsConsidered:stats(col('actorsConsidered')),actorsCulled:stats(col('actorsCulled')),
  timersPerFrame:Object.fromEntries(Object.entries(timers).map(([k,v])=>[k,{msPerFrame:+(v.ms/n).toFixed(3),callsPerFrame:+(v.calls/n).toFixed(1)}]))};
// Frames after a destruction revision: the draw that follows pays the cache rebuild.
const after=[];for(let i=1;i<rows.length;i++)if(rows[i].changed)after.push(rows[i].drawMs);
res.drawAfterDestruction=after.length?stats(after):null;
if(instrument){
  res.lines=Object.fromEntries([...PROF.lines].sort((a,b)=>b[1]-a[1]).slice(0,22).map(([k,v])=>[k,+(v/n*1000).toFixed(1)+' us']));
  res.inner=Object.fromEntries([...PROF.inner].sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,+(v/n*1000).toFixed(1)+' us']));
  res.slots=PROF.slots.map((q,i)=>({slot:['main','shadow1(lamp0)','shadow2(sun|lamp1)','shadow3(torch)'][i],callsPerFrame:+(q.calls/n).toFixed(2),repackRate:+(q.repacks/Math.max(1,q.calls)).toFixed(3),avgEntries:Math.round(q.entries/Math.max(1,q.calls)),avgRepackEntries:Math.round(q.repackEntries/Math.max(1,q.repacks))}));
}
console.log(JSON.stringify(res,null,1));
