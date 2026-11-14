// Real FAudio + MOD transport with observable WebAudio scheduling and graph ownership.
// This verifies integration/lifecycle, not subjective sound quality or a browser device.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const source=Object.fromEntries(['music','audio','audio-recipes','soundscape','economy','destruction','effects','simulation','motion','actors','options','game'].map(name=>
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
// recipes: METAL's table (src/audio-recipes.js) passed as game.js does; options: any other create() argument.
function rig({unavailable=false,noPan=false,recipes=false,options}={}){
  const contexts=[],music=[],scope={},timers=new Map();let timerId=0;scope.window=scope;
  scope.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:(contexts.at(-1)?.currentTime||0)+ms/1000});return id;};scope.clearTimeout=id=>timers.delete(id);
  if(!unavailable)scope.AudioContext=class extends Context{constructor(){super();if(noPan)this.createStereoPanner=undefined;contexts.push(this);}};
  vm.createContext(scope);vm.runInContext(source.music,scope,{filename:'music.js'});
  const create=scope.FMusic.create;scope.FMusic.create=(ctx,output)=>{const first=ctx.nodes.length,instance=create(ctx,output);music.push({instance,output,owned:ctx.nodes.slice(first)});return instance;};
  vm.runInContext(source.audio,scope,{filename:'audio.js'});if(recipes)vm.runInContext(source['audio-recipes'],scope,{filename:'audio-recipes.js'});
  return {scope,contexts,music,timers,audio:recipes||options?scope.FAudio.create(options||scope.MetalAudio.options()):scope.FAudio.create(),get ctx(){return contexts.at(-1);},get master(){return music.at(-1)?.output.connections[0];},get tracker(){return music.at(-1)?.instance;},advanceTimers(seconds){const end=contexts.at(-1).currentTime+seconds;let count=0;while(timers.size){const [id,timer]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(timer.at>end)break;assert(++count<1000,'timer pump is bounded');contexts.at(-1).advance(Math.max(0,timer.at-contexts.at(-1).currentTime));timers.delete(id);timer.fn();}contexts.at(-1).advance(Math.max(0,end-contexts.at(-1).currentTime));}};
}
function run(r,seconds,step=.04){for(let t=0;t<seconds;t+=step){r.audio.tick();r.ctx.advance(step);}}
function waveform(pcm){let peak=0,sum=0,energy=0,difference=0,tail=0;for(let i=0;i<pcm.length;i++){const x=pcm[i];assert(Number.isFinite(x));peak=Math.max(peak,Math.abs(x));sum+=x;energy+=x*x;if(i)difference+=(x-pcm[i-1])**2;if(i>pcm.length*.85)tail+=x*x;}return {peak,rms:Math.sqrt(energy/pcm.length),dc:sum/pcm.length,brightness:difference/energy,tail:tail/energy};}
// Absolute energy in [lo, hi) Hz (radix-2 FFT, Parseval-normalized), as bancs/feel-verif2/t4.mjs measures FEEL-06.
function bandDb(pcm,lo,hi,rate=22050){let n=1;while(n<pcm.length)n<<=1;const re=new Float64Array(n),im=new Float64Array(n);re.set(pcm);
  for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)[re[i],re[j]]=[re[j],re[i]];}
  for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);for(let i=0;i<n;i+=len)for(let k=0,cr=1,ci=0;k<len/2;k++){const p=i+k,q=p+len/2,vr=re[q]*cr-im[q]*ci,vi=re[q]*ci+im[q]*cr;re[q]=re[p]-vr;im[q]=im[p]-vi;re[p]+=vr;im[p]+=vi;[cr,ci]=[cr*wr-ci*wi,cr*wi+ci*wr];}}
  let e=0;for(let k=1;k<n/2;k++){const f=k*rate/n;if(f>=lo&&f<hi)e+=re[k]**2+im[k]**2;}return 10*Math.log10(2*e/n);}
const pcmKey=pcm=>Buffer.from(pcm.buffer,pcm.byteOffset,pcm.byteLength).toString('base64');
function effectGain(source){let n=source.connections[0];if(n.kind==='filter')n=n.connections[0];return n;}
function effectPeak(source){return Math.max(...effectGain(source).gain.events.map(e=>e.value));}

test('original PCM has bounded peaks, quiet tails and distinct material and weapon signatures',()=>{
  const r=rig(),render=r.scope.FAudio.synthesize,measure=new Map(),hashes=new Set();
  for(const name of r.scope.FAudio.effectNames){
    const a=render(name,0,22050),b=render(name,1,22050),m=waveform(a);measure.set(name,m);
    assert(a.length<=22050,name+' must not create a sustained transient');assert.equal(a[0],0);assert.equal(a.at(-1),0);
    assert(m.peak>.8&&m.peak<.85,name+' preserves digital headroom');assert(m.rms>.025&&m.rms<.4);assert(Math.abs(m.dc)<.003,name+' has no DC offset');
    assert(!Buffer.from(a.buffer).equals(Buffer.from(b.buffer)),name+' has seeded variation');
    const signature=Buffer.from(a.buffer).toString('base64');assert(!hashes.has(signature),name+' must have an independent waveform');hashes.add(signature);
    if(!name.startsWith('motor:')&&name!=='swish')assert(m.tail<.04,name+' finishes with a decayed tail');
  }
  assert(Buffer.from(render('pistol',0,22050).buffer).equals(Buffer.from(render('pistol',0,22050).buffer)),'procedural generation is reproducible');
  assert(measure.get('impact:glass').brightness>measure.get('impact:wood').brightness*4,'glass has a bright, brittle attack');
  assert(measure.get('impact:metal').tail>measure.get('impact:stone').tail*20,'metal retains a short physical ring while stone is dry');
  assert(measure.get('smg').rms<measure.get('rocket').rms,'automatic fire has a shorter, drier report than exhaust');
  for(const [name,seconds] of [['pistol',.18],['smg',.12],['shotgun',.35],['rocket',.45],['grenade',.32]])assert(render(name,0,22050).length/22050<seconds);
  assert.throws(()=>render('external-recording',0,22050),/Unknown procedural sound/);assert.equal(r.contexts.length,0,'offline synthesis needs no audio device');
});

test('METAL weapon recipes are seeded, denser reports under their own caps and pass every waveform rule on both variants (FEEL-06)',()=>{
  const r=rig({recipes:true}),{FAudio,MetalAudio}=r.scope,table=MetalAudio.recipes,caps={pistol:.36,smg:.26,shotgun:.95,rocket:.82,grenade:.55},rms={};
  assert.deepEqual(Object.keys(table).sort(),Object.keys(caps).sort());
  for(const [name,cap] of Object.entries(caps)){
    assert.equal(table[name].variants,2);const a=table[name].synth(0,22050),b=table[name].synth(1,22050);
    for(const pcm of [a,b]){
      const m=waveform(pcm);let end=0;for(let i=pcm.length-Math.round(.02*22050);i<pcm.length;i++)end=Math.max(end,Math.abs(pcm[i]));
      assert(pcm.length/22050<cap,name+' keeps its new duration cap');assert.equal(pcm[0],0);assert.equal(pcm.at(-1),0);
      assert(m.peak>.8&&m.peak<.85,name+' preserves digital headroom');assert(m.rms>.025&&m.rms<.4);assert(Math.abs(m.dc)<.003,name+' has no DC offset');
      assert(m.tail<.04&&end<.04,name+' fades out instead of being cut');
    }
    assert.notEqual(pcmKey(a),pcmKey(b),name+' has seeded variation');assert.equal(pcmKey(table[name].synth(0,22050)),pcmKey(a),name+' is reproducible');
    assert.equal(pcmKey(FAudio.synthesize(name,1,22050,table)),pcmKey(b),'synthesize consults a table before its own recipes');
    rms[name]=waveform(a).rms;
  }
  assert(rms.smg<rms.rocket,'automatic fire keeps a shorter, drier report than exhaust');
  for(const name of ['smg','pistol','shotgun','rocket']){
    const before=FAudio.synthesize(name,0,22050),after=table[name].synth(0,22050);
    assert(bandDb(after,120,500)-bandDb(before,120,500)>4.5,name+' gains 120-500 Hz energy, what small speakers carry');
    assert(20*Math.log10(waveform(after).rms/waveform(before).rms)>6,name+' is denser at the same peak');
  }
  assert.equal(r.contexts.length,0,'offline synthesis needs no audio device');
});

test('a recipe table replaces only its own buffers, falls back on bad output, and no table keeps the v0.2 bank bit for bit (MIX-01)',async()=>{
  const bank=async r=>{await r.audio.start();r.audio.setPlaying(true);return r.ctx.buffers.filter(b=>b.sampleRate===22050).map(b=>pcmKey(b.getChannelData(0)));};
  const plain=rig(),metal=rig({recipes:true}),{FAudio}=plain.scope,table=metal.scope.MetalAudio.recipes,jobs=[...FAudio.effectNames].flatMap(n=>n.startsWith('motor:')?[[n,0]]:[[n,0],[n,1]]);
  const a=await bank(plain),b=await bank(metal);assert.equal(a.length,64);assert.equal(b.length,72,'les huit tampons METAL — quatre confirmations et deux rapports ennemis, deux variantes chacun — s\'ajoutent à la banque, préparés avant le jeu');
  jobs.forEach(([n,v],i)=>assert.equal(a[i],pcmKey(FAudio.synthesize(n,v,22050)),'without a table the bank is the v0.2 PCM'));
  assert.deepEqual(jobs.filter((_,i)=>a[i]!==b[i]).map(([n,v])=>n+'#'+v),['pistol#0','pistol#1','smg#0','smg#1','shotgun#0','shotgun#1','rocket#0','rocket#1','grenade#0','grenade#1']);
  jobs.forEach(([n,v],i)=>{if(table[n])assert.equal(b[i],pcmKey(table[n].synth(v,22050)),'the bank holds the recipe output');});
  const count=metal.ctx.sources.length;metal.audio.shot({level:1});assert.equal(metal.ctx.sources.length,count+1);assert.equal(metal.ctx.sources.at(-1).buffer.length,Math.ceil(.24*22050));
  const odd=rig({options:{recipes:{click:{synth:()=>{throw new Error('broken recipe');}},body:{synth:()=>new Float32Array(0)},swish:{synth:()=>Float32Array.of(0,NaN,0)},smg:{},
    'external-recording':{synth:()=>Float32Array.of(0,.5,0)},explosion:{variants:1,synth:(v,rate)=>Float32Array.of(0,rate/44100,-.25,0)}}}});
  const c=await bank(odd),oddJobs=jobs.filter(([n,v])=>n!=='explosion'||v===0);assert.equal(c.length,63,'a single-variant recipe builds one buffer, unknown names are ignored');
  oddJobs.forEach(([n,v],i)=>assert.equal(c[i],n==='explosion'?pcmKey(Float32Array.of(0,.5,-.25,0)):pcmKey(FAudio.synthesize(n,v,22050)),n+' falls back to v0.2 unless its recipe is valid'));
  for(const r of [plain,metal,odd])r.audio.dispose();
});

test('the 240 ms METAL SMG overlaps two voices at 8 shots/s and leaves the 32/40/48 ceilings and stealing rules unchanged (MIX-06)',async()=>{
  const r=rig({recipes:true});r.audio.setStage(1);r.audio.setPlaying(true);await r.audio.start();r.audio.tick();const first=r.ctx.sources.length;
  for(let i=0;i<24;i++){r.audio.shot({level:1,hand:'right'});r.ctx.advance(.125);}
  const fired=r.ctx.sources.slice(first);assert.equal(fired.length,24);assert(fired.every(n=>n.buffer.length===Math.ceil(.24*22050)));assert.equal(r.audio.stats.peakVoices,2);
  r.ctx.advance(1);assert.equal(r.audio.stats.voices,0);
  const before=r.ctx.sources.length;for(let i=0;i<200;i++)r.audio.enemyShot({kind:i%4,level:.6,pan:0});
  assert.equal(r.ctx.sources.length-before,1,'simultaneous shots from one bearing still share a prebuilt transient');
  for(let burst=0;burst<4;burst++){r.ctx.currentTime+=.065;for(let p=-4;p<=4;p++)r.audio.enemyShot({kind:1,level:.6,pan:p/4});}
  assert.equal(r.audio.stats.voices,32,'longer distant reports still cannot consume the reserved slots');assert.equal(r.audio.stats.stolenVoices,0);assert(r.audio.stats.fxSkipped>0);
  const count=r.ctx.sources.length;r.audio.shot();assert.equal(r.ctx.sources.length-count,1,'the local report survives in a reserved voice');
  r.audio.fracture();r.audio.hurt();r.audio.bossImpact({level:1});r.audio.bossTell({level:1});for(let i=0;i<16;i++){r.ctx.currentTime+=.06;r.audio.shot();}
  assert(r.audio.stats.voices<=48);assert(r.audio.stats.stolenVoices>0,'an urgent nearby cue can still replace a distant voice');r.audio.dispose();
});

