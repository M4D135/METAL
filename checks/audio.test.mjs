// Real FAudio + MOD transport with observable WebAudio scheduling and graph ownership.
// This verifies integration/lifecycle, not subjective sound quality or a browser device.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const source=Object.fromEntries(['music','audio','destruction','effects','simulation','motion','actors','options','game'].map(name=>
  [name,readFileSync(new URL(`src/${name}.js`,root),'utf8')]));
class Param{
  constructor(value=0){this.value=value;this.events=[];}
  event(type,value,time){assert(Number.isFinite(value)&&Number.isFinite(time));this.value=value;this.events.push({type,value,time});}
  setValueAtTime(v,t){this.event('set',v,t);}
  linearRampToValueAtTime(v,t){this.event('linear',v,t);}
  exponentialRampToValueAtTime(v,t){assert(v>0);this.event('exponential',v,t);}
  setTargetAtTime(v,t,c){assert(c>0);this.event('target',v,t);}
  cancelScheduledValues(t){assert(Number.isFinite(t));}
}
class Context{
  constructor(){this.currentTime=0;this.sampleRate=44100;this.state='suspended';this.nodes=[];this.sources=[];this.buffers=[];this.resumes=0;this.closes=0;this.destination=this.node('destination');}
  node(kind){const n={kind,connections:[],disconnected:false,connect(target){this.connections.push(target);return target;},disconnect(){this.connections=[];this.disconnected=true;}};this.nodes.push(n);return n;}
  createGain(){const n=this.node('gain');n.gain=new Param(1);return n;}
  createStereoPanner(){const n=this.node('pan');n.pan=new Param();return n;}
  createBiquadFilter(){const n=this.node('filter');n.frequency=new Param(350);n.Q=new Param(1);return n;}
  createDelay(){const n=this.node('delay');n.delayTime=new Param();return n;}
  createDynamicsCompressor(){const n=this.node('limiter');for(const key of ['threshold','knee','ratio','attack','release'])n[key]=new Param();return n;}
  createWaveShaper(){return this.node('guard');}
  createBuffer(channels,length,sampleRate){assert(channels>0&&length>0&&sampleRate>=8000);const arrays=Array.from({length:channels},()=>new Float32Array(length));const b={sampleRate,length,duration:length/sampleRate,getChannelData:i=>arrays[i]};this.buffers.push(b);return b;}
  scheduled(kind){const n=this.node(kind);n.startTime=Infinity;n.stopTime=Infinity;n.ended=false;n.playbackRate=new Param(1);n.frequency=new Param(440);
    n.start=(t=this.currentTime,offset=0)=>{assert(t>=this.currentTime-.001,'source scheduled in the past');n.startTime=t;n.offset=offset;};
    n.stop=(t=this.currentTime)=>{assert(Number.isFinite(t));n.stopTime=t;};this.sources.push(n);return n;}
  createOscillator(){return this.scheduled('oscillator');}
  createBufferSource(){return this.scheduled('source');}
  advance(seconds){this.currentTime+=seconds;for(const n of this.sources){const natural=n.kind==='source'&&!n.loop?n.startTime+Math.max(0,(n.buffer?.duration||0)-n.offset)/n.playbackRate.value:Infinity;if(!n.ended&&Math.min(n.stopTime,natural)<=this.currentTime){n.ended=true;n.onended?.();}}}
  resume(){this.resumes++;this.state='running';return Promise.resolve();}
  close(){this.closes++;this.state='closed';return Promise.resolve();}
}
function rig({unavailable=false,noPan=false}={}){
  const contexts=[],music=[],scope={};scope.window=scope;
  if(!unavailable)scope.AudioContext=class extends Context{constructor(){super();if(noPan)this.createStereoPanner=undefined;contexts.push(this);}};
  vm.createContext(scope);vm.runInContext(source.music,scope,{filename:'music.js'});
  const create=scope.FMusic.create;scope.FMusic.create=(ctx,output)=>{const first=ctx.nodes.length,instance=create(ctx,output);music.push({instance,output,owned:ctx.nodes.slice(first)});return instance;};
  vm.runInContext(source.audio,scope,{filename:'audio.js'});
  return {scope,contexts,music,audio:scope.FAudio.create(),get ctx(){return contexts.at(-1);},get tracker(){return music.at(-1)?.instance;}};
}
function run(r,seconds,step=.04){for(let t=0;t<seconds;t+=step){r.audio.tick();r.ctx.advance(step);}}

