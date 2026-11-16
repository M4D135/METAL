import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={window:{}};vm.createContext(context);vm.runInContext(readFileSync(new URL('../src/options.js',import.meta.url),'utf8'),context);
const options=context.window.FOptions;
test('System mouse acceleration is opt-in and only accepts stored booleans',()=>{
  assert.equal(options.defaults().systemPointerAcceleration,false);
  assert.equal(options.normalize({systemPointerAcceleration:true}).systemPointerAcceleration,true);
  for(const value of [false,'true',1,null,undefined])assert.equal(options.normalize({systemPointerAcceleration:value}).systemPointerAcceleration,false);
});
test('Older preferences migrate while new controls have safe bounded values',()=>{
  const v=options.normalize({muted:true,quality:'high',softMotion:false,fov:300,sensitivity:NaN,musicVolume:-2,brightness:Infinity,showFps:'false'});
  assert.equal(v.muted,true);assert.equal(v.quality,'high');assert.equal(v.softMotion,false);assert.equal(v.fov,110);assert.equal(v.sensitivity,1);assert.equal(v.musicVolume,0);assert.equal(v.brightness,1);assert.equal(v.showFps,true);assert.equal(options.defaults(true).fov,79);
  assert.equal(v.aiAcceleration,'cpu');assert.equal(options.normalize({aiAcceleration:'auto'}).aiAcceleration,'auto');assert.equal(options.normalize({aiAcceleration:'cpu'}).aiAcceleration,'cpu');assert.equal(options.normalize({aiAcceleration:'npu-active'}).aiAcceleration,'cpu');
});
test('Rebinding changes the real input map, preserves other actions and survives JSON storage',()=>{
  const a=options.defaults(),r=options.assign(a.bindings,'interact','KeyH');assert.equal(r.ok,true);
  const stored=options.normalize(JSON.parse(JSON.stringify({...a,bindings:r.bindings})));
  assert.equal(options.matches(stored.bindings,'interact','KeyH'),true);assert.equal(options.matches(stored.bindings,'interact','KeyF'),false);
  assert.equal(options.down(stored.bindings,new Set(['KeyH']),'interact'),true);assert.equal(options.matches(stored.bindings,'pulse','KeyE'),true);
});
test('Conflicts and reserved keys never silently disable another action',()=>{
  const a=options.defaults(),original=JSON.stringify(a);
  assert.equal(options.assign(a.bindings,'interact','KeyE').conflict,'pulse');assert.equal(options.assign(a.bindings,'fire','Escape').ok,false);
  assert.equal(options.assign(a.bindings,'fire','MetaLeft').ok,false);assert.equal(options.assign(a.bindings,'sprint','ControlLeft').ok,false);assert.equal(JSON.stringify(a),original);
  const tampered={...a,bindings:{...a.bindings,fire:['KeyW']}};
  assert.equal(options.normalize(tampered).bindings.fire[0],'Enter');
});
test('Adding melee preserves an existing custom V binding and finds a free default key',()=>{
  const old=options.defaults();for(const id of ['view','melee','fireLeft','leftHand','weapon4'])delete old.bindings[id];old.bindings.interact=['KeyV'];old.bindings.fire=['KeyC'];
  const v=options.normalize(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(Array.from(v.bindings.interact),['KeyV']);assert.deepEqual(Array.from(v.bindings.fire),['KeyC']);
  assert.deepEqual(Array.from(v.bindings.melee),['KeyB']);
  const r=options.assign(v.bindings,'melee','KeyH');assert.equal(r.ok,true);
  assert.equal(options.down(r.bindings,new Set(['KeyH']),'melee'),true);
});

test('campaign pistol selection migrates without stealing a customized Digit5 binding',()=>{
  const old=options.defaults();delete old.bindings.weapon5;old.bindings.interact=['Digit5'];old.bindings.fire=['KeyH'];
  const migrated=options.normalize(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(Array.from(migrated.bindings.interact),['Digit5']);
  assert.deepEqual(Array.from(migrated.bindings.fire),['KeyH']);
  assert.notEqual(migrated.bindings.weapon5[0],'Digit5');
  const codes=Object.values(migrated.bindings).flat();assert.equal(new Set(codes).size,codes.length);
  assert.equal(options.matches(migrated.bindings,'weapon5',migrated.bindings.weapon5[0]),true);
  const custom=options.assign(migrated.bindings,'weapon5','Digit6');assert.equal(custom.ok,true);
  const restored=options.normalize(JSON.parse(JSON.stringify({...migrated,bindings:custom.bindings})));
  assert.equal(options.down(restored.bindings,new Set(['Digit6']),'weapon5'),true);
  assert.equal(options.matches(restored.bindings,'interact','Digit5'),true);
  const defaultOld=options.defaults();delete defaultOld.bindings.weapon5;
  assert.equal(options.normalize(defaultOld).bindings.weapon5[0],'Digit5');
});

test('The frame gate keeps a regular whole-vsync cadence and exposes the actual rate',()=>{
  // Rates in the counter-audit, not the contradictory 48/60 fps examples in the lot sheet.
  for(const [hz,limit,expected,stride] of [[75,60,75,1],[90,60,45,2],[100,60,50,2],[120,60,60,2],[144,60,72,2],[165,60,55,3],[240,60,60,4],[75,30,25,3],[144,120,144,1]]){
    const gate=options.createFrameGate(),shown=[];let previous=0;
    for(let frame=0;frame<hz*22;frame++){
      const now=Math.round(frame*10000/hz)/10,yes=options.frameGate(gate,now,limit);
      if(frame>=hz*2&&yes)shown.push(frame);
      if(frame>=hz*2)assert(Math.abs(gate.effectiveHz-expected)<1.1);
      previous=now;
    }
    assert.equal(shown.length/20,expected,`${hz} Hz, target ${limit}`);
    assert.equal(gate.stride,stride);
    for(let i=1;i<shown.length;i++)assert.equal(shown[i]-shown[i-1],stride,'cadence varied despite stable vsync');
    assert.equal(gate.last,previous,'skipped callbacks must still update the estimator');
  }
});

test('Unlimited and near-native rates never discard a valid callback after calibration',()=>{
  for(const [hz,limit] of [[59.94,60],[60,60],[120,120],[144,0]]){
    const gate=options.createFrameGate();
    for(let frame=0;frame<1200;frame++){
      const shown=options.frameGate(gate,frame*1000/hz,limit);
      if(frame>30)assert.equal(shown,true);
    }
  }
});

test('The frame gate recalibrates on display changes, long suspension and clock restart',()=>{
  const gate=options.createFrameGate();let now=0;
  for(let i=0;i<120;i++)options.frameGate(gate,now+=1000/144,60);
  assert.equal(gate.stride,2);
  for(let i=0;i<120;i++)options.frameGate(gate,now+=1000/165,60);
  assert.equal(gate.stride,3);assert(Math.abs(gate.effectiveHz-55)<1e-8);
  assert.equal(options.frameGate(gate,now+=10000,60),true);
  assert.equal(gate.count,0);
  for(let i=0;i<60;i++)options.frameGate(gate,now+=1000/60,60);
  assert.equal(gate.stride,1);assert(Math.abs(gate.effectiveHz-60)<1e-8);
  assert.equal(options.frameGate(gate,0,60),true);
  assert.equal(gate.count,0);assert.equal(options.frameGate(gate,0,60),false);
});

test('Changing the target is immediate and malformed timestamps cannot poison the gate',()=>{
  const gate=options.createFrameGate();let now=0;
  for(let i=0;i<120;i++)options.frameGate(gate,now+=1000/120,30);
  assert.equal(gate.stride,4);
  assert.equal(options.frameGate(gate,now+=1000/120,120),true);
  assert.equal(gate.stride,1);
  const before=JSON.stringify(gate);
  assert.equal(options.frameGate(gate,NaN,120),false);assert.equal(options.frameGate(gate,Infinity,120),false);
  assert.equal(JSON.stringify(gate),before);
  assert.equal(options.frameGate(gate,now+=1000/120,0),true);
});

test('Exact half-integer ratios choose their measured divisor on the first calibration and never oscillate',()=>{
  for(const origin of [0,1e6,1e9])for(const [hz,limit,stride] of [[90,60,2],[75,30,3],[150,60,3]]){
    const gate=options.createFrameGate();let lastShown;
    for(let frame=0;frame<2000;frame++){
      const shown=options.frameGate(gate,origin+frame*1000/hz,limit);
      if(frame<6)continue;
      assert.equal(gate.stride,stride,`${hz} Hz, target ${limit}, origin ${origin}, frame ${frame}`);
      if(shown){if(lastShown!==undefined)assert.equal(frame-lastShown,stride);lastShown=frame;}
    }
  }
});

test('Small timestamp jitter around a divider boundary cannot restart the display phase',()=>{
  const jitter=[0,.03,-.02,.01,-.03,.02];
  for(const phase of [0,1,2,3,4,5])for(const quantized of [false,true])for(const [hz,limit,stride] of [[90,60,2],[75,30,3],[150,60,3]]){
    const gate=options.createFrameGate();let lastShown;
    for(let frame=0;frame<1200;frame++){
      const stamp=frame*1000/hz+jitter[(frame+phase)%jitter.length],now=quantized?Math.round(stamp*10)/10:stamp;
      const shown=options.frameGate(gate,now,limit);
      if(frame<30)continue;
      assert.equal(gate.stride,stride,`${hz} Hz, phase ${phase}, quantized ${quantized}`);
      if(shown){if(lastShown!==undefined)assert.equal(frame-lastShown,stride,'a noisy estimate reset the phase');lastShown=frame;}
    }
  }
});

test('Divider hysteresis yields to a changed display, target or suspended clock',()=>{
  const gate=options.createFrameGate();let now=0;
  const settle=(hz,limit,stride)=>{for(let i=0;i<120;i++)options.frameGate(gate,now+=1000/hz,limit);assert.equal(gate.stride,stride,`${hz} Hz, target ${limit}`);};
  settle(75,60,1);settle(90,60,2);settle(60,60,1);
  settle(60,30,2);settle(75,30,3);settle(72,30,2);settle(75,30,3);
  settle(144,60,2);settle(150,60,3);settle(144,60,2);settle(165,60,3);
  assert.equal(options.frameGate(gate,now+=10000,60),true);assert.equal(gate.count,0);
  settle(90,60,2);settle(90,30,3);
  assert.equal(options.frameGate(gate,now+=1000/90,60),true);assert.equal(gate.stride,2);
});


test('native scale and stable automatic cadence have bounded independent preferences',()=>{
  assert.equal(options.defaults().renderScale,1);assert.equal(options.defaults().fpsLimit,-1);
  for(const scale of [1,.85,.75,.66,.5])assert.equal(options.normalize({renderScale:scale}).renderScale,scale);
  for(const scale of [0,NaN,Infinity,.2,2,'0.5'])assert.equal(options.normalize({renderScale:scale}).renderScale,1);
  assert.equal(options.normalize({fpsLimit:144}).fpsLimit,144);assert.equal(options.normalize({fpsLimit:0}).fpsLimit,0);
  assert.equal(options.cadenceChoice(10,60),60);assert.equal(options.cadenceChoice(12,60),30);
  assert.equal(options.cadenceChoice(10,30),30);assert.equal(options.cadenceChoice(8,30),60);assert.equal(options.cadenceChoice(undefined),30);
});

const plainPad=v=>JSON.parse(JSON.stringify(v));
test('Pad layout 2: LB runs, L3 waves, Y changes character, RB the weapon and R3 the view',()=>{
  const d=plainPad(options.defaults());
  assert.equal(d.padVersion,2);
  for(const [id,button] of Object.entries({fire:'RT',fireLeft:'LT',sprint:'LB',jump:'A',dash:'B',pulse:'L3',interact:'X',weaponNext:'RB',switchProfile:'Y',view:'R3',map:'Back',pause:'Start'}))assert.deepEqual(d.padBindings[id],[button],id);
  assert.deepEqual(d.padBindings.melee,[],'R3 now switches the view; melee stays remappable');
  assert.deepEqual(plainPad(options.normalize(d).padBindings),d.padBindings,'layout 2 is stable');
});
test('Saved layout 1 tables move only the buttons still at their former defaults',()=>{
  const old=plainPad(options.defaults());old.padVersion=1;delete old.padBindings.view;
  Object.assign(old.padBindings,{sprint:['L3'],pulse:['LB'],melee:['R3'],weaponNext:['Y'],switchProfile:['RB']});
  const moved=plainPad(options.normalize(old));
  assert.deepEqual(moved.padBindings,plainPad(options.defaults()).padBindings);assert.equal(moved.padVersion,2);
  // A personal pulse on the cross and melee on B are kept; free defaults still arrive.
  const custom=plainPad(old);Object.assign(custom.padBindings,{pulse:['Up'],weapon1:[],melee:['L3'],sprint:[]});
  const kept=plainPad(options.normalize(custom)).padBindings;
  assert.deepEqual(kept.pulse,['Up']);assert.deepEqual(kept.melee,['L3']);assert.deepEqual(kept.sprint,[],'a cleared action stays cleared');
  assert.deepEqual(kept.switchProfile,['Y']);assert.deepEqual(kept.weaponNext,['RB']);assert.deepEqual(kept.view,['R3']);
  const used=Object.values(kept).flat();assert.equal(new Set(used).size,used.length,'no button is assigned twice');
});
test('The game starts in first person, accepts only first or third person, and shows the controls legend by default',()=>{
  assert.equal(options.defaults().view,'first');
  assert.equal(options.normalize({view:'third'}).view,'third');
  for(const value of ['back','3',1,null])assert.equal(options.normalize({view:value}).view,'first');
  assert.equal(options.defaults().controlsHint,true);assert.equal(options.normalize({controlsHint:false}).controlsHint,false);assert.equal(options.normalize({controlsHint:'no'}).controlsHint,true);
  assert.deepEqual(plainPad(options.defaults().bindings.view),['KeyC']);
});
test('Music is quieter by default and the former default level migrates once; chosen levels stay',()=>{
  const d=options.defaults();assert.equal(d.musicVolume,.25);assert.equal(d.effectsVolume,1);assert.equal(d.mixVersion,2);
  assert.equal(options.normalize({musicVolume:.45}).musicVolume,.25,'old default moves to the new one');
  assert.equal(options.normalize({musicVolume:.6}).musicVolume,.6,'a personal level stays');
  assert.equal(options.normalize({musicVolume:.45,mixVersion:2}).musicVolume,.45,'a level chosen after the change stays');
  const saved={musicVolume:.45};options.normalize(saved);assert.equal(saved.musicVolume,.45,'the stored object is not modified');
});
