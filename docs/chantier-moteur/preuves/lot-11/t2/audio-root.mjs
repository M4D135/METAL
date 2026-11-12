// RESTE audio: main-thread cost of FAudio.tick()/FMusic.tick() (METAL 673d6b2 src/audio.js + src/music.js, byte-size identical to
// FERRO 248043a when last readable), main realm, counting fake Web Audio (explicit params, no Proxy on the hot path).
import {readFileSync} from 'node:fs';import vm from 'node:vm';const ROOT=process.argv[2]||process.cwd();const q=(a,p)=>{const s=Array.from(a).sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(s.length*p))];};
const C={param:0,nodes:0,buffers:0,bufferSamples:0,byKind:{}};let clock=0;
class Param{constructor(){this.value=0;}setTargetAtTime(){C.param++;return this;}setValueAtTime(){C.param++;return this;}linearRampToValueAtTime(){C.param++;return this;}exponentialRampToValueAtTime(){C.param++;return this;}cancelScheduledValues(){C.param++;return this;}cancelAndHoldAtTime(){C.param++;return this;}setValueCurveAtTime(){C.param++;return this;}}
class Node{constructor(kind){C.nodes++;C.byKind[kind]=(C.byKind[kind]||0)+1;this.kind=kind;this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.pan=new Param();this.playbackRate=new Param();this.detune=new Param();this.delayTime=new Param();this.threshold=new Param();this.knee=new Param();this.ratio=new Param();this.attack=new Param();this.release=new Param();this.onended=null;this.buffer=null;this.loop=false;}
  connect(){return this;}disconnect(){}start(){}stop(){}}
class Ctx{constructor(){this.state='running';this.sampleRate=48000;this.destination=new Node('destination');}get currentTime(){return clock;}
  createGain(){return new Node('gain');}createBiquadFilter(){return new Node('filter');}createStereoPanner(){return new Node('panner');}createDynamicsCompressor(){return new Node('compressor');}createWaveShaper(){return new Node('shaper');}createDelay(){return new Node('delay');}createOscillator(){return new Node('osc');}createBufferSource(){return new Node('source');}createConvolver(){return new Node('convolver');}
  createBuffer(ch,len,sr){C.buffers++;C.bufferSamples+=len;const data=Array.from({length:ch},()=>new Float32Array(len));return {length:len,duration:len/sr,sampleRate:sr,numberOfChannels:ch,getChannelData:i=>data[i],copyToChannel(src,i){data[i].set(src);}};}
  resume(){return Promise.resolve();}suspend(){return Promise.resolve();}close(){return Promise.resolve();}}
const win={AudioContext:Ctx,setTimeout:(f)=>{f();return 0;},clearTimeout(){}};
for(const n of ['music','audio'])vm.runInThisContext('(function(window,globalThis,setTimeout,clearTimeout,FMusic){'+readFileSync(ROOT+'/src/'+n+'.js','utf8')+'\n})',{filename:'A_'+n+'.js'})(win,win,win.setTimeout,win.clearTimeout,win.FMusic);
const audio=win.FAudio.create();
let t=performance.now();audio.start();await audio.prepare?.();const prepMs=performance.now()-t;
audio.setMuted?.(false);audio.setPlaying?.(true);audio.setMix?.({master:1,music:.6,effects:1,ambience:1});audio.setEnvironment?.({biome:'woodland',wind:1},.6);audio.setStage?.(1);
console.log('prepare (bank + music) ms',prepMs.toFixed(0),'| nodes',C.nodes,'| buffers',C.buffers,'| buffer samples',C.bufferSamples,'| stats',JSON.stringify({pcmReady:audio.stats.pcmReady,pcmBuffers:audio.stats.pcmBuffers}));
// one game frame of audio work, as game.js:702 does it
function frame(i){clock+=1/60;audio.setThreat(.3+.3*Math.sin(i/200));audio.setPressure?.(.4);audio.setSteam?.(.3+.2*Math.sin(i/50),.2,0);audio.setMachinery?.(.5,-.3,'fan',.2);audio.tick(1/60);}
for(let i=0;i<600;i++)frame(i);
const N=3600,times=new Float64Array(N);let p0=C.param,n0=C.nodes,b0=C.buffers,k0={...C.byKind};const firstNote=[];
for(let i=0;i<N;i++){const nb=C.nodes;const t0=performance.now();frame(i+600);times[i]=performance.now()-t0;if(C.nodes>nb)firstNote.push(times[i]);}
const sorted=Float64Array.from(times).sort(),quiet=[],busy=[];
console.log('audio frame (setThreat+setPressure+setSteam+setMachinery+tick), 3600 frames @60: median '+(1e3*sorted[N>>1]).toFixed(2)+' us | p10 '+(1e3*sorted[Math.floor(N*.1)]).toFixed(2)+' | p99 '+(1e3*sorted[Math.floor(N*.99)]).toFixed(2)+' | max '+(1e3*sorted[N-1]).toFixed(1)+' us');
console.log('AudioParam automation calls/frame',((C.param-p0)/N).toFixed(1),'| nodes created/s',((C.nodes-n0)/(N/60)).toFixed(1),'| buffers created during play',C.buffers-b0,'| frames that schedule notes',firstNote.length,'(median '+(firstNote.length?(1e3*q(firstNote,.5)).toFixed(1):'-')+' us, max '+(firstNote.length?(1e3*Math.max(...firstNote)).toFixed(1):'-')+' us)');
console.log('music stats',JSON.stringify(audio.stats.music||audio.musicStats?.()||{}),'| node kinds during play',JSON.stringify(Object.fromEntries(Object.entries(C.byKind).map(([k,v])=>[k,v-(k0[k]||0)]).filter(e=>e[1]))));
// stage change: lazily converted sample buffers + module build
for(const stage of [2,3,0]){const nb=C.buffers,bs=C.bufferSamples;let worst=0,sum=0;audio.setStage?.(stage);for(let i=0;i<240;i++){const t0=performance.now();frame(i);const d=performance.now()-t0;sum+=d;if(d>worst)worst=d;}console.log('stage ->',stage,'| worst frame after change ms',worst.toFixed(2),'| buffers created',C.buffers-nb,'| samples converted',C.bufferSamples-bs);}
