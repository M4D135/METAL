// Real browser-shell input dispatch and real simulation. DOM, renderer and
// audio devices are stubbed; these are deterministic behavior tests, not CPU benchmarks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const modules=['destruction','economy','simulation','motion','actors','effects','soundscape','options','game'];
const sources=Object.fromEntries(modules.map(name=>[name,readFileSync(new URL(`src/${name}.js`,root),'utf8')]));
const noop=()=>{};

function inputWorld(seed,index,options){
  return {seed,stage:index%3,index,campaign:!!options?.campaign,campaignVersion:1,chapter:0,chapterTitle:'Essai',generation:6,title:'Entrées',
    spawn:{x:0,z:0,yaw:0},bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},
    walkable:[{x:0,y:0,z:0,w:40,d:40}],meshes:[],lights:[],colliders:[],enemies:[],pickups:[],hazards:[],
    rooms:[{x:0,z:0,w:40,d:40,name:'Essai',outdoor:true}],corridors:[],
    environment:{biome:'woodland',outdoorZones:[{x:0,z:0,w:40,d:40}]},
    cores:[{id:0,x:16,z:0},{id:1,x:17,z:0},{id:2,x:18,z:0}],exit:{x:19,z:0},
    progression:{version:1,weaponSlots:5,startWeapons:[true,true,true,true,true],startAmmo:[180,36,12,16,1],ammoCaps:[180,36,12,16,1],startShield:true,maxActive:8}};
}

function shell({touch=false,settings={},bufferMs}={}){
  const elements=new Map(),listeners=new Map(),documentListeners=new Map(),simulations=[],steps=[],sounds=[],errors=[];
  const memory=new Map([['ferro-settings',JSON.stringify(settings)]]);
  let now=0,nextFrame,focused=true,lockRequests=0;
  const draw=new Proxy({},{get:()=>noop});
  const on=(events,name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);};
  const emit=(events,name,event={})=>{for(const fn of events.get(name)||[])fn({type:name,preventDefault:noop,...event});};
  function element(id){
    if(elements.has(id))return elements.get(id);
    const events=new Map(),classes=new Set();
    const value={id,tagName:id==='world'?'CANVAS':'BUTTON',hidden:false,textContent:'',innerHTML:'',style:{},dataset:{},firstChild:{textContent:''},
      classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),toggle(name,on){on??=!classes.has(name);on?classes.add(name):classes.delete(name);}},
      addEventListener:(name,fn)=>on(events,name,fn),emit:(name,event={})=>emit(events,name,{target:value,...event}),
      click:()=>emit(events,'click',{target:value}),querySelector:selector=>element(id+selector),querySelectorAll:()=>[0,1,2].map(n=>element(id+n)),
      setAttribute:noop,focus:noop,setPointerCapture:noop,getContext:()=>draw,getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),
      requestPointerLock(){lockRequests++;context.document.pointerLockElement=value;emit(documentListeners,'pointerlockchange');}};
    elements.set(id,value);return value;
  }
  const context={console:{error:(...args)=>errors.push(args)},performance:{now:()=>now},innerWidth:1280,innerHeight:800,URLSearchParams,
    setTimeout,clearTimeout,navigator:{maxTouchPoints:touch?2:0},location:{search:touch?'?touch=1':''},matchMedia:()=>({matches:false}),
    requestAnimationFrame:fn=>{nextFrame=fn;},addEventListener:(name,fn)=>on(listeners,name,fn),
    document:{body:element('body'),getElementById:element,addEventListener:(name,fn)=>on(documentListeners,name,fn),hasFocus:()=>focused,
      pointerLockElement:null,exitPointerLock(){this.pointerLockElement=null;emit(documentListeners,'pointerlockchange');}},
    localStorage:{getItem:name=>memory.get(name)??null,setItem:(name,value)=>memory.set(name,String(value)),removeItem:name=>memory.delete(name)},
    FWorld:{create:inputWorld},FAudio:{create:()=>new Proxy({},{get:(_,name)=>(...args)=>sounds.push({name,args})})},
    FRender:{create:()=>({stats:{backend:'test'},resize:noop,setWorld:noop,updateWorld:noop,draw:noop})}};
  context.window=context;vm.createContext(context);
  for(const name of modules.slice(0,-1))vm.runInContext(sources[name],context,{filename:`${name}.js`});
  if(bufferMs!==undefined)context.FOptions.fireBufferMs=bufferMs;
  const create=context.FSimulation.create;
  context.FSimulation.create=(world,options)=>{
    const sim=create(world,options),step=sim.step;
    sim.step=(dt,input)=>{const entry={dt,input:{...input},before:sim.state.shots};steps.push(entry);step(dt,input);entry.after=sim.state.shots;};
    simulations.push(sim);return sim;
  };
  vm.runInContext(sources.game,context,{filename:'game.js'});assert.deepEqual(errors,[]);
  element('start').click();element('weapon-slot-4').click();
  assert.equal(element('body').dataset.state,'playing');assert.equal(simulations.at(-1).state.weapon,4);
  return {context,element,simulations,steps,sounds,get sim(){return simulations.at(-1);},get now(){return now;},get lockRequests(){return lockRequests;},
    frame(ms=1000/60){now+=ms;nextFrame(now);assert.deepEqual(errors,[]);},
    advance(ms){now+=ms;},
    key(code,down=true,repeat=false){emit(listeners,down?'keydown':'keyup',{code,repeat});},
    mouse(button=0,down=true){down?element('world').emit('mousedown',{button}):emit(listeners,'mouseup',{button});},
    emit:(name,event={})=>emit(listeners,name,event),
    blur(){focused=false;emit(listeners,'blur');},focus(){focused=true;emit(listeners,'focus');},
    visible(value){context.document.hidden=!value;emit(documentListeners,'visibilitychange');},
    unlock(){context.document.pointerLockElement=null;},
    lock(){element('world').requestPointerLock();}};
}