test('a hit confirms with the METAL 2.8 and 4.1 kHz tick at level .30, one source, rising a semitone per consecutive hit (FEEL-07)',async()=>{
  const r=rig({recipes:true});r.audio.setStage(1);r.audio.setPlaying(true);await r.audio.start();r.audio.tick();
  const osc=r.ctx.nodes.filter(n=>n.kind==='oscillator').length,filters=r.ctx.nodes.filter(n=>n.kind==='filter').length;
  const first=r.ctx.sources.length;r.audio.hit({seed:0,pan:0});
  const added=r.ctx.sources.slice(first);
  assert.equal(added.length,1,'one AudioBufferSourceNode per hit');
  assert.equal(added[0].kind,'source','and no oscillator');
  assert.equal(added[0].buffer.length,Math.ceil(.055*22050),'a short tick');
  assert.equal(effectPeak(added[0]),.3,'level .30');
  const baseRate=added[0].playbackRate.value;
  assert.equal(r.ctx.nodes.filter(n=>n.kind==='filter').length,filters,'no extra filter on the confirmation path');
  const base=added[0].buffer;
  for(let i=0;i<6;i++){r.ctx.advance(.05);r.audio.hit({seed:0,pan:0});}
  const run=r.ctx.sources.slice(first+1);
  assert.equal(run.length,6);
  assert(Math.abs(run[5].playbackRate.value/baseRate-Math.pow(2,6/12))<1e-9,'six consecutive hits raise exactly one octave, never more');
  r.ctx.advance(1.5);r.audio.hit({seed:0,pan:0});
  const reset=r.ctx.sources.at(-1);
  assert.equal(reset.playbackRate.value,baseRate,'a pause restarts the run at the written pitch');
  assert.equal(reset.buffer.length,base.length);
  assert.equal(r.ctx.nodes.filter(n=>n.kind==='oscillator').length,osc,'confirmations never open an oscillator');
  r.audio.dispose();
});

test('a kill confirms with the METAL 90 to 50 Hz thunk and a 3.2 kHz tick at level .45 in one source (FEEL-07)',async()=>{
  const r=rig({recipes:true});r.audio.setStage(1);r.audio.setPlaying(true);await r.audio.start();r.audio.tick();
  const osc=r.ctx.nodes.filter(n=>n.kind==='oscillator').length,first=r.ctx.sources.length;
  r.audio.kill({seed:0});
  const added=r.ctx.sources.slice(first);
  assert.equal(added.length,1,'one AudioBufferSourceNode carries thunk and tick together');
  assert.equal(added[0].kind,'source');
  assert.equal(added[0].buffer.length,Math.ceil(.2*22050));
  assert.equal(effectPeak(added[0]),.45,'level .45');
  assert.equal(r.ctx.nodes.filter(n=>n.kind==='oscillator').length,osc,'no oscillator for the kill cue');
  r.audio.dispose();
});

test('METAL confirmation recipes obey every waveform rule on both variants and stay out of the effect bank (FEEL-07)',()=>{
  const r=rig({recipes:true}),{MetalAudio}=r.scope;
  assert.deepEqual(Object.keys(MetalAudio.extras).sort(),['enemyGrenade','enemySmg','killConfirm','touchConfirm']);
  for(const [name,spec] of Object.entries(MetalAudio.extras))for(const variant of [0,1]){
    const pcm=spec.synth(variant,22050),m=waveform(pcm);
    assert(pcm.length>0&&Number.isFinite(pcm.length));
    assert(m.peak>.8&&m.peak<.85,name+' keeps digital headroom');
    assert(m.rms>.025&&m.rms<.4,name+' has a bounded rms');
    assert(Math.abs(m.dc)<.003,name+' has no DC offset');
    assert(m.tail<.04,name+' fades out instead of being cut');
    assert.equal(pcm[0],0);assert.equal(pcm.at(-1),0);
    assert.equal(pcmKey(spec.synth(variant,22050)),pcmKey(pcm),name+' is reproducible');
  }
  assert(pcmKey(MetalAudio.extras.touchConfirm.synth(0,22050))!==pcmKey(MetalAudio.extras.touchConfirm.synth(1,22050)),'seeded variants differ');
  assert(!r.scope.FAudio.effectNames.includes('touchConfirm')&&!r.scope.FAudio.effectNames.includes('killConfirm'),'confirmations are not engine effect names');assert(!r.scope.FAudio.effectNames.includes('enemySmg')&&!r.scope.FAudio.effectNames.includes('enemyGrenade'),'the mech-free enemy reports are METAL content, not engine effect names');
  r.audio.dispose();
});

test('without the METAL extras, hit and kill keep the v0.2 cues and the bank stays the 64-buffer v0.2 bank (FEEL-07 default)',async()=>{
  const plain=rig();plain.audio.setStage(1);plain.audio.setPlaying(true);await plain.audio.start();plain.audio.tick();
  const first=plain.ctx.sources.length;plain.audio.hit();plain.audio.kill();
  const added=plain.ctx.sources.slice(first);
  assert.equal(added.length,3,'v0.2: one click for the hit, body and dirt for the kill');
  const banked=plain.ctx.buffers.filter(b=>b.sampleRate===22050);
  assert.equal(banked.length,64,'no confirmation buffer enters the default bank');
  const metal=rig({recipes:true});metal.audio.setStage(1);metal.audio.setPlaying(true);await metal.audio.start();metal.audio.tick();
  const metalBanked=metal.ctx.buffers.filter(b=>b.sampleRate===22050);
  assert.equal(metalBanked.length,72,'the eight METAL buffers — four confirmations and two mech-free enemy reports, two variants each — are prepared before play, never during');
  assert.deepEqual(metal.ctx.buffers.filter(b=>b.sampleRate===22050&&b.length===Math.ceil(.055*22050)).length,2);
  assert.deepEqual(metal.ctx.buffers.filter(b=>b.sampleRate===22050&&b.length===Math.ceil(.2*22050)).length,2);
  plain.audio.dispose();metal.audio.dispose();
});

test('empty rooms have no tonal bed, exterior wind has gaps, and every environmental layer silences on pause',async()=>{
  const r=rig();r.audio.setMix({music:0});await r.audio.start();r.audio.setPlaying(true);
  const loops=r.ctx.sources.filter(n=>n.loop),sources=r.ctx.sources.length;assert.equal(loops.length,6);assert(!r.ctx.sources.some(n=>n.kind==='oscillator'));
  r.audio.setPressure(1);r.audio.setThreat(1);r.audio.setEnvironment({wind:1},0);
  for(let i=0;i<40;i++){r.ctx.currentTime=i*.5;r.audio.tick();assert.equal(r.audio.stats.windGain,0);assert.equal(r.audio.stats.steamGain,0);assert.equal(r.audio.stats.machineryGain,0);}
  assert(loops.every(n=>effectGain(n).gain.value===0),'neither tension nor stage invents an indoor sound source');
  r.audio.setPressure(0);r.audio.setThreat(0);r.audio.setEnvironment({wind:1,biome:'woodland'},1);let gaps=0,gusts=0,peak=0;
  for(let i=0;i<180;i++){r.ctx.currentTime=i*.5;r.audio.tick();const gain=r.audio.stats.windGain;gaps+=gain===0;gusts+=gain>0;peak=Math.max(peak,gain);}
  assert(gaps>50&&gusts>40,'outside texture includes long gaps and gusts');assert(peak>0&&peak<=.020001);assert.equal(r.ctx.sources.length,sources,'no phantom birds, notes or periodic new sources');
  r.ctx.currentTime=92;r.audio.setMachinery(.8,-.6,'fan');r.audio.setSteam(.7,.4);r.audio.tick();assert(r.audio.stats.machineryGain>0&&r.audio.stats.steamGain>0);
  r.audio.setMuted(true);assert.equal(r.audio.stats.windGain,0);assert.equal(r.audio.stats.machineryGain,0);assert.equal(r.audio.stats.steamGain,0);
  r.audio.setMuted(false);r.audio.tick();assert(r.audio.stats.machineryGain>0);r.audio.setPlaying(false);assert(loops.every(n=>effectGain(n).gain.value===0));
  r.audio.setPlaying(true);r.audio.setEnvironment({wind:0},1);r.audio.tick();assert.equal(r.audio.stats.windGain,0);r.audio.dispose();
});

test('nearby machinery and steam are spatial, occluded, source-dependent and controlled by ambience',async()=>{
  const r=rig();r.audio.setMix({music:0});await r.audio.start();r.audio.setPlaying(true);
  const loops=r.ctx.sources.filter(n=>n.loop),steam=loops.find(n=>n.connections[0].frequency.value===1950),machines=loops.filter(n=>n.buffer.duration===.8),count=r.ctx.sources.length,buffers=r.ctx.buffers.length;
  const ambience=effectGain(steam).connections[0].connections[0];assert.equal(ambience.gain.value,.7);
  r.audio.setMachinery(.75,-.7,'fan',0);let machine=machines.find(n=>effectGain(n).gain.value>0);assert(machine);assert.equal(effectGain(machine).connections[0].pan.value,-.7);
  const open=machine.connections[0].frequency.value;r.audio.setMachinery(.75,.6,'fan',1);assert(machine.connections[0].frequency.value<open*.3);assert.equal(effectGain(machine).connections[0].pan.value,.6);
  r.audio.setSteam(.8,-.45,0);const steamOpen=steam.connections[0].frequency.value;r.audio.setSteam(.8,-.45,1);assert(steam.connections[0].frequency.value<steamOpen*.4);assert.equal(effectGain(steam).connections[0].pan.value,-.45);
  r.audio.setMachinery(.5,.1,'piston',0);assert.equal(effectGain(machine).gain.value,0);assert.equal(machines.filter(n=>effectGain(n).gain.value>0).length,1,'kind changes crossfade a fixed pool');
  for(let i=0;i<120;i++){r.audio.setMachinery(.5,.1,'piston',.5);r.audio.setSteam(.8,-.45,.5);}assert.equal(r.ctx.sources.length,count);assert.equal(r.ctx.buffers.length,buffers);
  r.audio.setMix({ambience:0});assert.equal(ambience.gain.value,0);assert.equal(r.audio.stats.steamGain,0);assert.equal(r.audio.stats.machineryGain,0);
  const before=r.ctx.sources.length;r.audio.pipeLeak({level:1,pan:-.3});assert.equal(r.ctx.sources.length,before+1,'a discrete hazardous burst remains an effects cue');assert.notEqual(effectGain(r.ctx.sources.at(-1)).connections[0].connections[0],ambience);
  r.audio.setMix({ambience:1,effects:0});assert(r.audio.stats.steamGain>0,'effects slider does not silence environmental steam');
  r.audio.setMachinery(0);r.audio.setSteam(0);assert.equal(r.audio.stats.steamGain,0);assert.equal(r.audio.stats.machineryGain,0);
  const delay=r.ctx.nodes.find(n=>n.kind==='delay'),send=r.ctx.nodes.find(n=>n.kind==='gain'&&n.connections.includes(delay));r.audio.setEnvironment({},0);r.audio.tick();const indoor=send.gain.value;r.audio.setEnvironment({},1);r.audio.tick();assert(send.gain.value<indoor*.2,'open sky does not accumulate a room echo');r.audio.dispose();
});

