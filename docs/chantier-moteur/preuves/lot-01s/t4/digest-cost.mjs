// Lot 01 suite / T4 — what the new assertions add to checks/campaign-world.test.mjs:
// one digest() (SHA-256 of JSON.stringify(world)) per campaign world, 108 in all,
// on a world the loop has already built. Measured where the test pays it, in a
// node:vm context loaded like the test (fmath.js then world.js), and in the main
// realm for reference. Each world: built once, then its digest timed --reps times
// in alternation across worlds; median per world, summed. Thread CPU time
// (process.cpuUsage), plus wall time. Nothing else is generated.
//   node docs/chantier-moteur/preuves/lot-01s/t4/digest-cost.mjs [--reps 5] [--report F]
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../..');
const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const reps=Number(flag('--reps')||5),reportFile=flag('--report');
const {loadRealm}=await import(join(root,'tools/realm-loader.mjs'));
const fixture=JSON.parse(readFileSync(join(root,'checks/campaign-world-digests.json'),'utf8'));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const median=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const cpu=()=>{const u=process.cpuUsage();return (u.user+u.system)/1000;};

function vmFactory(){
  const context={window:{}};
  for(const name of ['fmath','world']){const file=join(root,'src',name+'.js');vm.runInNewContext(readFileSync(file,'utf8'),context,{filename:file});}
  return context.window.FWorld;
}
const realms={vm:vmFactory(),main:loadRealm({root,modules:['fmath','world']}).window.FWorld},out={};
for(const [realm,W] of Object.entries(realms)){
  const worlds=[];let built=0;
  for(const kind of ['v1','v2'])for(const seed of fixture.seeds)for(let index=0;index<18;index++){
    const t=cpu(),world=W.create(seed,index,kind==='v1'?{campaign:true}:{campaign:true,campaignVersion:2});built+=cpu()-t;
    if(digest(world)!==fixture[kind][seed][index])throw new Error(`${realm}: ${kind} seed ${seed} world ${index+1} differs from the fixture`);
    worlds.push({world,cpu:[],wall:[],bytes:JSON.stringify(world).length});
  }
  for(let r=0;r<reps;r++)for(const w of worlds){const c=cpu(),t=process.hrtime.bigint();digest(w.world);w.wall.push(Number(process.hrtime.bigint()-t)/1e6);w.cpu.push(cpu()-c);}
  const cpuMs=worlds.reduce((s,w)=>s+median(w.cpu),0),wallMs=worlds.reduce((s,w)=>s+median(w.wall),0);
  out[realm]={worlds:worlds.length,repsPerWorld:reps,digestCpuMsSum:Math.round(cpuMs),digestWallMsSum:Math.round(wallMs),digestCpuMsPerWorld:Math.round(cpuMs/worlds.length*10)/10,
    jsonBytes:{min:Math.min(...worlds.map(w=>w.bytes)),max:Math.max(...worlds.map(w=>w.bytes))},buildCpuMsSum:Math.round(built)};
}
const report={schema:'metal-lot01s-t4-digest-cost-v1',environment:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch},
  note:'Added by T4: one digest per campaign world (108) in checks/campaign-world.test.mjs, on the world each loop already built. buildCpuMsSum: building the 108 worlds once, for scale (the test builds each one twice, plus its checks).',...out};
const text=JSON.stringify(report,null,1)+'\n';
if(reportFile){mkdirSync(dirname(resolve(reportFile)),{recursive:true});writeFileSync(reportFile,text);console.log(JSON.stringify({report:resolve(reportFile),vm:out.vm.digestCpuMsSum,main:out.main.digestCpuMsSum}));}
else process.stdout.write(text);
