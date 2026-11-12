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
  assert.equal(v.aiAcceleration,'auto');assert.equal(options.normalize({aiAcceleration:'cpu'}).aiAcceleration,'cpu');assert.equal(options.normalize({aiAcceleration:'npu-active'}).aiAcceleration,'auto');
});
test('Rebinding changes the real input map, preserves other actions and survives JSON storage',()=>{
  const a=options.defaults(),r=options.assign(a.bindings,'interact','KeyR');assert.equal(r.ok,true);
  const stored=options.normalize(JSON.parse(JSON.stringify({...a,bindings:r.bindings})));
  assert.equal(options.matches(stored.bindings,'interact','KeyR'),true);assert.equal(options.matches(stored.bindings,'interact','KeyF'),false);
  assert.equal(options.down(stored.bindings,new Set(['KeyR']),'interact'),true);assert.equal(options.matches(stored.bindings,'pulse','KeyE'),true);
});
test('Conflicts and reserved keys never silently disable another action',()=>{
  const a=options.defaults(),original=JSON.stringify(a);
  assert.equal(options.assign(a.bindings,'interact','KeyE').conflict,'pulse');assert.equal(options.assign(a.bindings,'fire','Escape').ok,false);
  assert.equal(options.assign(a.bindings,'fire','MetaLeft').ok,false);assert.equal(options.assign(a.bindings,'sprint','ControlLeft').ok,false);assert.equal(JSON.stringify(a),original);
  const tampered={...a,bindings:{...a.bindings,fire:['KeyW']}};
  assert.equal(options.normalize(tampered).bindings.fire[0],'Enter');
});
test('Adding melee preserves an existing custom V binding and finds a free default key',()=>{
  const old=options.defaults();for(const id of ['melee','fireLeft','leftHand','weapon4'])delete old.bindings[id];old.bindings.interact=['KeyV'];old.bindings.fire=['KeyC'];
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
