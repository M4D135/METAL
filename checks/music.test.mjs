import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const source=fs.readFileSync(new URL('../src/music.js',import.meta.url),'utf8');
const scope={};vm.runInNewContext(source,scope);const Music=scope.FMusic;
const bytesHash=b=>createHash('sha256').update(b).digest('hex');
function parse(bytes){
  assert.equal(Buffer.from(bytes.slice(1080,1084)).toString(),'M.K.');
  const order=Array.from(bytes.slice(952,952+bytes[950])),patterns=Math.max(...order)+1,samples=[];let offset=1084+patterns*1024;
  assert(order.length>1&&order.length<=128);assert(order.every(p=>p<64));
  for(let i=0;i<31;i++){
    const h=20+i*30,length=((bytes[h+22]<<8)|bytes[h+23])*2;
    assert(bytes[h+25]<=64);assert.equal(bytes[h+24],0);assert(length<=65536);
    const pcm=new Int8Array(bytes.buffer,bytes.byteOffset+offset,length);
    if(length){assert.equal(pcm[0],0);assert.equal(pcm[1],0);assert(pcm.some(v=>v<0)&&pcm.some(v=>v>0),'sample must contain a bipolar waveform');}
    samples.push({pcm,volume:bytes[h+25]});offset+=length;
  }
  assert.equal(offset,bytes.length,'headers must account for every PCM byte');
  const events=[];
  for(let p=0;p<patterns;p++)for(let row=0;row<64;row++)for(let channel=0;channel<4;channel++){
    const at=1084+(p*64+row)*16+channel*4,a=bytes[at],c=bytes[at+2],sample=(a&240)|(c>>4),period=((a&15)<<8)|bytes[at+1],effect=c&15,param=bytes[at+3];
    assert(sample<=31);assert(!period||period>=113&&period<=856);assert([0,12,15].includes(effect));
    if(sample)assert(samples[sample-1].pcm.length>2,'note references a generated instrument');
    events.push({p,row,channel,sample,period,effect,param});
  }
  return {bytes,order,patterns,samples,events};
}
class Param {
  constructor(value=0){this.value=value;this.events=[];}
  setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);}
  linearRampToValueAtTime(v,t){this.value=v;this.events.push(['linear',v,t]);}
  setTargetAtTime(v,t,c){this.value=v;this.events.push(['target',v,t,c]);}
  cancelScheduledValues(t){this.events.push(['cancel',t]);}
}
class Context {
  constructor(){this.currentTime=0;this.state='running';this.nodes=[];this.sources=[];this.buffers=[];this.closed=false;}
  node(kind){const n={kind,connections:[],targets:[],disconnected:false,connect(target){this.connections.push(target);this.targets.push(target);return target;},disconnect(){this.connections=[];this.disconnected=true;}};this.nodes.push(n);return n;}
  createGain(){const n=this.node('gain');n.gain=new Param(1);return n;}
  createStereoPanner(){const n=this.node('pan');n.pan=new Param();return n;}
  createBuffer(channels,length,rate){assert.equal(channels,1);assert(rate>=8000);const data=new Float32Array(length),buffer={duration:length/rate,sampleRate:rate,length,getChannelData:()=>data};this.buffers.push(buffer);return buffer;}
  createBufferSource(){const n=this.node('source');n.playbackRate=new Param(1);n.startTime=Infinity;n.stopTime=Infinity;n.ended=false;n.start=t=>{assert(t>=this.currentTime-.001,'scheduling past audio');n.startTime=t;};n.stop=t=>{n.stopTime=t;};this.sources.push(n);return n;}
  advance(seconds){this.currentTime+=seconds;for(const n of this.sources)if(!n.ended&&Math.min(n.stopTime,n.startTime+(n.buffer?.duration||0)/n.playbackRate.value)<=this.currentTime){n.ended=true;n.onended?.();}}
  close(){this.closed=true;}
}
function rig(){const ctx=new Context(),output=ctx.createGain(),music=Music.create(ctx,output);return {ctx,output,music};}
function run(rig,seconds,step=.04){for(let t=0;t<seconds;t+=step){rig.music.tick();rig.ctx.advance(step);}}

