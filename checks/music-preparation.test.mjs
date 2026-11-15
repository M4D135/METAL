import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/music.js',import.meta.url),'utf8');
function realm(){const scope={Int8Array,Uint8Array,Float32Array,setTimeout:fn=>queueMicrotask(fn)};scope.window=scope;vm.createContext(scope);vm.runInContext(source,scope);return scope;}
const plain=q=>JSON.stringify(q,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v);
test('prepared scores adopt all PCM and seeded orders without synthesizing in the receiving realm',async()=>{
  const producer=realm(),consumer=realm();vm.runInContext('Math.sin=()=>{throw Error("unexpected synthesis on page")}',consumer);
  for(const [key,seed] of [['title',undefined],[0,96],[1,7],[2,96],...producer.FMusic.cueIds().map(k=>[k,undefined])]){
    const expected=producer.FMusic.prepared(key,seed),wire=structuredClone(expected);
    assert(consumer.FMusic.adoptPrepared(wire),String(key));await consumer.FMusic.warmup(key,seed);
    assert.equal(plain(consumer.FMusic.prepared(key,seed)),plain(expected));
    assert.deepEqual(consumer.FMusic.getModule(key,seed),producer.FMusic.getModule(key,seed));
    // Transferring a packet must never detach the producer's cached module/PCM.
    const buffers=[],walk=q=>{if(!q||typeof q!=='object')return;if(ArrayBuffer.isView(q)){if(!buffers.includes(q.buffer))buffers.push(q.buffer);}else for(const v of Object.values(q))walk(v);};walk(expected);
    structuredClone(expected,{transfer:buffers});
    assert(producer.FMusic.getModule(key,seed).length>0);assert(producer.FMusic.prepared(key,seed).score.samples[0].pcm.length>0);
  }
});
test('worker preparation is deduplicated and rejection falls back to a complete local score',async()=>{
  const producer=realm(),consumer=realm();let calls=0;
  consumer.FMusic.setPreparer(async(key,seed)=>{calls++;return structuredClone(producer.FMusic.prepared(key,seed));});
  const a=consumer.FMusic.warmup(0,96),b=consumer.FMusic.warmup(0,96);assert.equal(a,b);await a;assert.equal(calls,1);
  await consumer.FMusic.warmup(0,96);assert.equal(calls,1);
  consumer.FMusic.setPreparer(()=>{calls++;throw Error('worker unavailable');});await consumer.FMusic.warmup(2,7);assert.equal(calls,2);
  assert.deepEqual(consumer.FMusic.getModule(2,7),producer.FMusic.getModule(2,7));
  assert.equal(consumer.FMusic.adoptPrepared({key:'bogus'}),false);
  const invalid=producer.FMusic.prepared('combat');invalid.score.samples[0].pcm=new Float32Array(4);assert.equal(consumer.FMusic.adoptPrepared(invalid),false);
});
