import {loadRealm} from '/home/m4d135/metal-chantier/voies/sim2/tools/realm-loader.mjs';
import {stateDigest,chainDigest,FNV_OFFSET,snapshotDigest} from '/home/m4d135/metal-chantier/voies/sim2/tools/proof/digest.mjs';
import {createFight} from './boss-driver.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [root,out,mode='aa',repsArg='5',warmupsArg='1',speciesArg='0,1,2']=process.argv.slice(2),reps=+repsArg,warmups=+warmupsArg;
const processor=()=>{const t=readFileSync('/proc/thread-self/stat','utf8');return +t.slice(t.lastIndexOf(')')+2).trim().split(/\s+/)[36];};
const transform=mode==='counter'?(name,text)=>name==='simulation'?text.replaceAll('edgeKnown.fill(0);','G.__edgeWipes=(G.__edgeWipes||0)+1;edgeKnown.fill(0);'):text:undefined;
const A=loadRealm({root,realm:'main'}),B=loadRealm({root,realm:'main',transform});
const report={schema:'metal-t5-paired-production-v1',root,mode,node:process.version,clock:'threadCpuUsage user+system microseconds',sourceA:A.sourceSha256,loadedA:A.loadedSha256,sourceB:B.sourceSha256,loadedB:B.loadedSha256,method:{seconds:60,seed:96,policy:'skilled',god:true,reps,warmups,order:'AB/BA alternates every step and first order reverses each pass',timing:'Prepare both inputs before timing; observe hashes after both steps. Full-scenario warmup passes excluded from comparisons; their first-cold values retained explicitly.',affinity:'unrestricted; processor ID sampled outside timing on expected first-break step'},passes:[]};
for(const species of speciesArg.split(',').map(Number))for(let pass=0;pass<reps+warmups;pass++){
 const a=createFight(A,species),b=createFight(B,species),states={a:{chain:FNV_OFFSET,rows:[],firstBreak:null,pumpSteps:0,maxPump:0},b:{chain:FNV_OFFSET,rows:[],firstBreak:null,pumpSteps:0,maxPump:0}};let firstDifference=null;
 for(let step=0;step<3600&&!a.done()&&!b.done();step++){
  const inputs={a:a.prepare(step),b:b.prepare(step)},timing={},before={a:a.sim.destruction.revision,b:b.sim.destruction.revision};
  for(const key of (step+pass)%2?['b','a']:['a','b']){
   const run=key==='a'?a:b,sample=step===(species===2?654:658),cpuBefore=sample?processor():null,c=process.threadCpuUsage(),t=performance.now();run.sim.step(1/60,inputs[key]);const wall=performance.now()-t,usage=process.threadCpuUsage(c),cpuAfter=sample?processor():null;timing[key]={step,cpuUs:usage.user+usage.system,wallMs:wall,...(sample?{cpuBefore,cpuAfter}:{})};
   if(!states[key].firstBreak&&run.sim.destruction.revision!==before[key])states[key].firstBreak=timing[key];
  }
  const da=stateDigest(a.state),db=stateDigest(b.state);if(da!==db&&firstDifference===null)firstDifference=step;
  for(const [key,run,digest] of [['a',a,da],['b',b,db]]){const v=states[key];v.chain=chainDigest(v.chain,digest);v.rows.push({...timing[key],stateHash:digest});if(run.state.aiStats.navUpdates>0)v.pumpSteps++;v.maxPump=Math.max(v.maxPump,run.state.aiStats.navUpdates);run.after();}
 }
 for(const [key,run] of [['a',a],['b',b]]){states[key].snapshot=snapshotDigest(run.sim);states[key].simSeconds=run.state.time;states[key].dead=run.state.dead;run.dispose();}
 const identical=firstDifference===null&&states.a.snapshot.sha256===states.b.snapshot.sha256;assert(identical,`state divergence species${species} pass${pass} step${firstDifference}`);
 report.passes.push({species,pass,excludedWarmup:pass<warmups,identical,firstDifference,...states});writeFileSync(out,JSON.stringify(report));console.log(species,pass,states.a.firstBreak?.cpuUs,states.b.firstBreak?.cpuUs,states.a.firstBreak?.cpuBefore,states.b.firstBreak?.cpuBefore);
}