function tap(app,kind='mouse',left=false){
  if(kind==='mouse'){app.mouse(left?2:0);app.mouse(left?2:0,false);}
  else if(kind==='key'){const code=left?'KeyC':'Enter';app.key(code);app.key(code,false);}
  else{const button=app.element(left?'left-fire-button':'fire-button');button.emit('pointerdown',{pointerId:left?2:1,pointerType:'touch'});button.emit('pointerup',{pointerId:left?2:1,pointerType:'touch'});button.emit('lostpointercapture',{pointerId:left?2:1,pointerType:'touch'});}
}
function firstShot(app){app.key('Enter');app.frame(10);app.key('Enter',false);assert.equal(app.sim.state.shots,1);}

for(const kind of ['mouse','key','touch'])test(`A brief ${kind} press between frames fires exactly once at 20, 30, 60 and 144 Hz`,()=>{
  for(const ms of [50,1000/30,1000/60,1000/144]){
    const app=shell({touch:kind==='touch'});tap(app,kind);app.frame(ms);
    assert.equal(app.sim.state.shots,1,`${kind} tap at ${1000/ms} Hz`);
    for(let i=0;i<30;i++)app.frame(ms);
    assert.equal(app.sim.state.shots,1,'A release never becomes an automatic repeat');
  }
});

test('A latched press is sent only to the first substep; holding still drives subsequent substeps',()=>{
  const app=shell();tap(app);app.frame(120);
  assert(app.steps.length>1);assert.equal(app.steps.filter(s=>s.input.fire).length,1);assert.equal(app.sim.state.shots,1);
  app.steps.length=0;app.key('Enter');app.frame(120);assert(app.steps.every(s=>s.input.fire));app.key('Enter',false);
});

test('A brief press just before the pistol becomes ready survives the cooldown and is consumed by its shot',()=>{
  const app=shell();firstShot(app);app.frame(100);app.frame(100);app.frame(60);
  assert(app.sim.state.weaponCooldowns[4]>0&&app.sim.state.weaponCooldowns[4]<.07);
  tap(app,'key');for(let i=0;i<6;i++)app.frame(20);
  assert.equal(app.sim.state.shots,2);for(let i=0;i<20;i++)app.frame(20);assert.equal(app.sim.state.shots,2);
});

test('An expired press and key repeat cannot schedule a delayed shot; the buffer duration is configurable',()=>{
  for(const bufferMs of [150,40]){
    const app=shell({bufferMs});firstShot(app);tap(app,'key');app.frame(bufferMs-1);
    app.key('Enter',true,true);app.key('Enter',false);for(let i=0;i<30;i++)app.frame(20);
    assert.equal(app.sim.state.shots,1,`No stale/repeated press with a ${bufferMs} ms buffer`);
  }
  const short=shell({bufferMs:40});firstShot(short);short.frame(100);short.frame(100);short.frame(60);tap(short,'key');
  for(let i=0;i<10;i++)short.frame(20);assert.equal(short.sim.state.shots,1,'A 40 ms buffer does not wait 60 ms for readiness');
});

