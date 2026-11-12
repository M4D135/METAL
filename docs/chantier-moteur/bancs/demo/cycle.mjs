// Banc DEMO — rotation des mondes : le tas revient-il au même palier quand on rouvre le même monde ?
// usage : node --expose-gc cycle.mjs [cycles=5] [pasParMonde=900]
import {runSession,W,HZ} from './session.mjs';
const cycles=+(process.argv[2]||5),steps=+(process.argv[3]||900);
const rows=[];
for(let c=0;c<cycles;c++)for(const index of [0,1,2]){
  const out=runSession({minutes:steps/HZ/60,startIndex:index,record:false,memoryEveryS:1e9,sampleDigest:false});
  globalThis.gc();globalThis.gc();const m=process.memoryUsage();
  rows.push({cycle:c,index,heapMB:+(m.heapUsed/1048576).toFixed(2),abMB:+(m.arrayBuffers/1048576).toFixed(2),rssMB:+(m.rss/1048576).toFixed(0),digest:out.finalDigest.toString(16),exceptions:out.exceptions.length});
}
console.log(JSON.stringify(rows));
const first=rows.filter(r=>r.cycle===1),last=rows.filter(r=>r.cycle===cycles-1);
console.log('palier après fermeture (cycle 1 → dernier), Mo :',first.map(r=>r.heapMB).join(' / '),'→',last.map(r=>r.heapMB).join(' / '),'| digests stables :',[0,1,2].every(i=>new Set(rows.filter(r=>r.index===i).map(r=>r.digest)).size===1));
