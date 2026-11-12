// Real FAudio + MOD transport with observable WebAudio scheduling and graph ownership.
// This verifies integration/lifecycle, not subjective sound quality or a browser device.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const source=Object.fromEntries(['music','audio','economy','destruction','effects','simulation','motion','actors','options','game'].map(name=>
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
  const contexts=[],music=[],scope={},timers=new Map();let timerId=0;scope.window=scope;
  scope.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:(contexts.at(-1)?.currentTime||0)+ms/1000});return id;};scope.clearTimeout=id=>timers.delete(id);
  if(!unavailable)scope.AudioContext=class extends Context{constructor(){super();if(noPan)this.createStereoPanner=undefined;contexts.push(this);}};
  vm.createContext(scope);vm.runInContext(source.music,scope,{filename:'music.js'});
  const create=scope.FMusic.create;scope.FMusic.create=(ctx,output)=>{const first=ctx.nodes.length,instance=create(ctx,output);music.push({instance,output,owned:ctx.nodes.slice(first)});return instance;};
  vm.runInContext(source.audio,scope,{filename:'audio.js'});
  return {scope,contexts,music,timers,audio:scope.FAudio.create(),get ctx(){return contexts.at(-1);},get master(){return music.at(-1)?.output.connections[0];},get tracker(){return music.at(-1)?.instance;},advanceTimers(seconds){const end=contexts.at(-1).currentTime+seconds;let count=0;while(timers.size){const [id,timer]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(timer.at>end)break;assert(++count<1000,'timer pump is bounded');contexts.at(-1).advance(Math.max(0,timer.at-contexts.at(-1).currentTime));timers.delete(id);timer.fn();}contexts.at(-1).advance(Math.max(0,end-contexts.at(-1).currentTime));}};
}
function run(r,seconds,step=.04){for(let t=0;t<seconds;t+=step){r.audio.tick();r.ctx.advance(step);}}

test('pre-start settings reach the tracker and independent buses through one lazily created context',async()=>{
  const r=rig();r.audio.setStage(2);r.audio.setThreat(1);r.audio.setMix({master:.7,music:.3,effects:.4,ambience:.2});r.audio.setMuted(true);r.audio.tick();
  assert.equal(r.contexts.length,0,'menus do not open audio before a user action');
  await r.audio.start();await r.audio.resume();assert.equal(r.contexts.length,1);assert.equal(r.ctx.resumes,1);
  const {owned}=r.music[0],output=r.master;assert.equal(output.gain.value,0);assert.equal(r.tracker.stats.stage,2);assert(!r.tracker.stats.playing);
  const limiter=output.connections[0];assert.equal(limiter.kind,'limiter');assert.equal(limiter.connections[0].kind,'guard');assert.equal(limiter.connections[0].connections[0],r.ctx.destination);
  const direct=r.ctx.nodes.filter(n=>n.kind==='gain'&&n.connections.includes(output));
  assert(direct.some(n=>Math.abs(n.gain.value-.36)<1e-9));assert(direct.some(n=>Math.abs(n.gain.value-.18)<1e-9));
  const before=r.ctx.sources.length;run(r,.4);assert.equal(r.ctx.sources.length,before);
  r.audio.setMuted(false);r.audio.setPlaying(true);r.audio.tick();assert(Math.abs(output.gain.value-.455)<1e-9);assert.equal(owned[0].gain.value,.3);assert.equal(r.tracker.stats.tempo,145);assert(r.tracker.stats.scheduledNotes>0);
  const leadPan=owned.find(n=>n.pan?.value===.32),lead=owned.find(n=>n.connections.includes(leadPan));assert.equal(lead.gain.value,.52);
  const noteCount=r.tracker.stats.scheduledNotes;r.audio.setThreat(0);assert.equal(lead.gain.value,.30);assert.equal(r.tracker.stats.scheduledNotes,noteCount,'intensity changes mix without spawning extra voices');
  r.audio.dispose();
});

