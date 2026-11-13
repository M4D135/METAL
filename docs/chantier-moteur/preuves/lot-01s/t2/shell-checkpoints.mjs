// Lot 01 suite / T2, proof (6): checkpoints written before the fix (root --base,
// host Math), read back by the real shell (src/game.js) of the branch.
//
//   node docs/chantier-moteur/preuves/lot-01s/t2/shell-checkpoints.mjs --base <root before the fix> [root] [--out F]
//
// The browser shell harness is the one of checks/checkpoint.test.mjs, read from
// the root at run time (harness(saved, initial, createWorld, runtime)), so this
// proof cannot drift from the test. Its FWorld comes from the root being read:
// fmath.js then world.js, loaded by tools/realm-loader.mjs. For each case, an
// envelope is written as game.js saveCheckpoint() writes it, from the world and
// FSimulation of the base after 60 steps; the base shell must resume it (control),
// then the shell of the branch resumes it: unchanged worlds are restored,
// changed worlds keep the original in ferro-expedition-v2-refuse, try again
// without rubble, then restart at the entry of the same sector.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);if(i<0)return null;const v=args[i+1];args.splice(i,2);return v;};
const base=flag('--base'),out=flag('--out'),root=resolve(args[0]||fileURLToPath(new URL('../../../../../',import.meta.url)));
if(!base)throw new Error('usage: shell-checkpoints.mjs --base <root before the fix> [root] [--out F]');
const {loadRealm,defaultModules}=await import(join(root,'tools/realm-loader.mjs'));
const KEY='ferro-expedition-v2',stats={time:316,kills:21,shots:72,hits:43,score:4730};
const SHELL=['destruction','economy','brain','simulation','motion','actors','effects','soundscape','options','game'];

function shellOf(dir){
  const text=readFileSync(join(dir,'checks/checkpoint.test.mjs'),'utf8'),start=text.indexOf('function harness('),end=text.indexOf('\nfunction savedPoint(');
  if(start<0||end<start)throw new Error('harness not found in '+dir+'/checks/checkpoint.test.mjs');
  const sources=Object.fromEntries(SHELL.map(name=>[name,readFileSync(join(dir,'src',name+'.js'),'utf8')]));
  // Generated worlds have foliage: the renderer stub of the harness also lends the
  // shared foliage geometry of the real renderer.js, which destruction.js requires.
  const anchor='FRender: { create: () => ({',body=text.slice(start,end);
  if(body.split(anchor).length!==2)throw new Error('FRender stub anchor not found once in the harness');
  const foliageTriangles=loadRealm({root:dir,modules:['renderer']}).window.FRender.foliageTriangles;
  const harness=new Function('vm','assert','key','sources','world','foliageTriangles',body.replace(anchor,'FRender: { foliageTriangles, create: () => ({')+'\nreturn harness;')(vm,assert,KEY,sources,()=>{throw new Error('no fixture world');},foliageTriangles);
  const FWorld=loadRealm({root:dir,modules:defaultModules(dir).filter(name=>name==='fmath'||name==='world')}).window.FWorld;
  return {dir,harness,FWorld,create:(seed,index,options)=>FWorld.create(seed,index,options)};
}

// Envelope as game.js saveCheckpoint() writes it (src/game.js, savedRun).
function envelope(shell,c){
  const app=shell.harness(null,{},shell.create),world=shell.create(c.seed,c.index,c.options&&{...c.options});
  const sim=app.context.FSimulation.create(world,{armorSystem:true}),entry=JSON.parse(JSON.stringify(sim.exportLoadout()));
  for(let i=0;i<60;i++){sim.step(1/60,{});sim.state.events.length=0;}
  const checkpoint=JSON.parse(JSON.stringify(sim.snapshot()));sim.dispose?.();
  return {version:world.campaign?3:2,...(world.campaign?{campaign:true,index:c.index,...(world.campaignVersion===2?{campaignRevision:2}:{})}:{}),
    generation:world.generation||3,seed:c.seed,stage:world.campaign?world.stage:c.index,runStats:{...stats},entryLoadout:entry,checkpoint};
}