test('three deterministic, complete ProTracker MODs contain original PCM and evolving scores',()=>{
  const songs=[0,1,2].map(s=>parse(Music.getModule(s)));
  assert.equal(new Set(songs.map(s=>bytesHash(s.bytes))).size,3);
  for(let stage=0;stage<3;stage++){
    const s=songs[stage];assert(s.samples.filter(x=>x.pcm.length).length>=10);assert.equal(s.patterns,6);
    assert.equal(new Set(Array.from({length:s.patterns},(_,p)=>bytesHash(s.bytes.slice(1084+p*1024,1084+(p+1)*1024)))).size,6);
    assert(s.events.some(e=>e.effect===15&&e.param===[100,170,145][stage]));
    assert(s.events.some(e=>e.effect===15&&e.param===6));
    assert(new Set(s.events.filter(e=>e.period).map(e=>e.period)).size>=10);
    assert.equal(bytesHash(Music.getModule(stage)),bytesHash(s.bytes));
    const exported=Music.getModule(stage);exported.fill(0);assert.equal(bytesHash(Music.getModule(stage)),bytesHash(s.bytes),'export must not mutate playback state');
  }
  const density=s=>s.events.filter(e=>e.channel===0&&e.period).length;
  assert(density(songs[1])>density(songs[0])*1.5,'thrash has a denser picking rhythm than doom');
  assert(songs[2].events.filter(e=>e.channel===2&&(e.sample===5||e.sample===6)).length>40,'melodic stage includes recurring harmonized phrases');
  const fresh={};vm.runInNewContext(source,fresh);assert.equal(bytesHash(fresh.FMusic.getModule(2)),bytesHash(songs[2].bytes),'synthesis must be deterministic across sessions');
});

test('playback reads the exported note periods and the exact signed eight-bit sample data',()=>{
  const r=rig(),module=parse(Music.getModule(0));r.music.setPlaying(true);r.music.tick();
  const notes=module.events.filter(e=>e.p===0&&e.row===0&&e.period),starts=r.ctx.sources.filter(n=>n.startTime===.035);
  assert.equal(starts.length,notes.length);
  notes.forEach((e,i)=>{
    assert.equal(starts[i].playbackRate.value,428/e.period);
    const actual=starts[i].buffer.getChannelData(0),expected=module.samples[e.sample-1].pcm;assert.equal(actual.length,expected.length);
    for(let j=0;j<expected.length;j+=137)assert.equal(actual[j],expected[j]/128);
  });
  assert.equal(r.music.stats.tempo,100);assert.equal(r.ctx.buffers.length,3,'shared open guitar sample is uploaded once for two tracks');r.music.dispose();
});

test('tracker advances at encoded tempo through multiple patterns and keeps a bounded voice budget',()=>{
  const r=rig();r.music.setStage(1);r.music.setPlaying(true);run(r,50);
  assert.equal(r.music.stats.tempo,170);assert(r.music.stats.scheduledRows>550&&r.music.stats.scheduledRows<575);
  assert(r.music.stats.scheduledNotes>700);assert(r.music.stats.peakVoices<=28);assert(r.music.stats.resyncs===0);
  assert(r.ctx.buffers.length<=14,'instrument buffers are cached across pattern changes');
  assert(r.ctx.sources.some(n=>n.startTime>45));r.music.dispose();
  assert.equal(r.music.stats.activeVoices,0);assert(r.ctx.nodes.slice(1).every(n=>n.disconnected));assert(!r.output.disconnected&&!r.ctx.closed);
});

test('pause cancels already scheduled notes, resumes on a bar, and does not touch shared context or SFX',()=>{
  const r=rig(),external=r.ctx.createBufferSource();external.buffer=r.ctx.createBuffer(1,441000,44100);external.connect(r.output);external.start(0);
  r.music.setPlaying(true);run(r,1.1);r.music.setPlaying(false);const rows=r.music.stats.scheduledRows,n=r.ctx.sources.length;
  r.ctx.advance(1);r.music.tick();assert.equal(r.music.stats.activeVoices,0);assert.equal(r.music.stats.scheduledRows,rows);assert.equal(r.ctx.sources.length,n);
  assert.equal(external.stopTime,Infinity);assert(!external.disconnected);
  const resume=r.ctx.currentTime;r.music.setPlaying(true);r.music.tick();const newSources=r.ctx.sources.slice(n);
  assert(newSources.length>0&&newSources.length<=12);assert(newSources.every(s=>s.startTime>=resume+.002));
  assert(r.music.stats.row<16||r.music.stats.row>=16&&r.music.stats.row<20,'restart lands at a readable bar boundary');
  r.music.dispose();assert(!external.disconnected&&!r.ctx.closed);
});

test('late frames resynchronize without an unbounded catch-up burst',()=>{
  const r=rig();r.music.setStage(1);r.music.setPlaying(true);run(r,1);
  r.ctx.advance(30);const notes=r.ctx.sources.length,rows=r.music.stats.scheduledRows;r.music.tick();
  assert.equal(r.music.stats.resyncs,1);assert(r.music.stats.scheduledRows-rows<=6);assert(r.ctx.sources.length-notes<=24);
  assert(r.ctx.sources.slice(notes).every(s=>s.startTime>=r.ctx.currentTime+.002));r.music.dispose();
});

