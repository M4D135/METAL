// RCPU: Canvas2D fallback (createSoftware) per-frame JS cost on the same tour, with a counting no-op 2D context.
// usage: node bench-canvas.mjs <ferroRoot> [frames=900] [world=camp:6] [quality=auto]
import {scene,stats,GLC,resetGL} from './harness.mjs';
const root=process.argv[2],frames=+(process.argv[3]||900),[kind,idx]=(process.argv[4]||'camp:6').split(':'),quality=process.argv[5]||'auto';
const S=scene(root,{world:[kind,+idx],quality,canvas2d:true,wrap:false});
console.log('backend',S.renderer.stats.backend,'setWorld ms',S.setWorldMs.toFixed(1),'canvas',S.canvas.width,S.canvas.height);
const rows=[];let destr=[];
for(let i=0;i<frames;i++){const g=GLC.calls;const r=S.frame(1/60,{tour:true});rows.push({...r,ctxCalls:GLC.calls-g});if(r.changed)destr.push({i,update:r.updateMs,nextDraw:null});}
for(const d of destr)d.nextDraw=rows[d.i]?.drawMs;
const tail=rows.slice(60);
console.log('first frame draw ms',rows[0].drawMs.toFixed(1),'frames 1-10 max',Math.max(...rows.slice(1,10).map(r=>r.drawMs)).toFixed(1));
console.log('draw',JSON.stringify(stats(tail.map(r=>r.drawMs))),'models',JSON.stringify(stats(tail.map(r=>r.modelsMs))),'ctx calls/frame',JSON.stringify(stats(tail.map(r=>r.ctxCalls))));
console.log('destruction updates',destr.length,'updateWorld ms',destr.map(d=>d.update.toFixed(2)).join(' '),'| draw in same frame',destr.map(d=>d.nextDraw?.toFixed(1)).join(' '));