test('distant salvos reserve player voices and never starve the independent tracker',async()=>{
  const r=rig();r.audio.setStage(1);r.audio.setPlaying(true);await r.audio.start();r.audio.tick();
  const before=r.ctx.sources.length;for(let i=0;i<200;i++)r.audio.enemyShot({kind:i%4,level:.6,pan:0});
  assert.equal(r.ctx.sources.length-before,2,'simultaneous shots from one bearing share a transient');
  // Keep ended callbacks delayed, and fill every bearing across two salvos.
  for(let burst=0;burst<2;burst++){r.ctx.currentTime+=.065;for(let p=-4;p<=4;p++)r.audio.enemyShot({kind:1,level:.6,pan:p/4});}
  assert.equal(r.audio.stats.voices,32,'background attackers cannot consume the reserved slots');
  let count=r.ctx.sources.length;r.audio.shot();assert.equal(r.ctx.sources.length-count,4,'all four components of the local weapon are retained');
  r.audio.fracture();r.audio.hurt();r.audio.bossImpact({level:1});r.audio.bossTell({level:1});
  assert(r.audio.stats.voices<=48);assert(r.audio.stats.stolenVoices>0,'an urgent nearby cue can replace a distant voice');
  const notes=r.tracker.stats.scheduledNotes;r.ctx.currentTime+=.12;r.audio.tick();assert(r.tracker.stats.scheduledNotes>notes);
  assert(r.tracker.stats.activeVoices<=28);r.ctx.advance(.7);run(r,2);assert(r.tracker.stats.resyncs>=1);
  r.audio.dispose();assert.equal(r.ctx.closes,1);assert(r.ctx.nodes.filter(n=>n!==r.ctx.destination).every(n=>n.disconnected));
});

