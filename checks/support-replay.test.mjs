import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {loadRealm} from '../tools/realm-loader.mjs';
const {FSimulation:S,FWorld:W,MetalReplay:R}=loadRealm({modules:['fmath','passages','renderer','support','profiles','world','destruction','economy','physics-geometry','physics','metal-physics','humanoids','actors','simulation','demo','replay-metal']}).window;
const plain=v=>JSON.parse(JSON.stringify(v));
const options={campaign:true,campaignVersion:2,profiles:true,combatVersion:1,hordeVersion:1,supportDroneVersion:1};
const header={gameVersion:'test',simHash:'same-source-fixture',simVersion:{format:1},engine:'cpu',checksumEvery:60};
const STEPS=10+50+30+3+60+3+90+150+3+60+150+40+180;
// A support expedition must be replayable: the CLI has to load support.js before
// world.js, otherwise FWorld.create rejects the recorded supportDroneVersion: 1.
function expedition(sim,rec,steps=40){
  const term=sim.state.mechanisms.find(m=>m.activation==='hack'),dock=sim.state.mechanisms.find(m=>m.activation==='dock');
  const go=m=>{const p=sim.state.player;p.x=m.x;p.y=m.y||0;p.z=m.z;p.airVX=p.airVY=p.airVZ=0;rec.recorder.command('restore',[plain(sim.snapshot())]);};
  const seg=(n,input)=>{for(let k=0;k<n;k++){sim.step(1/60,input);sim.state.events.length=0;}};
  const ammoBefore=sim.state.inventory.ammo.slice();
  seg(10,{});
  sim.switchProfile();                                     // heavy -> drone
  seg(50,{fire:true});                                     // twin lasers, no ammunition involved
  const checkpoint=sim.snapshot();
  seg(30,{});
  assert(sim.restore(checkpoint),'the mid-run checkpoint is accepted');
  go(term);seg(3,{});
  seg(60,{interact:true});                                 // a hack started, then interrupted
  assert(sim.state.support.progress>0&&sim.state.support.progress<1.5,'the hack is still partial');
  sim.switchProfile();                                     // drone -> heavy cancels it at once
  assert.equal(sim.state.support.target,null);assert.equal(sim.state.support.progress,0);
  sim.switchProfile();                                     // heavy -> drone
  go(term);seg(3,{});
  seg(90,{interact:true});                                 // the held hack completes after 1.5 s
  seg(150,{});                                             // the door it powers stays open
  go(dock);seg(3,{});
  seg(60,{});                                              // the drone parks on the key socket
  seg(150,{});
  seg(steps,{fire:true});
  seg(180,{});                                   // nothing re-pays afterwards
  return {term,dock,ammoBefore};
}
function build(){
  const world=W.create(96,0,options),sim=S.create(world,{rigidBodies:true,brain:null});
  const rec=R.attach(sim,{header:{...header,simHash:'same-source-fixture'},scene:{seed:96,index:0,options,simulationOptions:{rigidBodies:true,brain:null}}});
  const run=expedition(sim,rec);
  const bytes=rec.end(),final=sim.digest();
  const lightXp=sim.exportProfiles().classes.light.xp;
  return {world,sim,bytes,final,run,lightXp};
}
test('in-memory support replay reproduces lasers, hack, saved continuation, socket, doors and rewards',()=>{
  const {world,sim,bytes,final,run,lightXp}=build();
  let b;const replay=R.playback(bytes,()=>b=S.create(world,{rigidBodies:true,brain:null}),{simHash:header.simHash});
  const result=replay.run();
  assert(result.ok,JSON.stringify(result.divergence));
  assert.equal(result.steps,STEPS);
  assert(result.checked>10,'recorded digests were compared, not skipped');
  assert.equal(b.digest(),final);
  assert.deepEqual(plain(b.snapshot()),plain(sim.snapshot()));
  assert.equal(sim.state.activeProfile,'light');
  assert(sim.state.mechanisms.find(m=>m.id===run.term.id).active,'the terminal was hacked');
  assert(sim.state.mechanisms.find(m=>m.id===run.dock.id).active,'the drone socket was activated');
  assert.equal(lightXp,80,'the terminal and the socket each paid their experience exactly once');
  assert.deepEqual(plain(sim.state.inventory.ammo),plain(run.ammoBefore),'lasers never touch the heavy reserves');
  assert(sim.state.doors.find(d=>d.requires===run.term.id).open,'a hacked door stays open');
  assert(sim.state.doors.find(d=>d.requires===run.dock.id).open,'the socket door stays open');
  assert(b.state.doors.find(d=>d.requires===run.term.id).open&&b.state.doors.find(d=>d.requires===run.dock.id).open);
});
test('the replay CLI loads support.js and replays a real support expedition in a separate process',async()=>{
  const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{spawnSync}=await import('node:child_process');
  const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),simHash=html.match(/simHash:'([a-f0-9]{64})'/)[1];
  const dir=mkdtempSync(join(tmpdir(),'metal-support-replay-')),file=join(dir,'support.fdm');
  try{
    const world=W.create(96,0,options),sim=S.create(world,{rigidBodies:true,brain:null});
    const rec=R.attach(sim,{header:{...header,simHash},scene:{seed:96,index:0,options,simulationOptions:{rigidBodies:true,brain:null}}});
    expedition(sim,rec);
    const final=sim.digest();writeFileSync(file,rec.end());
    const run=spawnSync(process.execPath,[new URL('../tools/replay-metal.mjs',import.meta.url).pathname,file],{encoding:'utf8',timeout:120000});
    assert.equal(run.status,0,(run.stderr||'')+(run.stdout||''));
    const result=JSON.parse(run.stdout);
    assert.equal(result.ok,true,JSON.stringify(result.divergence));
    assert(result.checked>10,'the CLI compared recorded digests against the restored simulation');
    assert.equal(final,sim.digest(),'digesting the live simulation stayed a pure observation');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
