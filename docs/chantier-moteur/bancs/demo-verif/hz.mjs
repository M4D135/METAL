// Le pilote tient-il à d'autres cadences de pas (démo en pas variable, écrans 30/120/144 Hz) ? usage : HZ=144 node hz.mjs minutes monde
import {runSession,plausibleLoadout,HZ} from './session-hz.mjs';
const [min='8',idx='0']=process.argv.slice(2);
const o=runSession({minutes:+min,startIndex:+idx,startLoadout:+idx>0?plausibleLoadout(+idx):null,record:false,memoryEveryS:1e9,wallLimitMs:240000});
console.log(JSON.stringify({HZ,minutes:+(o.steps/HZ/60).toFixed(1),won:o.worldsWon,opened:o.worlds.length,deaths:o.deaths,stalls:o.stalls,exceptions:o.exceptions.length,assistHp:+o.assistHp.toFixed(0),worlds:o.worlds.map(w=>({i:w.index+1,won:w.won,s:w.seconds,stalls:w.stalls,deaths:w.deaths})),shots:o.shots,hits:o.hits}));