test('global mute, music mute, pause and sector changes retain independent transport semantics',async()=>{
  const r=rig();await r.audio.start();r.audio.setPlaying(true);run(r,.9);
  const {owned}=r.music[0],output=r.master;r.audio.setMuted(true);assert.equal(output.gain.value,0);const silentRows=r.tracker.stats.scheduledRows;run(r,.5);assert(r.tracker.stats.scheduledRows>silentRows,'global mute preserves musical position');
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
  r.audio.setSteam(.7,.3);assert(Math.abs(gain.gain.value-.0805)<1e-9);const sources=r.ctx.sources.length;
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
  const r=rig(),elements=new Map(),listeners=new Map(),documentListeners=new Map(),memory=new Map(),errors=[],simulations=[],downloads=[],blobs=[],timers=[];let frames=[],now=0;
  const noop=()=>{},draw=new Proxy({},{get:()=>noop}),schedule=r.scope.setTimeout;
  // Pure PCM warmup is tested with yielding jobs separately. Here use the real
  // cache synchronously so this DOM harness controls RAF and transport timing.
  r.scope.FMusic.warmup=async stage=>{const bytes=r.scope.FMusic.getModule(stage);return {...r.scope.FMusic.getTrack(stage),bytes:bytes.length};};
  function element(id){if(elements.has(id))return elements.get(id);const events=new Map(),classes=new Set();const el={style:{},dataset:{},firstChild:{textContent:''},hidden:false,
    classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),toggle(n,on){on??=!classes.has(n);on?classes.add(n):classes.delete(n);}},
    addEventListener:(name,fn)=>events.set(name,fn),dispatch:(name,event={})=>events.get(name)?.({preventDefault:noop,...event}),click(){this.dispatch('click');if(this.download)downloads.push(this);},
    querySelector:selector=>element(id+selector),querySelectorAll:()=>[],setAttribute:noop,focus:noop,getContext:()=>draw,requestPointerLock:noop};elements.set(id,el);return el;}
  const world=(seed,stage)=>({seed,stage,generation:5,title:'Audio QA',spawn:{x:0,z:0,yaw:0},bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},meshes:[],lights:[],colliders:[],enemies:[],pickups:[],hazards:[],rooms:[{x:0,z:0,w:40,d:40,name:'QA',outdoor:true}],corridors:[],environment:{biome:'woodland',outdoorZones:[]},cores:[{id:0,x:6,z:0},{id:1,x:8,z:0},{id:2,x:10,z:0}],exit:{x:15,z:0}});
  Object.assign(r.scope,{console:{error:(...args)=>errors.push(args)},performance:{now:()=>now},innerWidth:1280,innerHeight:800,URLSearchParams,Blob,
    URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:qa-'+blobs.length;},revokeObjectURL:noop},setTimeout:(fn,ms)=>{timers.push(fn);return schedule(fn,ms);},
    navigator:{maxTouchPoints:0},location:{search:''},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{frames.push(fn);},addEventListener:(name,fn)=>listeners.set(name,fn),
    document:{body:element('body'),getElementById:element,createElement:tag=>element(tag+elements.size),addEventListener:(name,fn)=>documentListeners.set(name,fn),hasFocus:()=>true},
    localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)},FWorld:{create:world},
    FRender:{create:()=>({stats:{backend:'test'},resize:noop,setWorld:noop,draw:noop})}});
  // The shell receives the same observed real audio instance as the direct API tests.
  r.scope.FAudio.create=()=>r.audio;
  for(const name of ['economy','destruction','effects','simulation','motion','actors','options'])vm.runInContext(source[name],r.scope,{filename:name+'.js'});
  const create=r.scope.FSimulation.create;r.scope.FSimulation.create=value=>{const sim=create(value);simulations.push(sim);return sim;};
  vm.runInContext(source.game,r.scope,{filename:'game.js'});assert.deepEqual(errors,[],'game must initialize without an audio or DOM exception');
  return Object.assign(r,{element,listeners,documentListeners,simulations,downloads,blobs,timers,memory,frame(ms=40){now+=ms;if(r.ctx)r.advanceTimers(ms/1000);const batch=frames;frames=[];for(const fn of batch)fn(now);},async ready(){for(let i=0;i<40;i++){this.frame();await Promise.resolve();await Promise.resolve();if(this.mode()!=='loading')return;}throw new Error('loading did not finish');},mode:()=>element('body').dataset.state||'menu'});
}

test('actual game menus, pause, focus loss, volume controls and MOD export drive the real transport',async()=>{
  const app=shell();app.frame();assert.equal(app.contexts.length,0);app.element('intro-options').click();assert.equal(app.mode(),'options');app.frame();assert.equal(app.contexts.length,0);
  app.element('export-mod').click();assert.equal(app.downloads[0].download,'METAL-01.mod');const exported=new Uint8Array(await app.blobs[0].arrayBuffer());assert.equal(Buffer.from(exported.slice(1080,1084)).toString(),'M.K.');assert.equal(app.contexts.length,0,'MOD export does not need an audio device');
  app.element('resume').click();assert.equal(app.mode(),'menu');app.element('start').click();await app.ready();app.frame();assert.equal(app.mode(),'playing');assert(app.tracker.stats.playing&&app.tracker.stats.scheduledNotes>0);
  app.element('pause-button').click();app.frame(100);assert.equal(app.mode(),'paused');assert(!app.tracker.stats.playing);assert.equal(app.tracker.stats.activeVoices,0);const paused=app.tracker.stats.scheduledNotes;app.frame(400);assert.equal(app.tracker.stats.scheduledNotes,paused);
  app.element('music-setting').value='0';app.element('music-setting').dispatch('input');app.element('resume').click();app.frame();assert(app.tracker.stats.playing);assert.equal(app.tracker.stats.scheduledNotes,paused);
  app.element('music-setting').value='65';app.element('music-setting').dispatch('input');app.frame();assert(app.tracker.stats.scheduledNotes>paused);assert.equal(app.music[0].owned[0].gain.value,.65);
  app.element('sound-toggle').click();assert.equal(app.master.gain.value,0);app.element('sound-toggle').click();assert.equal(app.master.gain.value,.65);
  app.listeners.get('blur')();app.frame(100);assert.equal(app.mode(),'paused');assert.equal(app.tracker.stats.activeVoices,0);
  app.element('pause-main').click();app.frame();assert.equal(app.mode(),'menu');assert(!app.tracker.stats.playing);assert.equal(app.master.gain.value,0);
  assert.equal(JSON.parse(app.memory.get('ferro-settings')).musicVolume,.65);app.audio.dispose();
});

