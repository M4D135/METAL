import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Approved snapshot of the published 0.12.8 layout. Do not regenerate it from
// options.js during a test: changing a default must be an explicit decision.
const approved=JSON.parse(readFileSync(new URL('../config/default-controls.json',import.meta.url),'utf8'));
const plain=value=>JSON.parse(JSON.stringify(value));
const controls=p=>plain({bindingsVersion:p.bindingsVersion,bindings:p.bindings,padVersion:p.padVersion,padBindings:p.padBindings});
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const bundled=html.match(/<script\b[^>]*data-module="options\.js"[^>]*>([\s\S]*?)<\/script>/);
assert(bundled,'Standalone build must embed options.js');
const source=readFileSync(process.env.METAL_DEFAULT_CONTROLS_SOURCE||new URL('../src/options.js',import.meta.url),'utf8');

for(const [name,code] of [['source',source],['standalone',bundled[1]]]){
  const context={window:{}};vm.runInNewContext(code,context,{filename:name+'/options.js'});
  const O=context.window.FOptions;
  test(name+': all approved keyboard and gamepad defaults survive a fresh desktop or touch profile',()=>{
    for(const touch of [false,true]){
      assert.deepEqual(controls(O.defaults(touch)),approved);
      assert.deepEqual(controls(O.normalize(null,touch)),approved);
      assert.deepEqual(controls(O.normalize({},touch)),approved);
    }
    const ids=O.actions.map(a=>a.id).sort();
    assert.deepEqual(Object.keys(approved.bindings).sort(),Array.from(ids));
    assert.deepEqual(Object.keys(approved.padBindings).sort(),Array.from(ids));
    for(const map of [approved.bindings,approved.padBindings]){
      const codes=Object.values(map).flat();assert.equal(new Set(codes).size,codes.length);
    }
  });
  test(name+': R/C and both keyboard layouts are part of the approved preset',()=>{
    assert.deepEqual(approved.bindings.view,['KeyR']);
    assert.deepEqual(approved.bindings.dash,['KeyC']);
    assert.deepEqual(approved.bindings.forward,['KeyW','KeyZ','ArrowUp']);
    assert.deepEqual(approved.bindings.left,['KeyA','KeyQ']);
    const p=O.defaults();
    for(const [id,codes] of Object.entries(approved.bindings))for(const code of codes){
      const held=new Set([code]);
      assert(O.down(p.bindings,held,id),id+': '+code);
      for(const {id:other} of O.actions)if(other!==id)assert(!O.down(p.bindings,held,other),code+' also triggers '+other);
    }
  });
  test(name+': the approved preset imports and survives JSON storage without migration drift',()=>{
    const p=O.normalize(plain(approved));
    assert.deepEqual(controls(p),approved);
    assert.deepEqual(controls(O.normalize(plain(p))),approved);
  });
  test(name+': corrupt duplicate bindings recover the entire approved layout',()=>{
    const invalid=plain(approved);invalid.bindings.interact=['KeyE'];invalid.padBindings.jump=['B'];
    assert.deepEqual(controls(O.normalize(invalid)),approved);
  });
  test(name+': editing one profile never changes future defaults',()=>{
    const p=O.defaults();p.bindings.view[0]='KeyH';p.bindings.forward.length=0;p.padBindings.view[0]='Back';
    assert.deepEqual(controls(O.defaults()),approved);
    assert.deepEqual(controls(O.defaults(true)),approved);
  });
  test(name+': personal mappings remain personal until an explicit keyboard reset',()=>{
    const p=O.defaults();p.bindings.view=['KeyH'];p.bindings.interact=['KeyB'];
    p.padBindings.view=['Back'];p.padBindings.map=['R3'];p.musicVolume=.62;p.sensitivity=1.8;
    const restored=O.normalize(plain(p));
    assert.deepEqual(controls(restored),controls(p));
    const d=O.defaults();
    // Same values as the existing reset-keys handler, not a global settings reset.
    restored.bindings=d.bindings;restored.bindingsVersion=d.bindingsVersion;
    const reset=O.normalize(plain(restored));
    assert.deepEqual(plain(reset.bindings),approved.bindings);
    assert.deepEqual(plain(reset.padBindings),plain(p.padBindings));
    assert.equal(reset.musicVolume,.62);assert.equal(reset.sensitivity,1.8);
  });
}