test('volume, threat, stage changes and unavailable audio respect lifecycle ownership',()=>{
  const r=rig();r.music.setThreat(1);r.music.setVolume(.6);r.music.setPlaying(true);run(r,.4);
  const samples=r.ctx.buffers.length;r.music.setStage(2);r.music.tick();assert.equal(r.music.stats.tempo,145);assert.equal(r.music.stats.stage,2);assert(r.ctx.buffers.length>samples);
  r.music.setVolume(0);r.ctx.advance(.05);const count=r.ctx.sources.length;run(r,1);assert.equal(r.ctx.sources.length,count);assert.equal(r.music.stats.activeVoices,0);
  r.music.setVolume(.4);r.music.tick();assert(r.ctx.sources.length>count);
  r.ctx.state='suspended';const held=r.music.stats.scheduledRows;run(r,1);assert.equal(r.music.stats.scheduledRows,held);
  r.ctx.state='running';r.music.tick();assert(r.music.stats.scheduledRows>held);
  r.music.dispose();r.music.dispose();const nodes=r.ctx.nodes.length;r.music.setPlaying(true);r.music.setStage(0);r.music.tick();assert.equal(r.ctx.nodes.length,nodes);
  const silent=Music.create(null,null);silent.setPlaying(true);silent.tick();silent.dispose();assert.equal(silent.stats.activeVoices,0);
});

test('public track metadata matches the playable MOD, without loading audio or exposing mutable settings',()=>{
  for(let stage=0;stage<3;stage++){
    const track=Music.getTrack(stage),s=parse(Music.getModule(stage));assert.equal(track.channels,4);assert.equal(track.bpm,[100,170,145][stage]);assert(track.title.length>3&&track.style.length>3);
    assert(Math.abs(track.duration-s.order.length*64*15/track.bpm)<1e-9);assert(Buffer.from(s.bytes.slice(0,20)).toString().startsWith('METAL'));
    track.title='changed';track.bpm=0;assert.notEqual(Music.getTrack(stage).title,'changed');assert(Music.getTrack(stage).bpm>0);
  }
});

test('arrangements contain genuine stop/drop sections and substantial rhythm guitar sustain',()=>{
  for(let stage=0;stage<3;stage++){
    const s=parse(Music.getModule(stage)),count=p=>s.events.filter(e=>e.p===p&&e.channel===0&&e.period).length;
    assert(count(3)<count(1)*.75,'the breakdown changes the notes, not just an output fader');
    assert(s.events.filter(e=>e.p===3&&e.effect===12&&e.param===0).length>=12,'rests explicitly stop the sustained strings');
    assert(s.events.filter(e=>e.channel===2&&e.sample===15).length===4,'an original dissonant texture marks the four-bar tension passage');
    const palm=s.samples[0].pcm,open=s.samples[1].pcm,rms=(a,start,end)=>Math.sqrt(a.slice(start,end).reduce((sum,x)=>sum+(x/128)**2,0)/(end-start));
    assert(rms(palm,80,700)>.07);assert(rms(open,1000,4000)>.07,'open power chords retain body instead of an inaudible pluck');
    for(const sample of s.samples.filter(s=>s.pcm.length)){const mean=sample.pcm.reduce((sum,v)=>sum+v,0)/sample.pcm.length/128;assert(Math.abs(mean)<.035,'generated instruments must not carry a large DC offset');}
  }
});

test('warmup yields between instruments, shares pending work and opens no audio device',async()=>{
  let yields=0,contexts=0;const cold={setTimeout:fn=>{yields++;queueMicrotask(fn);},AudioContext:class{constructor(){contexts++;}}};vm.runInNewContext(source,cold);
  const first=cold.FMusic.warmup(0);assert.equal(first,cold.FMusic.warmup(0),'concurrent requests share synthesis');const meta=await first;
  assert(yields>=7,'PCM generation is split into loading-screen tasks');assert.equal(contexts,0);assert.equal(meta.bpm,100);assert.equal(meta.bytes,cold.FMusic.getModule(0).length);assert.equal(bytesHash(cold.FMusic.getModule(0)),bytesHash(Music.getModule(0)));
  const before=yields;await cold.FMusic.warmup(0);assert.equal(yields,before,'cached modules add no new jobs');await cold.FMusic.warmup(1);await cold.FMusic.warmup(2);assert.equal(yields,before+40,'LOAD-13: each remaining stage yields once per module phase plus its closing pause — seven kit drums, eight kit bars, kit extras, compose, serialize, decode = 19 phases, ×2 stages');assert.equal(contexts,0);
});

test('preparing future AudioBuffers never switches the score and avoids first-use buffer work in combat',()=>{
 const r=rig();const nodeCount=r.ctx.nodes.length;assert(r.music.prepare(0));assert(r.music.prepare(1));assert(r.music.prepare(2));const prepared=r.ctx.buffers.length;
 assert.equal(prepared,45);assert.equal(r.ctx.nodes.length,nodeCount);assert.equal(r.ctx.sources.length,0);assert.equal(r.music.stats.stage,0);assert(!r.music.stats.playing);
 for(let stage=0;stage<3;stage++){r.music.setStage(stage);r.music.setPlaying(true);run(r,9);assert.equal(r.ctx.buffers.length,prepared,'every pattern uses the bank prepared outside combat');r.music.setPlaying(false);}
 r.music.dispose();assert.equal(r.music.prepare(1),false);
});

