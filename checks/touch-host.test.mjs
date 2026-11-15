import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const c={};vm.createContext(c);for(const m of ['touch','host','input'])vm.runInContext(readFileSync(new URL('../src/'+m+'.js',import.meta.url),'utf8'),c);
const {FTouch:T,FHost:H,FInput:I}=c;
test('pointer ownership, invalid input, cancellation and independent held actions',()=>{
 const t=T.create();for(const args of [['unknown',1,0,0],['move',NaN,0,0],['move',1,0,0,NaN]])assert.equal(t.begin(...args),false);
 assert(t.begin('move',1,50,50));assert.equal(t.begin('move',2,60,60),false);assert(t.begin('fire',2,200,50));assert.equal(t.begin('look',2,0,0),false);
 t.move(1,50,-30);let s=t.sample(1/60);assert.equal(s.moveY,1);assert(s.sprint&&s.fire);t.end(99);assert(t.sample(1/60).fire);t.end(2);assert(!t.sample(1/60).fire);assert(t.stick);t.clear();assert.equal(t.stick,null);assert(!t.sample(1/60).sprint);
});
test('floating joystick follows finger and sprint has hysteresis',()=>{
 const t=T.create();t.begin('move',1,0,0,50);t.move(1,63,0);assert(t.stick.run);t.move(1,55,0);assert(t.stick.run);t.move(1,52,0);assert(!t.stick.run);t.move(1,200,0);assert.equal(t.stick.x,120);assert.equal(t.sample(.016).moveX,1);
});
test('fire aim ignores initial tremor, sums coalesced distance once per frame',()=>{
 const t=T.create({touchAccel:0});t.begin('fire',1,100,100);t.move(1,102,100);assert.equal(t.sample(.016).lookX,0);t.move(1,110,100);t.move(1,120,100);assert.equal(t.sample(.016).lookX,.08);assert.equal(t.sample(.016).lookX,0);t.end(1);assert(!t.aiming);
 const a=T.create(),b=T.create();a.begin('look',1,0,0);b.begin('look',1,0,0);a.move(1,100,0);for(let i=1;i<=10;i++)b.move(1,i*10,0);assert.equal(a.sample(.016).lookX,b.sample(.016).lookX);
});
test('portrait world FOV preserves horizontal visibility and gyro orientation/invalid samples',()=>{
 assert.equal(T.fovFor(16/9,79),79);const v=T.fovFor(390/844,79);assert(v>79&&v<=104);assert(2*Math.atan(Math.tan(v*Math.PI/360)*390/844)*180/Math.PI>=49.999);
 const g={x:0,y:-9.81,z:0};assert.equal(T.gyroAim({alpha:0,beta:0,gamma:.5},g,0,.016).lookX,0);assert(T.gyroAim({alpha:0,beta:0,gamma:10},g,0,.016).lookX>0);assert.equal(T.gyroAim({alpha:0,beta:10,gamma:0},g,90,.016).lookY,0);assert.equal(T.gyroAim({alpha:NaN,beta:0,gamma:1},g,0,.016).lookX,0);
});
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
test('wake lock is released after delayed acquisition, re-acquired on visibility, and disposed',async()=>{
 const listeners={},dl={},leases=[];let finish;
 const w={document:{hidden:false,addEventListener:(k,f)=>dl[k]=f,removeEventListener:(k)=>delete dl[k]},addEventListener:(k,f)=>listeners[k]=f,removeEventListener:k=>delete listeners[k],navigator:{wakeLock:{request:()=>new Promise(r=>finish=r)}}};
 const h=H.create(w);h.keepAwake(true);await settle();h.keepAwake(false);let releases=0;finish({release:()=>{releases++;return Promise.resolve();}});await settle();assert.equal(releases,1);assert(!h.awake);
 w.navigator.wakeLock.request=async()=>{const x={released:0,release(){this.released++;return Promise.resolve();},addEventListener(){}};leases.push(x);return x;};h.keepAwake(true);await settle();assert(h.awake);w.document.hidden=true;dl.visibilitychange();assert.equal(leases[0].released,1);w.document.hidden=false;dl.visibilitychange();await settle();assert.equal(leases.length,2);h.dispose();assert.equal(leases[1].released,1);assert.deepEqual(dl,{});
});
test('gyro permission result cannot reactivate after user switched it off',async()=>{
 let permit,added=0;const w={isSecureContext:true,DeviceMotionEvent:{requestPermission:()=>new Promise(r=>permit=r)},addEventListener:(k)=>{if(k==='devicemotion')added++;},removeEventListener(){}};
 const h=H.create(w),pending=h.enableGyro(true);await h.enableGyro(false);permit('granted');assert.equal(await pending,false);assert.equal(added,0);assert(!h.gyro);
});
test('controller select moves one enabled option in either direction',()=>{
 c.Event=class{constructor(type){this.type=type;}};
 const el={tagName:'SELECT',value:'b',options:[{value:'a'},{value:'skip',disabled:true},{value:'b'},{value:'c'}],getClientRects:()=>[{}],dispatchEvent(){}};
 const root={querySelectorAll:()=>[el]},doc={activeElement:el};I.focusMove(root,'increase',doc);assert.equal(el.value,'c');I.focusMove(root,'decrease',doc);assert.equal(el.value,'b');I.focusMove(root,'decrease',doc);assert.equal(el.value,'a');
});
