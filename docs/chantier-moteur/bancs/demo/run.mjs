// usage : node --expose-gc run.mjs [minutes=30] [mondeDépart=0] [graine=96] [assist=1] [sortie.json]
import {writeFileSync} from 'node:fs';
import {runSession,summarize,plausibleLoadout} from './session.mjs';
const [min='30',start='0',seed='96',assist='1',outFile='']=process.argv.slice(2);
const out=runSession({minutes:+min,startIndex:+start,seed:+seed,assist:assist!=='0',record:false,log:m=>console.error(m),worldCapS:+(process.env.CAP||600),stallS:+(process.env.STALL||50),checkpoints:process.env.NOCP?false:true,wallLimitMs:+(process.env.WALL||270)*1000,startLoadout:+start>0?plausibleLoadout(+start):null,memoryEveryS:+(process.env.MEM||30)});
const sum=summarize(out);sum.wallStopped=!!out.wallStopped;sum.startIndex=+start;
console.log(JSON.stringify(sum,null,1));
console.log('MONDES');for(const w of out.worlds)console.log(JSON.stringify({i:w.index+1,why:w.why,won:w.won,s:w.seconds,deaths:w.deaths,stalls:w.stalls,relays:w.relays,mech:w.mechanisms,kills:w.kills,boss:w.bossHpLeft+'/'+w.bossMaxHp,hp:w.hp,refused:w.restoresRefused,timeout:w.timeout,goal:w.lastGoal,pilot:w.pilot,stallLog:w.stallLog}));
console.log('POINTES',JSON.stringify(out.spikes.sort((a,b)=>b.ms-a.ms).slice(0,12)));
if(out.exceptions.length)console.log('EXCEPTIONS',JSON.stringify(out.exceptions.slice(0,5),null,1));
if(outFile)writeFileSync(outFile,JSON.stringify({summary:sum,worlds:out.worlds,spikes:out.spikes,exceptions:out.exceptions,memory:out.memory,events:out.events,hist:out.hist},null,1));