test('actual sector completion silences the old score and starts each next sector at its encoded tempo',async()=>{
  const app=shell();app.element('start').click();await app.ready();app.frame();
  for(let stage=0;stage<3;stage++){
    assert.equal(app.tracker.stats.stage,stage);assert.equal(app.tracker.stats.tempo,[100,170,145][stage]);
    for(const x of [6,8,10,15]){app.simulations.at(-1).state.player.x=x;app.frame();}
    assert.equal(app.mode(),stage===2?'complete':'cleared');assert(!app.tracker.stats.playing);app.frame(100);assert.equal(app.tracker.stats.activeVoices,0);
    const notes=app.tracker.stats.scheduledNotes;app.frame(100);assert.equal(app.tracker.stats.scheduledNotes,notes);
    if(stage<2){app.element('continue').click();await app.ready();app.frame();assert.equal(app.mode(),'playing');assert(app.tracker.stats.scheduledNotes>notes);assert.equal(app.tracker.stats.order,0);assert(app.tracker.stats.row<4);}
  }
  assert.equal(app.contexts.length,1);app.audio.dispose();
});

test('important effects duck only the music bus and preserve explicit silent sliders',async()=>{
  const r=rig();await r.audio.start();r.audio.setPlaying(true);r.audio.tick();const bus=r.music[0].output,master=r.master,volume=r.music[0].owned[0];
  const base=bus.gain.value,masterLevel=master.gain.value,musicLevel=volume.gain.value;r.audio.shot();
  assert(r.audio.stats.duckGain<base*.6);assert(bus.gain.events.some(e=>e.type==='target'&&e.value<base*.6));
  const recovery=bus.gain.events.at(-1);assert.equal(recovery.value,base);assert(recovery.time>r.ctx.currentTime&&recovery.time<r.ctx.currentTime+.4);
  assert.equal(master.gain.value,masterLevel);assert.equal(volume.gain.value,musicLevel,'ducking never rewrites the user music volume');
  r.ctx.advance(1.5);r.audio.tick();assert.equal(r.audio.stats.duckGain,base);
  r.audio.setMix({effects:0});const count=r.ctx.sources.length,events=bus.gain.events.length;r.audio.fracture();r.audio.enemyShot({level:1});r.audio.empty();assert.equal(r.ctx.sources.length,count);assert.equal(bus.gain.events.length,events,'silent effects cannot pump the soundtrack');
  r.audio.setMix({effects:1});r.audio.enemyShot({level:0});assert.equal(r.ctx.sources.length,count,'zero attenuation is silence, not a default of one');r.audio.dispose();
});

test('two-second menu audition owns one bounded timer, uses the real mix and returns to silence',async()=>{
  const r=rig();r.audio.setMuted(true);r.audio.setMix({master:.6,music:.3,effects:.7,ambience:.4});assert(await r.audio.testMix({muted:false}));
  assert(r.audio.stats.preview&&r.tracker.stats.playing);assert.equal(r.timers.size,1);assert.equal(r.music[0].owned[0].gain.value,.3);
  assert(r.master.gain.events.some(e=>e.type==='target'&&Math.abs(e.value-.39)<1e-9));
  assert(r.master.gain.events.some(e=>e.type==='linear'&&e.value===0&&e.time===2),'the audio clock closes the menu output even if timers stall');
  const initial=r.ctx.sources.length;r.advanceTimers(.65);assert(r.ctx.sources.length>initial+7,'the audition actually schedules both gunshots');assert(r.audio.stats.duckGain<.56);
  r.advanceTimers(1.5);assert(!r.audio.stats.preview&&!r.tracker.stats.playing);assert.equal(r.timers.size,0);assert.equal(r.audio.stats.voices,0);assert.equal(r.tracker.stats.activeVoices,0);assert.equal(r.master.gain.value,0);
  const end=r.ctx.sources.length;r.advanceTimers(10);assert.equal(r.ctx.sources.length,end);r.audio.dispose();
});