test('steady ambience is automated once per change and every wind cut can be undone at the same instant (LOOP-14)',async()=>{
  const r=rig();r.audio.setMix({music:0});await r.audio.start();r.audio.setPlaying(true);
  const loops=r.ctx.sources.filter(n=>n.loop),steam=loops.find(n=>n.connections[0].frequency.value===1950),machines=loops.filter(n=>n.buffer.duration===.8),air=loops.find(n=>n!==steam&&!machines.includes(n));
  const delay=r.ctx.nodes.find(n=>n.kind==='delay'),send=r.ctx.nodes.find(n=>n.kind==='gain'&&n.connections.includes(delay)),wind=effectGain(air).gain;
  const params=[steam,air,...machines].flatMap(n=>[n.connections[0].frequency,effectGain(n).gain,effectGain(n).connections[0].pan]).filter(Boolean).concat(send.gain);assert.equal(params.length,18);
  const sent=()=>params.reduce((sum,p)=>sum+p.events.length,0),frame=outside=>{r.audio.setEnvironment({wind:1},outside);r.audio.setMachinery(.6,-.4,'fan',.3);r.audio.setSteam(.5,.2,.1);r.audio.setThreat(.2);r.audio.setPressure(.1);r.audio.tick();};
  frame(0);const settled=sent();for(let i=0;i<120;i++){r.ctx.currentTime+=1/60;frame(0);}
  assert.equal(sent(),settled,'unchanged targets are not sent again, neither by the next frame nor by tick after a setter');
  r.audio.setSteam(.5+1e-9,.2,.1);r.audio.tick();assert.equal(sent(),settled+1,'strict equality: the smallest change is sent once, with no threshold');
  frame(1);const audible=wind.value;assert(audible>0&&audible===r.audio.stats.windGain);
  for(const [cut,restore] of [[()=>r.audio.setMuted(true),()=>r.audio.setMuted(false)],[()=>r.audio.setPlaying(false),()=>r.audio.setPlaying(true)],[()=>r.audio.setMix({ambience:0}),()=>r.audio.setMix({ambience:1})],[()=>r.audio.setTitlePlaying(true),()=>r.audio.setPlaying(true)]]){
    cut();assert.equal(wind.value,0,'each path still cuts the wind');assert.equal(r.audio.stats.windGain,0);
    restore();frame(1);assert.equal(wind.value,audible,'a cut never leaves a stale target that would keep the wind silent');
  }
  r.audio.setPlaying(false);assert(await r.audio.testMix({muted:false}));r.audio.tick();r.audio.cancelTestMix();assert.equal(wind.value,0);
  r.audio.setPlaying(true);frame(1);assert.equal(wind.value,audible,'the audition cut is remembered too');r.audio.dispose();
});

test('material collisions use their real material, energy and occlusion without allocating combat buffers',async()=>{
  const r=rig();r.audio.setMix({music:0});await r.audio.start();r.audio.setPlaying(true);const buffers=r.ctx.buffers.length,profiles=new Set();
  for(const material of ['metal','stone','wood','glass','dirt'])for(const method of ['materialImpact','materialBreak','debrisLand']){
    const before=r.ctx.sources.length;r.audio[method]({material,level:.8,pan:.6,energy:2,mass:1,seed:42});assert.equal(r.ctx.sources.length,before+1);
    const source=r.ctx.sources.at(-1);assert(source.stopTime-r.ctx.currentTime<1.2);assert.equal(effectGain(source).connections[0].pan.value,.6);profiles.add(source.buffer);r.ctx.advance(1.3);
  }
  assert.equal(profiles.size,15);assert.equal(r.ctx.buffers.length,buffers);
  r.audio.materialImpact({material:'metal',level:1,pan:-.6,energy:1,mass:1,seed:31,occluded:0});const open=r.ctx.sources.at(-1),gain=effectPeak(open);r.ctx.advance(1);
  r.audio.materialImpact({material:'metal',level:.3,pan:-.6,energy:1,mass:1,seed:31,occluded:1});const hidden=r.ctx.sources.at(-1);assert.equal(hidden.buffer,open.buffer);assert(hidden.connections[0].frequency.value<1500);assert(effectPeak(hidden)<gain*.31);
  r.ctx.advance(1);const silent=r.ctx.sources.length;r.audio.debrisLand({material:'stone',energy:0});assert.equal(r.ctx.sources.length,silent,'settled rubble does not make phantom collisions');
  for(let i=0;i<120;i++){r.ctx.currentTime+=.04;r.audio.debrisLand({material:i%2?'metal':'stone',energy:30,pan:(i%7-3)/3,seed:i});assert(r.audio.stats.voices<=32);}
  for(let i=0;i<30;i++){r.ctx.currentTime+=.06;r.audio.materialBreak({material:'stone',power:35,pan:.3,seed:i});assert(r.audio.stats.voices<=40);}
  const busy=r.ctx.sources.length;r.audio.shot({weapon:4});r.audio.grenadeLaunch();assert.equal(r.ctx.sources.length,busy+2);assert(r.audio.stats.voices<=48);assert.equal(r.ctx.buffers.length,buffers);
  r.audio.setMix({effects:0});const muted=r.ctx.sources.length;for(const method of ['materialImpact','materialBreak','debrisLand'])r.audio[method]({material:'glass',energy:4});assert.equal(r.ctx.sources.length,muted);
  r.audio.setMix({effects:1});r.audio.setPlaying(false);assert.equal(r.audio.stats.voices,0);for(const method of ['materialImpact','materialBreak','debrisLand'])r.audio[method]({material:'wood',energy:4});assert.equal(r.ctx.sources.length,muted);r.audio.dispose();
});

test('effect preparation yields in bounded batches and disposal cancels its pending work',async()=>{
  const r=rig();await r.audio.start();r.scope.FMusic.warmup=async()=>true;
  const before=r.ctx.buffers.length,pending=r.audio.prepare(0);assert(!r.audio.stats.pcmReady);assert(r.ctx.buffers.length>before&&r.ctx.buffers.length<before+10);assert.equal(r.timers.size,1);
  r.audio.dispose();assert.equal(await pending,false);assert.equal(r.timers.size,0);const buffers=r.ctx.buffers.length;r.advanceTimers(2);assert.equal(r.ctx.buffers.length,buffers);assert.equal(r.ctx.closes,1);
});

test('effect preparation slices on a time budget instead of an effect count and rebuilds the same bank bit for bit (LOAD-13)',async()=>{
  const key=b=>Buffer.from(b.getChannelData(0).buffer,b.getChannelData(0).byteOffset,b.getChannelData(0).byteLength).toString('base64');
  const bank=r=>r.ctx.buffers.filter(b=>b.sampleRate===22050).map(key);
  const plain=rig();await plain.audio.start();plain.scope.FMusic.warmup=async()=>true;
  const plainPending=plain.audio.prepare(0);plain.advanceTimers(30);
  assert.equal(await plainPending,true,'the uncut preparation still completes');
  const synchronous=bank(plain);
  const r=rig();await r.audio.start();r.scope.FMusic.warmup=async()=>true;
  // A synthetic clock that ticks .05 ms per reading: the budget check itself
  // reads it three times per block, so a slice may overshoot by well under a
  // millisecond. The real 8 ms figure is measured by tools/audio-prep-profile.
  let fake=0;const clock=()=>(fake+=.05,fake);r.scope.performance={now:clock};
  const slices=[];
  const pending=r.audio.prepare(0);
  for(let guard=0;r.timers.size;guard++){
    assert(guard<4000,'the time-budgeted preparation terminates');
    const [id,timer]=[...r.timers][0];r.timers.delete(id);
    const t0=clock(),before=r.ctx.buffers.length;
    timer.fn();
    slices.push({buffers:r.ctx.buffers.length-before,ms:clock()-t0});
  }
  assert.equal(await pending,true);
  assert.deepEqual(bank(r),synchronous,'a sliced bank is the synchronous bank, bit for bit');
  assert(Math.max(...slices.map(s=>s.ms))<=9,'no slice exceeds the 8 ms budget');
  assert(slices.length>=20,'the bank is spread over many time slices, not a handful of batches');
  assert(slices.some(s=>s.buffers>1),'a slice batches several variants, not a fixed effect count');
  assert(slices.some(s=>s.buffers===0),'a heavy report is cut and resumed on the next slice');
  plain.audio.dispose();r.audio.dispose();
});

test('every effect renders the same bytes whatever the build order and the prepared bank is exactly those renders (MIX-09)',async()=>{
  const r=rig();await r.audio.start();r.scope.FMusic.warmup=async()=>true;
  const FAudio=r.scope.FAudio,variantsOf=name=>name.indexOf('motor:')===0?1:2;
  const render=order=>{const seen=[];for(const name of order)for(let v=0;v<variantsOf(name);v++)seen.push({key:name+'#'+v,digest:pcmKey(FAudio.synthesize(name,v,22050))});return seen;};
  const forward=render(FAudio.effectNames),backward=render([...FAudio.effectNames].reverse());
  const mirror=new Map(backward.map(entry=>[entry.key,entry.digest]));
  for(const entry of forward)assert.equal(entry.digest,mirror.get(entry.key),'order never changes one sample of '+entry.key);
  const pending=r.audio.prepare(0);r.advanceTimers(30);assert.equal(await pending,true);
  const banked=r.ctx.buffers.filter(b=>b.sampleRate===22050).map(b=>pcmKey(b.getChannelData(0)));
  assert.equal(banked.length,forward.length,'one buffer per effect variant');
  assert.deepEqual(banked.slice().sort(),forward.map(entry=>entry.digest).sort(),'the sliced bank is exactly the set of pure renders');
  r.audio.dispose();
});

test('pre-start settings reach the tracker and independent buses through one lazily created context',async()=>{
  const r=rig();r.audio.setStage(2);r.audio.setThreat(1);r.audio.setMix({master:.7,music:.3,effects:.4,ambience:.2});r.audio.setMuted(true);r.audio.tick();
  assert.equal(r.contexts.length,0,'menus do not open audio before a user action');
  await r.audio.start();await r.audio.resume();assert.equal(r.contexts.length,1);assert.equal(r.ctx.resumes,1);
  const {owned}=r.music[0],output=r.master;assert.equal(output.gain.value,0);assert.equal(r.tracker.stats.stage,2);assert(!r.tracker.stats.playing);
  const limiter=output.connections[0];assert.equal(limiter.kind,'limiter');assert.equal(limiter.connections[0].kind,'guard');assert.equal(limiter.connections[0].connections[0],r.ctx.destination);
  const direct=r.ctx.nodes.filter(n=>n.kind==='gain'&&n.connections.includes(output));
  assert(direct.some(n=>Math.abs(n.gain.value-.36)<1e-9));assert(direct.some(n=>Math.abs(n.gain.value-.14)<1e-9));
  const before=r.ctx.sources.length;run(r,.4);assert.equal(r.ctx.sources.length,before);
  r.audio.setMuted(false);r.audio.setPlaying(true);r.audio.tick();assert(Math.abs(output.gain.value-.455)<1e-9);assert.equal(owned[0].gain.value,.3);assert.equal(r.tracker.stats.tempo,145);assert(r.tracker.stats.scheduledNotes>0);
  const leadPan=owned.find(n=>n.pan?.value===.32),lead=owned.find(n=>n.connections.includes(leadPan));assert.equal(lead.gain.value,.52);
  const noteCount=r.tracker.stats.scheduledNotes;r.audio.setThreat(0);assert.equal(lead.gain.value,.30);assert.equal(r.tracker.stats.scheduledNotes,noteCount,'intensity changes mix without spawning extra voices');
  r.audio.dispose();
});