test('pre-start settings reach the tracker and independent buses through one lazily created context',async()=>{
  const r=rig();r.audio.setStage(2);r.audio.setThreat(1);r.audio.setMix({master:.7,music:.3,effects:.4,ambience:.2});r.audio.setMuted(true);r.audio.tick();
  assert.equal(r.contexts.length,0,'menus do not open audio before a user action');
  await r.audio.start();await r.audio.resume();assert.equal(r.contexts.length,1);assert.equal(r.ctx.resumes,1);
  const {output,owned}=r.music[0];assert.equal(output.gain.value,0);assert.equal(r.tracker.stats.stage,2);assert(!r.tracker.stats.playing);
  const limiter=output.connections[0];assert.equal(limiter.kind,'limiter');assert.equal(limiter.connections[0].kind,'guard');assert.equal(limiter.connections[0].connections[0],r.ctx.destination);
  const direct=r.ctx.nodes.filter(n=>n.kind==='gain'&&n.connections.includes(output));
  assert(direct.some(n=>Math.abs(n.gain.value-.32)<1e-9));assert(direct.some(n=>Math.abs(n.gain.value-.12)<1e-9));
  const before=r.ctx.sources.length;run(r,.4);assert.equal(r.ctx.sources.length,before);
  r.audio.setMuted(false);r.audio.setPlaying(true);r.audio.tick();assert(Math.abs(output.gain.value-.455)<1e-9);assert.equal(owned[0].gain.value,.3);assert.equal(r.tracker.stats.tempo,145);assert(r.tracker.stats.scheduledNotes>0);
  const leadPan=owned.find(n=>n.pan?.value===.32),lead=owned.find(n=>n.connections.includes(leadPan));assert.equal(lead.gain.value,.72);
  const noteCount=r.tracker.stats.scheduledNotes;r.audio.setThreat(0);assert.equal(lead.gain.value,.25);assert.equal(r.tracker.stats.scheduledNotes,noteCount,'intensity changes mix without spawning extra voices');
  r.audio.dispose();
});

test('a full SFX budget cannot starve tracker scheduling or take its voices',async()=>{
  const r=rig();r.audio.setStage(1);r.audio.setPlaying(true);await r.audio.start();r.audio.tick();
  const before=r.ctx.sources.length;for(let i=0;i<200;i++)r.audio.enemyShot({kind:i%4,level:.6,pan:0});
  assert.equal(r.ctx.sources.length-before,48,'SFX cap holds during a burst from many enemies');
  const notes=r.tracker.stats.scheduledNotes;
  // Hold ended callbacks to model a delayed main-thread turn with all SFX slots busy.
  r.ctx.currentTime+=.12;r.audio.tick();assert(r.tracker.stats.scheduledNotes>notes);
  assert(r.tracker.stats.activeVoices<=28);r.ctx.advance(.7);run(r,2);assert.equal(r.tracker.stats.resyncs,1);
  r.audio.dispose();assert.equal(r.ctx.closes,1);assert(r.ctx.nodes.filter(n=>n!==r.ctx.destination).every(n=>n.disconnected));
});

test('global mute, music mute, pause and sector changes retain independent transport semantics',async()=>{
  const r=rig();await r.audio.start();r.audio.setPlaying(true);run(r,.9);
  const {output,owned}=r.music[0];r.audio.setMuted(true);assert.equal(output.gain.value,0);const silentRows=r.tracker.stats.scheduledRows;run(r,.5);assert(r.tracker.stats.scheduledRows>silentRows,'global mute preserves musical position');
  r.audio.setMix({master:.5,music:0,effects:.8,ambience:.4});const musicNotes=r.tracker.stats.scheduledNotes;run(r,.5);assert.equal(r.tracker.stats.scheduledNotes,musicNotes);assert.equal(r.tracker.stats.activeVoices,0);
  r.audio.setMuted(false);assert.equal(output.gain.value,.325);assert.equal(owned[0].gain.value,0);const effects=r.ctx.sources.length;r.audio.shot();assert(r.ctx.sources.length>effects,'effects remain audible when music alone is disabled');
  r.audio.setPlaying(false);r.audio.setMix({music:.6});run(r,.5);assert.equal(r.tracker.stats.scheduledNotes,musicNotes);assert.equal(owned[0].gain.value,0);
  r.audio.setStage(2);assert.equal(r.tracker.stats.stage,2);r.audio.setPlaying(true);r.audio.tick();assert.equal(r.tracker.stats.tempo,145);assert.equal(r.tracker.stats.order,0);assert(r.tracker.stats.row<4);assert.equal(owned[0].gain.value,.6);
  r.audio.setPlaying(false);r.ctx.advance(.03);assert.equal(r.tracker.stats.activeVoices,0);const stopped=r.tracker.stats.scheduledRows;run(r,20);assert.equal(r.tracker.stats.scheduledRows,stopped);
  r.audio.setPlaying(true);r.audio.tick();assert(r.tracker.stats.scheduledRows>stopped);assert(r.tracker.stats.row<4);r.audio.dispose();
});

