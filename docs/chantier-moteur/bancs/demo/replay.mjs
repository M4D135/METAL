// Banc DEMO — enregistrement puis rejeu d'entrées : égalité des états, taille du flux, sources de divergence.
// usage : node replay.mjs [secondes=40] [monde=0] [sortie.json]
import {writeFileSync} from 'node:fs';import zlib from 'node:zlib';
import {runSession,REC,HZ,plausibleLoadout} from './session.mjs';
const [secArg='40',startArg='0',outFile='']=process.argv.slice(2);const minutes=+secArg/60,startIndex=+startArg,startLoadout=startIndex>0?plausibleLoadout(startIndex):null;
const base={minutes,startIndex,startLoadout,digestEvery:60,memoryEveryS:1e9};
const rec=runSession({...base,record:true});
const cmp=(a,b)=>{let at=-1;for(let i=0;i<Math.min(a.digests.length,b.digests.length);i++)if(a.digests[i]!==b.digests[i]){at=i;break;}return {identical:a.finalDigest===b.finalDigest&&at<0&&a.steps===b.steps,firstDivergenceStep:at<0?null:(at+1)*60,steps:[a.steps,b.steps]};};
const same=runSession({...base,replay:rec.record});
const again=runSession({...base,record:true});
const noCheckpoint=runSession({...base,replay:rec.record,checkpoints:false});
const noAssist=runSession({...base,replay:rec.record,assist:false});
// --- taille : brut, delta + plages, deflate
const bytes=rec.record.bytes.subarray(0,rec.steps*REC),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
function deltaRle(){
  const out=[];const varint=v=>{v=(v<<1)^(v>>31);v>>>=0;while(v>127){out.push(v&127|128);v>>>=7;}out.push(v);};
  let prev=[0,0,0,0,0,255],run=0;const flush=()=>{while(run>0){const n=Math.min(run,16384);out.push(128|(n-1)&63);out.push((n-1)>>6);run-=n;}};
  for(let i=0;i<rec.steps;i++){const o=i*REC,cur=[view.getInt8(o),view.getInt8(o+1),view.getInt16(o+2,true),view.getInt16(o+4,true),view.getUint8(o+6),view.getUint8(o+7)];
    let mask=0;for(let k=0;k<6;k++)if(cur[k]!==prev[k])mask|=1<<k;
    if(!mask){run++;continue;}flush();out.push(mask);
    if(mask&1)out.push(cur[0]&255);if(mask&2)out.push(cur[1]&255);if(mask&4)varint(cur[2]);if(mask&8)varint(cur[3]);if(mask&16)out.push(cur[4]);if(mask&32)out.push(cur[5]);prev=cur;}
  flush();return Uint8Array.from(out);
}
const d=deltaRle(),perMin=n=>Math.round(n/rec.steps*HZ*60);
// part des pas où le regard change : c'est lui qui domine le flux
let lookChanges=0,buttonChanges=0,pb=-1;for(let i=0;i<rec.steps;i++){const o=i*REC;if(view.getInt16(o+2,true)||view.getInt16(o+4,true))lookChanges++;const bt=view.getUint8(o+6);if(bt!==pb){buttonChanges++;pb=bt;}}
const result={simSeconds:rec.steps/HZ,startIndex,events:{mechanism:rec.mechanisms,core:rec.relays,checkpoints:rec.checkpointMs.length,deaths:rec.deaths,assistHp:+rec.assistHp.toFixed(1)},
  replaySameSettings:cmp(rec,same),secondRecording:cmp(rec,again),replayWithoutCheckpointCalls:cmp(rec,noCheckpoint),replayWithoutAssist:cmp(rec,noAssist),
  sizeBytesPerMinute:{raw8:perMin(bytes.length),deltaRle:perMin(d.length),rawDeflate:perMin(zlib.deflateRawSync(bytes,{level:6}).length),deltaRleDeflate:perMin(zlib.deflateRawSync(d,{level:6}).length)},
  bytesPerStep:{raw:REC,deltaRle:+(d.length/rec.steps).toFixed(2)},stepsWithLookChange:+(lookChanges/rec.steps).toFixed(3),buttonTransitions:buttonChanges,finalDigest:rec.finalDigest.toString(16)};
console.log(JSON.stringify(result,null,1));if(outFile)writeFileSync(outFile,JSON.stringify(result,null,1));