test('audition cancellation, in-flight resume, mute and zero volumes cannot leak sound or timers',async()=>{
  const muted=rig();assert.equal(await muted.audio.testMix({muted:true}),false);assert.equal(muted.contexts.length,0);muted.audio.setMix({master:0});assert.equal(await muted.audio.testMix({muted:false}),false);assert.equal(muted.contexts.length,0);
  const r=rig();r.audio.setMuted(true);const pending=r.audio.testMix({muted:false});r.audio.cancelTestMix();assert.equal(await pending,false);assert.equal(r.timers.size,0);
  r.audio.setMix({music:0,effects:0,ambience:0});assert(await r.audio.testMix({muted:false}));assert.equal(r.audio.stats.voices,0);assert.equal(r.tracker.stats.scheduledNotes,0);r.advanceTimers(.8);assert.equal(r.audio.stats.voices,0);assert.equal(r.tracker.stats.scheduledNotes,0);
  r.audio.cancelTestMix();assert.equal(r.timers.size,0);assert.equal(r.master.gain.value,0);
  r.audio.setMix({music:.4,effects:1,ambience:1});assert(await r.audio.testMix({muted:false}));r.audio.setPlaying(true);assert.equal(r.timers.size,0);assert(!r.audio.stats.preview&&r.tracker.stats.playing);
  r.audio.setPlaying(false);assert(await r.audio.testMix({muted:false}));r.audio.dispose();assert.equal(r.timers.size,0);assert.equal(r.audio.stats.voices,0);assert.equal(r.tracker.stats.activeVoices,0);r.advanceTimers(3);assert.equal(r.ctx.closes,1);
});

test('new arsenal cues are distinct, bounded and survive distant salvo saturation',async()=>{
  const r=rig();await r.audio.start();r.audio.setPlaying(true);
  const signatures=[];for(const name of ['ammoPickup','weaponPickup','empty','melee','wave']){
    const before=r.ctx.sources.length;r.audio[name]({level:.8,pan:-.3,hit:true});const created=r.ctx.sources.slice(before);
    assert(created.length>=2&&created.length<=5);signatures.push(created.map(n=>[n.kind,n.frequency.value,n.stopTime-r.ctx.currentTime]));
    for(let i=0;i<30;i++)r.audio[name]({level:.8,pan:-.3,hit:true});assert.equal(r.ctx.sources.length,before+created.length,'repeated input observes the cue cooldown');r.ctx.advance(1);
  }
  assert.equal(new Set(signatures.map(JSON.stringify)).size,5);assert(r.audio.stats.peakVoices<=48);r.audio.dispose();
});

test('device unlock is cheap and loading prepares future instrument buffers without changing play state',async()=>{
 const r=rig();r.scope.setTimeout=fn=>{queueMicrotask(fn);return 0;};await r.audio.start();assert.equal(r.ctx.buffers.length,1,'unlock only creates the shared noise buffer, not PCM instruments');assert.equal(r.tracker.stats.scheduledNotes,0);
 const sources=r.ctx.sources.length,nodes=r.ctx.nodes.length;assert(await r.audio.prepare(2));assert.equal(r.tracker.stats.stage,0);assert(!r.tracker.stats.playing);assert.equal(r.ctx.sources.length,sources);assert.equal(r.ctx.nodes.length,nodes);
 const buffers=r.ctx.buffers.length;assert.equal(buffers,16);r.audio.setStage(2);r.audio.setPlaying(true);run(r,9);assert.equal(r.ctx.buffers.length,buffers,'first combat notes do not allocate cached AudioBuffers');
 r.audio.dispose();assert.equal(await r.audio.prepare(1),false);
 const cold=rig();cold.scope.setTimeout=fn=>{queueMicrotask(fn);return 0;};assert.equal(await cold.audio.prepare(0),false);assert.equal(cold.contexts.length,0,'preparation never opens a device without a user gesture');cold.audio.dispose();
});

