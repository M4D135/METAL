// RCPU: behaviour of resolutionGovernor() (renderer.js:746) under synthetic GPU-bound frame times.
// Model: GPU time per frame = T1 * scale^2 (fill-rate bound); presentation is either vsync-quantised
// (60 Hz: next multiple of 16.67 ms) or free (VRR-like). Reports the steady scale and achieved fps after 60 s.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=process.argv[2];
const src=readFileSync(root+'/src/renderer.js','utf8').replace('window.FRender={create,foliageTriangles};','window.FRender={create,foliageTriangles};window.__gov=resolutionGovernor;');
const win={innerWidth:1280,innerHeight:720,devicePixelRatio:2};vm.runInThisContext('(function(window){'+src+'\n})',{filename:'renderer-g.js'})(win);
function run(T1,quantise,hz=60){
  const g=win.__gov();let scale=1,t=0,frames=0,late=0;const vs=1000/hz;let changes=0;
  while(t<60000){const gpu=T1*scale*scale;const ms=quantise?Math.max(vs,Math.ceil(gpu/vs-1e-9)*vs):Math.max(vs,gpu);t+=ms;
    const next=g.update({adaptive:true,frameMs:ms},'auto');if(next!==scale){changes++;scale=next;}
    if(t>30000){frames++;if(ms>vs*1.5)late++;}}
  return {T1,mode:quantise?'vsync'+hz:'free'+hz,scale,fpsLast30s:+(frames/30).toFixed(1),lateFramesPct:+(100*late/frames).toFixed(0),scaleChanges:changes};
}
for(const hz of [60,120])for(const q of [true,false])for(const T1 of [15,19,22,24,26,30,40])console.log(JSON.stringify(run(T1,q,hz)));