test('audio interruption, panner fallback, disposal and unavailable audio remain safe',async()=>{
  const r=rig({noPan:true});await r.audio.start();r.audio.setPlaying(true);run(r,.4);r.ctx.state='interrupted';const before=r.tracker.stats.scheduledRows;r.audio.tick();assert.equal(r.tracker.stats.scheduledRows,before);
  await r.audio.resume();r.ctx.advance(.2);r.audio.tick();assert(r.tracker.stats.scheduledRows>before);assert.equal(r.contexts.length,1);
  r.audio.dispose();r.audio.dispose();const count=r.ctx.nodes.length;await r.audio.start();r.audio.tick();r.audio.shot();r.audio.setMix({music:1});r.audio.setStage(1);assert.equal(r.ctx.nodes.length,count);assert.equal(r.ctx.closes,1);assert.equal(r.tracker.stats.activeVoices,0);
  const silent=rig({unavailable:true});await silent.audio.start();silent.audio.setPlaying(true);silent.audio.setMix({music:1});silent.audio.tick();silent.audio.shot();silent.audio.dispose();assert.equal(silent.contexts.length,0);assert.equal(Buffer.from(silent.scope.FMusic.getModule(1).slice(1080,1084)).toString(),'M.K.');
});

test('final output guard preserves ordinary samples and bounds any finite overload before the destination',async()=>{
  const r=rig();await r.audio.start();const guard=r.ctx.nodes.find(n=>n.kind==='guard'),curve=guard.curve;
  assert.equal(guard.oversample,'none');assert.equal(guard.connections[0],r.ctx.destination);assert.equal(r.ctx.nodes.filter(n=>n.connections.includes(r.ctx.destination)).length,1);
  assert.equal(curve.length,2049);assert.equal(curve[1024],0);assert(r.audio.stats.outputCeiling<.97);
  for(let i=0;i<curve.length;i++){assert(Number.isFinite(curve[i])&&Math.abs(curve[i])<.97);if(i)assert(curve[i]>=curve[i-1]);const x=i/1024-1;if(Math.abs(x)<=.875)assert.equal(curve[i],x);}
  // WaveShaper's specified clamped, linearly interpolated transfer function.
  const transfer=x=>{const position=Math.max(0,Math.min(curve.length-1,(x+1)*1024)),i=Math.floor(position),f=position-i;return curve[i]*(1-f)+(curve[Math.min(i+1,curve.length-1)])*f;};
  for(let i=0;i<10000;i++){const x=(i-5000)*.017;assert(Math.abs(transfer(x))<.97);if(Math.abs(x)<.875)assert(Math.abs(transfer(x)-x)<1e-7);}
  assert(Math.abs(transfer(-1e6))===r.audio.stats.outputCeiling);assert(transfer(1e6)===r.audio.stats.outputCeiling);r.audio.dispose();
});

test('explosion/boss storms stay bounded and continuous steam follows actual play state with one source',async()=>{
  const r=rig();await r.audio.start();r.audio.setPlaying(true);r.audio.setStage(1);
  const hiss=r.ctx.sources.find(n=>n.loop&&n.connections[0]?.frequency?.value===1850),gain=hiss.connections[0].connections[0];assert(hiss);
  r.audio.setSteam(.7,.3);assert(Math.abs(gain.gain.value-.0595)<1e-9);const sources=r.ctx.sources.length;
  for(let i=0;i<100;i++)r.audio.setSteam(.7,.3);assert.equal(r.ctx.sources.length,sources,'pipes share one persistent source');
  for(let step=0;step<120;step++){
    for(let i=0;i<12;i++)for(const name of ['rocket','grenade','explosion','pipeLeak','trap','creak','bossTell','bossRoar','bossImpact','bossDeath'])r.audio[name]({level:.8,pan:.2,kind:'blade',radius:6});
    r.audio.tick();assert(r.audio.stats.voices<=48);assert(r.tracker.stats.activeVoices<=28);r.ctx.advance(.04);
  }
  assert(r.audio.stats.fxSkipped>100);assert(r.tracker.stats.scheduledRows>40);assert(r.audio.stats.peakVoices<=48);
  r.audio.setPlaying(false);assert.equal(gain.gain.value,0);r.audio.setPlaying(true);assert(gain.gain.value>0);r.audio.setStage(2);assert.equal(gain.gain.value,0);
  r.audio.dispose();assert.equal(r.audio.stats.voices,0);assert(hiss.disconnected);assert.equal(r.ctx.closes,1);
});