async function resume(shell,saved){
  const raw=JSON.stringify(saved),restores=[],app=shell.harness(saved,{},shell.create),create=app.context.FSimulation.create;
  app.context.FSimulation.create=(value,options)=>{const sim=create(value,options),restore=sim.restore;
    sim.restore=(point,opts)=>{const ok=restore.call(sim,point,opts);restores.push({ok,withRubble:point?.rubbleVersion!==undefined||Array.isArray(point?.state?.rubble)});return ok;};return sim;};
  const errors=[],report=app.context.console.error;app.context.console.error=(...a)=>{errors.push(a.map(String).join(' '));report(...a);};
  let exception=null;
  try{await app.element('resume-expedition').click();app.frame(100);}catch(error){exception=String(error?.stack||error);}
  const sim=app.simulations.at(-1),active=app.memory.get(KEY),next=active?JSON.parse(active):null,refused=app.memory.get(KEY+'-refuse')??null;
  return {state:app.element('body').dataset.state,toast:app.element('toast').textContent,restores,exception,consoleErrors:errors,
    refuseSlotHoldsOriginal:refused===raw,refuseSlotWritten:refused!==null,activeIsOriginal:active===raw,
    loaded:sim?{seed:sim.state.world.seed,stage:sim.state.world.stage,index:sim.state.world.index??null,campaign:!!sim.state.world.campaign,campaignVersion:sim.state.world.campaignVersion??null}:null,
    next:next?{seed:next.seed,stage:next.stage,index:next.index??null,version:next.version,relays:next.checkpoint?.state?.relays,entryLoadoutKept:JSON.stringify(next.entryLoadout)===JSON.stringify(saved.entryLoadout),runStatsKept:JSON.stringify(next.runStats)===JSON.stringify(saved.runStats)}:null,
    loadoutIsEntry:sim?JSON.stringify(sim.exportLoadout())===JSON.stringify(saved.entryLoadout):null};
}

const cases=[
  {label:'classique 96/0',seed:96,index:0,options:undefined},
  {label:'classique 1/0',seed:1,index:0,options:undefined},
  {label:'V1 96 monde 1',seed:96,index:0,options:{campaign:true}},
  {label:'V1 96 monde 2',seed:96,index:1,options:{campaign:true}},
  {label:'V2 96 monde 1',seed:96,index:0,options:{campaign:true,campaignVersion:2}},
  {label:'V2 96 monde 2',seed:96,index:1,options:{campaign:true,campaignVersion:2}},
];
const writer=shellOf(resolve(base)),reader=shellOf(root),rows=[];
for(const c of cases){
  const saved=envelope(writer,c),control=await resume(writer,saved),branch=await resume(reader,saved);
  rows.push({case:c.label,seed:c.seed,index:c.index,options:c.options??null,fingerprint:saved.checkpoint.fingerprint,control:{state:control.state,toast:control.toast,restores:control.restores,exception:control.exception},branch});
}
const summary=rows.map(r=>({case:r.case,control:r.control.toast,branch:r.branch.toast,restores:r.branch.restores.map(x=>x.ok),refuseSlot:r.branch.refuseSlotHoldsOriginal,exception:r.branch.exception!==null||r.control.exception!==null,consoleErrors:r.branch.consoleErrors.length}));
const report={schema:'metal-lot01s-shell-checkpoints-v1',environment:{node:process.version,platform:process.platform,arch:process.arch},root,base:resolve(base),
  note:'Writer: world.js and FSimulation of the base root (host Math), 60 steps of 1/60 s, envelope of game.js saveCheckpoint(). Reader: the real shell (game.js) of the root with its FWorld (fmath.js, world.js), harness of checks/checkpoint.test.mjs.',summary,rows};
const text=JSON.stringify(report,null,1)+'\n';
if(out){mkdirSync(dirname(resolve(out)),{recursive:true});writeFileSync(out,text);}
console.log(JSON.stringify(summary,null,1));
