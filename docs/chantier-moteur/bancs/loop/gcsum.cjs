// Résumé --trace-gc entre PLAY-START et PLAY-END : node gcsum.cjs fichier frames
const [file,frames]=process.argv.slice(2);const L=require('fs').readFileSync(file,'utf8').split('\n');
let on=false,prevAfter=null,alloc=0;const sc=[],mc=[];
for(const l of L){if(l.includes('PLAY-START')){on=true;continue;}if(l.includes('PLAY-END'))break;if(!on)continue;
  const m=l.match(/ms: (Scavenge|Mark-Compact|Minor Mark-Sweep|Mark-Sweep)[^\d]*([\d.]+) \(([\d.]+)\) -> ([\d.]+) \(([\d.]+)\) MB, pooled: [\d.]+ MB, ([\d.]+) \/ ([\d.]+) ms/);if(!m)continue;
  const before=+m[2],after=+m[4],pause=+m[6];if(prevAfter!==null)alloc+=before-prevAfter;prevAfter=after;(m[1]==='Scavenge'?sc:mc).push(pause);}
const avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-';
console.log(JSON.stringify({allocMB:+alloc.toFixed(0),perFrameKB:+(alloc*1024/frames).toFixed(0),scavenges:sc.length,scavengeAvgMs:avg(sc),scavengeMaxMs:Math.max(0,...sc),major:mc.length,majorMs:mc}));