test('explosions have bounded crack/body/debris tails, scale with power and preserve the player reserve',async()=>{
 async function burst(event){const r=rig();await r.audio.start();r.audio.setPlaying(true);const before=r.ctx.sources.length,firstNode=r.ctx.nodes.length;r.audio.explosion(event);const voices=r.ctx.sources.slice(before),nodes=r.ctx.nodes.slice(firstNode);return {r,voices,nodes,peak:Math.max(...nodes.flatMap(n=>n.gain?.events.filter(e=>e.type==='linear').map(e=>e.value)||[])),end:Math.max(...voices.map(n=>n.stopTime-r.ctx.currentTime))};}
 const close=await burst({level:1,pan:.4,radius:4.2,power:55,kind:'rocket',seed:96});assert.equal(close.voices.length,7);assert(close.voices.filter(n=>n.kind==='oscillator').length===3);assert(close.voices.filter(n=>n.kind==='source').length===4);assert(close.end>1.3&&close.end<2.1);assert(close.peak>.4&&close.peak<.5);assert(close.nodes.some(n=>n.kind==='filter'&&n.type==='lowpass'));assert(close.nodes.some(n=>n.kind==='filter'&&n.type==='bandpass'));
 const far=await burst({level:.15,pan:.4,radius:4.2,power:55,kind:'rocket',seed:96});assert(far.peak<close.peak*.2);assert(far.r.audio.stats.duckGain>close.r.audio.stats.duckGain*2,'a distant blast does not deeply duck nearby action');
 const steam=await burst({level:1,pan:.4,radius:2.25,power:10,kind:'steam',seed:96});assert(steam.peak<close.peak*.5);assert(steam.end<close.end);
 const r=close.r;for(let i=0;i<20;i++){r.ctx.currentTime+=.1;r.audio.explosion({level:1,radius:6,power:90,kind:'boss',seed:i});}assert(r.audio.stats.voices<=40,'explosion tails cannot consume the player reservation');const count=r.ctx.sources.length;r.audio.shot();assert.equal(r.ctx.sources.length-count,4);assert(r.audio.stats.voices<=48);assert(r.audio.stats.outputCeiling<.97);
 for(const q of [close,far,steam])q.r.audio.dispose();
});

test('simultaneous hands keep independent firing transients, stereo placement and cooldowns',async()=>{
  const r=rig();await r.audio.start();r.audio.setPlaying(true);
  for(const [name,parts] of [['shot',4],['fracture',5],['rocket',3],['grenadeLaunch',4]]){
    const start=r.ctx.sources.length,nodes=r.ctx.nodes.length;
    r.audio[name]({hand:'left',owner:'player',level:.8,pan:0});assert.equal(r.ctx.sources.length-start,parts);
    const left=r.ctx.nodes.slice(nodes).filter(n=>n.kind==='pan');assert(left.length===parts&&left.every(n=>n.pan.value<0));
    const next=r.ctx.nodes.length;r.audio[name]({hand:'right',owner:'player',level:.8,pan:0});assert.equal(r.ctx.sources.length-start,parts*2,'the other hand must remain audible in the same frame');
    const right=r.ctx.nodes.slice(next).filter(n=>n.kind==='pan');assert(right.length===parts&&right.every(n=>n.pan.value>0));
    for(let i=0;i<20;i++)for(const hand of ['left','right'])r.audio[name]({hand,owner:'player',level:.8});
    assert.equal(r.ctx.sources.length-start,parts*2,'each hand still rejects duplicate events');r.ctx.advance(1);
  }
  const before=r.ctx.nodes.length;r.audio.fracture({hand:'right',pan:1,level:1});assert(r.ctx.nodes.slice(before).filter(n=>n.kind==='pan').every(n=>n.pan.value>=-1&&n.pan.value<=1));
  assert(r.audio.stats.peakVoices<=48);r.audio.dispose();
});