test('distant salvos reserve player voices and never starve the independent tracker',async()=>{
  const r=rig();r.audio.setStage(1);r.audio.setPlaying(true);await r.audio.start();r.audio.tick();
  const before=r.ctx.sources.length;for(let i=0;i<200;i++)r.audio.enemyShot({kind:i%4,level:.6,pan:0});
  assert.equal(r.ctx.sources.length-before,1,'simultaneous shots from one bearing share a prebuilt transient');
  // Keep ended callbacks delayed, and fill every bearing across two salvos.
  for(let burst=0;burst<4;burst++){r.ctx.currentTime+=.065;for(let p=-4;p<=4;p++)r.audio.enemyShot({kind:1,level:.6,pan:p/4});}
  assert.equal(r.audio.stats.voices,32,'background attackers cannot consume the reserved slots');
  let count=r.ctx.sources.length;r.audio.shot();assert.equal(r.ctx.sources.length-count,1,'the complete local report survives in one reserved voice');
  r.audio.fracture();r.audio.hurt();r.audio.bossImpact({level:1});r.audio.bossTell({level:1});
  for(let i=0;i<16;i++){r.ctx.currentTime+=.06;r.audio.shot();}
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
  const hiss=r.ctx.sources.find(n=>n.loop&&n.connections[0]?.frequency?.value===1950),gain=hiss.connections[0].connections[0];assert(hiss);
  r.audio.setSteam(.7,.3);assert(Math.abs(gain.gain.value-.0385)<1e-9);const sources=r.ctx.sources.length;
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
  assert(!r.ctx.sources.some(n=>n.kind==='oscillator'&&n.stopTime===Infinity),'no persistent drone or modulation oscillator remains');r.audio.setPlaying(false);assert.equal(r.audio.stats.windGain,0);assert.equal(r.audio.stats.machineryGain,0);assert.equal(r.audio.stats.steamGain,0);assert.equal(r.audio.stats.voices,0,'pause releases existing world transients');const stopped=r.ctx.sources.length;r.audio.horror({kind:'ambush',intensity:1});assert.equal(r.ctx.sources.length,stopped);r.audio.setStage(2);r.audio.setPlaying(true);assert(lead.gain.value<raised);r.audio.dispose();assert.equal(r.audio.stats.voices,0);
});

function shell({touch=false,settings:storedSettings,recipes=false}={}){
  const r=rig({recipes}),elements=new Map(),listeners=new Map(),documentListeners=new Map(),memory=new Map(),errors=[],simulations=[],downloads=[],blobs=[],timers=[];let frames=[],now=0;
  let focused=true;
  if(storedSettings)memory.set('ferro-settings',JSON.stringify(storedSettings));
  const noop=()=>{},draw=new Proxy({},{get:()=>noop}),schedule=r.scope.setTimeout;
  function register(map,name,fn,options){
    if(!map.has(name)){const callbacks=[];const dispatch=event=>{for(const {fn} of callbacks)fn(event||{});};dispatch.callbacks=callbacks;map.set(name,dispatch);}
    map.get(name).callbacks.push({fn,capture:options===true||!!options?.capture});
  }
  function emit(map,name,event,capture){for(const item of map.get(name)?.callbacks||[])if(capture===undefined||item.capture===capture)item.fn(event);}
  // Pure PCM warmup is tested with yielding jobs separately. Here use the real
  // cache synchronously so this DOM harness controls RAF and transport timing.
  r.scope.FMusic.warmup=async stage=>{const bytes=r.scope.FMusic.getModule(stage);return {...r.scope.FMusic.getTrack(stage),bytes:bytes.length};};
  function element(id){if(elements.has(id))return elements.get(id);const events=new Map(),classes=new Set(),attributes=new Map();const el={id,tagName:id==='body'?'BODY':id==='world'?'CANVAS':id.endsWith('-setting')?'INPUT':'BUTTON',style:{},dataset:{},firstChild:{textContent:''},hidden:false,
    classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),toggle(n,on){on??=!classes.has(n);on?classes.add(n):classes.delete(n);}},
    addEventListener:(name,fn,options)=>register(events,name,fn,options),dispatch(name,event={}){const e={type:name,target:el,isTrusted:true,preventDefault:noop,...event};emit(listeners,name,e,true);let result;for(const {fn} of events.get(name)?.callbacks||[])result=fn(e);emit(listeners,name,e,false);return result;},click(){this.dispatch('click',{isTrusted:!this.download});if(this.download)downloads.push(this);},
    closest:selector=>selector==='button'&&el.tagName==='BUTTON'?el:null,querySelector:selector=>element(id+selector),querySelectorAll:()=>[],setAttribute:(key,value)=>attributes.set(key,String(value)),getAttribute:key=>attributes.get(key),focus:noop,getContext:()=>draw,requestPointerLock:noop};elements.set(id,el);return el;}
  const world=(seed,stage)=>({seed,stage,generation:5,title:'Audio QA',spawn:{x:0,z:0,yaw:0},bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},meshes:[],lights:[],colliders:[],enemies:[],pickups:[],hazards:[],rooms:[{x:0,z:0,w:40,d:40,name:'QA',outdoor:true}],corridors:[],environment:{biome:'woodland',outdoorZones:[]},cores:[{id:0,x:6,z:0},{id:1,x:8,z:0},{id:2,x:10,z:0}],exit:{x:15,z:0}});
  Object.assign(r.scope,{console:{error:(...args)=>errors.push(args)},performance:{now:()=>now},innerWidth:1280,innerHeight:800,URLSearchParams,Blob,
    URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:qa-'+blobs.length;},revokeObjectURL:noop},setTimeout:(fn,ms)=>{timers.push(fn);return schedule(fn,ms);},
    navigator:{maxTouchPoints:touch?5:0},location:{search:''},matchMedia:query=>({matches:touch&&query==='(pointer: coarse)'}),requestAnimationFrame:fn=>{frames.push(fn);},addEventListener:(name,fn,options)=>register(listeners,name,fn,options),
    document:{body:element('body'),hidden:false,getElementById:element,createElement:tag=>element(tag+elements.size),addEventListener:(name,fn,options)=>register(documentListeners,name,fn,options),hasFocus:()=>focused},
    localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)},FWorld:{create:world},
    FRender:{create:()=>({stats:{backend:'test'},resize:noop,setWorld:noop,draw:noop})}});
  // The shell receives the same observed real audio instance as the direct API tests.
  // With recipes, game.js's own create() argument builds that instance.
  const createAudio=r.scope.FAudio.create;r.scope.FAudio.create=recipes?options=>{r.createOptions=options;return r.audio=createAudio(options);}:()=>r.audio;
  for(const name of ['soundscape','economy','destruction','effects','simulation','motion','actors','options'])vm.runInContext(source[name],r.scope,{filename:name+'.js'});
  const create=r.scope.FSimulation.create;r.scope.FSimulation.create=value=>{const sim=create(value);simulations.push(sim);return sim;};
  vm.runInContext(source.game,r.scope,{filename:'game.js'});assert.deepEqual(errors,[],'game must initialize without an audio or DOM exception');
  return Object.assign(r,{element,listeners,documentListeners,simulations,downloads,blobs,timers,memory,gesture(name='pointerup',event={}){emit(listeners,name,{type:name,target:element('body'),isTrusted:true,button:0,preventDefault:noop,...event});},visibility(visible){r.scope.document.hidden=!visible;emit(documentListeners,'visibilitychange',{});},focus(){focused=true;emit(listeners,'focus',{});},blur(){focused=false;emit(listeners,'blur',{});},frame(ms=40){now+=ms;if(r.ctx)r.advanceTimers(ms/1000);const batch=frames;frames=[];for(const fn of batch)fn(now);},async flush(){for(let i=0;i<12;i++){await Promise.resolve();this.frame(10);}},async ready(){for(let i=0;i<40;i++){this.frame();await Promise.resolve();await Promise.resolve();if(this.mode()!=='loading')return;}throw new Error('loading did not finish');},mode:()=>element('body').dataset.state||'menu'});
}

test('actual game menus, pause, focus loss, volume controls and MOD export drive the real transport',async()=>{
  const app=shell();app.frame();assert.equal(app.contexts.length,0);app.element('intro-options').dispatch('click',{isTrusted:false});assert.equal(app.mode(),'options');app.frame();assert.equal(app.contexts.length,0);
  app.element('export-mod').dispatch('click',{isTrusted:false});assert.equal(app.downloads[0].download,'METAL-titre.mod');const exported=new Uint8Array(await app.blobs[0].arrayBuffer());assert.equal(Buffer.from(exported.slice(1080,1084)).toString(),'M.K.');assert.equal(app.contexts.length,0,'MOD export does not need an audio device');
  app.element('resume').click();assert.equal(app.mode(),'menu');app.element('start').click();await app.ready();app.frame();assert.equal(app.mode(),'playing');assert(app.tracker.stats.playing&&app.tracker.stats.scheduledNotes>0);
  app.element('pause-button').click();app.frame(100);assert.equal(app.mode(),'paused');assert(!app.tracker.stats.playing);assert.equal(app.tracker.stats.activeVoices,0);const paused=app.tracker.stats.scheduledNotes;app.frame(400);assert.equal(app.tracker.stats.scheduledNotes,paused);
  app.element('music-setting').value='0';app.element('music-setting').dispatch('input');app.element('resume').click();app.frame();assert(app.tracker.stats.playing);assert.equal(app.tracker.stats.scheduledNotes,paused);
  app.element('music-setting').value='65';app.element('music-setting').dispatch('input');app.frame();assert(app.tracker.stats.scheduledNotes>paused);assert.equal(app.music[0].owned[0].gain.value,.65);
  app.element('sound-toggle').click();assert.equal(app.master.gain.value,0);app.element('sound-toggle').click();assert.equal(app.master.gain.value,.65);
  app.blur();app.frame(100);assert.equal(app.mode(),'paused');assert.equal(app.tracker.stats.activeVoices,0);app.focus();assert.equal(app.mode(),'paused');assert(!app.tracker.stats.playing);
  app.element('pause-main').click();await app.flush();assert.equal(app.mode(),'menu');assert(app.audio.stats.titlePlaying&&app.tracker.stats.playing);assert.equal(app.tracker.stats.stage,'title');assert.equal(app.master.gain.value,.65);
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
  const initial=r.ctx.sources.length;r.advanceTimers(.65);assert(r.ctx.sources.slice(initial).some(n=>n.buffer?.length===Math.ceil(.165*22050)),'audition schedules the pistol');assert(r.ctx.sources.slice(initial).some(n=>n.buffer?.length===Math.ceil(.105*22050)),'audition schedules the SMG');assert(r.audio.stats.duckGain<.56);
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
    assert(created.length>=1&&created.length<=5);signatures.push(created.map(n=>[n.kind,n.frequency.value,n.stopTime-r.ctx.currentTime]));
    for(let i=0;i<30;i++)r.audio[name]({level:.8,pan:-.3,hit:true});assert.equal(r.ctx.sources.length,before+created.length,'repeated input observes the cue cooldown');r.ctx.advance(1);
  }
  assert.equal(new Set(signatures.map(JSON.stringify)).size,5);assert(r.audio.stats.peakVoices<=48);r.audio.dispose();
});

test('device unlock is cheap and loading prepares future instrument buffers without changing play state',async()=>{
 const r=rig();r.scope.setTimeout=fn=>{queueMicrotask(fn);return 0;};await r.audio.start();assert.equal(r.ctx.buffers.length,1,'unlock only creates the shared noise buffer, not PCM instruments');assert.equal(r.tracker.stats.scheduledNotes,0);
 const sources=r.ctx.sources.length,nodes=r.ctx.nodes.length;assert(await r.audio.prepare(2));assert.equal(r.tracker.stats.stage,0);assert(!r.tracker.stats.playing);assert.equal(r.ctx.sources.length,sources+4,'four fixed machine loops are prepared, all initially silent');assert.equal(r.ctx.nodes.length,nodes+4);assert.equal(r.audio.stats.machineryGain,0);assert(r.audio.stats.pcmReady);
 const buffers=r.ctx.buffers.length;assert.equal(r.audio.stats.pcmBuffers,64);assert.equal(buffers,16+r.audio.stats.pcmBuffers);assert(r.audio.stats.pcmBytes<2*1024*1024);r.audio.setStage(2);r.audio.setPlaying(true);run(r,9);assert.equal(r.ctx.buffers.length,buffers,'first combat notes do not allocate cached AudioBuffers');
 r.audio.dispose();assert.equal(await r.audio.prepare(1),false);
 const cold=rig();cold.scope.setTimeout=fn=>{queueMicrotask(fn);return 0;};assert.equal(await cold.audio.prepare(0),false);assert.equal(cold.contexts.length,0,'preparation never opens a device without a user gesture');cold.audio.dispose();
});

