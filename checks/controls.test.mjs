import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const files=['input','options','controls'].map(n=>readFileSync(new URL('../src/'+n+'.js',import.meta.url),'utf8'));
const plain=o=>JSON.parse(JSON.stringify(o));
function rig(stored={}){
  const pads=[];const w={navigator:{getGamepads:()=>pads},Event:class{constructor(type,opts){this.type=type;Object.assign(this,opts);}}};w.window=w;
  vm.createContext(w);for(const text of files)vm.runInContext(text,w);
  const prefs=w.FOptions.normalize(stored),c=w.MetalControls.create(prefs),make=(index=0,id='Xbox')=>({index,id,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))});
  const press=(p,n,v)=>{const j=w.FInput.PAD_BUTTONS.indexOf(n);p.buttons[j]={value:v,pressed:v>.5};};
  return {w,pads,prefs,c,make,press,tick(dt=1/60){const f=c.frame(dt),s=c.step();return {f,s};}};
}
test('MASTER tuning, first connected pad, full analog magnitude and bounded curves',()=>{
  const r=rig(),a=r.make(0),b=r.make(1,'DualSense');r.pads.push(a,b);r.press(b,'A',1);assert.equal(r.tick().s.jump,false,'second pad cannot inject actions');
  a.axes=[.07,0,.07,0];let q=r.tick();assert.equal(q.s.moveX,0);assert.equal(q.s.lookX,0);
  a.axes=[.5,0,.5,0];q=r.tick();const expected=Math.pow((.5-.07)/(.97-.07),1.3);
  assert(Math.abs(q.s.moveX-expected)<1e-12);assert(Math.abs(q.s.lookX-expected*300*Math.PI/180/60)<1e-12);
  a.axes=[1,0,0,0];q=r.tick();assert.equal(q.s.moveX,1);assert.equal(q.s.sprint,true);
  r.pads.shift();q=r.tick();assert.equal(q.s.jump,true);assert.equal(r.c.padLabel('jump'),'✕');
});
test('Analog trigger hysteresis and press fronts do not repeat while held',()=>{
  const r=rig(),p=r.make();r.pads.push(p);r.tick();
  r.press(p,'RT',.31);let q=r.tick();assert.equal(q.s.fire,true);assert(q.f.pressed.includes('fire'));
  r.press(p,'RT',.25);q=r.tick();assert.equal(q.s.fire,true);assert(!q.f.pressed.includes('fire'));
  r.press(p,'RT',.18);assert.equal(r.tick().s.fire,false);
  r.press(p,'RT',.31);assert(r.tick().f.pressed.includes('fire'));
});
test('Pause clear suppresses every held button until release, including fire and jump',()=>{
  const r=rig(),p=r.make();r.pads.push(p);r.press(p,'RT',1);r.press(p,'A',1);r.tick();r.c.clear();
  for(let i=0;i<4;i++){const q=r.tick();assert.equal(q.s.fire,false);assert.equal(q.s.jump,false);assert.equal(q.f.nav.accept,false);}
  r.press(p,'RT',0);r.press(p,'A',0);r.tick();r.press(p,'RT',1);r.press(p,'A',1);const q=r.tick();assert.equal(q.s.fire,true);assert(q.f.pressed.includes('jump'));
});
test('Pad bindings normalize idempotently and reject conflicts without stealing controls',()=>{
  const r=rig(),O=r.w.FOptions,original=plain(r.prefs);assert.equal(O.assignPad(r.prefs.padBindings,'dash','A').conflict,'jump');assert.deepEqual(plain(r.prefs),original);
  const freed=O.assignPad(r.prefs.padBindings,'jump',null);const assigned=O.assignPad(freed.bindings,'dash','A');assert.equal(assigned.ok,true);
  const stored={...r.prefs,padBindings:assigned.bindings,padVibration:.35,padDead:.11};const a=O.normalize(stored),b=O.normalize(plain(a));assert.deepEqual(plain(a),plain(b));assert.deepEqual(plain(a.padBindings.dash),['A']);assert.equal(a.padVibration,.35);
  assert.equal(O.assignPad(a.padBindings,'dash','Home').ok,false);assert.equal(O.normalize({...a,padDead:Infinity}).padDead,.07);
});
test('Old Space dodge migrates to jump without stealing a custom R binding',()=>{
  const r=rig(),old=plain(r.prefs);delete old.bindingsVersion;delete old.bindings.jump;delete old.bindings.switchProfile;delete old.bindings.weaponNext;old.bindings.dash=['Space'];old.bindings.interact=['KeyR'];
  const p=r.w.FOptions.normalize(old);assert.deepEqual(plain(p.bindings.jump),['Space']);assert.deepEqual(plain(p.bindings.interact),['KeyR']);assert.notDeepEqual(plain(p.bindings.dash),['KeyR']);assert.equal(new Set(Object.values(p.bindings).flat()).size,Object.values(p.bindings).flat().length);
});
test('Merged host and pad preserve strongest move, add look, and retain every held action',()=>{
  const r=rig(),m=r.w.MetalControls.merge;
  const a=m({moveX:1,moveY:0,lookX:.2,lookY:-.1,fire:true,jumpHeld:true},{moveX:.5,moveY:.5,lookX:.3,lookY:.2,fireLeft:true,switchProfile:true});
  assert.deepEqual(plain(a),{moveX:1,moveY:0,lookX:.5,lookY:.1,fire:true,jumpHeld:true,fireLeft:true,sprint:false,dash:false,pulse:false,melee:false,interact:false,switchProfile:true});
  assert.equal(m({moveX:0,moveY:.2},{moveX:.6,moveY:.8}).moveY,.8);
});
test('Menu focus excludes disabled, hidden ancestors and zero rectangles; range sends input',()=>{
  const r=rig(),D={activeElement:null},make=(id,extra={})=>({id,tagName:'BUTTON',disabled:false,hidden:false,getClientRects(){return this.hidden?[]:[{}];},closest(){return this.parentHidden?{}:null;},getAttribute(){return null;},focus(){D.activeElement=this;},click(){this.clicks=(this.clicks||0)+1;},...extra});
  const a=make('a'),off=make('off',{disabled:true}),hidden=make('hidden',{parentHidden:true}),zero=make('zero',{hidden:true}),range=make('range',{tagName:'INPUT',type:'range',value:'40',min:'0',max:'100',step:'5',dispatchEvent(e){this.event=e;}}),b=make('b');const root={querySelectorAll:()=>[a,off,hidden,zero,range,b]};
  const move=c=>r.w.FInput.focusMove(root,c,D);move('down');assert.equal(D.activeElement,a);move('down');assert.equal(D.activeElement,range);move('right');assert.equal(range.value,'45');assert.equal(range.event.type,'input');move('down');assert.equal(D.activeElement,b);move('accept');assert.equal(b.clicks,1);move('down');assert.equal(D.activeElement,a);move('up');assert.equal(D.activeElement,b);
});
test('Pad menu directions repeat after delay but A/B are edges only',()=>{
  const r=rig(),p=r.make();r.pads.push(p);r.tick();r.press(p,'Down',1);r.press(p,'A',1);let q=r.tick();assert.equal(q.f.nav.direction,'down');assert.equal(q.f.nav.accept,true);
  for(let i=0;i<10;i++){q=r.tick(.02);assert.equal(q.f.nav.direction,null);assert.equal(q.f.nav.accept,false);}
  let repeats=0;for(let i=0;i<20;i++)repeats+=!!r.tick(.02).f.nav.direction;assert(repeats>=1&&repeats<=3);
});
test('Rumble requires a gesture, merges pending effects, limits calls, and clears on pause',()=>{
  const r=rig(),p=r.make(),calls=[];let resets=0;p.vibrationActuator={playEffect(type,q){calls.push({type,...q});return Promise.resolve();},reset(){resets++;return Promise.resolve();}};r.pads.push(p);r.tick();
  r.c.event({name:'shot',weapon:0});r.c.flush(0,true);assert.equal(calls.length,0);
  r.press(p,'X',1);r.tick();r.c.event({name:'shot',weapon:0});r.c.event({name:'shot',weapon:1});assert.equal(r.c.flush(100,true),true);assert.equal(calls[0].strongMagnitude,.55);
  r.c.event({name:'bossDeath'});assert.equal(r.c.flush(120,true),false);assert.equal(r.c.flush(140,true),true);assert.equal(calls[1].strongMagnitude,.8);
  for(let t=141;t<240;t++){r.c.event({name:'shot',weapon:0});r.c.flush(t,true);}assert(calls.length<=4);
  r.c.clear();assert.equal(resets,1);assert.equal(r.c.flush(1000,true),false);r.c.event({name:'shot',weapon:1});r.c.flush(1040,false);assert.equal(calls.length,4);
});
test('Legacy pulse actuator, refusal and unplug are harmless; zero intensity survives reload',async()=>{
  const r=rig({padVibration:.5}),p=r.make(),calls=[];p.hapticActuators=[{pulse(v,t){calls.push([v,t]);return Promise.reject(Error('disconnected'));}}];r.pads.push(p);r.press(p,'A',1);r.tick();r.c.event({name:'profileSwitch'});r.c.flush(100,true);assert.deepEqual(calls[0],[.225,120]);r.pads.length=0;r.tick();r.c.clear();assert.deepEqual(calls[1],[0,0]);await new Promise(resolve=>setImmediate(resolve));
  const zero=rig({padVibration:0}),z=zero.make();z.vibrationActuator={playEffect(){assert.fail('disabled rumble');}};zero.pads.push(z);zero.press(z,'RT',1);zero.tick();zero.c.event({name:'shot',weapon:2});assert.equal(zero.c.flush(100,true),false);
});
