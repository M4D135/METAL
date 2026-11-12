// Simulation du gouverneur de résolution réel (extrait du source, renderer.js:746-764) avec un modèle de coût
// GPU = fixe + k·pixels (mesuré : ~1,3 ms + 2,3 ms/MPix) mis à l'échelle, et une présentation calée sur le vsync.
import {readFileSync} from 'node:fs';
const src=readFileSync(process.argv[2]+'/src/renderer.js','utf8');
const a=src.indexOf('function resolutionGovernor(){'),b=src.indexOf('function metadata(mesh)');
const resolutionGovernor=new Function(src.slice(a,b)+';return resolutionGovernor;')();
function run(hz,costAt1,seconds=120){
  const g=resolutionGovernor(),vs=1000/hz;let t=0,scale=1,changes=0,slowFrames=0,frames=0,trace=[],last=1;
  const fixed=costAt1*.25,perPix=costAt1*.75; // part proportionnelle aux pixels (mesure : ~75 % à 1,8 MPix)
  let frameMs=vs;
  while(t<seconds*1000){
    scale=g.update({adaptive:true,frameMs},'auto');
    if(scale!==last){changes++;trace.push((t/1000).toFixed(1)+'s→'+scale);last=scale;}
    const cost=fixed+perPix*scale*scale;frameMs=Math.ceil(cost/vs-1e-9)*vs;if(frameMs>vs+1e-6)slowFrames++;frames++;t+=frameMs;
  }
  return {hz,costAt1,changes,changesPerMin:+(changes/(seconds/60)).toFixed(1),missedShare:+(slowFrames/frames).toFixed(3),finalScale:scale,trace:trace.slice(0,10).join(' ')};
}
for(const [hz,c] of [[60,14],[60,17.5],[60,19],[60,22],[60,30],[120,7],[120,10],[120,14],[120,16],[120,20],[144,9]])console.log(JSON.stringify(run(hz,c)));