test('horror pressure reuses ambience and the MOD mix while spatial cues remain bounded and pause-safe',async()=>{
  const r=rig();r.audio.setPressure(1);r.audio.horror({kind:'metallicSlam',intensity:1});assert.equal(r.contexts.length,0);await r.audio.start();
  const idle=r.ctx.sources.length;r.audio.horror({kind:'alarm',intensity:1});assert.equal(r.ctx.sources.length,idle,'menu pressure cannot start a sting');
  r.audio.setPlaying(true);r.audio.tick();const {owned}=r.music[0],leadPan=owned.find(n=>n.pan?.value===.32),lead=owned.find(n=>n.connections.includes(leadPan)),raised=lead.gain.value;
  const nodes=r.ctx.nodes.length;r.audio.setPressure(0);assert(lead.gain.value<raised);r.audio.setPressure(1);assert.equal(lead.gain.value,raised);assert.equal(r.ctx.nodes.length,nodes,'continuous pressure creates no sources or timers');
  for(const kind of ['metallicSlam','blackout','alarm','ambush']){
    const before=r.ctx.sources.length;r.audio.horror({kind,intensity:.8,level:.7,pan:-.65,tier:2});assert(r.ctx.sources.length>before);assert(r.ctx.sources.slice(before).every(n=>n.stopTime-r.ctx.currentTime<1));
    const once=r.ctx.sources.length;r.audio.horror({kind,intensity:.8,level:.7,pan:-.65,tier:2});assert.equal(r.ctx.sources.length,once,'identical simultaneous shocks share the cooldown');
    const pans=r.ctx.nodes.filter(n=>n.kind==='pan'&&n.pan.value===-.65);assert(pans.length>0);r.ctx.advance(1.1);
  }
  for(let i=0;i<120;i++){r.audio.horrorSting({intensity:1,level:1,tier:i%4});r.audio.metallicSlam({intensity:1});r.audio.alarm({intensity:1});r.audio.powerCut({intensity:1});assert(r.audio.stats.voices<=48);r.ctx.advance(.01);}
  r.audio.setPlaying(false);const stopped=r.ctx.sources.length;r.audio.horror({kind:'ambush',intensity:1});assert.equal(r.ctx.sources.length,stopped);r.audio.setStage(2);r.audio.setPlaying(true);assert(lead.gain.value<raised);r.audio.dispose();assert.equal(r.audio.stats.voices,0);
});

function shell(){
  const r=rig(),elements=new Map(),listeners=new Map(),documentListeners=new Map(),memory=new Map(),errors=[],simulations=[],downloads=[],blobs=[],timers=[];let frame,now=0;
  const noop=()=>{},draw=new Proxy({},{get:()=>noop});
  function element(id){if(elements.has(id))return elements.get(id);const events=new Map(),classes=new Set();const el={style:{},dataset:{},firstChild:{textContent:''},hidden:false,
    classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),toggle(n,on){on??=!classes.has(n);on?classes.add(n):classes.delete(n);}},
    addEventListener:(name,fn)=>events.set(name,fn),dispatch:(name,event={})=>events.get(name)?.({preventDefault:noop,...event}),click(){this.dispatch('click');if(this.download)downloads.push(this);},
    querySelector:selector=>element(id+selector),querySelectorAll:()=>[],setAttribute:noop,focus:noop,getContext:()=>draw,requestPointerLock:noop};elements.set(id,el);return el;}
  const world=(seed,stage)=>({seed,stage,generation:5,title:'Audio QA',spawn:{x:0,z:0,yaw:0},bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},meshes:[],lights:[],colliders:[],enemies:[],pickups:[],hazards:[],rooms:[{x:0,z:0,w:40,d:40,name:'QA',outdoor:true}],corridors:[],environment:{biome:'woodland',outdoorZones:[]},cores:[{id:0,x:6,z:0},{id:1,x:8,z:0},{id:2,x:10,z:0}],exit:{x:15,z:0}});
  Object.assign(r.scope,{console:{error:(...args)=>errors.push(args)},performance:{now:()=>now},innerWidth:1280,innerHeight:800,URLSearchParams,Blob,
    URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:qa-'+blobs.length;},revokeObjectURL:noop},setTimeout:fn=>timers.push(fn),
    navigator:{maxTouchPoints:0},location:{search:''},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{frame=fn;},addEventListener:(name,fn)=>listeners.set(name,fn),
    document:{body:element('body'),getElementById:element,createElement:tag=>element(tag+elements.size),addEventListener:(name,fn)=>documentListeners.set(name,fn),hasFocus:()=>true},
    localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)},FWorld:{create:world},
    FRender:{create:()=>({stats:{backend:'test'},resize:noop,setWorld:noop,draw:noop})}});
  // The shell receives the same observed real audio instance as the direct API tests.
  r.scope.FAudio.create=()=>r.audio;
  for(const name of ['destruction','effects','simulation','motion','actors','options'])vm.runInContext(source[name],r.scope,{filename:name+'.js'});
  const create=r.scope.FSimulation.create;r.scope.FSimulation.create=value=>{const sim=create(value);simulations.push(sim);return sim;};
  vm.runInContext(source.game,r.scope,{filename:'game.js'});assert.deepEqual(errors,[],'game must initialize without an audio or DOM exception');
  return Object.assign(r,{element,listeners,documentListeners,simulations,downloads,blobs,timers,memory,frame(ms=40){now+=ms;if(r.ctx)r.ctx.advance(ms/1000);frame(now);},mode:()=>element('body').dataset.state||'menu'});
}

