// Banc MIX — prototype de variation musicale (< 1 Ko de source) : positions permutées, batterie et réponse
// du 3e canal variées par graine. Applique le patch à une COPIE de src/music.js (musicvar/src/music.js),
// vérifie que le module par défaut reste identique octet pour octet, et mesure la durée sans répétition.
// usage : node musicvar.mjs <racine METAL>
import {readFileSync, writeFileSync, copyFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const root = process.argv[2], here = new URL('./musicvar/', import.meta.url).pathname;
const original = readFileSync(root + '/src/music.js', 'utf8');
function patchOnce(src, from, to, tag) { const at = src.indexOf(from); if (at < 0) throw new Error('patch introuvable : ' + tag); if (src.indexOf(from, at + 1) >= 0) throw new Error('patch non unique : ' + tag); return src.slice(0, at) + to + src.slice(at + from.length); }
let s = original;
s = patchOnce(s, 'function compose(stage,samples){', 'function compose(stage,samples,seed){', 'compose');
s = patchOnce(s, "const orders=stage===0?[0,1,2,1,3,1,4,5]:stage===1?[0,1,2,1,3,4,1,5]:[0,1,2,3,1,4,2,5];", "const orders=stage===0?[0,1,2,1,3,1,4,5]:stage===1?[0,1,2,1,3,4,1,5]:[0,1,2,3,1,4,2,5],base=orders.slice();", 'orders');
s = patchOnce(s, "    return {title:song.moduleTitle,patterns,orders,samples};",
`    // Variation par graine : 5 cycles de plus (48 positions), ordre permuté, batterie et réponses variées.
    if(seed!==undefined){const rnd=random((seed|0)*7919+stage+1),pick=n=>floor((rnd()+1)*.5*n)%n;
      for(let c=1;c<6;c++){
        const o=base.slice(),i=1+pick(5),j=1+pick(5);[o[i],o[j]]=[o[j],o[i]];
        for(const b of o){
          const q=patterns[b].slice(),mute=b!==3&&!pick(3);
          for(let row=0;row<64;row++){
            const d=row*16+12,l=row*16+8,k=(q[d+2]>>4)-7;
            if(row%16===0&&q[d+1])q[d+2]=(7+(k<3?pick(3):k===6?6-4*pick(2):k)<<4)|12;
            if(mute&&(q[l]&15|q[l+1])){q[l]=q[l+1]=q[l+3]=0;q[l+2]=12;}
          }
          orders.push(patterns.push(q)-1);
        }
      }
    }
    return {title:song.moduleTitle,patterns,orders,samples};`, 'variation');
s = patchOnce(s, "function moduleFor(stage){\n    stage=stageOf(stage);if(modules.has(stage))return modules.get(stage);", "function moduleFor(stage,seed){\n    stage=stageOf(stage);const key=seed===undefined?stage:stage+'/'+seed;if(modules.has(key))return modules.get(key);", 'moduleFor');
s = patchOnce(s, "const value=decode(serialize(compose(stage,samples)));modules.set(stage,value);return value;", "const value=decode(serialize(compose(stage,samples,seed)));if(key!==stage)for(const k of modules.keys())if((k+'').startsWith(stage+'/'))modules.delete(k);modules.set(key,value);return value;", 'cache');
s = patchOnce(s, "function getModule(stage){return moduleFor(stage).bytes.slice();}", "function getModule(stage,seed){return moduleFor(stage,seed).bytes.slice();}", 'getModule');
s = patchOnce(s, "function getTrack(stage){const song=SONGS[stageOf(stage)];return {title:song.title,bpm:song.bpm,style:song.style,duration:7680/song.bpm,channels:4};}", "function getTrack(stage,seed){const song=SONGS[stageOf(stage)];return {title:song.title,bpm:song.bpm,style:song.style,duration:(seed===undefined?7680:46080)/song.bpm,channels:4};}", 'getTrack');
s = patchOnce(s, "let stage=0,threat=0,volume=.4,", "let seed,stage=0,threat=0,volume=.4,", 'state');
s = patchOnce(s, "function load(){if(module)return;module=moduleFor(stage);", "function load(){if(module)return;module=moduleFor(stage,seed);", 'load');
s = patchOnce(s, "setStage(value){const next=stageOf(value);if(disposed||next===stage)return;stopAll();stage=next;", "setStage(value,nextSeed){const next=stageOf(value);if(disposed||next===stage&&nextSeed===seed)return;stopAll();stage=next;seed=nextSeed;", 'setStage');
writeFileSync(here + 'src/music.js', s); copyFileSync(root + '/checks/music.test.mjs', here + 'checks/music.test.mjs');
const hash = b => createHash('sha256').update(b).digest('hex').slice(0, 16);
const A = {}, B = {}; vm.runInNewContext(original, A); vm.runInNewContext(s, B);
const out = {sourceBytes: {avant: Buffer.byteLength(original), apres: Buffer.byteLength(s), ajout: Buffer.byteLength(s) - Buffer.byteLength(original)}, defaut: [], varie: []};
for (let stage = 0; stage < 3; stage++) out.defaut.push({stage, identique: hash(A.FMusic.getModule(stage)) === hash(B.FMusic.getModule(stage)), sha: hash(B.FMusic.getModule(stage))});
function analyse(bytes, bpm) {
  const order = Array.from(bytes.slice(952, 952 + bytes[950])), count = Math.max(...order) + 1, ph = [];
  for (let p = 0; p < count; p++) ph.push(hash(bytes.slice(1084 + p * 1024, 1084 + (p + 1) * 1024)));
  const seq = order.map(p => ph[p]), posSeconds = 64 * 15 / bpm, loopSeconds = order.length * posSeconds;
  // première répétition exacte d'une fenêtre de n positions consécutives (dans la boucle, sans passer par le rebouclage)
  const firstRepeat = n => { const seen = new Map(); for (let i = 0; i + n <= seq.length; i++) { const k = seq.slice(i, i + n).join(); if (seen.has(k)) return {at: i, previous: seen.get(k), seconds: +(i * posSeconds).toFixed(1)}; seen.set(k, i); } return null; };
  return {positions: order.length, patterns: count, uniquePatterns: new Set(ph).size, uniquePositionsHeard: new Set(seq).size, loopSeconds: +loopSeconds.toFixed(1), moduleBytes: bytes.length, order: order.join(' '),
    repeat2: firstRepeat(2), repeat4: firstRepeat(4), repeat8: firstRepeat(8)};
}
const bpm = [100, 170, 145];
for (let stage = 0; stage < 3; stage++) out.defaut[stage].analyse = analyse(B.FMusic.getModule(stage), bpm[stage]);
for (const seed of [1, 7, 96, 2026]) for (let stage = 0; stage < 3; stage++) {
  const t0 = performance.now(), bytes = B.FMusic.getModule(stage, seed), ms = performance.now() - t0, a = analyse(bytes, bpm[stage]);
  out.varie.push({seed, stage, ms: +ms.toFixed(1), reproductible: hash(bytes) === hash(B.FMusic.getModule(stage, seed)), track: B.FMusic.getTrack(stage, seed).duration, ...a});
}
// les graines donnent des modules différents
out.graines = [0, 1, 2].map(stage => new Set([1, 7, 96, 2026, 3, 4, 5, 6].map(seed => hash(B.FMusic.getModule(stage, seed)))).size);
console.log(JSON.stringify(out, null, 1));
