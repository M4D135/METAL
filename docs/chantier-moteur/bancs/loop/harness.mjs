// Harnais LOOP : exécute le VRAI src/game.js (et tous les modules, ordre de tools/build.py)
// dans node:vm avec un DOM factice, un renderer factice, un AudioContext factice et une
// horloge virtuelle. Rien n'est écrit dans le dépôt : les sondes sont injectées dans la
// copie mémoire du source de game.js.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {performance as realPerf} from 'node:perf_hooks';

export const realNow=()=>realPerf.now();
const ORDER=['renderer','world','destruction','music','audio','soundscape','economy','brain','simulation','motion','actors','effects','options','game'];
// Fonctions de niveau 2 (indentation 2) de game.js instrumentées (temps inclusif).
const PROBES=['frame','events','renderHUD','drawRadar','models','machinery','ambience','systems','saveCheckpoint','syncDestruction','load','renderShop','setMode','toast'];

export function createHarness(root,opts={}){
  const C={probes:{},calls:{},dom:{text:0,textSame:0,style:0,styleSame:0,cls:0,clsSame:0,attr:0,attrSame:0,data:0,dataSame:0,html:0,htmlBytes:0,hidden:0,hiddenSame:0,prop:0,propSame:0},
    canvas:{calls:0,sets:0,byName:{}},audio:{param:0,nodes:0,byParam:{}},storage:{set:0,lastBytes:0,maxBytes:0,ms:0},draws:[],drawCount:0,meshes:0,stepMs:[],stepCount:0};
  let virtualNow=0;
  const resetDom=()=>{for(const k in C.dom)C.dom[k]=0;C.canvas.calls=C.canvas.sets=0;C.canvas.byName={};C.audio.param=0;C.audio.nodes=0;C.audio.byParam={};};
  // ---------- DOM factice ----------
  class ClassList{constructor(){this.s=new Set();}
    add(...c){for(const x of c){if(this.s.has(x))C.dom.clsSame++;else{this.s.add(x);C.dom.cls++;}}}
    remove(...c){for(const x of c){if(!this.s.has(x))C.dom.clsSame++;else{this.s.delete(x);C.dom.cls++;}}}
    toggle(c,f){const has=this.s.has(c),want=f===undefined?!has:!!f;if(want===has)C.dom.clsSame++;else{C.dom.cls++;want?this.s.add(c):this.s.delete(c);}return want;}
    contains(c){return this.s.has(c);}}
  const recorder=(kind)=>new Proxy({},{set(t,k,v){v=String(v);if(t[k]===v)C.dom[kind+'Same']++;else{C.dom[kind]++;t[k]=v;}return true;},get(t,k){return k in t?t[k]:'';}});
  function fake2d(){const props={};return new Proxy(props,{get(t,k){if(k in t)return t[k];return (...a)=>{C.canvas.calls++;C.canvas.byName[k]=(C.canvas.byName[k]||0)+1;};},set(t,k,v){C.canvas.sets++;t[k]=v;return true;}});}
  const pending=[];
  class El{
    constructor(id){this.id=id;this._t='';this._h='';this._hid=false;this._dis=false;this.style=recorder('style');this.classList=new ClassList();this.dataset=recorder('data');this.attrs={};this.ls={};this.kids={};this.value='';this.title='';this.tabIndex=0;this.scrollTop=0;this.firstChild={textContent:''};this.clientWidth=opts.width||1280;this.clientHeight=opts.height||720;this.width=300;this.height=150;this.tagName='DIV';}
    get textContent(){return this._t;} set textContent(v){v=String(v);if(v===this._t)C.dom.textSame++;else{C.dom.text++;this._t=v;}}
    get innerHTML(){return this._h;} set innerHTML(v){C.dom.html++;C.dom.htmlBytes+=String(v).length;this._h=String(v);}
    get hidden(){return this._hid;} set hidden(v){v=!!v;if(v===this._hid)C.dom.hiddenSame++;else{C.dom.hidden++;this._hid=v;}}
    get disabled(){return this._dis;} set disabled(v){v=!!v;if(v===this._dis)C.dom.propSame++;else{C.dom.prop++;this._dis=v;}}
    setAttribute(k,v){v=String(v);if(this.attrs[k]===v)C.dom.attrSame++;else{C.dom.attr++;this.attrs[k]=v;}}
    getAttribute(k){return this.attrs[k]??null;} removeAttribute(k){delete this.attrs[k];}
    addEventListener(t,f){(this.ls[t]??=[]).push(f);} removeEventListener(){}
    dispatch(t,e={}){for(const f of this.ls[t]||[])f({preventDefault(){},stopPropagation(){},target:this,...e});}
    focus(){} blur(){} click(){this.dispatch('click');}
    querySelector(s){return this.kids[s]??=new El(this.id+'>'+s);}
    querySelectorAll(s){return this.kids['*'+s]??=[0,1,2].map(i=>new El(this.id+'>'+s+i));}
    getBoundingClientRect(){return {left:0,top:0,width:120,height:120,right:120,bottom:120};}
    setPointerCapture(){} releasePointerCapture(){}
    requestPointerLock(){doc.pointerLockElement=this;pending.push(()=>doc.dispatch('pointerlockchange'));return Promise.resolve();}
    getContext(t){return t==='2d'?(this._c2d??=fake2d()):null;}
  }
  const els=new Map();
  const doc={body:new El('body'),hidden:false,pointerLockElement:null,ls:{},
    getElementById(id){let e=els.get(id);if(!e){e=new El(id);if(id==='world')e.tagName='CANVAS';els.set(id,e);}return e;},
    addEventListener(t,f){(this.ls[t]??=[]).push(f);},removeEventListener(){},dispatch(t,e={}){for(const f of this.ls[t]||[])f({preventDefault(){},target:doc.getElementById('world'),...e});},
    exitPointerLock(){this.pointerLockElement=null;pending.push(()=>doc.dispatch('pointerlockchange'));},hasFocus(){return true;},createElement(t){return new El('new-'+t);}};
  const winLs={};
  // ---------- stockage ----------
  const store=new Map();
  const localStorage={getItem:k=>store.has(k)?store.get(k):null,removeItem:k=>store.delete(k),
    setItem(k,v){const t=realNow();v=String(v);store.set(k,v);C.storage.set++;C.storage.lastBytes=v.length;C.storage.maxBytes=Math.max(C.storage.maxBytes,v.length);C.storage.ms+=realNow()-t;}};
  // ---------- Web Audio factice ----------
  class Param{constructor(name){this.value=0;this.n=name;}
    _c(){C.audio.param++;C.audio.byParam[this.n]=(C.audio.byParam[this.n]||0)+1;return this;}
    setTargetAtTime(){return this._c();} setValueAtTime(){return this._c();} linearRampToValueAtTime(){return this._c();} exponentialRampToValueAtTime(){return this._c();}
    cancelScheduledValues(){return this._c();} cancelAndHoldAtTime(){return this._c();} setValueCurveAtTime(){return this._c();}}
  function node(kind){C.audio.nodes++;const t={kind,connect(){},disconnect(){},start(){},stop(){if(t.onended)pending.push(()=>t.onended&&t.onended());}};
    return new Proxy(t,{get(o,k){if(k in o)return o[k];if(typeof k!=='string')return undefined;const p=new Param(kind+'.'+k);o[k]=p;return p;},set(o,k,v){o[k]=v;return true;}});}
  class FakeAudioContext{constructor(){this.state='running';this.sampleRate=48000;this.destination=node('destination');}
    get currentTime(){return virtualNow/1000;}
    createGain(){return node('gain');} createBiquadFilter(){return node('filter');} createStereoPanner(){return node('panner');} createDynamicsCompressor(){return node('compressor');}
    createWaveShaper(){return node('shaper');} createDelay(){return node('delay');} createOscillator(){return node('osc');} createBufferSource(){return node('source');}
    createBuffer(ch,len,sr){const data=Array.from({length:ch},()=>new Float32Array(len));return {length:len,duration:len/sr,sampleRate:sr,numberOfChannels:ch,getChannelData:i=>data[i],copyToChannel(src,i){data[i].set(src);}};}
    resume(){this.state='running';return Promise.resolve();} suspend(){return Promise.resolve();} close(){return Promise.resolve();}}
  // ---------- contexte ----------
  const ctx={console,Math,Date,JSON,setTimeout,clearTimeout,setInterval,clearInterval,queueMicrotask,URLSearchParams,TextEncoder,TextDecoder,
    performance:{now:()=>virtualNow},document:doc,localStorage,
    navigator:{maxTouchPoints:0,userAgent:'node'},location:{search:opts.search||'',reload(){}},
    matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),
    innerWidth:opts.width||1280,innerHeight:opts.height||720,devicePixelRatio:opts.dpr||2,
    URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}},Blob:class{constructor(p){this.p=p;}},
    addEventListener(t,f){(winLs[t]??=[]).push(f);},removeEventListener(){},
    requestAnimationFrame(cb){raf.push(cb);return raf.length;},cancelAnimationFrame(){},
    AudioContext:opts.audio===false?undefined:FakeAudioContext};
  let raf=[];
  vm.createContext(ctx);ctx.window=ctx;ctx.globalThis=ctx;
  ctx.__probe=(name,fn)=>{const t=realNow();try{return fn();}finally{const d=realNow()-t;const q=C.probes[name]??={ms:0,n:0,max:0};q.ms+=d;q.n++;if(d>q.max)q.max=d;}};
  for(const n of ORDER){
    let src=readFileSync(root+'/src/'+n+'.js','utf8');
    if(n==='game'){
      for(const f of PROBES){const a='\n  function '+f+'(';if(!src.includes(a))throw new Error('probe '+f);src=src.replace(a,'\n  function '+f+'(...__a){return __probe('+JSON.stringify(f)+',()=>'+f+'__o(...__a));}\n  function '+f+'__o(');}
      // Exposition des internes pour piloter les scénarios (copie mémoire uniquement).
      const tail=src.lastIndexOf('})();');
      src=src.slice(0,tail)+'window.__game={load,start,newRun,setMode,saveCheckpoint,renderHUD,drawRadar,models,events,preparePlay,motion,leftMotion,input,keys,get sim(){return sim},get world(){return world},get mode(){return mode},get prefs(){return prefs},get stage(){return stage},get savedRun(){return savedRun},set hudWait(v){hudWait=v}};\n'+src.slice(tail);
    }
    if(n==='game'&&opts.beforeGame)opts.beforeGame(ctx,C);
    vm.runInContext(src,ctx,{filename:n+'.js'});
    if(n==='simulation'){
      const create=ctx.FSimulation.create;
      ctx.FSimulation.create=(...a)=>{const sim=create(...a),step=sim.step,snap=sim.snapshot;
        sim.step=(dt,input)=>{const t=realNow();const r=step(dt,input);const d=realNow()-t;C.stepMs.push(d);C.stepCount++;const q=C.probes['sim.step']??={ms:0,n:0,max:0};q.ms+=d;q.n++;if(d>q.max)q.max=d;C.lastStepDt=dt;return r;};
        sim.snapshot=(...b)=>ctx.__probe('sim.snapshot',()=>snap(...b));
        return sim;};
    }
    if(n==='renderer'){
      // Renderer factice : le coût GPU/pack du vrai renderer est hors de l'axe LOOP.
      ctx.FRender.create=()=>({stats:{backend:'webgl2',width:1280,height:720},resize(){},setWorld(){C.calls.setWorld=(C.calls.setWorld||0)+1;},
        updateWorld(){C.calls.updateWorld=(C.calls.updateWorld||0)+1;return true;},
        draw(camera,meshes,fx){C.drawCount++;C.meshes=meshes.length;C.lastCamera=camera;C.lastFx=fx;},
        actorFilter:(camera)=>{const yaw=camera.yaw,fx=Math.sin(yaw),fz=-Math.cos(yaw);return (x,y,z,r)=>{const dx=x-camera.pos[0],dz=z-camera.pos[2],d=Math.hypot(dx,dz);return d<r+2||(dx*fx+dz*fz)/Math.max(d,1e-6)>Math.cos(1.25)-r/Math.max(d,1);};},dispose(){}});
    }
    if(n==='soundscape'){
      const create=ctx.FSoundscape.create;ctx.FSoundscape.create=()=>{const s=create(),sample=s.sample,event=s.event;s.sample=(...a)=>ctx.__probe('soundscape.sample',()=>sample(...a));s.event=(...a)=>ctx.__probe('soundscape.event',()=>event(...a));return s;};
    }
    if(n==='effects'){
      const b=ctx.FEffects.build,l=ctx.FEffects.lights;ctx.FEffects.build=(...a)=>ctx.__probe('FEffects.build',()=>b(...a));ctx.FEffects.lights=(...a)=>ctx.__probe('FEffects.lights',()=>l(...a));
    }
    if(n==='actors'){const b=ctx.FActors.build;ctx.FActors.build=(...a)=>ctx.__probe('FActors.build',()=>b(...a));}
    if(n==='audio'){
      const create=ctx.FAudio.create;ctx.FAudio.create=()=>{const a=create();for(const k of ['tick','setMachinery','setSteam','setThreat','setPressure','setEnvironment','step'])if(typeof a[k]==='function'){const f=a[k];a[k]=(...b)=>ctx.__probe('audio.'+k,()=>f(...b));}return a;};
    }
  }
  const G=ctx.__game,canvas=doc.getElementById('world');
  function flush(){while(pending.length)pending.shift()();}
  function frame(now){virtualNow=now;flush();const q=raf;raf=[];for(const cb of q)cb(now);flush();}
  const key=(type,code,repeat=false)=>{for(const f of winLs[type]||[])f({code,repeat,metaKey:false,altKey:false,ctrlKey:false,preventDefault(){},target:{tagName:'CANVAS'}});};
  const mouse={move(dx,dy){doc.dispatch('mousemove',{movementX:dx,movementY:dy});},
    down(button=0){canvas.dispatch('mousedown',{button});canvas.dispatch('pointerdown',{button,pointerType:'mouse',pointerId:1,clientX:600,clientY:300});},
    up(button=0){for(const f of winLs.mouseup||[])f({button});for(const f of winLs.pointerup||[])f({button,pointerType:'mouse',pointerId:1,buttons:0,type:'pointerup'});}};
  async function settle(){for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));}
  // Lance une partie via le vrai bouton « start » (preparePlay complet) puis attend le mode playing.
  async function startGame(maxFrames=4000){
    doc.getElementById('start').click();
    for(let i=0;i<maxFrames&&G.mode!=='playing';i++){frame(virtualNow+16.667);await settle();}
    if(G.mode!=='playing')throw new Error('start failed, mode='+G.mode);
  }
  return {ctx,C,G,doc,canvas,frame,key,mouse,startGame,settle,resetDom,get now(){return virtualNow;},set now(v){virtualNow=v;},store};
}

export function stats(a){const s=[...a].sort((x,y)=>x-y),q=p=>s[Math.min(s.length-1,Math.floor(s.length*p))];return {n:s.length,avg:+(s.reduce((x,y)=>x+y,0)/Math.max(1,s.length)).toFixed(3),p50:+q(.5).toFixed(3),p95:+q(.95).toFixed(3),p99:+q(.99).toFixed(3),max:+(s.at(-1)||0).toFixed(2)};}
