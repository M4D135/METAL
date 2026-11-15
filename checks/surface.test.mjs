import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
const scope={};scope.window=scope;vm.runInNewContext(readFileSync(new URL('../src/surface.js',import.meta.url),'utf8'),scope);const F=scope.FSurface;
test('physical dimensions use rounded edges and the observer never mutates the canvas',()=>{
 let callback,disconnects=0;const canvas={width:300,height:150,getBoundingClientRect:()=>({left:.3,right:333.6,top:.2,bottom:200.5})};
 const surface=F.create(canvas,{environment:{devicePixelRatio:1.5,ResizeObserver:class{constructor(fn){callback=fn;}observe(){}disconnect(){disconnects++;}}}});
 assert.equal(surface.size().width,500);assert.equal(surface.size().height,301);
 callback([{target:canvas,devicePixelContentBoxSize:[{inlineSize:1001,blockSize:602}]}]);assert.equal(surface.size().width,1001);assert.equal(canvas.width,300);
 surface.record(1001,602);assert.equal(surface.stats.changes,0);surface.record(1001,602);assert.equal(surface.stats.changes,0);
 surface.setScale(.5);assert.equal(surface.size().width,500);surface.record(500,301);assert.equal(surface.stats.changes,1);surface.dispose();assert.equal(disconnects,1);
});
test('pixel and device limits are explicit without a hidden floor that can exceed them',()=>{
 const canvas={clientWidth:7680,clientHeight:4320},surface=F.create(canvas,{environment:{devicePixelRatio:2},maxPixels:8847360});
 const a=surface.size();assert(a.width*a.height<=8847360);assert.equal(surface.stats.capped,'safety');
 const limited=F.create(canvas,{environment:{devicePixelRatio:2},limit:2048});const b=limited.size();assert(b.width<=2048&&b.height<=2048);assert.equal(limited.stats.capped,'gpu');
});
test('sustained load reports once without choosing a scale or changing the target',()=>{
 const notices=[],b=F.budget({onBudget:value=>notices.push(value)});
 for(let i=0;i<2000;i++)b.update(30);assert.equal(b.stats.target,60);assert.equal(b.stats.sustained,true);assert.equal(b.stats.p95,30);assert.equal(notices.length,1);
 for(let i=0;i<300;i++)b.update(16);assert.equal(b.stats.sustained,false);
 for(let i=0;i<300;i++)b.update(30);assert.equal(notices.length,2);assert.equal(b.log.length,2);
 b.setTarget(30);for(let i=0;i<300;i++)b.update(33.3333);assert.equal(b.stats.sustained,false);
});