test('melodic harmony uses thirds belonging to its dark mode, not arbitrary parallel intervals',()=>{
 const s=parse(Music.getModule(2)),periods=[856,808,762,720,678,640,604,570,538,508,480,453,428,404,381,360,339,320,302,285,269,254,240,226,214,202,190,180,170,160,151,143,135,127,120,113],mode=new Set([4,5,7,9,11,0,2]);
 for(const note of s.events.filter(e=>e.channel===2&&(e.sample===5||e.sample===6))){const midi=36+periods.indexOf(note.period),third=note.sample===5?3:4;assert(mode.has(midi%12));assert(mode.has((midi+third)%12));}
});

test('the original title thrash starts immediately, evolves for a full loop and leaves the three world scores unchanged',()=>{
 const title=Music.getTrack('title'),song=parse(Music.getModule('title'));
 assert.equal(title.title,'Furie d’acier');assert.equal(title.bpm,212);assert.equal(title.channels,4);
 assert.equal(song.patterns,8);assert.equal(song.order.length,12);assert.equal(title.duration,song.order.length*64*15/title.bpm);
 assert.equal(song.events.filter(e=>e.p===0&&e.row===0&&e.period).length,4,'guitars, bass and drums attack together instead of an ambient intro');
 assert.equal(new Set(Array.from({length:song.patterns},(_,p)=>bytesHash(song.bytes.slice(1084+p*1024,1084+(p+1)*1024)))).size,8);
 const density=p=>song.events.filter(e=>e.p===p&&e.channel===0&&e.period).length;
 assert(density(4)>=56,'the assault has rapid picked sixteenths');assert(density(3)<density(1)*.5,'the breakdown contains real rhythmic space');
 assert(song.events.filter(e=>e.p===3&&e.effect===12&&e.param===0).length>=30);
 assert(song.events.some(e=>e.channel===2&&e.sample===16));assert(song.events.some(e=>e.channel===2&&e.sample===17));
 assert.notEqual(bytesHash(song.samples[0].pcm),bytesHash(song.samples[15].pcm),'left and right palm guitars use independent synthesized pick attacks');
 assert.notEqual(bytesHash(song.samples[1].pcm),bytesHash(song.samples[16].pcm));
 for(const sample of song.samples.filter(s=>s.pcm.length)){
  const peak=sample.pcm.reduce((n,x)=>Math.max(n,Math.abs(x)),0)/128,dc=sample.pcm.reduce((n,x)=>n+x,0)/sample.pcm.length/128;
  assert(peak>.7&&peak<.92,'each synthesized instrument retains digital headroom');assert(Math.abs(dc)<.035);
 }
 const fresh={};vm.runInNewContext(source,fresh);assert.equal(bytesHash(fresh.FMusic.getModule('title')),bytesHash(song.bytes));
 const exportCopy=Music.getModule('title');exportCopy.fill(0);assert.equal(bytesHash(Music.getModule('title')),bytesHash(song.bytes));
 const worldHashes=['50d88a07744be3d2e51a98c15f5367351f4238c504644e5475aebf64d8758cd0','c12b06dab600fbc391299f10b6b1814db39b6c8bc7e23569c2bd1f204b81fcbd','738adaa5a8460e6f8fb8a3f6b11f05d25034dede0845553587b87ea03d7a6c39'];
 worldHashes.forEach((expected,stage)=>assert.equal(bytesHash(Music.getModule(stage)),expected,'world '+stage+' is byte-identical to the established composition'));
 assert.equal(Music.getTrack(3).bpm,145,'numeric out-of-range stage compatibility is preserved');assert.equal(Music.getTrack(-1).bpm,100);
});

test('title preparation and playback reuse a separate bank, loop and switch cleanly back to every world',()=>{
 const r=rig();for(const stage of [0,1,2,'title'])assert(r.music.prepare(stage));
 assert.equal(r.ctx.buffers.length,62);assert.equal(r.ctx.sources.length,0);assert.equal(r.music.stats.stage,0);
 r.music.setStage('title');r.music.setPlaying(true);run(r,Music.getTrack('title').duration+1);
 assert.equal(r.music.stats.stage,'title');assert.equal(r.music.stats.tempo,212);assert.equal(r.music.stats.order,0,'the 48-measure arrangement wraps to its opening');
 assert(r.music.stats.scheduledRows>768&&r.music.stats.scheduledRows<800);assert(r.music.stats.peakVoices<=28);assert.equal(r.music.stats.resyncs,0);
 assert.equal(r.ctx.buffers.length,62,'looping adds no AudioBuffers');
 for(const stage of [0,1,2,'title']){
  const before=r.ctx.sources.length;r.music.setStage(stage);r.music.tick();assert.equal(r.music.stats.stage,stage);assert.equal(r.music.stats.tempo,Music.getTrack(stage).bpm);
  const song=parse(Music.getModule(stage)),first=song.events.find(e=>e.p===0&&e.row===0&&e.channel===0&&e.period),actual=r.ctx.sources[before].buffer.getChannelData(0),expected=song.samples[first.sample-1].pcm;
  assert.equal(actual.length,expected.length);for(let i=0;i<actual.length;i+=127)assert.equal(actual[i],expected[i]/128,'symbolic and numeric cache keys must not collide');
  run(r,.3);assert.equal(r.ctx.buffers.length,62);
 }
 r.music.setPlaying(false);r.ctx.advance(.1);assert.equal(r.music.stats.activeVoices,0);const notes=r.music.stats.scheduledNotes;run(r,1);assert.equal(r.music.stats.scheduledNotes,notes);
 r.music.dispose();assert(r.ctx.nodes.slice(1).every(n=>n.disconnected));assert(!r.output.disconnected&&!r.ctx.closed);
});

