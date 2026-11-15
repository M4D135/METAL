import {withChrome} from '../../render/chrome.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),out=resolve(process.argv[2]||join(tmpdir(),'metal-audio-worker-'+process.pid));mkdirSync(out,{recursive:true});
const html=readFileSync(root+'/dist/index.html','utf8'),scripts=[...html.matchAll(/<script\b[^>]*data-worker[^>]*>[\s\S]*?<\/script>/g)].map(x=>x[0]);
writeFileSync(out+'/audio.html','<!doctype html><title>METAL audio preparation</title>'+scripts.join('\n')+`<script>
window.__jobs=FJobs.create({environment:window,handlers:MetalTasks.jobs,bootstrap:'FJobs.serve(MetalTasks.jobs);'});
window.__hash=value=>{let h=2166136261;for(const n of value)h=Math.imul(h^n,16777619);return(h>>>0).toString(16);};
</script>`);
await withChrome({angle:'swiftshader',window:[800,600]},async browser=>{
 const page=await browser.openPage(out+'/audio.html');
 const receipt=await page.evaluate(`(async()=>{
   const rows=[],ctx=new OfflineAudioContext(2,44100,44100),create=ctx.createBuffer.bind(ctx);let allocations=0;
   ctx.createBuffer=(...args)=>{allocations++;return create(...args);};
   const music=FMusic.create(ctx,ctx.destination),keys=['title',0,1,2,...FMusic.cueIds()];
   for(const stage of keys){const seed=typeof stage==='number'?96:undefined,packet=await __jobs.request('music',{stage,seed}),sin=Math.sin;
     Math.sin=()=>{throw Error('main thread synthesized music');};
     try{const before=performance.now();if(!FMusic.adoptPrepared(packet.prepared))throw Error('packet refused');const adoptMs=performance.now()-before;
       const local=FMusic.getModule(stage,seed),t=performance.now();await music.prepareAsync(stage,seed);
       rows.push({stage,seed,equal:__hash(local)===__hash(packet.bytes),adoptMs,uploadElapsedMs:performance.now()-t,bytes:local.length});
     }finally{Math.sin=sin;}
   }
   // A second request exercises a worker cache after its previous result was transferred.
   const repeated=await __jobs.request('music',{stage:0,seed:96});
   const repeatEqual=__hash(repeated.bytes)===__hash(FMusic.getModule(0,96));
   const before=allocations,sin=Math.sin;Math.sin=()=>{throw Error('unexpected synthesis during play');};
   try{for(const key of keys){music.setStage(key,typeof key==='number'?96:undefined);music.setPlaying(true);music.tick();}}finally{Math.sin=sin;}
   const result={mode:__jobs.mode,stats:{...__jobs.stats},repeatEqual,allocationsDuringPlay:allocations-before,rows};music.dispose();__jobs.dispose();return result;
 })()`);
 assert.equal(receipt.mode,'worker');assert.equal(receipt.stats.fallbacks,0);assert(receipt.repeatEqual);assert.equal(receipt.allocationsDuringPlay,0);for(const row of receipt.rows)assert(row.equal);assert.deepEqual(page.errors,[]);
 writeFileSync(out+'/receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));await page.close();
});