test('A right-hand shot cannot consume a buffered left-hand shot',()=>{
  const app=shell();app.element('left-hand-setting').value='0';app.element('left-hand-setting').emit('change');
  app.key('KeyC');app.frame(10);app.key('KeyC',false);assert.equal(app.sim.state.shots,1);
  tap(app,'mouse',true);tap(app,'mouse');app.frame(1000/60);assert.equal(app.sim.state.shots,2);
  for(let i=0;i<8;i++)app.frame(1000/60);
  assert.equal(app.sim.state.shots,3);assert.equal(app.sounds.filter(s=>s.name==='shot'&&s.args[0]?.hand==='left').length,2);
  for(let i=0;i<20;i++)app.frame(20);assert.equal(app.sim.state.shots,3);
});

test('Keyboard rebinding and simultaneous touch taps preserve independent hand intentions',()=>{
  const app=shell({touch:true,settings:{bindings:{fire:['KeyT'],fireLeft:['KeyG']}}});
  app.element('left-hand-setting').value='0';app.element('left-hand-setting').emit('change');
  app.key('KeyT');app.key('KeyT',false);app.key('KeyG');app.key('KeyG',false);app.frame(20);assert.equal(app.sim.state.shots,2);
  for(let i=0;i<20;i++)app.frame(20);
  tap(app,'touch');tap(app,'touch',true);app.frame(20);assert.equal(app.sim.state.shots,4);
});

test('Switching away and back cancels an earlier intention instead of firing the new equipment',()=>{
  const app=shell();firstShot(app);app.frame(100);app.frame(100);app.frame(60);tap(app,'key');
  app.element('weapon-slot-0').click();app.element('weapon-slot-4').click();for(let i=0;i<10;i++)app.frame(20);assert.equal(app.sim.state.shots,1);
  app.element('left-hand-setting').value='0';app.element('left-hand-setting').emit('change');tap(app,'key',true);
  app.element('left-hand-setting').value='1';app.element('left-hand-setting').emit('change');app.element('left-hand-setting').value='0';app.element('left-hand-setting').emit('change');
  app.frame(20);assert.equal(app.sim.state.shots,1);
});

test('Pause, focus loss, hidden tab and context loss clear unconsumed input',()=>{
  for(const reason of ['pause','blur','hidden','context']){
    const app=shell();tap(app,'key');
    if(reason==='pause'){app.key('KeyP');app.key('KeyP',false);}
    else if(reason==='blur')app.blur();else if(reason==='hidden')app.visible(false);else app.element('world').emit('webglcontextlost');
    assert.equal(app.element('body').dataset.state,'paused');app.focus();app.visible(true);app.element('resume').click();app.frame(20);
    assert.equal(app.sim.state.shots,0,reason);
  }
});

test('A mouse press without pointer lock is not a fire intention',()=>{
  const app=shell();app.unlock();app.element('world').emit('pointerdown',{pointerId:7,pointerType:'mouse',clientX:600,clientY:300});app.mouse();app.frame(20);app.mouse(0,false);
  assert.equal(app.sim.state.shots,0);app.lock();tap(app);app.frame(20);assert.equal(app.sim.state.shots,1);
});

test('Pointer cancellation clears pending fire while normal touch release preserves a tap',()=>{
  for(const reason of ['pointercancel','lostpointercapture']){
    const app=shell({touch:true});const button=app.element('fire-button');button.emit('pointerdown',{pointerId:5,pointerType:'touch'});button.emit(reason,{pointerId:5,pointerType:'touch'});app.frame(20);assert.equal(app.sim.state.shots,0,reason);
  }
  const mouse=shell();mouse.mouse();mouse.emit('pointercancel',{pointerId:2,pointerType:'mouse'});mouse.frame(20);assert.equal(mouse.sim.state.shots,0);
});

test('Shield guard remains a held action and is not latched as a firearm',()=>{
  const app=shell();app.element('left-hand-setting').value='shield';app.element('left-hand-setting').emit('change');tap(app,'key',true);app.frame(20);
  assert.equal(app.sim.state.shield.raised,false);app.key('KeyC');app.frame(20);assert.equal(app.sim.state.shield.raised,true);app.key('KeyC',false);app.frame(20);assert.equal(app.sim.state.shield.raised,false);
});
