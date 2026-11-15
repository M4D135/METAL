import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const c={};vm.createContext(c);vm.runInContext(readFileSync(new URL('../src/loop.js',import.meta.url),'utf8'),c);
test('render interpolation keeps live state unchanged and reuses mirrors',()=>{
 const v=c.FLoop.view({single:['body'],many:['items']}),a={x:0,y:1,z:0,yaw:3.1,baseY:0},state={body:{x:0,y:0,z:0,yaw:0},items:[a],time:0};v.capture(state);state.body.x=1;state.body.yaw=.6;a.x=1;a.yaw=-3.1;
 const out=v.render(state,.5);assert.equal(out.body.x,.5);assert.equal(out.body.yaw,.6);assert.equal(out.items[0].x,.5);assert(Math.abs(out.items[0].yaw-Math.PI)<1e-9);assert.equal(state.body.x,1);assert.equal(a.yaw,-3.1);const copy=out.items[0];assert.equal(v.render(state,.8).items[0],copy);
});
test('teleports, replacement identity and reset never interpolate from stale positions',()=>{
 const v=c.FLoop.view({single:['body'],many:['items']}),state={body:{x:0,y:0,z:0},items:[]};v.capture(state);state.body.x=4;assert.equal(v.render(state,0).body.x,4);state.body={x:8,y:0,z:0};assert.equal(v.render(state,0).body.x,8);v.capture(state);state.body.x=9;v.clear();assert.equal(v.render(state,0).body.x,9);
});
