// Gouverneur reel (renderer.js:746) face a une image limitee par le CPU : la duree d'image ne depend PAS de l'echelle.
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const root=process.argv[2];
const src=readFileSync(root+'/src/renderer.js','utf8').replace('window.FRender={create,foliageTriangles};','window.FRender={create,foliageTriangles};window.__gov=resolutionGovernor;');
const win={innerWidth:1280,innerHeight:720,devicePixelRatio:2};vm.runInThisContext('(function(window){'+src+'\n})',{filename:'renderer-g.js'})(win);
function run(label,frameAt,seconds=60){const g=win.__gov();let t=0,scale=1,changes=[],i=0;while(t<seconds*1000){const ms=frameAt(i++,t,scale);t+=ms;const s=g.update({adaptive:true,frameMs:ms},'auto');if(s!==scale){changes.push((t/1000).toFixed(1)+'s->'+s);scale=s;}}
  console.log(label.padEnd(58),'scale finale',scale,'pixels',Math.round(scale*scale*100)+'%','changements',changes.length,changes.slice(0,6).join(' '));}
run('CPU 28 ms constant (GPU libre), 60 Hz sans vsync',()=>28);
run('CPU lie: vsync 60 Hz, 1 image sur 2 a 33,3 ms (moy. 25)',i=>i%2?33.33:16.67);
run('CPU lie: vsync 60 Hz, 2 images sur 3 a 33,3 ms',i=>i%3?33.33:16.67);
run('rafale: 60 fps + 1 pic de 120 ms toutes les 0,5 s (A*, GC)',(i)=>i%24===0?120:16.67);
run('rafale: 60 fps + 1 pic de 150 ms toutes les 1 s',(i)=>i%52===0?150:16.67);
run('combat boss 10 s a 30 fps CPU puis retour 60 fps',(i,t)=>t<10000?33.33:16.67,60);