test('actual game menus, pause, focus loss, volume controls and MOD export drive the real transport',async()=>{
  const app=shell();app.frame();assert.equal(app.contexts.length,0);app.element('intro-options').click();assert.equal(app.mode(),'options');app.frame();assert.equal(app.contexts.length,0);
  app.element('export-mod').click();assert.equal(app.downloads[0].download,'METAL-01.mod');const exported=new Uint8Array(await app.blobs[0].arrayBuffer());assert.equal(Buffer.from(exported.slice(1080,1084)).toString(),'M.K.');assert.equal(app.contexts.length,0,'MOD export does not need an audio device');
  app.element('resume').click();assert.equal(app.mode(),'menu');app.element('start').click();app.frame();assert.equal(app.mode(),'playing');assert(app.tracker.stats.playing&&app.tracker.stats.scheduledNotes>0);
  app.element('pause-button').click();app.frame(100);assert.equal(app.mode(),'paused');assert(!app.tracker.stats.playing);assert.equal(app.tracker.stats.activeVoices,0);const paused=app.tracker.stats.scheduledNotes;app.frame(400);assert.equal(app.tracker.stats.scheduledNotes,paused);
  app.element('music-setting').value='0';app.element('music-setting').dispatch('input');app.element('resume').click();app.frame();assert(app.tracker.stats.playing);assert.equal(app.tracker.stats.scheduledNotes,paused);
  app.element('music-setting').value='65';app.element('music-setting').dispatch('input');app.frame();assert(app.tracker.stats.scheduledNotes>paused);assert.equal(app.music[0].owned[0].gain.value,.65);
  app.element('sound-toggle').click();assert.equal(app.music[0].output.gain.value,0);app.element('sound-toggle').click();assert.equal(app.music[0].output.gain.value,.65);
  app.listeners.get('blur')();app.frame(100);assert.equal(app.mode(),'paused');assert.equal(app.tracker.stats.activeVoices,0);
  app.element('pause-main').click();app.frame();assert.equal(app.mode(),'menu');assert(!app.tracker.stats.playing);assert.equal(app.music[0].output.gain.value,0);
  assert.equal(JSON.parse(app.memory.get('ferro-settings')).musicVolume,.65);app.audio.dispose();
});

test('actual sector completion silences the old score and starts each next sector at its encoded tempo',()=>{
  const app=shell();app.element('start').click();app.frame();
  for(let stage=0;stage<3;stage++){
    assert.equal(app.tracker.stats.stage,stage);assert.equal(app.tracker.stats.tempo,[100,170,145][stage]);
    for(const x of [6,8,10,15]){app.simulations.at(-1).state.player.x=x;app.frame();}
    assert.equal(app.mode(),stage===2?'complete':'cleared');assert(!app.tracker.stats.playing);app.frame(100);assert.equal(app.tracker.stats.activeVoices,0);
    const notes=app.tracker.stats.scheduledNotes;app.frame(100);assert.equal(app.tracker.stats.scheduledNotes,notes);
    if(stage<2){app.element('continue').click();app.frame();assert.equal(app.mode(),'playing');assert(app.tracker.stats.scheduledNotes>notes);assert.equal(app.tracker.stats.order,0);assert(app.tracker.stats.row<4);}
  }
  assert.equal(app.contexts.length,1);app.audio.dispose();
});
