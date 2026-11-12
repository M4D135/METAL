// LOOP-09: deterministic callback counts, not a hardware FPS benchmark.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const [beforeArg,afterArg]=process.argv.slice(2);
if(!beforeArg||!afterArg)throw new Error('Usage: node tools/frame-gate-profile.mjs <reference-root> <candidate-root>');
const before=resolve(beforeArg),after=resolve(afterArg),game=readFileSync(before+'/src/game.js','utf8'),source=readFileSync(after+'/src/options.js','utf8');
if(!game.includes('prefs.fpsLimit&&now-last<1000/prefs.fpsLimit-.5'))throw new Error('Reference does not contain the audited historical limiter');
const window={};Function('window',source)(window);const options=window.FOptions;
const hash=text=>createHash('sha256').update(text).digest('hex');
const rows=[],jitter=[0,.03,-.02,.01,-.03,.02];
for(const clock of ['rounded-0.1ms','exact','jitter-0.03ms'])for(const hz of [60,75,90,100,120,144,150,165,240])for(const limit of [30,60,120]){
  if(limit>=hz)continue;
  const gate=options.createFrameGate();let lastOld=0,lastNew=0,beforeFrames=0,afterFrames=0,lastFrame=0,lastStride=0,strideChanges=0;const oldGaps=new Set(),newGaps=new Set(),vsyncGaps=new Set(),strides=new Set();
  for(let frame=1;frame<=hz*22;frame++){
    const now=clock==='rounded-0.1ms'?Math.round(frame*10000/hz)/10:frame*1000/hz+(clock==='jitter-0.03ms'?jitter[frame%jitter.length]:0),old=now-lastOld>=1000/limit-.5,next=options.frameGate(gate,now,limit);
    if(old){if(frame>hz*2){beforeFrames++;oldGaps.add(Math.round((now-lastOld)*10)/10);}lastOld=now;}
    if(frame>hz*2){strides.add(gate.stride);if(lastStride&&lastStride!==gate.stride)strideChanges++;lastStride=gate.stride;}
    if(next){if(frame>hz*2){afterFrames++;newGaps.add(Math.round((now-lastNew)*10)/10);if(lastFrame>hz*2)vsyncGaps.add(frame-lastFrame);}lastNew=now;lastFrame=frame;}
  }
  rows.push({clock,displayHz:hz,targetFps:limit,beforeFps:beforeFrames/20,afterFps:afterFrames/20,vsyncStride:gate.stride,strides:[...strides].sort((a,b)=>a-b),strideChanges,afterVsyncGaps:[...vsyncGaps].sort((a,b)=>a-b),displayedEstimateFps:Math.round(gate.effectiveHz),beforeGapsMs:[...oldGaps].sort((a,b)=>a-b),afterGapsMs:[...newGaps].sort((a,b)=>a-b)});
}
console.log(JSON.stringify({schema:'metal-frame-gate-profile-v2',reference:before,candidate:after,referenceGameSha256:hash(game),candidateOptionsSha256:hash(source),clocks:['Synthetic vsync rounded to 0.1 ms','Exact synthetic timestamps','Deterministic timestamp jitter of at most 0.03 ms'],warmupSeconds:2,measuredSeconds:20,policy:'Nearest regular whole-vsync cadence, with a 0.02 divider hysteresis band and fresh selection after a >2% refresh shift; actual estimate displayed, not a strict upper cap. LOOP-09 counter-audit takes precedence over conflicting lot-sheet examples.',rows},null,2));
