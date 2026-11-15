// Real browser-shell input dispatch and real simulation. DOM, renderer and
// audio devices are stubbed; these are deterministic behavior tests, not CPU benchmarks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {FRenderMesh} from './mesh-fixture.mjs';

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
    progression:{version:1,weaponSlots:5,startWeapons:[true,true,true,true,true],startAmmo:[180,36,12,16,1],ammoCaps:[180,36,12,16,1],maxActive:8}};
}

function shell({touch=false,settings={},bufferMs,requestLock,pointerLockAvailable=true}={}){
  const elements=new Map(),listeners=new Map(),documentListeners=new Map(),simulations=[],steps=[],sounds=[],errors=[],lockCalls=[];
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
      requestPointerLock(...args){lockRequests++;lockCalls.push(args);const acquire=()=>{context.document.pointerLockElement=value;emit(documentListeners,'pointerlockchange');};return requestLock?requestLock(args,acquire):acquire();}};
    if(!pointerLockAvailable&&id==='world')value.requestPointerLock=undefined;
    elements.set(id,value);return value;
  }
  const context={console:{error:(...args)=>errors.push(args)},performance:{now:()=>now},innerWidth:1280,innerHeight:800,URLSearchParams,
    setTimeout,clearTimeout,navigator:{maxTouchPoints:touch?2:0},location:{search:touch?'?touch=1':''},matchMedia:()=>({matches:false}),
    requestAnimationFrame:fn=>{nextFrame=fn;},addEventListener:(name,fn)=>on(listeners,name,fn),
    document:{body:element('body'),getElementById:element,addEventListener:(name,fn)=>on(documentListeners,name,fn),hasFocus:()=>focused,
      pointerLockElement:null,exitPointerLock(){this.pointerLockElement=null;emit(documentListeners,'pointerlockchange');}},
    localStorage:{getItem:name=>memory.get(name)??null,setItem:(name,value)=>memory.set(name,String(value)),removeItem:name=>memory.delete(name)},
    FWorld:{create:inputWorld},FAudio:{create:()=>new Proxy({},{get:(_,name)=>(...args)=>sounds.push({name,args})})},
    FRender:{create:()=>({stats:{backend:'test'},resize:noop,setWorld:noop,updateWorld:noop,draw:noop}),mesh:FRenderMesh}};
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
  return {context,element,simulations,steps,sounds,memory,lockCalls,get sim(){return simulations.at(-1);},get now(){return now;},get lockRequests(){return lockRequests;},
    frame(ms=1000/60){now+=ms;nextFrame(now);assert.deepEqual(errors,[]);},
    advance(ms){now+=ms;},
    key(code,down=true,repeat=false){emit(listeners,down?'keydown':'keyup',{code,repeat});},
    mouse(button=0,down=true){down?element('world').emit('mousedown',{button}):emit(listeners,'mouseup',{button});},
    emit:(name,event={})=>emit(listeners,name,event),
    documentEvent:(name,event={})=>emit(documentListeners,name,event),
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

test('The left-hand trigger stays a held action and is never latched as a firearm',()=>{
  const app=shell();app.element('left-hand-setting').value='1';app.element('left-hand-setting').emit('change');
  assert.equal(app.sim.state.equipment.left,1);assert.equal(app.sim.state.shield,undefined,'the left hand no longer holds a guard');
  tap(app,'key',true);app.frame(20);assert.equal(app.sim.state.shots,1,'one tap fires exactly once');assert.equal(app.sim.state.inventory.ammo[1],34,'the shotgun spends its two shells');
  app.key('KeyC');for(let i=0;i<90;i++)app.frame(20);assert(app.sim.state.shots>1,'a held trigger keeps firing');
  app.key('KeyC',false);const held=app.sim.state.shots;for(let i=0;i<90;i++)app.frame(20);assert.equal(app.sim.state.shots,held,'a released trigger never keeps firing');
});

test('Thirty small wheel events cross the threshold only once and respect the 150 ms cooldown',()=>{
  const app=shell(),before=app.sounds.filter(s=>s.name==='switchWeapon').length;
  for(let i=0;i<30;i++)app.emit('wheel',{deltaY:4,deltaMode:0});
  assert.equal(app.sounds.filter(s=>s.name==='switchWeapon').length-before,1);assert.equal(app.sim.state.weapon,0);
  app.advance(149);app.emit('wheel',{deltaY:100,deltaMode:0});assert.equal(app.sim.state.weapon,0);
  app.advance(1);app.emit('wheel',{deltaY:100,deltaMode:0});assert.equal(app.sim.state.weapon,1);
});

test('Wheel direction changes reset partial travel, line/page modes normalize and pause clears accumulation',()=>{
  const app=shell();app.emit('wheel',{deltaY:80,deltaMode:0});app.emit('wheel',{deltaY:-40,deltaMode:0});assert.equal(app.sim.state.weapon,4);
  app.emit('wheel',{deltaY:-60,deltaMode:0});assert.equal(app.sim.state.weapon,3);
  app.advance(150);app.emit('wheel',{deltaY:3,deltaMode:1});assert.equal(app.sim.state.weapon,3,'Three lines = 99 px, below threshold');app.emit('wheel',{deltaY:1,deltaMode:1});assert.equal(app.sim.state.weapon,4);
  app.advance(150);app.emit('wheel',{deltaY:1,deltaMode:2});assert.equal(app.sim.state.weapon,0);
  app.advance(150);app.emit('wheel',{deltaY:80,deltaMode:0});app.key('KeyP');app.key('KeyP',false);app.element('resume').click();app.emit('wheel',{deltaY:40,deltaMode:0});assert.equal(app.sim.state.weapon,0);
  for(const deltaY of [0,NaN,Infinity,-Infinity])app.emit('wheel',{deltaY,deltaMode:0});assert.equal(app.sim.state.weapon,0);
});

test('Pointer capture is requested in the canvas gesture and its matching mouse press never fires',()=>{
  const app=shell();app.unlock();const before=app.lockRequests;
  app.element('world').emit('pointerdown',{pointerId:5,pointerType:'mouse',button:0,clientX:700,clientY:300});
  assert.equal(app.lockRequests,before+1);assert.equal(app.context.document.pointerLockElement,app.element('world'));
  app.mouse();app.frame(30);assert.equal(app.sim.state.shots,0,'Capture may succeed synchronously before compatibility mousedown');
  app.mouse(0,false);tap(app);app.frame(20);assert.equal(app.sim.state.shots,1);
});

test('Raw mouse input is the default; the saved system-acceleration preference and reset control change the request',()=>{
  const app=shell();assert.equal(app.lockCalls.at(-1)[0]?.unadjustedMovement,true);
  app.key('KeyP');app.key('KeyP',false);app.element('pointer-acceleration-toggle').click();
  assert.equal(JSON.parse(app.memory.get('ferro-settings')).systemPointerAcceleration,true);app.element('resume').click();assert.equal(app.lockCalls.at(-1).length,0);
  const restored=shell({settings:JSON.parse(app.memory.get('ferro-settings'))});assert.equal(restored.lockCalls.at(-1).length,0);
  restored.key('KeyP');restored.key('KeyP',false);restored.element('reset-controls').click();restored.element('resume').click();assert.equal(restored.lockCalls.at(-1)[0]?.unadjustedMovement,true);
  assert.match(readFileSync(new URL('src/index.html',root),'utf8'),/id="pointer-acceleration-toggle"[^>]*>Accélération du système/);
});

test('Unsupported raw input retries exactly once without options for synchronous and promise APIs',async()=>{
  for(const promise of [false,true]){
    const unsupported=()=>Object.assign(new Error('raw unsupported'),{name:'NotSupportedError'});
    const app=shell({requestLock(args,acquire){if(args[0]?.unadjustedMovement){if(promise)return Promise.reject(unsupported());throw unsupported();}acquire();return promise?Promise.resolve():undefined;}});
    for(let i=0;i<8;i++)await Promise.resolve();
    assert.equal(app.lockCalls.length,2);assert.equal(app.lockCalls[0][0]?.unadjustedMovement,true);assert.equal(app.lockCalls[1].length,0);
    assert.equal(app.context.document.pointerLockElement,app.element('world'));
  }
});

test('A failed lock keeps drag-look usable without mouse firing and leaves touch gestures unchanged',async()=>{
  for(const available of [false,true]){
    const app=shell({pointerLockAvailable:available,requestLock(){return Promise.reject(Object.assign(new Error('denied'),{name:'NotAllowedError'}));}});
    for(let i=0;i<8;i++)await Promise.resolve();const initial=app.sim.state.player.yaw,before=app.lockRequests;
    app.element('world').emit('pointerdown',{pointerId:9,pointerType:'mouse',button:0,clientX:700,clientY:300});app.mouse();
    app.element('world').emit('pointermove',{pointerId:9,pointerType:'mouse',clientX:730,clientY:300});app.frame(20);
    for(let i=0;i<8;i++)await Promise.resolve();
    assert(app.sim.state.player.yaw>initial);assert.equal(app.sim.state.shots,0);assert.equal(app.lockRequests,before+(available?1:0));assert.match(app.element('toast').textContent,/gliss/i);
  }
  const touch=shell({touch:true});const before=touch.sim.state.player.yaw;
  touch.element('world').emit('pointerdown',{pointerId:3,pointerType:'touch',clientX:700,clientY:300});touch.element('world').emit('pointermove',{pointerId:3,pointerType:'touch',clientX:730,clientY:300});tap(touch,'touch');touch.frame(20);
  assert(touch.sim.state.player.yaw>before);assert.equal(touch.sim.state.shots,1);assert.equal(touch.lockRequests,0);
});

test('Late lock failure or success after pause cannot recapture the pointer in a menu',async()=>{
  for(const succeeds of [false,true]){
    let settle;
    const app=shell({requestLock(args,acquire){return new Promise((resolve,reject)=>{settle=()=>{if(succeeds){acquire();resolve();}else reject(Object.assign(new Error('unsupported'),{name:'NotSupportedError'}));};});}});
    app.key('KeyP');app.key('KeyP',false);settle();for(let i=0;i<8;i++)await Promise.resolve();
    assert.equal(app.element('body').dataset.state,'paused');assert.equal(app.context.document.pointerLockElement,null);assert.equal(app.lockRequests,1);
  }
});

test('Legacy pointer-lock error events give a usable fallback and cancelling capture cannot block the next click',()=>{
  const app=shell({requestLock(){}});app.documentEvent('pointerlockerror');assert.match(app.element('toast').textContent,/gliss/i);
  app.element('world').emit('pointerdown',{pointerId:8,pointerType:'mouse',button:0,clientX:700,clientY:300});
  app.emit('pointercancel',{pointerId:8,pointerType:'mouse'});const before=app.lockRequests;
  app.element('world').emit('pointerdown',{pointerId:9,pointerType:'mouse',button:0,clientX:700,clientY:300});assert.equal(app.lockRequests,before+1);
  app.context.document.pointerLockElement=app.element('world');app.documentEvent('pointerlockchange');app.mouse(0,false);
  tap(app);app.frame(20);assert.equal(app.sim.state.shots,1);
});

test('Pointer cancellation invalidates a pending raw-input retry',async()=>{
  let reject;
  const app=shell({requestLock(args,acquire){
    if(args[0]?.unadjustedMovement)return new Promise((_resolve,fail)=>{reject=fail;});
    acquire();return Promise.resolve();
  }});
  app.element('world').emit('pointerdown',{pointerId:8,pointerType:'mouse',button:0,clientX:700,clientY:300});
  const before=app.lockRequests;app.emit('pointercancel',{pointerId:8,pointerType:'mouse'});
  reject(Object.assign(new Error('raw unsupported'),{name:'NotSupportedError'}));
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(app.lockRequests,before,'A cancelled gesture must not retry without raw input');
  assert.equal(app.context.document.pointerLockElement,null);assert.equal(app.element('body').dataset.state,'playing');
});

test('Late pointer-lock success after pointer cancellation is released for promise and void APIs',async()=>{
  for(const promise of [false,true]){
    let acquireLater;
    const app=shell({requestLock(_args,acquire){
      if(promise)return new Promise(resolve=>{acquireLater=()=>{acquire();resolve();};});
      acquireLater=acquire;
    }});
    app.element('world').emit('pointerdown',{pointerId:8,pointerType:'mouse',button:0,clientX:700,clientY:300});
    app.emit('pointercancel',{pointerId:8,pointerType:'mouse'});acquireLater();
    for(let i=0;i<8;i++)await Promise.resolve();
    assert.equal(app.context.document.pointerLockElement,null,`${promise?'Promise':'Void'} success belongs to a cancelled gesture`);
    assert.equal(app.element('body').dataset.state,'playing');
    const before=app.lockRequests;
    app.element('world').emit('pointerdown',{pointerId:9,pointerType:'mouse',button:0,clientX:700,clientY:300});app.mouse();acquireLater();
    for(let i=0;i<8;i++)await Promise.resolve();
    assert.equal(app.lockRequests,before+1);assert.equal(app.context.document.pointerLockElement,app.element('world'));
    app.frame(20);assert.equal(app.sim.state.shots,0,'The fresh capture click still must not fire');
    app.mouse(0,false);tap(app);app.frame(20);assert.equal(app.sim.state.shots,1);
  }
});

test('A normal mouse release keeps an asynchronous pointer-lock request valid',async()=>{
  for(const promise of [false,true]){
    let acquireLater;
    const app=shell({requestLock(_args,acquire){
      if(promise)return new Promise(resolve=>{acquireLater=()=>{acquire();resolve();};});
      acquireLater=acquire;
    }});
    app.element('world').emit('pointerdown',{pointerId:8,pointerType:'mouse',button:0,clientX:700,clientY:300});app.mouse();
    app.emit('pointerup',{pointerId:8,pointerType:'mouse',buttons:0});app.mouse(0,false);acquireLater();
    for(let i=0;i<8;i++)await Promise.resolve();
    assert.equal(app.context.document.pointerLockElement,app.element('world'),'A release is not a cancelled gesture');
    app.frame(20);assert.equal(app.sim.state.shots,0);tap(app);app.frame(20);assert.equal(app.sim.state.shots,1);
  }
});

test('The paused image options refresh the displayed cadence after target and display changes',()=>{
  const app=shell();for(let i=0;i<90;i++)app.frame(1000/144);
  app.key('KeyP');app.key('KeyP',false);app.element('tab-image').click();
  assert.equal(app.element('body').dataset.state,'paused');
  app.element('fps-limit').value='60';app.element('fps-limit').emit('change');
  for(let i=0;i<120;i++)app.frame(1000/144);
  assert.match(app.element('fps-effective').textContent,/72 i\/s.*144 Hz/);
  app.element('fps-limit').value='30';app.element('fps-limit').emit('change');
  for(let i=0;i<120;i++)app.frame(1000/144);
  assert.match(app.element('fps-effective').textContent,/29 i\/s.*144 Hz/);
  app.element('fps-limit').value='60';app.element('fps-limit').emit('change');
  for(let i=0;i<240;i++)app.frame(1000/165);
  assert.match(app.element('fps-effective').textContent,/55 i\/s.*165 Hz/);
  assert.equal(app.element('body').dataset.state,'paused','Measuring cadence must never resume gameplay');
});