test('title preparation opens no device, then plays music alone without building the world effects bank',async()=>{
  const r=rig();r.scope.setTimeout=fn=>{queueMicrotask(fn);return 0;};r.audio.setStage(2);
  assert.equal(await r.audio.prepareTitle(),false);assert.equal(r.contexts.length,0);
  await r.audio.start();assert(await r.audio.prepareTitle());assert.equal(r.audio.stats.pcmBuffers,0);assert(!r.audio.stats.pcmReady);
  r.audio.setTitlePlaying(true);r.audio.setThreat(1);r.audio.setPressure(1);r.audio.setEnvironment({wind:2},1);r.audio.setSteam(1);r.audio.setMachinery(1);run(r,1.5);
  assert.equal(r.tracker.stats.stage,'title');assert.equal(r.tracker.stats.tempo,212);assert(r.tracker.stats.scheduledNotes>0);assert(r.audio.stats.titlePlaying);
  assert.equal(r.audio.stats.windGain,0);assert.equal(r.audio.stats.steamGain,0);assert.equal(r.audio.stats.machineryGain,0);assert.equal(r.audio.stats.voices,0);
  const before=r.ctx.sources.length;for(const name of ['explosion','bossTell','switchWeapon','pickup','ammoPickup','shot'])r.audio[name]({level:1,weapon:4});assert.equal(r.ctx.sources.length,before,'an audible title cannot leak world cues');
  r.audio.setMix({music:0});run(r,.2);assert.equal(r.tracker.stats.activeVoices,0);r.audio.setMix({music:.4});r.audio.setMuted(true);assert.equal(r.master.gain.value,0);r.audio.setMuted(false);
  r.audio.setPlaying(true);r.audio.tick();assert(!r.audio.stats.titlePlaying);assert.equal(r.tracker.stats.stage,2);assert.equal(r.tracker.stats.tempo,145);assert(r.audio.stats.pcmReady);
  r.audio.bossImpact({level:1});assert(r.audio.stats.duckGain<.56);r.audio.setPlaying(false);r.audio.setTitlePlaying(true);assert.equal(r.audio.stats.duckGain,.56,'a new title is not attenuated by the last combat impact');r.audio.dispose();assert(!r.audio.stats.titlePlaying);assert.equal(r.ctx.closes,1);
});

test('a title audition returns to the title and releases every transient when cancelled or finished',async()=>{
  const r=rig();r.scope.FMusic.warmup=async key=>{r.scope.FMusic.getModule(key);return true;};await r.audio.start();await r.audio.prepareTitle();r.audio.setTitlePlaying(true);r.audio.tick();
  assert(await r.audio.testMix({muted:false}));assert(r.audio.stats.preview);r.advanceTimers(.65);assert(r.audio.stats.voices>0);
  r.audio.cancelTestMix();assert(!r.audio.stats.preview);assert.equal(r.audio.stats.voices,0);assert(r.audio.stats.titlePlaying&&r.tracker.stats.playing);assert.equal(r.tracker.stats.stage,'title');assert.equal(r.timers.size,0);
  assert(await r.audio.testMix({muted:false}));r.advanceTimers(2.1);assert(!r.audio.stats.preview);assert(r.audio.stats.titlePlaying&&r.tracker.stats.playing);assert.equal(r.audio.stats.voices,0);assert.equal(r.timers.size,0);
  r.audio.setTitlePlaying(false);assert(!r.tracker.stats.playing);assert.equal(r.tracker.stats.stage,0);r.audio.dispose();
});

test('mouse, touch and keyboard gestures unlock the title once without advancing the world',async()=>{
  for(const kind of ['mouse','touch','keyboard']){
    const app=shell({touch:kind==='touch'}),simulation=app.simulations[0],elapsed=simulation.state.elapsed;
    app.frame(400);assert.equal(app.contexts.length,0);assert.match(app.element('intro-sound').textContent,/ÉCOUTER/);
    if(kind==='mouse')app.element('intro-sound').click();else if(kind==='touch')app.gesture('pointerup',{pointerType:'touch'});else app.gesture('keydown',{code:'Tab'});
    assert.equal(app.contexts.length,1,'unlock happens synchronously inside the gesture');await app.flush();
    assert.equal(app.mode(),'menu');assert(app.audio.stats.titlePlaying);assert.equal(app.tracker.stats.stage,'title');assert.equal(app.tracker.stats.tempo,212);assert(app.tracker.stats.scheduledNotes>0);
    assert.equal(app.simulations.length,1);assert.equal(simulation.state.elapsed,elapsed);assert.equal(app.audio.stats.pcmBuffers,0);assert.equal(app.element('intro-sound').getAttribute('aria-pressed'),'true');
    app.gesture();app.gesture('keydown',{code:'Tab'});await app.flush();assert.equal(app.contexts.length,1);
    app.element('intro-sound').click();assert.equal(app.master.gain.value,0);assert(!app.audio.stats.titlePlaying);app.element('intro-sound').click();await app.flush();assert(app.audio.stats.titlePlaying);assert.equal(simulation.state.elapsed,elapsed);app.audio.dispose();
  }
});

test('title mute and zero sliders are respected, while hidden tabs and blur never resume combat',async()=>{
  const muted=shell({settings:{muted:true,musicVolume:.3}});muted.gesture();await muted.flush();assert.equal(muted.contexts.length,0);muted.element('intro-sound').click();await muted.flush();assert(muted.audio.stats.titlePlaying);assert.equal(muted.music[0].owned[0].gain.value,.3);muted.audio.dispose();
  const zero=shell({settings:{musicVolume:0,masterVolume:.6}});zero.element('intro-sound').click();assert.equal(zero.mode(),'options');assert.equal(zero.contexts.length,0);assert.equal(JSON.parse(zero.memory.get('ferro-settings')).musicVolume,0);
  zero.element('music-setting').value='25';zero.element('music-setting').dispatch('input');await zero.flush();assert(zero.audio.stats.titlePlaying);assert.equal(zero.music[0].owned[0].gain.value,.25);assert.equal(zero.master.gain.value,.39);
  zero.visibility(false);zero.frame(100);assert(!zero.audio.stats.titlePlaying);assert(!zero.tracker.stats.playing);assert.equal(zero.master.gain.value,0);const notes=zero.tracker.stats.scheduledNotes;zero.frame(500);assert.equal(zero.tracker.stats.scheduledNotes,notes);
  zero.visibility(true);await zero.flush();assert(zero.audio.stats.titlePlaying);zero.blur();assert(!zero.audio.stats.titlePlaying);zero.focus();await zero.flush();assert(zero.audio.stats.titlePlaying);
  zero.element('resume').click();zero.element('start').click();await zero.ready();assert.equal(zero.mode(),'playing');assert(!zero.audio.stats.titlePlaying);zero.visibility(false);assert.equal(zero.mode(),'paused');zero.visibility(true);await zero.flush();assert.equal(zero.mode(),'paused');assert(!zero.tracker.stats.playing);assert(!zero.audio.stats.titlePlaying);zero.audio.dispose();
});

test('shared title preparation cannot restart music after launch, mute, hiding or focus loss',async()=>{
  for(const action of ['launch','mute','hide','blur']){
    const app=shell(),prepare=app.audio.prepareTitle;let release,calls=0;
    app.audio.prepareTitle=()=>{calls++;return new Promise(resolve=>{release=async()=>resolve(await prepare());});};
    app.gesture();app.gesture('keydown',{code:'Tab'});app.element('intro-options').click();await app.flush();assert.equal(calls,1,'all pending title requests share instrument preparation');assert.equal(typeof release,'function');
    if(action==='launch'){app.element('resume').click();app.element('start').click();await app.ready();}
    else if(action==='mute')app.element('sound-toggle').click();else if(action==='hide')app.visibility(false);else app.blur();
    await release();await app.flush();assert(!app.audio.stats.titlePlaying,action+' must invalidate every pending title request');
    if(action==='launch'){assert.equal(app.mode(),'playing');assert.equal(app.tracker.stats.stage,0);assert(app.tracker.stats.playing);}else{assert.equal(app.master.gain.value,0);assert(!app.tracker.stats.playing);assert.equal(app.simulations[0].state.elapsed,0);}
    app.audio.dispose();
  }
});

test('a blocked audio resume remains retryable by a new user gesture',async()=>{
  const app=shell(),resume=app.scope.AudioContext.prototype.resume;app.scope.AudioContext.prototype.resume=function(){this.resumes++;return Promise.resolve();};
  app.element('intro-sound').click();await app.flush();assert(!app.audio.stats.titlePlaying);assert.match(app.element('intro-music-status').textContent,/réessayer/);assert.equal(app.mode(),'menu');
  app.scope.AudioContext.prototype.resume=resume;app.element('intro-sound').click();await app.flush();assert(app.audio.stats.titlePlaying);assert.equal(app.contexts.length,1);app.audio.dispose();
});

test('a world prepared while hidden or unfocused waits for explicit resume before combat',async()=>{
  for(const reason of ['hidden','blur']){
    const app=shell();app.element('start').click();assert.equal(app.mode(),'loading');if(reason==='hidden')app.visibility(false);else app.blur();await app.ready();
    assert.equal(app.mode(),'paused');assert(!app.tracker.stats.playing);assert(!app.audio.stats.titlePlaying);assert.equal(app.master.gain.value,0);assert.equal(app.simulations.at(-1).state.elapsed,0);
    if(reason==='hidden')app.visibility(true);else app.focus();await app.flush();assert.equal(app.mode(),'paused');assert.equal(app.simulations.at(-1).state.elapsed,0);
    app.element('resume').click();app.frame();assert.equal(app.mode(),'playing');assert.equal(app.tracker.stats.stage,0);assert(app.tracker.stats.playing);app.audio.dispose();
  }
});

test('explosions have bounded crack/body/debris tails, scale with power and preserve the player reserve',async()=>{
 async function burst(event){const r=rig();await r.audio.start();r.audio.setPlaying(true);const before=r.ctx.sources.length,firstNode=r.ctx.nodes.length;r.audio.explosion(event);const voices=r.ctx.sources.slice(before),nodes=r.ctx.nodes.slice(firstNode);return {r,voices,nodes,peak:Math.max(...nodes.flatMap(n=>n.gain?.events.filter(e=>e.type==='linear').map(e=>e.value)||[])),end:Math.max(...voices.map(n=>n.stopTime-r.ctx.currentTime))};}
 const close=await burst({level:1,pan:.4,radius:4.2,power:55,kind:'rocket',seed:96});assert.equal(close.voices.length,1,'one buffer contains crack, pressure and scatter');assert(close.voices.every(n=>n.kind==='source'));assert(close.end>.8&&close.end<1.2);assert(close.peak>.9&&close.peak<1.1);assert.equal(close.voices[0].buffer.sampleRate,22050);
 const far=await burst({level:.15,pan:.4,radius:4.2,power:55,kind:'rocket',seed:96});assert(far.peak<close.peak*.2);assert(far.r.audio.stats.duckGain>close.r.audio.stats.duckGain*2,'a distant blast does not deeply duck nearby action');
 const steam=await burst({level:1,pan:.4,radius:2.25,power:10,kind:'steam',seed:96});assert(steam.peak<close.peak*.5);assert(steam.end<close.end);
 const r=close.r;for(let i=0;i<20;i++){r.ctx.currentTime+=.1;r.audio.explosion({level:1,radius:6,power:90,kind:'boss',seed:i});}assert(r.audio.stats.voices<=40,'explosion tails cannot consume the player reservation');const count=r.ctx.sources.length;r.audio.shot();assert.equal(r.ctx.sources.length-count,1);assert(r.audio.stats.voices<=48);assert(r.audio.stats.outputCeiling<.97);
 for(const q of [close,far,steam])q.r.audio.dispose();
});