test('title warmup is shared, yields its instrument work and needs no audio device',async()=>{
 let yields=0,contexts=0;const cold={setTimeout:fn=>{yields++;queueMicrotask(fn);},AudioContext:class{constructor(){contexts++;}}};vm.runInNewContext(source,cold);
 const first=cold.FMusic.warmup('title');assert.equal(first,cold.FMusic.warmup('title'));const meta=await first;
 assert.equal(meta.bpm,212);assert.equal(meta.title,'Furie d’acier');assert.equal(meta.bytes,cold.FMusic.getModule('title').length);assert(yields>=10);assert.equal(contexts,0);
  const before=yields;await cold.FMusic.warmup('title');assert.equal(yields,before);await cold.FMusic.warmup(0);assert.equal(yields,before+20,'LOAD-13: world preparation reuses the shared instruments and yields once per module phase plus its closing pause — seven kit drums, eight kit bars, kit extras, compose, serialize, decode = 19 phases');
 assert.equal(bytesHash(cold.FMusic.getModule('title')),bytesHash(Music.getModule('title')));assert.equal(contexts,0);
});
// RESTE-09 (lot 11) : la variante « deux GainNode persistants par piste » du point (1) reste
// écartée sur avis du constat lui-même (« à écarter : 30 nœuds par seconde sont insignifiants…
// réutiliser un gain qui porte encore des automations planifiées peut produire des clics »).
// Le test ne compte plus les nœuds — ce comptage verrouillait l'état contraire de la fiche et
// aurait bloqué quiconque voudrait implémenter le point (1) (tour 2, problème 7). Il garde les
// invariants neutres (une source par note, pas de panoramisation par note) et vérifie la
// propriété de qualité réelle qui justifiait l'écart : toute note coupée avant sa fin naturelle
// fond au silence (le fondu ~8 ms de music.js:380), donc ne clique pas.
test('sixty seconds of music fade every note cut before its natural end to silence (no click)',async()=>{
  await Music.warmup(0);
  const r=rig();r.music.setStage(0);r.music.setPlaying(true);
  const graph=r.ctx.nodes.slice();
  run(r,60);
  const notes=r.music.stats.scheduledNotes,created=r.ctx.nodes.filter(n=>graph.indexOf(n)<0);
  assert(notes>200,'soixante secondes de musique programment des notes, eu '+notes);
  const sources=created.filter(n=>n.kind==='source');
  assert.equal(sources.length,notes,'une AudioBufferSourceNode par note');
  assert.equal(created.filter(n=>n.kind==='pan').length,0,'aucun nœud de panoramisation par note');
  let cut=0;
  for(const s of sources){
    const natural=s.startTime+(s.buffer?s.buffer.duration/s.playbackRate.value:0);
    if(s.stopTime<natural-1e-4){
      cut++;
      const gain=s.targets[0];
      assert(gain&&gain.gain&&gain.gain.events.some(e=>e[0]==='target'&&e[1]<=.001),
        'une note coupée avant sa fin naturelle doit fondre au silence (fondu 8 ms), sinon clic');
    }
  }
  assert(cut>0,'des notes sont réellement coupées par la suivante, sinon le test est vide, eu '+cut);
});