test('shield raise, impact, break and bash use distinct short cues and respect pause and silent effects',async()=>{
  const r=rig();await r.audio.start();const names=['grenadeLaunch','shieldRaise','shieldBlock','shieldBash'],idle=r.ctx.sources.length;
  for(const name of names)r.audio[name]({level:1,hit:true,absorbed:8});assert.equal(r.ctx.sources.length,idle,'menu state must not play the new combat cues');
  r.audio.setPlaying(true);const shapes=[];
  for(const [name,data,parts] of [['shieldRaise',{},3],['shieldBlock',{absorbed:8},3],['shieldBlock',{absorbed:8,broken:true},5],['shieldBash',{hit:false},2],['shieldBash',{hit:true,count:2},4]]){
    const start=r.ctx.sources.length;r.audio[name]({level:.8,pan:-.2,...data});const voices=r.ctx.sources.slice(start);assert.equal(voices.length,parts);
    assert(voices.every(n=>n.stopTime-r.ctx.currentTime<.5));shapes.push(voices.map(n=>[n.kind,n.frequency.value,n.stopTime-r.ctx.currentTime]));
    r.audio[name]({level:.8,pan:-.2,...data});assert.equal(r.ctx.sources.length,start+parts,'duplicate impact shares its cue cooldown');r.ctx.advance(1);
  }
  assert.equal(new Set(shapes.map(JSON.stringify)).size,5);assert(r.audio.stats.duckGain<.56);
  r.audio.setMix({effects:0});const silent=r.ctx.sources.length;for(const name of names)r.audio[name]({level:1,hit:true,broken:true});assert.equal(r.ctx.sources.length,silent);
  r.audio.setMix({effects:1});r.audio.setMuted(true);for(const name of names)r.audio[name]({level:1});assert.equal(r.ctx.sources.length,silent);
  r.audio.setMuted(false);r.audio.setPlaying(false);for(const name of names)r.audio[name]({level:1});assert.equal(r.ctx.sources.length,silent);
  r.audio.dispose();assert.equal(r.audio.stats.voices,0);assert(r.ctx.nodes.filter(n=>n!==r.ctx.destination).every(n=>n.disconnected));
});

test('a grenade launch and real shield block keep the player reservation during an explosion storm',async()=>{
  const r=rig();await r.audio.start();r.audio.setPlaying(true);
  for(let i=0;i<30;i++){r.ctx.currentTime+=.1;r.audio.explosion({level:.8,radius:5,power:55});}assert.equal(r.audio.stats.voices,40);
  const before=r.ctx.sources.length;r.audio.grenadeLaunch({level:1,hand:'right',owner:'player'});r.audio.shieldBlock({level:1,absorbed:8,energy:70});
  assert.equal(r.ctx.sources.length-before,7);assert(r.audio.stats.voices<=48);assert(r.audio.stats.outputCeiling<.97);
  for(let i=0;i<100;i++){r.ctx.advance(.04);r.audio.shieldBlock({level:1,absorbed:6,broken:i%13===0});r.audio.grenadeLaunch({level:1,hand:i%2?'left':'right'});r.audio.tick();assert(r.audio.stats.voices<=48);assert(r.tracker.stats.activeVoices<=28);}
  assert(r.tracker.stats.scheduledRows>0);r.audio.dispose();
});