test('simultaneous hands keep independent firing transients, stereo placement and cooldowns',async()=>{
  const r=rig();await r.audio.start();r.audio.setPlaying(true);
  for(const [name,parts] of [['shot',1],['fracture',1],['rocket',1],['grenadeLaunch',1]]){
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

test('campaign pistol has its own short synthesized report and preserves independent hand timing and silent states',async()=>{
  const r=rig();await r.audio.start();const idle=r.ctx.sources.length;
  r.audio.shot({weapon:4,hand:'right'});assert.equal(r.ctx.sources.length,idle,'the campaign pistol must stay silent in menus');
  r.audio.setPlaying(true);
  const base=r.ctx.sources.length,first=r.ctx.nodes.length;
  r.audio.shot({weapon:4,hand:'right',level:.8});
  const pistol=r.ctx.sources.slice(base);assert.equal(pistol.length,1);
  assert(pistol.every(n=>n.stopTime-r.ctx.currentTime<.18),'the compact report must not leave a long tail');
  assert(r.ctx.nodes.slice(first).filter(n=>n.kind==='pan').every(n=>n.pan.value>0));
  const left=r.ctx.nodes.length;r.audio.shot({weapon:0,hand:'left',level:.8});
  const rifle=r.ctx.sources.slice(base+1);assert.equal(rifle.length,1,'the other hand keeps its simultaneous transient');
  assert(r.ctx.nodes.slice(left).filter(n=>n.kind==='pan').every(n=>n.pan.value<0));
  const shape=voices=>voices.map(n=>[n.kind,n.type,n.frequency.value,n.stopTime-r.ctx.currentTime]);
  assert.notDeepEqual(shape(pistol),shape(rifle),'pistol and automatic rifle must have distinct synthesis');
  for(let i=0;i<20;i++)r.audio.shot({weapon:4,hand:'right',level:.8});
  assert.equal(r.ctx.sources.length,base+2,'duplicate pistol cues in one frame stay bounded');
  r.ctx.advance(.32);r.audio.shot({weapon:4,hand:'right',level:.8});assert.equal(r.ctx.sources.length,base+3,'the next legal pistol shot must sound');
  assert(r.audio.stats.duckGain<.56);
  r.ctx.advance(1);r.audio.setMix({effects:0});const silent=r.ctx.sources.length;
  r.audio.shot({weapon:4,hand:'right'});assert.equal(r.ctx.sources.length,silent);
  r.ctx.advance(1);r.audio.setMix({effects:1});r.audio.setMuted(true);r.audio.shot({weapon:4,hand:'right'});assert.equal(r.ctx.sources.length,silent);
  r.audio.setMuted(false);r.audio.setPlaying(false);r.audio.shot({weapon:4,hand:'right'});assert.equal(r.ctx.sources.length,silent);
  r.audio.setPlaying(true);for(let i=0;i<55;i++){r.ctx.currentTime+=.1;r.audio.explosion({level:.8,radius:5,power:55});}
  assert(r.audio.stats.voices<=40);const crowded=r.ctx.sources.length;r.audio.shot({weapon:4,hand:'right'});
  assert.equal(r.ctx.sources.length,crowded+1,'the pistol retains the player reservation during a blast storm');
  assert(r.audio.stats.voices<=48);r.audio.dispose();assert.equal(r.audio.stats.voices,0);
});

test('melee, mechanism, ammunition and grenade cues stay short, deduplicated and silent outside play',async()=>{
  const r=rig();await r.audio.start();
  const guarded=['rocket','grenade','grenadeLaunch'],all=['grenadeLaunch','melee','mechanism','ammoPickup','empty'],idle=r.ctx.sources.length;
  for(const name of guarded)r.audio[name]({level:1,hit:true});assert.equal(r.ctx.sources.length,idle,'menu state must not play the guarded combat cues');
  r.audio.setPlaying(true);const shapes=[];
  for(const [name,data,parts] of [['grenadeLaunch',{hand:'right'},1],['melee',{hit:false},1],['melee',{hit:true},2],['mechanism',{},2],['ammoPickup',{},3],['empty',{},1]]){
    const start=r.ctx.sources.length;r.audio[name]({level:.8,pan:-.2,...data});const voices=r.ctx.sources.slice(start);assert.equal(voices.length,parts,name+' '+JSON.stringify(data));
    assert(voices.every(n=>n.stopTime-r.ctx.currentTime<.8));shapes.push(voices.map(n=>[n.kind,n.frequency.value,n.stopTime-r.ctx.currentTime]));
    r.audio[name]({level:.8,pan:-.2,...data});assert.equal(r.ctx.sources.length,start+parts,'duplicate impact shares its cue cooldown');r.ctx.advance(1);
  }
  assert.equal(new Set(shapes.map(JSON.stringify)).size,6);assert(r.audio.stats.duckGain<.56);
  r.audio.setMix({effects:0});const silent=r.ctx.sources.length;for(const name of all)r.audio[name]({level:1,hit:true});assert.equal(r.ctx.sources.length,silent);
  r.audio.setMix({effects:1});r.audio.setMuted(true);for(const name of all)r.audio[name]({level:1});assert.equal(r.ctx.sources.length,silent);
  r.audio.setMuted(false);r.audio.setPlaying(false);for(const name of guarded)r.audio[name]({level:1});assert.equal(r.ctx.sources.length,silent);
  r.audio.dispose();assert.equal(r.audio.stats.voices,0);assert(r.ctx.nodes.filter(n=>n!==r.ctx.destination).every(n=>n.disconnected));
});

test('a grenade launch and a real melee hit keep the player reservation during an explosion storm',async()=>{
  const r=rig();await r.audio.start();r.audio.setPlaying(true);
  for(let i=0;i<55;i++){r.ctx.currentTime+=.1;r.audio.explosion({level:.8,radius:5,power:55});}assert.equal(r.audio.stats.voices,40);
  const before=r.ctx.sources.length;r.audio.grenadeLaunch({level:1,hand:'right',owner:'player'});r.audio.melee({level:1,hit:true});
  assert.equal(r.ctx.sources.length-before,3);assert(r.audio.stats.voices<=48);assert(r.audio.stats.outputCeiling<.97);
  for(let i=0;i<100;i++){r.ctx.advance(.04);r.audio.melee({level:1,hit:i%13===0});r.audio.grenadeLaunch({level:1,hand:i%2?'left':'right'});r.audio.tick();assert(r.audio.stats.voices<=48);assert(r.tracker.stats.activeVoices<=28);}
  assert(r.tracker.stats.scheduledRows>0);r.audio.dispose();
});

test('trophy discovery has one bounded metal sting, survives a busy mix and stays silent when paused or muted',async()=>{
  const r=rig();await r.audio.start();const idle=r.ctx.sources.length;
  r.audio.trophy({key:'rifle'});assert.equal(r.ctx.sources.length,idle,'menus cannot sound a trophy');
  r.audio.setPlaying(true);
  const start=r.ctx.sources.length;r.audio.trophy({key:'rifle',level:.9});const sting=r.ctx.sources.slice(start);
  assert.equal(sting.length,5);assert(sting.every(n=>n.stopTime-r.ctx.currentTime<.8));
  assert(sting.filter(n=>n.kind==='oscillator').length===4);
  assert(sting.some(n=>n.type==='sawtooth'),'discovery retains a rough metal interval');
  assert(r.audio.stats.duckGain<.56,'the short melody must emerge above the tracker');
  for(let i=0;i<20;i++)r.audio.trophy({key:'rifle',level:.9});assert.equal(r.ctx.sources.length,start+5);
  assert.equal(r.timers.size,0,'sting scheduling belongs to the audio clock');
  r.ctx.advance(1.2);assert.equal(r.audio.stats.voices,0,'the cue fully releases its voices');
  const pickup=r.ctx.sources.length;r.audio.weaponPickup({level:.9});const other=r.ctx.sources.slice(pickup);
  const shape=voices=>voices.map(n=>[n.kind,n.type,n.frequency.value]);
  assert.notDeepEqual(shape(sting),shape(other),'ordinary drops keep their own cue');
  r.ctx.advance(1.2);r.audio.setMix({effects:0});const silent=r.ctx.sources.length;
  r.audio.trophy({key:'smg'});assert.equal(r.ctx.sources.length,silent);
  r.ctx.advance(1.2);r.audio.setMix({effects:1});r.audio.setMuted(true);r.audio.trophy({key:'smg'});assert.equal(r.ctx.sources.length,silent);
  r.audio.setMuted(false);r.audio.setPlaying(false);r.audio.trophy({key:'smg'});assert.equal(r.ctx.sources.length,silent);
  r.audio.setPlaying(true);
  for(let i=0;i<55;i++){r.ctx.currentTime+=.1;r.audio.explosion({level:.8,radius:5,power:55});}
  assert.equal(r.audio.stats.voices,40);const crowded=r.ctx.sources.length;r.audio.trophy({key:'smg'});
  assert.equal(r.ctx.sources.length,crowded+5);assert(r.audio.stats.voices<=48);
  r.audio.dispose();assert.equal(r.audio.stats.voices,0);
});


test('actual menu audition survives live volume sliders and stops on explicit mute or navigation',async()=>{
  const app=shell();app.element('intro-options').click();app.element('tab-audio').click();await app.flush();assert(app.audio.stats.titlePlaying);
  const elapsed=app.simulations.at(-1).state.elapsed;
  await app.element('test-audio').dispatch('click');assert.equal(app.audio.stats.preview,true);
  for(const [id,key,value] of [['master','masterVolume','60'],['music','musicVolume','35'],['effects','effectsVolume','55'],['ambience','ambienceVolume','45']]){
    app.element(id+'-setting').value=value;app.element(id+'-setting').dispatch('input');
    assert.equal(app.audio.stats.preview,true,id+' must adjust the active audition without cancelling it');
    assert.equal(JSON.parse(app.memory.get('ferro-settings'))[key],Number(value)/100);
  }
  assert.equal(app.music[0].owned[0].gain.value,.35);app.frame(300);assert.equal(app.simulations.at(-1).state.elapsed,elapsed);
  app.element('sound-toggle').click();assert.equal(app.audio.stats.preview,false);assert.equal(app.master.gain.value,0);assert.equal(app.tracker.stats.playing,false);
  await app.element('test-audio').dispatch('click');assert.equal(app.audio.stats.preview,false,'Explicit mute forbids a new audition');
  app.element('sound-toggle').click();await app.flush();await app.element('test-audio').dispatch('click');assert.equal(app.audio.stats.preview,true);
  app.element('tab-image').click();assert.equal(app.audio.stats.preview,false);assert.equal(app.master.gain.value,.39);assert(app.audio.stats.titlePlaying&&app.tracker.stats.playing);
  app.element('tab-audio').click();await app.element('test-audio').dispatch('click');app.frame(2100);
  assert.equal(app.audio.stats.preview,false);assert.equal(app.master.gain.value,.39);assert.equal(app.tracker.stats.playing,true);assert.equal(app.tracker.stats.stage,'title');
  await app.element('test-audio').dispatch('click');assert(app.audio.stats.preview);await app.element('test-audio').dispatch('click');assert(!app.audio.stats.preview);assert(app.audio.stats.titlePlaying);
  await app.element('test-audio').dispatch('click');app.visibility(false);assert(!app.audio.stats.preview);assert(!app.audio.stats.titlePlaying);assert.equal(app.master.gain.value,0);app.visibility(true);await app.flush();assert(app.audio.stats.titlePlaying);
  assert.equal(app.simulations.at(-1).state.elapsed,elapsed,'Audition and slider changes never unpause the game');
  app.element('resume').click();app.element('start').click();await app.ready();app.element('pause-button').click();app.element('tab-audio').click();
  await app.element('test-audio').dispatch('click');assert.equal(app.audio.stats.preview,true);
  app.element('resume').click();assert.equal(app.audio.stats.preview,false);assert.equal(app.mode(),'playing');assert.equal(app.tracker.stats.playing,true);
  app.audio.dispose();
});

test('no shield cue survives in the audio API, the ducking table or the local source tracker',async()=>{
  const r=rig();await r.audio.start();
  for(const name of ['shield','shieldRaise','shieldBlock','shieldBreak','shieldBash','guard'])assert.equal(r.audio[name],undefined,'the '+name+' cue must no longer exist');
  r.audio.setPlaying(true);const before=r.ctx.sources.length;
  for(const name of ['shot','fracture','melee','hurt','dash'])r.audio[name]({level:1,hit:true});
  assert(r.ctx.sources.length>before,'the remaining combat cues still sound after the cleanup');
  r.audio.dispose();
  assert.doesNotMatch(source.audio,/shield/i,'the audio module keeps no shield cue, ducking entry or priority entry');
  assert.doesNotMatch(source.soundscape,/shield/i,'the local source tracker no longer classifies shield sounds as personal');
});

test('the game creates FAudio with the METAL recipe table and its own audition plays the 0.24 s SMG report',async()=>{
  const app=shell({recipes:true});assert.equal(app.createOptions?.recipes,app.scope.MetalAudio.recipes,'game.js hands METAL recipes to FAudio');
  app.element('intro-options').click();app.element('tab-audio').click();await app.flush();assert(app.audio.stats.titlePlaying);
  const before=app.ctx.sources.length;await app.element('test-audio').dispatch('click');assert(app.audio.stats.preview);app.frame(700);
  const lengths=app.ctx.sources.slice(before).map(n=>n.buffer?.length);
  assert(lengths.includes(Math.ceil(.24*22050)),'the audition plays the METAL SMG');assert(lengths.includes(Math.ceil(.34*22050)),'and the METAL pistol');
  assert(!lengths.includes(Math.ceil(.105*22050))&&!lengths.includes(Math.ceil(.165*22050)),'no v0.2 weapon buffer is played');
  app.element('resume').click();app.element('start').click();await app.ready();assert.equal(app.mode(),'playing');assert.equal(app.contexts.length,1);app.audio.dispose();
});

// LOAD-13 (lot 11, tour 1) : la préparation découpe vraiment, et le découpage ne change pas le son.
test('a game recipe renders bit for bit the same PCM whether the engine cuts it into blocks or not',()=>{
  const r=rig({recipes:true});
  const names=[...Object.keys(r.scope.MetalAudio.recipes),...Object.keys(r.scope.MetalAudio.extras)];
  assert(names.length>=7,'the METAL table and its confirmations are loaded');
  for(const name of names){
    const recipe=r.scope.MetalAudio.recipes[name]||r.scope.MetalAudio.extras[name];
    assert.equal(typeof recipe.job,'function',name+' exposes a resumable renderer');
    for(const variant of [0,1])for(const block of [1,16,64,256,4096]){
      const one=recipe.synth(variant,22050),job=recipe.job(variant,22050);
      assert.equal(job.total,one.length,name+' reports its length before rendering');
      let guard=0;while(!job.step(block)&&guard++<200000){}
      assert.deepEqual(job.seal(),one,name+' variant '+variant+' cut at '+block+' samples');
    }
  }
  r.audio.dispose();
});

test('the preparation scheduler never runs past its 8 ms slice on the clock it reads',async()=>{
  const scope={timers:[]},contexts=[];scope.window=scope;
  let clockT=0;scope.performance={now:()=>(clockT+=.05)};
  scope.setTimeout=fn=>{scope.timers.push(fn);return scope.timers.length;};scope.clearTimeout=()=>{};
  scope.AudioContext=class extends Context{constructor(){super();contexts.push(this);}};
  vm.createContext(scope);
  vm.runInContext(source.music,scope,{filename:'music.js'});
  vm.runInContext(source.audio,scope,{filename:'audio.js'});
  vm.runInContext(source['audio-recipes'],scope,{filename:'audio-recipes.js'});
  const audio=scope.FAudio.create(scope.MetalAudio.options());
  await audio.start();
  const pending=audio.prepare(0),slices=[];
  const idle=()=>new Promise(resolve=>setImmediate(resolve));
  await idle();
  while(scope.timers.length){const fn=scope.timers.shift();const t0=scope.performance.now();fn();slices.push(scope.performance.now()-t0);await idle();}
  assert.equal(await pending,true,'the bank is ready');
  assert(slices.length>20,'the work really is cut into slices, got '+slices.length);
  for(const ms of slices)assert(ms<=8.000001,'une tranche dépasse son budget : '+ms.toFixed(2)+' ms');
  audio.dispose();
});

test('the prepared bank equals the direct synthesis for every name, recipe-backed names included',async()=>{
  const r=rig({recipes:true});await r.audio.start();
  const idle=()=>new Promise(resolve=>setImmediate(resolve));
  const pending=r.audio.prepare(0);
  await idle();
  while(r.timers.size){const [id,timer]=[...r.timers][0];r.timers.delete(id);timer.fn();await idle();}
  assert.equal(await pending,true);
  const sha=b=>Buffer.from(b.getChannelData(0).buffer).toString('base64');
  const prepared=r.contexts.flatMap(c=>c.buffers).filter(b=>b.sampleRate===22050);
  const table=r.scope.MetalAudio.recipes,extras=r.scope.MetalAudio.extras;
  const expected=[];
  for(const name of r.scope.FAudio.effectNames)for(let k=0;k<(table[name]?.variants??(name.startsWith('motor:')?1:2));k++)expected.push(sha({getChannelData:()=>r.scope.FAudio.synthesize(name,k,22050,table)}));
  for(const name of Object.keys(extras).sort())for(let k=0;k<2;k++)expected.push(sha({getChannelData:()=>extras[name].synth(k,22050)}));
  assert.equal(prepared.length,expected.length,'the bank holds every prepared buffer');
  const got=prepared.map(sha).sort(),want=expected.slice().sort();
  for(let i=0;i<want.length;i++)assert.equal(got[i],want[i],'buffer '+i+' diffère de la synthèse directe');
  r.audio.dispose();
});
test('FEEL-07 fige les quatre réglages décidés : compresseur maître, maintien du duck, voix ennemie, envoi écho',async()=>{
  const r=rig({recipes:true});r.audio.setStage(1);r.audio.setPlaying(true);await r.audio.start();r.audio.tick();
  const ctx=r.ctx,limiter=ctx.nodes.find(n=>n.kind==='limiter'),guard=ctx.nodes.find(n=>n.kind==='guard');
  assert.deepEqual([limiter.threshold.value,limiter.knee.value,limiter.ratio.value,limiter.attack.value,limiter.release.value],[-9,6,8,.002,.1],'le compresseur maitre est le préréglage MIX-04 : −9 dB, genou 6, ratio 8:1, attaque 2 ms, relâchement 100 ms');
  assert(guard.curve&&guard.curve.length>1,'le plafond souple .875 reste sous le nouveau compresseur');assert.equal(guard.oversample,'none');
  const delay=ctx.nodes.find(n=>n.kind==='delay'),send=ctx.nodes.find(n=>n.kind==='gain'&&n.connections.includes(delay));
  assert(send,'le bus des effets a bien un envoi vers le delai');assert.equal(send.gain.value,.09,'lenvoi decho des armes est a 0,09');
  const bus=r.music[0].output,base=bus.gain.value;
  r.audio.fracture();
  assert(Math.abs(r.audio.stats.duckGain-base*.35)<1e-6,'la pompe abat la musique a 0,35 de son niveau, pas 0,45');
  let hold=bus.gain.events.at(-1).time-ctx.currentTime;assert(Math.abs(hold-.30)<1e-9,'la pompe tient le caniveau 0,30 s depuis les tenues MIX-V1, '+hold);
  r.ctx.advance(1.5);r.audio.tick();bus.gain.events.length=0;
  r.audio.shot({level:1});
  assert(Math.abs(r.audio.stats.duckGain-base*.35)<1e-6,'la rafale de SMG abat la musique a 0,35');
  hold=bus.gain.events.at(-1).time-ctx.currentTime;assert(Math.abs(hold-.36)<1e-9,'le SMG tient le caniveau 0,36 s depuis les tenues MIX-V1, '+hold);
  r.ctx.advance(1.5);r.audio.tick();
  const before=ctx.sources.length;r.audio.enemyShot({kind:0,level:1,pan:0});
  assert.equal(ctx.sources.length,before+1,'une salve ennemie joue un seul tampon');
  const shot=ctx.sources.at(-1),metal=r.scope.MetalAudio.extras.enemySmg;
  assert.equal(pcmKey(shot.buffer.getChannelData(0)),pcmKey(metal.synth(0,22050)),'lenemi joue la recette du joueur sans son clic mecanique');
  assert(Math.abs(shot.playbackRate.value-.85)<=.85*.015,'la voix ennemie est ralentie a 0,85 a la variation de 1,5 % pres, '+shot.playbackRate.value);
  const filter=shot.connections[0];assert.equal(filter.kind,'filter','la voix ennemie passe par un filtre');
  assert.equal(filter.type,'lowpass');assert.equal(filter.frequency.value,1100,'et par un passe-bas a 1,1 kHz');
  assert(effectPeak(shot)<=.24*1.001&&effectPeak(shot)>0,'le niveau demande est 0,24, mesure '+effectPeak(shot));
  const plain=rig();await plain.audio.start();plain.audio.setPlaying(true);plain.audio.tick();
  const n=plain.ctx.sources.length;plain.audio.enemyShot({kind:0,level:1,pan:0});
  assert.equal(plain.ctx.sources.length,n+1,'sans la table METAL, lenemi garde le tampon v0.2 plutot que le silence');
  assert.equal(plain.ctx.sources.at(-1).connections[0].frequency.value,1100,'le passe-bas sapplique aussi a la voix de secours');
  r.audio.dispose();plain.audio.dispose();});

// MIX-11 (lot 11b T2) : injecter un contexte hors ligne, et lire le vrai graphe.
class OfflineContext extends Context{
  constructor(){super();this.renders=0;this.state='suspended';}
  startRendering(){this.renders++;return Promise.resolve({sampleRate:this.sampleRate,length:0,numberOfChannels:2,getChannelData:()=>new Float32Array(0)});}
}
test('un contexte hors ligne injecte tient pour disponible, nest jamais ouvert, relance ni ferme, et api.graph() rend les six noeuds (MIX-11)',async()=>{
  const ctx=new OfflineContext();
  const r=rig({options:{context:ctx}});
  assert.equal(r.audio.graph(),null,'avant toute ouverture, le graphe nest pas rendu');
  await r.audio.start();
  assert.equal(ctx.resumes,0,'le moteur ne relance jamais un contexte qui lui est confié');
  assert.equal(ctx.closes,0,'le moteur ne ferme jamais un contexte qui lui est confié');
  const g=r.audio.graph();
  assert(g,'le graphe est rendu des que le contexte est adopte');
  assert.deepEqual(Object.keys(g).sort(),['ambience','effects','guard','limiter','master','musicBus'],'api.graph() rend maitre, ecreteur, garde, effets, ambiance et bus de musique');
  for(const k of Object.keys(g))assert.equal(typeof g[k].connect,'function',k+' est bien un noeud');
  assert.equal(g.limiter.kind,'limiter','le limiteur expose est le vrai compresseur de la chaine');
  assert.equal(g.guard.kind,'guard','le garde expose est le vrai ecreteur');
  assert(g.musicBus.connections.includes(g.master),'le bus de musique rendu est bien celui qui monte au maitre');
  r.audio.setStage(1);r.audio.setPlaying(true);r.audio.tick();
  const before=ctx.sources.length;r.audio.shot({level:1});
  assert.equal(ctx.sources.length,before+1,'un tir est bien programme sur un contexte hors ligne, malgre son etat « suspended »');
  assert(r.tracker.stats.scheduledRows>0,'le mod joue aussi sur un contexte hors ligne');
  r.audio.dispose();
  assert.equal(ctx.closes,0,'la liberation ne ferme pas le contexte du banc');
  const plain=rig();await plain.audio.start();plain.audio.setStage(1);plain.audio.setPlaying(true);plain.audio.tick();
  const n=plain.ctx.sources.length;plain.audio.shot({level:1});
  assert.equal(plain.ctx.sources.length,n+1,'sans contexte injecte, le jeu normal joue toujours');
  plain.audio.dispose();
  assert.equal(plain.ctx.closes,1,'en revanche le contexte que le moteur a ouvert est bien ferme');
});

// MIX-02 (lot 11b T3) : le rattrapage caché du compresseur, annoncé et compensé.
test('FAudio.makeupDb rend le rattrapage automatique du compresseur aux quatre couples mesurés, et chain level:"fixe" le compense après le compresseur (MIX-02)',async()=>{
  const MESURES=[[-12,6,3,3.73],[-19,18,5,4.55],[-6,4,12,2.56],[-9,6,8,3.53]];
  const r=rig();await r.audio.start();
  for(const [seuil,genou,ratio,mesure] of MESURES){
    const annonce=r.scope.FAudio.makeupDb(seuil,genou,ratio);
    assert(Math.abs(annonce-mesure)<=0.05,'rattrapage ('+seuil+' dB, genou '+genou+', '+ratio+':1) annoncé '+annonce.toFixed(3)+', rendu '+mesure+' par le banc');
  }
  assert.equal(r.audio.stats.makeupDb,r.scope.FAudio.makeupDb(-12,6,3),'stats.makeupDb rend bien le rattrapage du compresseur en place');
  const g0=r.audio.graph();
  assert(g0.limiter.connections.includes(g0.guard),'sans option chain, le limiteur monte toujours directement a l ecreteur');
  assert.equal(r.ctx.nodes.filter(n=>n.kind==='gain'&&g0.limiter.connections.includes(n)).length,0,'aucun gain de rattrapage n est ajoute par defaut');
  assert.equal(g0.master.gain.value,.65,'le maitre reste a 0,65 sans option chain');
  r.audio.dispose();
  const f=rig({options:{chain:{masterGain:.65,compressor:{threshold:-9,knee:6,ratio:8,attack:.002,release:.1},level:'fixe'}}});
  await f.audio.start();
  const g=f.audio.graph();
  assert.deepEqual([g.limiter.threshold.value,g.limiter.knee.value,g.limiter.ratio.value,g.limiter.attack.value,g.limiter.release.value],[-9,6,8,.002,.1],'chain.compressor regle le vrai compresseur');
  assert.equal(g.limiter.connections.length,1,'le limiteur ne sort plus que vers le gain de rattrapage');
  const compensation=g.limiter.connections[0];
  assert.equal(compensation.kind,'gain','level fixe ajoute un GainNode');
  assert(compensation.connections.includes(g.guard),'entre le compresseur et l ecreteur, jamais avant le compresseur');
  const attendu=Math.pow(10,(r.scope.FAudio.makeupDb(-19,18,5)-r.scope.FAudio.makeupDb(-9,6,8))/20);
  assert(Math.abs(compensation.gain.value-attendu)<1e-12,'le gain vaut 10^((4,547 - 3,531)/20) = '+attendu.toFixed(4)+', mesure '+compensation.gain.value);
  assert.equal(g.master.gain.value,.65,'master.gain n est pas touche : le point de travail du compresseur ne bouge pas');
  assert.equal(f.audio.stats.makeupDb,r.scope.FAudio.makeupDb(-9,6,8),'stats rend le rattrapage du nouveau compresseur');
  f.audio.dispose();
  const m=rig({options:{chain:{masterGain:.5}}});await m.audio.start();
  assert.equal(m.audio.graph().master.gain.value,.5,'chain.masterGain regle bien le maitre');
  assert.deepEqual([m.audio.graph().limiter.threshold.value,m.audio.graph().limiter.knee.value,m.audio.graph().limiter.ratio.value],[-12,6,3],'sans compressor dans chain, les reglages en place restent');
  m.audio.dispose();
});

// MIX-V2 (lot 11b T8) : le duck suit le volume des effets, et ne bouge pas à 1.
test('le duck de la musique est proportionnel au volume des effets et reste identique bit à bit à effets = 1 (MIX-V2)',async()=>{
  const r=rig();r.audio.setStage(1);r.audio.setPlaying(true);await r.audio.start();r.audio.tick();
  const bus=r.music[0].output,base=bus.gain.value;
  r.audio.setMix({master:1,music:.45,effects:1,ambience:1});
  r.audio.shot({level:1});
  assert(Math.abs(r.audio.stats.duckGain-base*.35)<1e-6,'à effets = 1 (le défaut), le caniveau reste à 0,35 du niveau de la musique, pas plus');
  const aEffetsUn=r.audio.stats.duckGain;
  r.ctx.advance(1.5);r.audio.tick();
  for(const [effets,attendu] of [[.5,1-.65*.5],[.2,1-.65*.2],[.05,1-.65*.05]]){
    r.audio.setMix({master:1,music:.45,effects:effets,ambience:1});
    r.audio.shot({level:1});
    const voulu=base*attendu;
    assert(Math.abs(r.audio.stats.duckGain-voulu)<1e-6,'à '+effets*100+' % d\'effets le caniveau vaut '+r.audio.stats.duckGain.toFixed(4)+', attendu '+voulu.toFixed(4));
    r.ctx.advance(1.5);r.audio.tick();
  }
  r.audio.setMix({master:1,music:.45,effects:1,ambience:1});
  r.audio.shot({level:1});
  assert.equal(r.audio.stats.duckGain,aEffetsUn,'revenu à effets = 1, le duck est exactement le même nombre');
  r.ctx.advance(1.5);r.audio.tick();
  r.audio.setMix({master:1,music:.45,effects:0,ambience:1});
  r.audio.shot({level:1});
  assert.equal(r.audio.stats.duckGain,base,'à effets = 0 la musique ne plonge pas pour des tirs inaudibles');
  r.audio.dispose();
});

// MIX-V1 (lot 11b T4) : les tenues du duck deviennent une option du moteur.
test('duck.classes remplace profondeur et tenue cue par cue, et sans l\'option le duck est exactement celui d\'aujourd\'hui (MIX-V1)',async()=>{
  function caniveau(audio,ctx,bus,name,arg){
    audio[name](arg);
    const g=bus.gain.events.at(-1).time-ctx.currentTime;
    return {gain:audio.stats.duckGain,hold:g};
  }
  const nu=rig();nu.audio.setStage(1);nu.audio.setPlaying(true);await nu.audio.start();nu.audio.tick();
  const busN=nu.music[0].output,baseN=busN.gain.value;
  let r=caniveau(nu.audio,nu.ctx,busN,'shot',{level:1,weapon:0,seed:1});
  assert(Math.abs(r.gain-baseN*.35)<1e-6,'sans option, le SMG abat toujours la musique a 0,35');
  assert(Math.abs(r.hold-.18)<1e-9,'sans option, le SMG tient toujours 0,18 s, mesure '+r.hold);
  nu.audio.dispose();
  const m=rig({options:{duck:{classes:[{cues:['shot'],hold:.36},{cues:['fracture','rocket','grenade','grenadeLaunch'],hold:.30}]}}});
  m.audio.setStage(1);m.audio.setPlaying(true);await m.audio.start();m.audio.tick();
  const busM=m.music[0].output,baseM=busM.gain.value;
  r=caniveau(m.audio,m.ctx,busM,'shot',{level:1,weapon:0,seed:1});
  assert(Math.abs(r.hold-.36)<1e-9,'la classe allonge la tenue du tir a 0,36 s, mesure '+r.hold);
  assert(Math.abs(r.gain-baseM*.35)<1e-6,'la tenue ne change pas la profondeur : toujours 0,35');
  m.ctx.advance(1.5);m.audio.tick();busM.gain.events.length=0;
  r=caniveau(m.audio,m.ctx,busM,'fracture',{level:1,seed:1});
  assert(Math.abs(r.hold-.30)<1e-9,'la pompe est tenue 0,30 s, mesure '+r.hold);
  m.audio.dispose();
  const d=rig({options:{duck:{classes:[{cues:['shot'],depth:.5,hold:.2},{cues:['switchWeapon'],depth:.6,fixed:true}]}}});
  d.audio.setStage(1);d.audio.setPlaying(true);await d.audio.start();d.audio.tick();
  const busD=d.music[0].output,baseD=busD.gain.value;
  r=caniveau(d.audio,d.ctx,busD,'shot',{level:1,weapon:0,seed:1});
  assert(Math.abs(r.gain-baseD*.5)<1e-6,'la classe peut aussi imposer sa profondeur');
  assert(Math.abs(r.hold-.2)<1e-9,'et son maintien, mesure '+r.hold);
  d.ctx.advance(1.5);d.audio.tick();busD.gain.events.length=0;
  d.audio.switchWeapon();
  assert(Math.abs(d.audio.stats.duckGain-baseD*.6)<1e-6,'fixed:true fait duck un cue que le moteur ne duckait pas, a profondeur fixe');
  d.ctx.advance(1.5);d.audio.tick();busD.gain.events.length=0;
  d.audio.shot({level:.2,weapon:0,seed:1});
  const demi=baseD*(1-.5*Math.min(1,.2*1.25));
  assert(Math.abs(d.audio.stats.duckGain-demi)<1e-6,'hors fixed, le niveau du son pondere toujours la profondeur');
  d.audio.dispose();
});

// MIX-04 (lot 11b T5) : le préréglage Doom est une option du moteur, pas son défaut.
test('le préréglage Doom de METAL passe par chain et weaponGain : limiteur −9/6/8 sans compensation, rapports du joueur ×1,41, ennemis inchangés (MIX-04)',async()=>{
  const metal=rig({recipes:true});metal.audio.setStage(1);metal.audio.setPlaying(true);await metal.audio.start();metal.audio.tick();
  const g=metal.audio.graph();
  assert.deepEqual([g.limiter.threshold.value,g.limiter.knee.value,g.limiter.ratio.value,g.limiter.attack.value,g.limiter.release.value],[-9,6,8,.002,.1],'le préréglage regle le limiteur a −9 dB, genou 6, ratio 8:1, attaque 2 ms, relâchement 100 ms');
  assert(g.limiter.connections.includes(g.guard),'level:auto : aucun gain de rattrapage ne sépare le compresseur de l\'écrêteur');
  assert.equal(metal.audio.stats.makeupDb,metal.scope.FAudio.makeupDb(-9,6,8),'le rattrapage annoncé est bien celui du nouveau compresseur');
  metal.audio.shot({level:1,weapon:0,seed:1});
  const rapportJoueur=effectPeak(metal.ctx.sources.at(-1));
  metal.ctx.advance(1.5);metal.audio.tick();
  metal.audio.enemyShot({kind:0,level:1,pan:0});
  const rapportEnnemi=effectPeak(metal.ctx.sources.at(-1));
  metal.audio.dispose();
  const nu=rig({options:{recipes:metal.scope.MetalAudio.recipes,extras:metal.scope.MetalAudio.extras}});
  nu.audio.setStage(1);nu.audio.setPlaying(true);await nu.audio.start();nu.audio.tick();
  const gn=nu.audio.graph();
  assert.deepEqual([gn.limiter.threshold.value,gn.limiter.knee.value,gn.limiter.ratio.value],[-12,6,3],'sans chain, le moteur garde son compresseur à lui');
  nu.audio.shot({level:1,weapon:0,seed:1});
  const sansRapport=effectPeak(nu.ctx.sources.at(-1));
  nu.ctx.advance(1.5);nu.audio.tick();
  nu.audio.enemyShot({kind:0,level:1,pan:0});
  const sansEnnemi=effectPeak(nu.ctx.sources.at(-1));
  assert(Math.abs(rapportJoueur/sansRapport-1.41)<1e-9,'le rapport du joueur est multiplié par 1,41 : '+sansRapport.toFixed(4)+' → '+rapportJoueur.toFixed(4));
  assert.equal(rapportEnnemi,sansEnnemi,'les tirs ennemis ne montent pas : la table n\'est lue que dans les cues du joueur');
  nu.audio.dispose();
});