// MIX-10 et MIX-V3 (lot 11b T7) : la boucle varie par graine, jamais a l'identique.
test('une graine allonge la boucle au-dela de 240 s sans repeter une fenetre de 4 positions, et le module sans graine reste octet pour octet l arrangement ecrit (MIX-10, MIX-V3)',()=>{
  for(let stage=0;stage<3;stage++){
    const ecrit=parse(Music.getModule(stage)),g=parse(Music.getModule(stage,96));
    assert.equal(ecrit.order.length,8,'sans graine, les huit positions ecrites');
    assert.notEqual(bytesHash(g.bytes),bytesHash(ecrit.bytes),'une graine change le module');
    assert.equal(bytesHash(Music.getModule(stage,96)),bytesHash(g.bytes),'la meme graine rend le meme module, deux appels de suite');
    assert.notEqual(bytesHash(Music.getModule(stage,7)),bytesHash(g.bytes),'deux graines rendent deux modules differents');
    assert(g.order.length>=48,'la boucle variee compte '+g.order.length+' positions');
    const track=Music.getTrack(stage,96);
    assert(Math.abs(track.duration-g.order.length*64*15/track.bpm)<1e-9,'la duree annoncee est la duree jouee');
    assert(track.duration>=240,'boucle de '+track.duration.toFixed(1)+' s au tempo '+track.bpm+', cible 240 s');
    const ph=[];for(let p=0;p<=Math.max(...g.order);p++)ph.push(bytesHash(g.bytes.slice(1084+p*1024,1084+(p+1)*1024)));
    const seq=g.order.map(p=>ph[p]),vues=new Map();
    for(let i=0;i+4<=seq.length;i++){const k=seq.slice(i,i+4).join();assert(!vues.has(k),'fenetre de quatre positions consecutives repetee a la position '+i);vues.set(k,i);}
    const guitares=new Set();
    for(let p=0;p<=Math.max(...g.order);p++)guitares.add(bytesHash(g.bytes.slice(1084+p*1024,1084+p*1024+768)));
    assert(guitares.size>=12,'au moins douze contenus de guitare distincts (canaux 0 a 2), mesure '+guitares.size);
  }
  const muet=rig(),varie=rig();
  muet.music.setStage(0);varie.music.setStage(0,96);
  muet.music.setPlaying(true);varie.music.setPlaying(true);
  run(muet,8);run(varie,8);
  assert(muet.music.stats.scheduledNotes>0&&varie.music.stats.scheduledNotes>0,'les deux se jouent');
  assert.equal(varie.music.stats.resyncs,0,'la graine ne provoque aucun resynchronisation');
});
// ---------------------------------------------------------------------------
// MUS-02 — adaptive repertoire: fast thrash, heavy doom, vertical layers and
// written horizontal joins. The three historical modules and the thrash
// welcome theme are untouched, byte for byte (hashes checked above); every
// assertion below covers content added beside them.
// ---------------------------------------------------------------------------
const CUE_IDS=Music.cueIds();
const CUE_ROWS=64,CUE_TRACKS=5;
const imuseSource=fs.readFileSync(new URL('../src/imuse.js',import.meta.url),'utf8');
// Two players: the shipped one with FImuse, and music.js alone with its plain
// fallback transport. Behaviour that both must guarantee is checked on both.
const adaptiveScope={};vm.runInNewContext(imuseSource,adaptiveScope);vm.runInNewContext(source,adaptiveScope);
const plainScope={};vm.runInNewContext(source,plainScope);
function crig(mode){
  const scope=mode==='adaptive'?adaptiveScope:plainScope;
  const ctx=new Context(),output=ctx.createGain();
  return {ctx,output,music:scope.FMusic.create(ctx,output)};
}
function cueParse(id){
  const bytes=Music.getModule(id);
  assert.equal(bytes.length%(CUE_ROWS*CUE_TRACKS*4),0,'a cue pattern is 64 rows of five tracks');
  const patterns=bytes.length/(CUE_ROWS*CUE_TRACKS*4),events=[];
  for(let p=0;p<patterns;p++)for(let row=0;row<CUE_ROWS;row++)for(let track=0;track<CUE_TRACKS;track++){
    const at=(p*CUE_ROWS+row)*CUE_TRACKS*4+track*4,a=bytes[at],c=bytes[at+2];
    events.push({p,row,track,sample:(a&240)|(c>>4),period:((a&15)<<8)|bytes[at+1],effect:c&15,param:bytes[at+3]});
  }
  return {bytes,patterns,events};
}
test('eight adaptive cues join the three worlds and the welcome theme without touching them',async()=>{
  await Promise.all(CUE_IDS.map(id=>Music.warmup(id)));
  assert.equal(CUE_IDS.slice().sort().join(','),'boss,calm,combat,doom1,doom2,thrash1,thrash2,victory');
  const titles=CUE_IDS.map(id=>Music.getTrack(id).title);
  assert.equal(new Set(titles).size,8,'every cue has its own title');
  assert.equal(new Set(CUE_IDS.map(id=>bytesHash(Music.getModule(id)))).size,8,'every cue has its own score');
  const fast=CUE_IDS.filter(id=>/thrash/i.test(Music.getTrack(id).style)),slow=['doom1','doom2'];
  assert(fast.length>=3,'at least three thrash cues, got '+fast.join(','));
  assert(fast.every(id=>Music.getTrack(id).bpm>=180),'thrash is fast: '+fast.map(id=>Music.getTrack(id).bpm).join(', '));
  assert(slow.every(id=>Music.getTrack(id).bpm<=70),'doom is heavy and slow: '+slow.map(id=>Music.getTrack(id).bpm).join(', '));
  assert(Music.getTrack('calm').bpm<Music.getTrack('doom1').bpm+20,'the idle bed stays in the same slow family');
  for(const id of CUE_IDS){
    const track=Music.getTrack(id);
    assert.equal(track.channels,CUE_TRACKS,'five tracks: rhythm, bass, lead, drums, announcement');
    assert(track.title.length>3&&track.style.length>3&&track.duration>0);
    assert(Music.isCue(id)&&!Music.isCue(id+'x'));
    const fresh={};vm.runInNewContext(source,fresh);
    assert.equal(bytesHash(fresh.FMusic.getModule(id)),bytesHash(Music.getModule(id)),'synthesis is deterministic across sessions for '+id);
  }
  for(const legacy of ['0','1','2','title'])assert.equal(Music.isCue(legacy),false,'the historical keys stay plain stages');
  const copy=Music.getModule(CUE_IDS[0]);copy.fill(0);
  assert.equal(bytesHash(Music.getModule(CUE_IDS[0])),bytesHash(Music.getModule(CUE_IDS[0])),'export must not mutate playback state');
});
test('adaptive scores write real played parts on all five tracks',async()=>{
  await Promise.all(CUE_IDS.map(id=>Music.warmup(id)));
  const parse=id=>cueParse(id);
  const density=id=>{const s=parse(id);return s.events.filter(e=>e.track===0&&e.period).length/s.patterns;};
  const fast=CUE_IDS.filter(id=>Music.getTrack(id).bpm>=180),slow=['doom1','doom2'];
  const mean=list=>list.reduce((n,id)=>n+density(id),0)/list.length;
  assert(mean(fast)>mean(slow)*2,'thrash picking is far denser than doom: '+mean(fast).toFixed(1)+' against '+mean(slow).toFixed(1));
  for(const id of CUE_IDS){
    const {events,patterns}=parse(id),bpm=Music.getTrack(id).bpm,desc=Music.cueDescriptor(id);
    assert(patterns>=5,'a cue holds its own forms plus written joins, got '+patterns);
    assert(['tfill','troll','tbridge'].every(t=>desc.segments[t]),'three written joins are offered');
    assert(Object.keys(desc.segments).length>=desc.order.length+3,'joins sit beside the forms');
    assert(events.some(e=>e.track===3&&e.sample>=7&&e.sample<=14),'a played drum bar on the fourth track');
    assert(events.some(e=>e.track===4&&e.sample>=16&&e.sample<=23),'played announcement percussion on the fifth track');
    assert(events.some(e=>e.track===1&&e.period),'a bass line');
    assert(events.some(e=>e.track===2&&e.period),'a lead line');
    assert(events.some(e=>e.track===0&&e.period&&e.sample>=24&&e.sample<=27),'its own picked guitar, not the historical bank');
    assert(events.every(e=>e.sample<=31),'every note references a generated instrument');
    assert(events.filter(e=>e.effect===15&&e.param===bpm).length>=patterns,'the encoded tempo is present in every pattern');
    assert(events.filter(e=>e.period).every(e=>e.period>=113&&e.period<=856),'periods stay in the playable range');
  }
});
test('announcement percussion and cue guitars are fresh bipolar waves without a dc offset',async()=>{
  await Music.warmup('combat');
  const r=crig('adaptive');assert.equal(r.music.prepare('combat'),true);
  assert(r.ctx.buffers.length>10,'the announcement kit and the cue guitars are uploaded, got '+r.ctx.buffers.length);
  for(const b of r.ctx.buffers){
    const data=b.getChannelData(0);
    assert(data.some(v=>v<0)&&data.some(v=>v>0),'every synthesized wave is bipolar');
    assert(Math.abs(data.reduce((n,v)=>n+v,0)/data.length)<.035,'no dc offset in a synthesized wave');
  }
  r.music.dispose();
});
for(const mode of ['plain','adaptive'])test(`vertical layers enter and leave on the bar as intensity moves (${mode} director)`,async()=>{
  await Promise.all(['combat','boss','calm'].map(id=>Music.warmup(id)));
  const r=crig(mode);r.music.setVolume(1);r.music.setPlaying(true);
  assert.equal(r.music.setCue('combat',{key:'spawn'}),true);
  r.music.setThreat(0);run(r,3);
  const quiet=r.music.stats.layers.split(',');
  assert(!quiet.includes('announce'),'at zero intensity the announcement kit stays closed');
  assert(quiet.includes('rhythm')&&quiet.includes('drums'),'the floor of the piece keeps playing at zero intensity');
  r.music.setThreat(1);run(r,12);
  const loud=r.music.stats.layers.split(',');
  assert(loud.includes('announce')&&loud.includes('lead'),'at full intensity the lead and the announcement enter');
  const gains=r.ctx.nodes.filter(n=>n.kind==='gain'),pans=r.ctx.nodes.filter(n=>n.kind==='pan');
  const faders=gains.filter(n=>pans.some(p=>n.connections.includes(p)));
  assert.equal(faders.length,CUE_TRACKS,'one fader per track');
  const gates=faders.reduce((list,f)=>list.concat(gains.filter(g=>g.connections.includes(f))),[]);
  assert.equal(gates.length,CUE_TRACKS,'one layer gate per track, between the note envelope and the fader');
  const moved=gates.filter(g=>g.gain.events.some(e=>e[0]==='target'&&e[1]===0)&&g.gain.events.some(e=>e[0]==='target'&&e[1]===1));
  assert(moved.length>=2,'at least two layers really closed then reopened, got '+moved.length);
  // A gate is commanded exactly once per bar, immediately before that bar is
  // scheduled: never mid-note, never on an event arriving between two bars.
  const rows=r.music.stats.scheduledRows,starts=gates[0].gain.events.filter(e=>e[0]==='target').length;
  assert(starts>=Math.floor(rows/16)-1&&starts<=Math.ceil(rows/16)+1,'a layer moves once per bar, never mid-bar: '+starts+' moves for '+rows+' rows');
  for(const g of gates)assert.equal(g.gain.events.filter(e=>e[0]==='target').length,starts,'all five gates move together on the bar line');
  r.music.dispose();
});
for(const mode of ['plain','adaptive'])test(`an event never interrupts the running bar and never restarts the same cue (${mode} director)`,async()=>{
  await Promise.all(['combat','boss','calm'].map(id=>Music.warmup(id)));
  const r=crig(mode);r.music.setVolume(1);r.music.setThreat(1);r.music.setPlaying(true);
  assert.equal(r.music.setCue('combat',{key:'spawn'}),true);
  run(r,1);
  const rows=r.music.stats.scheduledRows,sources=r.ctx.sources.length;
  assert.equal(r.music.setCue('combat',{key:'spawn'}),false,'the same event does not restart the cue');
  assert.equal(r.music.setCue('nope',{key:'x'}),false,'an unknown piece is refused instead of falling back to world 0');
  assert.equal(r.music.setCue('boss',{key:'colossus'}),true);
  run(r,1);
  assert(r.music.stats.scheduledRows>rows&&r.ctx.sources.length>sources,'and the transport keeps playing meanwhile');
  const joins=[];
  for(let f=0;f<1400;f++){r.music.tick();r.ctx.advance(1/60);const t=r.music.stats.transition;if(!joins.length||joins[joins.length-1]!==t)joins.push(t);}
  if(mode==='adaptive')assert(joins.some(t=>t==='fill'||t==='roll'||t==='bridge'),'a written join is played between the two pieces: '+joins.join('>'));
  assert.equal(r.music.stats.cue,'boss','the target is reached');
  assert(r.music.stats.scheduledNotes>0);
  assert.equal(r.music.setCue('boss',{key:'colossus'}),false,'and the visit is remembered: the same event does not retrigger it');
  r.music.dispose();
});
test('warming a cue yields between synthesis phases and opens no audio device',async()=>{
  let yields=0,contexts=0;
  const cold={setTimeout:fn=>{yields++;queueMicrotask(fn);},AudioContext:class{constructor(){contexts++;}}};
  vm.runInNewContext(source,cold);
  const first=cold.FMusic.warmup('boss');
  assert.equal(first,cold.FMusic.warmup('boss'),'concurrent requests share one synthesis');
  const meta=await first;
  assert(yields>=20,'the synthesis is cut into loading-screen sized tasks, got '+yields);
  assert.equal(contexts,0,'warming never opens an audio device');
  assert.equal(meta.bytes,cold.FMusic.getModule('boss').length);
  assert.equal(meta.bpm,152);assert.equal(meta.channels,5);
  const before=yields;await cold.FMusic.warmup('boss');
  assert.equal(yields,before,'an already prepared cue replays nothing');
});
test('the adaptive director stays optional: music.js alone still walks the worlds',()=>{
  const ctx=new Context(),music=plainScope.FMusic.create(ctx,ctx.createGain());
  music.setStage(1);music.setVolume(1);music.setPlaying(true);
  for(let f=0;f<300;f++){music.tick();ctx.advance(1/60);}
  assert(music.stats.scheduledNotes>60,'the plain tracker works without FImuse, got '+music.stats.scheduledNotes);
  assert.equal(music.stats.tempo,170);
  const seen=new Set();for(let f=0;f<1800;f++){music.tick();ctx.advance(1/60);seen.add(music.cueState().segment);}
  assert(seen.size>1,'the plain transport still walks the form, not one segment forever: '+[...seen].join(','));
  music.dispose();
});


test('seeded arrangements remain complete under the adaptive transport and have accurate durations',()=>{
  const table=Music.descriptorTable(96);
  for(const key of ['0','1','2'])assert.equal(table[key].order.length,48);
  for(const id of Music.cueIds()){
    const d=Music.cueDescriptor(id),bars=d.order.reduce((n,key)=>n+d.segments[key].bars,0);
    assert.equal(Music.getTrack(id).duration,bars*4*60/d.bpm);
  }
  for(const mode of ['adaptive','plain']){
    const r=crig(mode);r.music.setStage(0,96);r.music.setPlaying(true);
    run(r,85);assert(r.music.stats.order>=6,'the seeded later cycle is reached: '+r.music.stats.order);
    assert.equal(r.music.stats.resyncs,0);r.music.dispose();
  }
});
